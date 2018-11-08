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
			if (user.lastMessage && user.lastMessage.member.roles.has(this.config.roles.officer)) {
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
			}
		});

		this.Client.on('messageReactionRemove', (messageReaction, user) => {
			this.deleteCheck(messageReaction, user);
		});
	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	addCheck(messageReaction, user, timeout = this.config.DEV ? (60 * 60 * 1000) : (24 * 60 * 60 * 1000)) {
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
			message.timeRunCheck = new Date(now + timeout).getTime();
			message.timeAdded = now;
			message.timeout = timeout;
			message.emojiName = messageReaction.emoji.name;
			message.emojiId = messageReaction.emoji.id;

			this.data.messages.push(message);

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				messageReaction.message.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''}scheduling this message for ReadCheck after ${helpers.getReadableTime(timeout)}.
				
${messageReaction.message.url}`);
				this.main();
			});
		} else {
			message = this.data.messages[messageIndex];

			if (message.userId === user.id) {

			}
				messageReaction.message.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''}this message has already been scheduled for ReadCheck after ${helpers.getReadableTime(message.timeout)}!
				
Time left to ReadCheck: ${helpers.getReadableTime(new Date(message.timeRunCheck - now).getTime())}

If you want to remove ReadCheck for this message, ${message.authorId !== message.userId ? `<@${message.userId}> has to ` : ''}remove <:${message.emojiName}:${message.emojiId}> reaction.
						
${messageReaction.message.url}`);
		}
	}

	deleteCheck(messageReaction, user) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageReaction.message.id);

		if (messageIndex > -1) {
			const message = this.data.messages[messageIndex];

			if (message.userId === user.id && message.emojiName === messageReaction.emoji.name) {
				this.data.messages.splice(messageIndex, 1);

				helpers.updateJSON(this.config, 'readCheck', this.data, () => {
					messageReaction.message.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''}scheduled ReadCheck of this message has been removed.

${messageReaction.message.url}`);
					this.main();
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

		const messagesToDelete = [];

		this.data.messages.forEach((message, index) => {
			const millisecondsToCheck = helpers.getMillisecondsToTime(message.timeRunCheck);

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
								slackers = new Set([...slackers].sort((a,b) => (a.displayName > b.displayName) ? 1 : ((b.displayName > a.displayName) ? -1 : 0)));
								this.sendReport(msg, slackers, message);
							}
						});
					});
			}, Math.max(millisecondsToCheck, 0)));

			if (millisecondsToCheck <= 0)
				messagesToDelete.unshift(index);
		});

		messagesToDelete.forEach(index => this.data.messages.splice(index, 1));
		helpers.updateJSON(this.config, 'readCheck', this.data);
	}

	sendReport(msg, slackers, message) {
		msg.reply(`${message.authorId !== message.userId ? `<@${message.userId}>, ` : ''}ReadCheck time! List of @mentioned people who didn't react to your message in ${helpers.getReadableTime(message.timeout)}:
		
${msg.url}

${[...slackers].map(slacker => `<@${slacker.id}>`).join('\n')}`
		);
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
