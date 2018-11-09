import helpers from '../../../helpers/helpers';

export default class ReadCheck {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.data = data;
		this.timeouts = [];

		this.listenToMessages();
		this.listenToReactions();
		this.main();
		this.cacheDiscord();
	}

	main() {
		try {
			this.scheduleChecks();
		} catch (err) {
			console.log(`${this.config.guildName}: ReadCheck main`, err);
			setTimeout(() => this.scheduleChecks(), this.config.retryTimeout);
		}
	}

	cacheDiscord() {
		const promises = [];

		promises.push(
			this.channels.bot_playground.guild.fetchMembers()
				.then((guild) => {
					if (this.config.DEV)
						console.log(`${guild.name}: ${guild.members.size} members`);
				})
		);

		this.channels.bot_playground.guild.channels.forEach((channel) => {
			if (channel.members && channel.members.has(this.Client.user.id)) {
				promises.push(
					channel.fetchMessages({limit: 100})
						.then((messages) => {
							if (this.config.DEV)
								console.log(`${this.Client.user.username} | ${channel.name}: ${messages.size} messages`);
						})
				);

				promises.push(
					channel.fetchPinnedMessages()
						.then((messages) => {
							if (this.config.DEV)
								console.log(`${this.Client.user.username} | ${channel.name}: ${messages.size} pinned messages`);
						})
				);
			}
		});

		Promise.all(promises)
			.then(() => console.log(`${this.config.guildName}: ReadCheck cacheDiscord is DONE`));
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift().toLowerCase();

			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			if (command === 'help' && msg.member.roles.has(this.config.roles.member))
				this.helpReply(msg);

			if (command !== 'readcheck') return;

			switch ((args[0] || '').toLowerCase()) {
				case '':
				case 'help':
					this.helpReply(msg);
					break;
			}
		});
	}

	listenToReactions() {
		this.Client.on('messageReactionAdd', (messageReaction, user) => {
			if (messageReaction.message.guild.members
				.get(user.id).roles
				.has(this.config.roles.officer)
			) {
				if (this.hasReaction(messageReaction, 'readCheck_1h'))
					this.addCheck(messageReaction, user, 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_6h'))
					this.addCheck(messageReaction, user, 6 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_12h'))
					this.addCheck(messageReaction, user, 12 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_24h'))
					this.addCheck(messageReaction, user, 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_48h'))
					this.addCheck(messageReaction, user, 48 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, '🔁'))
					this.toggleRepetition(messageReaction, user, true);
			}
		});

		this.Client.on('messageReactionRemove', (messageReaction, user) => {
			this.deleteCheck(messageReaction, user);

			if (this.hasReaction(messageReaction, '🔁'))
				this.toggleRepetition(messageReaction, user, false);
		});
	}

	toggleRepetition(messageReaction, user, shouldRepeat) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);
		const message = this.data.messages[messageIndex];

		if (message && message.userId === user.id) {
			message.shouldRepeat = shouldRepeat;

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				if (shouldRepeat) {
					messageReaction.message.react('🔁')
						.then(() => this.main());
				} else {
					messageReaction.message.reactions.get('🔁')
					&& messageReaction.message.reactions.get('🔁').remove()
						.then(() => this.main());
				}
			});
		}

	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	addCheck(messageReaction, user, timeout) {
		timeout = this.config.DEV ? 15000 : timeout;
		let message = {};

		if (!this.config.DEV && messageReaction.message.channel.id === this.config.channels.bot_playground) return;

		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);
		const now = new Date().getTime();

		if (messageIndex === -1) {
			// register new message
			message.channelId = messageReaction.message.channel.id;
			message.id = messageReaction.message.id;
			message.authorId = messageReaction.message.author.id;
			message.userId = user.id;
			message.timeCheck = new Date(now + timeout).getTime();
			message.timeAdded = now;
			message.timeout = timeout;
			message.emojiName = messageReaction.emoji.name;
			message.emojiId = messageReaction.emoji.id;
			message.shouldRepeat = false;

			this.data.messages.push(message);

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				messageReaction.message.react('👀')
					.then(() => this.main());
			});
		} else {
			message = this.data.messages[messageIndex];

			if (message.userId === user.id) {
				messageReaction.message.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''}__**ReadCheck is already active**__

•    Message is scheduled for ReadCheck after ${helpers.getReadableTime(message.timeout, this.config.DEV)}.

•    Time left to ReadCheck: ${helpers.getReadableTime(new Date(message.timeCheck - now).getTime(), this.config.DEV)}

•    To remove/change ReadCheck ${message.authorId !== message.userId ? `<@${message.userId}> has to ` : ''}remove existing <:${message.emojiName}:${message.emojiId}> reaction.
						
•    Jump to that message: ${messageReaction.message.url}`);
			}
		}
	}

	deleteCheck(messageReaction, user) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);

		if (messageIndex > -1) {
			const message = this.data.messages[messageIndex];

			if (message.userId === user.id && message.emojiName === messageReaction.emoji.name) {
				this.data.messages.splice(messageIndex, 1);

				helpers.updateJSON(this.config, 'readCheck', this.data, () => {
					const reactions = messageReaction.message.reactions;

					reactions.get('🔁') && reactions.get('🔁').remove();
					reactions.get('👀') && reactions.get('👀').remove()
						.then(() => this.main());
				});
			}
		}
	}

	helpReply(msg) {
		msg.reply(`__ReadCheck__ commands:
\`emoji reaction\` *- officer only*. React on a new message with one of the \`:readCheck_?h:\` emojis. You can choose from a set of different time spans: from 1 to 48 hours.
 
Once scheduled, ReadCheck will run through all people @mentioned in that message after certain time and list those who didn't react to that message with an emoji (emoji type doesn't matter).`
		);
	}

	scheduleChecks() {
		this.clearTimeouts();

		if (!this.data.messages.length) return;

		this.data.messages.forEach((message, messageIndex) => {
			const millisecondsToCheck = helpers.getMillisecondsToTime(message.timeCheck);

			if (!this.config.DEV && message.channel.id === this.config.channels.bot_playground) return;

			this.timeouts.push(setTimeout(() => {
				const channel = this.Client.channels.get(message.channelId);
				const channelUsers = new Set();
				const mentionedUsers = new Set();
				const reactingUsers = new Set();
				let pingedUsers;
				let slackers;

				channel.fetchMessage(message.id)
					.then(msg => {
						channel.members.forEach(member => {
							if (!member.user.bot)
								channelUsers.add({
									id: member.id,
									displayName: member.displayName
								});
						});

						if (msg.mentions.everyone) {
							pingedUsers = channelUsers;
						} else {
							msg.mentions.members.forEach(member => {
								mentionedUsers.add(member.id);
							});

							msg.mentions.roles.forEach(role => {
								role.members.forEach(member => {
									mentionedUsers.add(member.id);
								});
							});

							pingedUsers = new Set([...channelUsers].filter(channelUser => mentionedUsers.has(channelUser.id)));
						}

						const reactionPromises = [];

						msg.reactions.forEach(reaction => {
							reactionPromises.push(
								reaction.fetchUsers()
									.then(users => {
										users.forEach(user => reactingUsers.add(user.id));
									})
							);
						});

						Promise.all(reactionPromises).then(() => {
							slackers = new Set([...pingedUsers].filter(pingedUser => !reactingUsers.has(pingedUser.id)));
							slackers.delete(msg.author.id);

							if (slackers.size) {
								slackers = new Set([...slackers].sort((a, b) => (a.displayName > b.displayName) ? 1 : ((b.displayName > a.displayName) ? -1 : 0)));
								this.sendReport(msg, slackers, message, messageIndex);
							} else {
								this.data.messages.splice(messageIndex, 1);

								helpers.updateJSON(this.config, 'readCheck', this.data, () => {
									msg.reactions.get('👀') && msg.reactions.get('👀').remove()
										.then(() => this.main());
								});
							}
						});
					});
			}, Math.max(millisecondsToCheck, 0)));
		});
	}

	sendReport(msg, slackers, message, messageIndex) {
		message = JSON.parse(JSON.stringify(message));

		if (message.shouldRepeat) {
			this.data.messages[messageIndex].timeCheck = new Date(message.timeCheck + message.timeout).getTime();
		} else {
			this.data.messages.splice(messageIndex, 1);
		}

		helpers.updateJSON(this.config, 'readCheck', this.data, () => {
			if (!message.shouldRepeat)
				msg.reactions.get('👀') && msg.reactions.get('👀').remove();

			msg.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''} __**ReadCheck Report${message.shouldRepeat ? ` (repeats every ${helpers.getReadableTime(message.timeout, this.config.DEV)})` : ''}**__

•    ${slackers.size} ${slackers.size > 1 ? 'people' : 'person'} didn't react to message for ${helpers.getReadableTime(message.timeCheck - message.timeAdded, this.config.DEV)}:
${[...slackers].map(slacker => `      - <@${slacker.id}>`).join('\n')}

•    What is this?
      - If you see yourself above, please go to the tracked message, read it and react to it with any emoji.
      
      - Short preview of the message, so it's easier to find:
\`\`\`${msg.cleanContent.substring(0, 100).trim()}${msg.cleanContent.length > 100 ? ' (...)' : ''}\`\`\`
      - Jump to that message: ${msg.url}`
			).then(() => this.main());
		});
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
