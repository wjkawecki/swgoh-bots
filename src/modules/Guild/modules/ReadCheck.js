import helpers from '../../../helpers/helpers';

export default class ReadCheck {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.data = data;
		this.timeouts = [];

		// this.listenToMessages();
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

				default:
					if (msg.member.roles.has(this.config.roles.officer))
						this.initCheck(msg, args);
			}
		});
	}

	listenToReactions() {
		this.Client.on('messageReactionAdd', (messageReaction, user) => {
			if (user.lastMessage && user.lastMessage.member.roles.has(this.config.roles.officer)) {
				if (this.hasReaction(messageReaction, 'readCheck_1h'))
					this.registerCheck(messageReaction, 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_6h'))
					this.registerCheck(messageReaction, 6 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_12h'))
					this.registerCheck(messageReaction, 12 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_24h'))
					this.registerCheck(messageReaction, 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'readCheck_48h'))
					this.registerCheck(messageReaction, 48 * 60 * 60 * 1000);


			}
		});
	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	registerCheck(messageReaction, timeout = this.config.DEV ? (60 * 60 * 1000) : (24 * 60 * 60 * 1000)) {
		const message = {};

		if (!this.data.messages.find(message => message.id === messageReaction.message.id)) {
			// register new message
			message.channelId = messageReaction.message.channel.id;
			message.id = messageReaction.message.id;
			message.time = new Date(new Date().getTime() + timeout).getTime();
			message.timeout = timeout;

			this.data.messages.push(message);

			helpers.updateJSON(this.config, 'readCheck', this.data, () => {
				messageReaction.message.reply(`registered message for read check in ${helpers.getReadableTime(timeout)}.
				
${messageReaction.message.url}`);
				this.main();
			});
		} else {
			messageReaction.message.reply(`this message has already been scheduled for read check!`);
		}
	}

	helpReply(msg) {
		msg.reply(`__ReadCheck__ commands:
\`-readCheck start\` *- officer only*. Start ReadCheck.
\`-readCheck edit\` *- officer only*. Edit config of ReadCheck`
		);
	}

	scheduleChecks() {
		this.clearTimeouts();

		if (!this.data.messages.length) return;

		const messagesToDelete = [];

		this.data.messages.forEach((message, index) => {
			const millisecondsToCheck = helpers.getMillisecondsToTime(message.time);

			if (millisecondsToCheck > 0) {
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
							channelUsers.add(member.id);
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

							pingedUsers = new Set([...channelUsers].filter(channelUser => mentionedUsers.has(channelUser)));
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
							slackers = new Set([...pingedUsers].filter(pingedUser => !reactingUsers.has(pingedUser)));
							slackers.delete(msg.author.id);

							if (slackers.size) {
								this.sendReport(msg, slackers, message.timeout);
							}
						});
					});
				}, millisecondsToCheck));
			} else {
				messagesToDelete.unshift(index);
			}
		});

		messagesToDelete.forEach(index => this.data.messages.splice(index, 1));
		helpers.updateJSON(this.config, 'readCheck', this.data);
	}

	sendReport(msg, slackers, timeout) {
		msg.reply(`here is a list of people who didn't react to your message in ${helpers.getReadableTime(timeout)}:
		
${msg.url}

${[...slackers].map(slacker => `<@${slacker}>`).join('\n')}`
		);
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
