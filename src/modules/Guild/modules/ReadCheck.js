import helpers from '../../../helpers/helpers';

export default class ReadCheck {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.guild = Client.guilds.first();
		this.data = data;
		this.timeouts = [];

		this.listenToMessages();
		this.listenToReactions();
		this.main();
	}

	main() {
		try {
			this.scheduleChecks();
		} catch (err) {
			console.log(`${this.config.guildName}: ReadCheck main`, err);
			setTimeout(() => this.scheduleChecks(), this.config.retryTimeout);
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift().toLowerCase();

			if (msg.channel.type !== 'text') return;
			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			if (command === 'help' && msg.member.roles.has(this.config.roles.member))
				this.helpReply(msg);

			if (command === 'fetchmessage' && msg.member.roles.has(this.config.roles.member))
				this.fetchMessage(msg, args[0], args[1]);

			if (command === 'echo' && msg.member.roles.has(this.config.roles.member))
				this.sendEcho(msg, command);

			if (command === 'dm' && msg.member.roles.has(this.config.roles.member))
				this.sendDM(msg, command);

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
			if (this.guild.members.get(user.id).roles.has(this.config.roles.officer)
				|| (this.config.DEV && this.guild.members.get(user.id).user.bot)) {
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

				if (this.hasReaction(messageReaction, 'readCheck_1h'))
					this.addCheck(messageReaction, user, 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, '🔍') && this.config.DEV)
					this.addCheck(messageReaction, user, 30 * 1000);

				if (this.hasReaction(messageReaction, '🔁'))
					this.toggleRepetition(messageReaction, user, true);

				if (this.hasReaction(messageReaction, '💬'))
					this.toggleDM(messageReaction, user, true);
			}
		});

		this.Client.on('messageReactionRemove', (messageReaction, user) => {
			if (this.guild.members
				.get(user.id).roles
				.has(this.config.roles.officer)
			) {
				this.deleteCheck(messageReaction, user);

				if (this.hasReaction(messageReaction, '🔁'))
					this.toggleRepetition(messageReaction, user, false);

				if (this.hasReaction(messageReaction, '💬'))
					this.toggleRepetition(messageReaction, user, false);
			}
		});
	}

	fetchMessage(msg, messageId, channelId) {
		const channel = this.Client.channels.get(channelId || msg.channel.id);

		channel.fetchMessage(messageId)
			.then(() => msg.delete())
			.catch(err => {
				console.log(err);

				msg.react('🚫')
					.then(() => setTimeout(() => {
						msg.reactions.get('🚫') && msg.reactions.get('🚫').remove();
					}, 2000));
			});
	}

	sendEcho(msg, command) {
		msg.channel.send(msg.content.split(`${command} `).pop())
			.then(message => {
				this.config.DEV && message.react('🔍');
				setTimeout(() => {
					this.config.DEV && message.react('💬');
				}, 15000);
			});
	}

	sendDM(msg, command) {
		const user = msg.author;

		user.createDM()
			.then(channel => channel.send(msg.content.split(`${command} `).pop()));
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

	toggleDM(messageReaction, user, sendDM) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);
		const message = this.data.messages[messageIndex];

		if (message && message.userId === user.id) {
			message.sendDM = sendDM;

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				if (sendDM) {
					messageReaction.message.react('💬')
						.then(() => this.main());
				} else {
					messageReaction.message.reactions.get('💬')
					&& messageReaction.message.reactions.get('💬').remove()
						.then(() => this.main());
				}
			});
		}

	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	addCheck(messageReaction, user, timeout) {
		timeout = this.config.DEV ? 30000 : timeout;
		const reactions = messageReaction.message.reactions;
		let message = {};

		if (!this.config.DEV && messageReaction.message.channel.id === this.config.channels.bot_playground) return;

		if (reactions.get('▶') && reactions.get('▶').users.find(user => user.bot)) {
			messageReaction.message.react('🚫')
				.then(() => setTimeout(() => {
					reactions.get('🚫') && reactions.get('🚫').remove();
				}, 2000));
			return;
		}

		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);

		if (messageIndex === -1) {
			// register new message
			message.channelId = messageReaction.message.channel.id;
			message.id = messageReaction.message.id;
			message.authorId = messageReaction.message.author.id;
			message.authorUsername = messageReaction.message.author.username;
			message.userId = user.id;
			message.userUsername = user.username;
			message.timeAdded = messageReaction.message.createdTimestamp;
			message.timeCheck = new Date(message.timeAdded + timeout).getTime();
			message.timeout = timeout;
			message.emojiName = messageReaction.emoji.name;
			message.emojiId = messageReaction.emoji.id;
			message.shouldRepeat = false;
			message.sendDM = false;
			message.url = messageReaction.message.url;

			while (message.timeCheck < new Date().getTime()) {
				message.timeCheck = new Date(message.timeCheck + message.timeout).getTime();
			}

			this.data.messages.push(message);

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				messageReaction.message.react('▶')
					.then(() => this.main());
			});
		}
	}

	deleteCheck(messageReaction, user) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);

		if (messageIndex > -1) {
			const message = this.data.messages[messageIndex];

			if (this.config.DEV)
				console.log('deleteCheck', message.userId, user.id, message.emojiName, messageReaction.emoji.name);

			if (message.userId === user.id && message.emojiName === messageReaction.emoji.name) {
				this.data.messages.splice(messageIndex, 1);

				helpers.updateJSON(this.config, 'readCheck', this.data, () => {
					const reactions = messageReaction.message.reactions;

					reactions.get('🔁') && reactions.get('🔁').remove();
					reactions.get('💬') && reactions.get('💬').remove();
					reactions.get('▶') && reactions.get('▶').remove()
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

			if (!this.config.DEV && message.channelId === this.config.channels.bot_playground) return;

			this.timeouts.push(setTimeout(() => {
				const channel = this.Client.channels.get(message.channelId);
				const channelUsers = new Set();
				const mentionedUsers = new Set();
				const reactingUsers = new Set();
				let pingedUsers;
				let slackers;

				if (channel.members && channel.members.has(this.Client.user.id)) {
					console.log(`${this.config.guildName}: ReadCheck sweepMessages() - ${this.Client.sweepMessages(1)}`);

					channel.fetchMessage(message.id)
						.then(msg => {
							channel.members.forEach(member => {
								if (!member.user.bot)
									channelUsers.add({
										id: member.id,
										displayName: member.displayName
									});
							});

							if (msg && msg.mentions.everyone) {
								pingedUsers = channelUsers;
							} else {
								msg && msg.mentions.members.forEach(member => {
									mentionedUsers.add(member.id);
								});

								msg && msg.mentions.roles.forEach(role => {
									role.members.forEach(member => {
										mentionedUsers.add(member.id);
									});
								});

								pingedUsers = new Set([...channelUsers].filter(channelUser => mentionedUsers.has(channelUser.id)));
							}

							const reactionPromises = [];

							msg && msg.reactions.forEach(reaction => {
								reactionPromises.push(
									reaction.fetchUsers()
										.then(users => {
											users.forEach(user => reactingUsers.add(user.id));
										})
								);
							});

							Promise.all(reactionPromises).then(() => {
								slackers = new Set([...pingedUsers].filter(pingedUser => !reactingUsers.has(pingedUser.id)));
								slackers.delete(msg && msg.author.id);

								if (slackers.size) {
									slackers = new Set([...slackers].sort((a, b) => (a.displayName > b.displayName) ? 1 : ((b.displayName > a.displayName) ? -1 : 0)));
									this.sendReport(msg, slackers, message, messageIndex);
								} else {
									this.data.messages.splice(messageIndex, 1);

									helpers.updateJSON(this.config, 'readCheck', this.data, () => {
										msg && msg.reactions.get('🔁') && msg.reactions.get('🔁').remove();
										msg && msg.reactions.get('💬') && msg.reactions.get('💬').remove();
										msg && msg.reactions.get('▶') && msg.reactions.get('▶').remove()
											.then(() => this.main());
									});
								}
							});
						});
				}
			}, this.config.DEV ? millisecondsToCheck : Math.max(millisecondsToCheck, 2 * 60 * 1000)));
		});
	}

	sendReport(msg, slackers, message, messageIndex) {
		message = JSON.parse(JSON.stringify(message));

		const sendReply = () => {
			const channel = this.config.DEV ? this.channels.bot_playground : msg.channel;

			channel.send(`__**ReadCheck Report${message.shouldRepeat ? ` (repeats every ${helpers.getReadableTime(message.timeout, this.config.DEV)})` : ''}**__

•    ${slackers.size} ${slackers.size > 1 ? `people haven't` : `person hasn't`} reacted to the tracked message in ${helpers.getReadableTime(message.timeCheck - message.timeAdded, this.config.DEV)}:
${[...slackers].map(slacker => `      - <@${slacker.id}>`).join('\n')}

•    What is this?
      - If you see yourself above, please go to the tracked message, read it and react to it with any emoji.
      
      - Short preview of the message, so it's easier to find:
\`\`\`${msg.cleanContent.substring(0, 100).trim()}${msg.cleanContent.length > 100 ? ' (...)' : ''}\`\`\`
      - Jump to that message: ${msg.url}
${message.sendDM ? `
•    I'm sending additional DM to each person on the list.
` : ''}      
/cc ${message.authorId !== message.userId ? `<@${message.authorId}>, <@${message.userId}>` : `<@${message.authorId}>`}`, {split: true})
				.then(() => helpers.updateJSON(this.config, 'readCheck', this.data, () => this.main()));
		};

		const sendDM = () => {
			if (!message.sendDM) return;

			slackers.forEach(slacker => {
				this.guild.members.get(slacker.id).createDM()
					.then(channel => {
						channel.send(`Hello ${slacker.displayName}.

•    You haven't reacted to a tracked message in ${helpers.getReadableTime(message.timeCheck - message.timeAdded, this.config.DEV)}. Please make sure you read it and react to it with any emoji.

•    Short preview of the message, so it's easier to find:
\`\`\`${msg.cleanContent.substring(0, 100).trim()}${msg.cleanContent.length > 100 ? ' (...)' : ''}\`\`\`
•    Jump to that message: ${msg.url}`, {split: true});
					});
			});
		};

		if (message.shouldRepeat) {
			while (this.data.messages[messageIndex].timeCheck < new Date().getTime()) {
				this.data.messages[messageIndex].timeCheck = new Date(this.data.messages[messageIndex].timeCheck + message.timeout).getTime();
			}
		} else {
			this.data.messages.splice(messageIndex, 1);
		}

		helpers.updateJSON(this.config, 'readCheck', this.data, () => {
			if (!message.shouldRepeat) {
				msg.reactions.get('▶') && msg.reactions.get('▶').remove();
			}

			sendReply();
			sendDM();
		});
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
