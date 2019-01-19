import helpers from '../../../helpers/helpers';

export default class CourtOfLaw {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.guild = Client.guilds.first();
		this.data = data;
		this.timeouts = {
			court: [],
			checks: []
		};

		this.listenToMessages();
		this.listenToReactions();
		this.main();
	}

	main() {
		try {
			this.scheduleCourt();
			this.scheduleChecks();
		} catch (err) {
			console.log(`${this.config.name}: CourtOfLaw main`, err);
			setTimeout(() => {
				this.scheduleCourt();
				this.scheduleChecks();
			}, this.config.retryTimeout);
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift().toLowerCase();

			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.channel.type !== 'text') return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			if (command === 'help' && msg.member.roles.has(this.config.roles.member))
				this.helpReply(msg);

			if (command === 'fetchmessage' && msg.member.roles.has(this.config.roles.member))
				this.fetchMessage(msg, args[0], args[1]);

			if (command === 'echo' && msg.member.roles.has(this.config.roles.member))
				this.sendEcho(msg, command);

			if (command !== 'court') return;

			switch ((args[0] || '').toLowerCase()) {
				case '':
				case 'help':
					this.helpReply(msg);
					break;

				case 'remove':
				case 'delete':
					if (msg.member.roles.has(this.config.roles.officer))
						this.deleteCheckById(msg, (args[1] || '').toLowerCase());
					break;

				case 'all':
					if (msg.member.roles.has(this.config.roles.officer))
						this.printCourt(msg, 'all');
					break;

				default:
					if (msg.member.roles.has(this.config.roles.officer))
						this.printCourt(msg, (args[0] || '').toLowerCase(), (args[1] || '').toLowerCase());
			}
		});
	}

	listenToReactions() {
		this.Client.on('messageReactionAdd', (messageReaction, user) => {
			if (this.guild.members.get(user.id).roles.has(this.config.roles.officer) ||
				(this.config.DEV && this.guild.members.get(user.id).user.bot)) {
				if (this.hasReaction(messageReaction, 'courtOfLaw_1d'))
					this.addCheck(messageReaction, user, 1 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_2d'))
					this.addCheck(messageReaction, user, 2 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_3d'))
					this.addCheck(messageReaction, user, 3 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_4d'))
					this.addCheck(messageReaction, user, 4 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_5d'))
					this.addCheck(messageReaction, user, 5 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_6d'))
					this.addCheck(messageReaction, user, 6 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_7d'))
					this.addCheck(messageReaction, user, 7 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_8d'))
					this.addCheck(messageReaction, user, 8 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, 'courtOfLaw_9d'))
					this.addCheck(messageReaction, user, 9 * 24 * 60 * 60 * 1000);

				if (this.hasReaction(messageReaction, '🔍') && this.config.DEV)
					this.addCheck(messageReaction, user, 30 * 1000);
			}
		});

		this.Client.on('messageReactionRemove', (messageReaction, user) => {
			if (this.guild.members.get(user.id).roles.has(this.config.roles.officer)) {
				this.deleteCheck(messageReaction, user);
			}
		});
	}

	deleteCheckById(msg, messageId) {
		this.fetchMessage(msg, messageId, null, this.deleteCheck);
	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	fetchMessage(msg, messageId, channelId, cb) {
		const channel = this.Client.channels.get(channelId || msg.channel.id);

		channel.fetchMessage(messageId)
			.then((message) => cb ? cb.bind(this, message, message.author)() : {})
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
			.then(message => this.config.DEV && message.react('🔍'));
	}

	addCheck(messageReaction, user, timeout) {
		timeout = this.config.DEV ? 30000 : timeout;
		const reactions = messageReaction.message.reactions;
		let message = {};

		if (!this.config.DEV && messageReaction.message.channel.id === this.config.channels.bot_playground) return;

		console.log(`${this.config.name}: CourtOfLaw addCheck - by ${user.username} in ${helpers.getReadableTime(timeout)}`);

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
			message.sendDM = true;
			message.url = messageReaction.message.url;

			while (message.timeCheck < new Date().getTime()) {
				message.timeCheck = new Date(message.timeCheck + message.timeout).getTime();
			}

			this.data.messages.push(message);

			helpers.updateJSON(this.config, 'courtOfLaw', this.data, () => {
				messageReaction.message.react('▶')
					.then(() => this.main());
			});
		}
	}

	deleteCheck(messageOrMessageReaction, user) {
		const messageIndex = this.data.messages.map(message => message.id).indexOf(messageOrMessageReaction.id || messageOrMessageReaction.message.id);

		if (messageIndex > -1) {
			const message = this.data.messages[messageIndex];

			console.log(`${this.config.name}: CourtOfLaw deleteCheck - ${user.username} removed ${messageOrMessageReaction.id || message.emojiName}`);

			if (messageOrMessageReaction.id || (message.userId === user.id && message.emojiName === messageOrMessageReaction.emoji.name)) {
				this.data.messages.splice(messageIndex, 1);

				helpers.updateJSON(this.config, 'courtOfLaw', this.data, () => {
					const reactions = messageOrMessageReaction.reactions || messageOrMessageReaction.message.reactions;

					reactions.get('▶') && reactions.get('▶').remove()
						.then(() => this.main());
				});
			}
		}
	}

	helpReply(msg) {
		msg.reply(`__CourtOfLaw__ commands:
\`-court [dateFrom or keyword] [dateTo (optional)]\` *- officer only*.
\`-court remove messageID\` *- officer only*. Remove obsolete courtCheck from a message.

Examples:
\`-court this\` or \`-court current\` or \`-court currentMonth\`
\`-court last\` or \`-court previous\` or \`-court lastMonth\`
\`-court 10/1/2018\`
\`-court 10/1/2018 10/20/2018\``);
	}

	printCourt(msg, fromString, toString) {
		const now = new Date();
		let dateFrom;
		let dateTo;

		msg.react('⌛');

		if (fromString === 'all') {
			dateFrom = null;
			dateTo = null;
		} else if (fromString === 'this' ||
			fromString === 'current' ||
			fromString === 'currentmonth' ||
			fromString === 'thismonth') {
			dateFrom = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
			dateTo = null;
		} else if (fromString === 'last' ||
			fromString === 'previous' ||
			fromString === 'lastmonth' ||
			fromString === 'previousmonth') {
			dateFrom = new Date(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
			dateTo = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
		} else {
			dateFrom = new Date(fromString);
			dateTo = (toString && new Date(toString) || null);

			if (!dateFrom instanceof Date || isNaN(dateFrom)) {
				msg.reply(`\`${fromString}\` is not a valid date. Try \`currentMonth\` or \`10/25/2018\`.`);
				return;
			}

			if (toString && !dateTo instanceof Date || isNaN(dateTo)) {
				msg.reply(`\`${toString}\` is not a valid date. Try \`10/25/2018\`.`);
				return;
			}

			dateFrom = dateFrom.getTime();
			dateTo = dateTo && dateTo.getTime() || null;
		}

		this.fetchSlackers(dateFrom, dateTo)
			.then(({
				slackers,
				lastMessageTimestamp
			}) => this.printSlackers(msg, lastMessageTimestamp || dateFrom, dateTo, slackers));
	}

	fetchSlackers(timestampFrom, timestampTo, messageId) {
		this.slackers = messageId ? this.slackers : new Map();

		return new Promise(resolve => {
			const options = {
				limit: 100
			};
			const channel = this.config.DEV ?
				this.Client.channels.get(this.config.channels.court_of_law) :
				this.channels.court_of_law;

			if (messageId)
				options.before = messageId;

			channel.fetchMessages(options)
				.then(messages => {
					let reachedTimestampFrom = false;
					let messageId = '';

					messages.forEach(message => {
						const members = message.mentions && message.mentions.members;

						messageId = message.id;

						if (timestampFrom > message.createdTimestamp) {
							reachedTimestampFrom = true;
						} else {
							if (!timestampTo || timestampTo > message.createdTimestamp) {
								members.forEach(member => {
									if (member.roles.has(this.config.roles.member)) {
										if (!this.slackers.get(member.id)) {
											this.slackers.set(member.id, {
												id: member.id,
												displayName: member.displayName,
												mentionCount: 1
											});
										} else {
											const memberObj = this.slackers.get(member.id);

											this.slackers.set(member.id, Object.assign(memberObj, {
												mentionCount: memberObj.mentionCount + 1
											}));
										}
									}
								});
							}
						}
					});

					if (reachedTimestampFrom || messages.size < options.limit) {
						// sort by mentionCount and displayName
						this.slackers = new Map([...this.slackers].sort((a, b) => b[1].mentionCount - a[1].mentionCount || a[1].displayName.localeCompare(b[1].displayName)));

						resolve({
							slackers: this.slackers,
							lastMessageTimestamp: messages.size < options.limit ?
								messages.last().createdTimestamp : null
						});
					} else {
						resolve(this.fetchSlackers(timestampFrom, timestampTo, messageId));
					}
				});
		});
	}

	scheduleCourt() {
		const now = new Date();
		const nextMonthTimestamp = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 1)).getTime();
		const timeout = nextMonthTimestamp - now.getTime() + (30 * 1000);

		this.clearTimeouts('court');

		// if timeout is unreasonably big, return
		if (timeout > (2 * 24 * 60 * 60 * 1000)) return;

		this.timeouts.court.push(setTimeout(() => {
			const now = new Date();
			const dateFrom = new Date(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
			const dateTo = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime());

			this.fetchSlackers(dateFrom, dateTo)
				.then(({
					slackers
				}) => this.printSlackers(null, dateFrom, dateTo, slackers));
		}, timeout));

		console.log(`${this.config.name}: CourtOfLaw scheduled in ${helpers.getReadableTime(timeout)}`);
	}

	scheduleChecks() {
		this.clearTimeouts('checks');

		if (!this.data.messages.length) return;

		this.data.messages.forEach((message, messageIndex) => {
			const millisecondsToCheck = helpers.getMillisecondsToTime(message.timeCheck);

			if (!this.config.DEV && message.channelId === this.config.channels.bot_playground) return;

			this.timeouts.checks.push(setTimeout(() => {
				const channel = this.Client.channels.get(message.channelId);
				const channelUsers = new Set();
				const mentionedUsers = new Set();
				const reactingUsers = new Set();
				let pingedUsers;
				let slackers;

				if (channel.members && channel.members.has(this.Client.user.id)) {
					console.log(`${this.config.name}: ReadCheck sweepMessages() - ${this.Client.sweepMessages(1)}`);

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
								slackers = new Set([...pingedUsers]);
								slackers.delete(msg && msg.author.id);

								if (slackers.size) {
									slackers = new Set([...slackers].sort((a, b) => a.displayName.localeCompare(b.displayName)));
									this.sendReport(msg, slackers, message, messageIndex);
								} else {
									this.data.messages.splice(messageIndex, 1);

									helpers.updateJSON(this.config, 'courtOfLaw', this.data, () => {
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

		if (!message.sendDM) return;

		this.data.messages.splice(messageIndex, 1);

		helpers.updateJSON(this.config, 'courtOfLaw', this.data, () => {
			msg.reactions.get('▶') && msg.reactions.get('▶').remove();
			slackers.forEach(slacker => this.sendDM(false, msg, slacker, message));
			this.sendDM(true, msg, slackers, message);
		});
	}

	sendDM(toAuthor, msg, slacker, message) {
		const trimLimit = 300,
			split = true;

		this.guild.members.get(toAuthor ? message.authorId : slacker.id).createDM()
			.then(channel => {
				if (toAuthor) {
					channel.send(`Hello ${message.authorUsername}.

•    You have mentioned **${slacker.values().next().value.displayName}** in \`#court-of-law\` ${helpers.getReadableTime(message.timeCheck - message.timeAdded, this.config.DEV)} ago.

•    Please verify his/her donations count.

•    Short preview of the message, so it's easier to find:
\`\`\`${msg.cleanContent.substring(0, trimLimit).trim()}${msg.cleanContent.length > trimLimit ? ' (...)' : ''}\`\`\`
•    Jump to that message: ${msg.url}`, {
						split
					});
				} else {
					channel.send(`Hello ${slacker.displayName}.

•    You have been mentioned by ${message.authorUsername} in \`#court-of-law\` ${helpers.getReadableTime(message.timeCheck - message.timeAdded, this.config.DEV)} ago.

•    Please post a screenshot in \`#guild-lounge\` with confirmation of your donations (if you haven't done it already).

•    Short preview of the message, so it's easier to find:
\`\`\`${msg.cleanContent.substring(0, trimLimit).trim()}${msg.cleanContent.length > trimLimit ? ' (...)' : ''}\`\`\`
•    Jump to that message: ${msg.url}`, {
						split
					});
				}
			});
	};

	printSlackers(msg, dateFrom, dateTo, slackers) {
		const channel = msg ? msg.channel : this.channels.officer_chat;

		channel.send(`__**Court of Law ${msg ? '' : 'Monthly '}Report**__

•    ${helpers.getReadableTime((dateTo ? dateTo : new Date().getTime()) - dateFrom)}
      - From: ${new Date(dateFrom)}
      - To: ${dateTo && new Date(dateTo) || 'now'}

•    ${slackers.size} ${slackers.size === 1 ? 'member' : 'members'} of ${this.guild.roles.get(this.config.roles.member).name} ${slackers.size === 1 ? 'was' : 'were'} mentioned during that time${slackers.size > 0 ? ':' : '.'}
${[...slackers].map(slacker => `      - <@${slacker[1].id}> ${slacker[1].mentionCount}x`).join('\n')}`, {
			split: true
		});

		msg && msg.reactions.get('⌛') && msg.reactions.get('⌛').remove();
	}

	clearTimeouts(key) {
		key && this.timeouts[key] && this.timeouts[key].forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
