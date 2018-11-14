import helpers from '../../../helpers/helpers';

export default class CourtOfLaw {
	constructor(Client, config, channels) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.guild = Client.guilds.first();
		this.timeouts = [];

		this.listenToMessages();
		this.main();
	}

	main() {
		try {
			this.scheduleCourt();
		} catch (err) {
			console.log(`${this.config.guildName}: CourtOfLaw main`, err);
			setTimeout(() => this.scheduleCourt(), this.config.retryTimeout);
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

			if (command !== 'court') return;

			switch ((args[0] || '').toLowerCase()) {
				case '':
				case 'help':
					this.helpReply(msg);
					break;

				default:
					if (msg.member.roles.has(this.config.roles.officer))
						this.printCourt(msg, (args[0] || '').toLowerCase(), (args[1] || '').toLowerCase());
			}
		});
	}

	helpReply(msg) {
		msg.reply(`__CourtOfLaw__ commands:
\`-court [dateFrom or keyword] [dateTo (optional)]\` *- officer only*.

Examples:
\`-court this\` or \`-court current\` or \`-court currentMonth\`
\`-court last\` or \`-court previous\` or \`-court lastMonth\`
\`-court 10/1/2018\`
\`-court 10/1/2018 10/20/2018\``
		);
	}

	printCourt(msg, fromString, toString) {
		const now = new Date();
		let dateFrom;
		let dateTo;

		msg.react('⌛');

		if (fromString === 'this'
			|| fromString === 'current'
			|| fromString === 'currentmonth'
			|| fromString === 'thismonth') {
			dateFrom = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
			dateTo = null;
		} else if (fromString === 'last'
			|| fromString === 'previous'
			|| fromString === 'lastmonth'
			|| fromString === 'previousmonth') {
			dateFrom = new Date(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
			dateTo = new Date(new Date(now.getFullYear(), now.getMonth(), 0).getTime());
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
			.then(slackers => this.printSlackers(msg, dateFrom, dateTo, slackers));
	}

	fetchSlackers(timestampFrom, timestampTo, messageId) {
		this.slackers = messageId ? this.slackers : new Map();

		return new Promise(resolve => {
			const options = {limit: 100};
			const channel = this.config.DEV
				? this.Client.channels.get(this.config.channels.court_of_law)
				: this.channels.court_of_law;

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

						resolve(this.slackers);
					} else {
						resolve(this.fetchSlackers(timestampFrom, timestampTo, messageId));
					}
				});
		});
	}

	scheduleCourt() {
		const now = new Date();
		const nextMonthTimestamp = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 1)).getTime();

		this.clearTimeouts();

		this.timeouts.push(setTimeout(() => {
			const now = new Date();
			const dateFrom = new Date(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
			const dateTo = new Date(new Date(now.getFullYear(), now.getMonth(), 0).getTime());

			this.fetchSlackers(dateFrom, dateTo)
				.then(slackers => this.printSlackers(null, dateFrom, dateTo, slackers));
		}, nextMonthTimestamp - now.getTime()));

		console.log(`${this.config.guildName}: CourtOfLaw scheduled in ${helpers.getReadableTime(nextMonthTimestamp - now.getTime())}`);
	}

	printSlackers(msg, dateFrom, dateTo, slackers) {
		const channel = msg ? msg.channel : this.channels.officer_chat;

		channel.send(`__**Court of Law ${msg ? '' : 'Monthly '}Report**__

•    ${helpers.getReadableTime((dateTo ? dateTo : new Date().getTime()) - dateFrom)}
      - From: ${new Date(dateFrom)}
      - To: ${dateTo && new Date(dateTo) || 'now'}

•    ${slackers.size} members of ${this.guild.roles.get(this.config.roles.member).name} were mentioned during that time:
${[...slackers].map(slacker => `      - <@${slacker[1].id}> ${slacker[1].mentionCount}x`).join('\n')}`);

		msg && msg.reactions.get('⌛') && msg.reactions.get('⌛').remove();
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
