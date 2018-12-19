import helpers from '../../../helpers/helpers';

export default class MSFRaids {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.data = data;
		this.timeouts = [];

		this.listenToMessages();
		this.main();
	}

	main() {
		try {
			this.scheduleReminders();
		} catch (err) {
			console.log(`${this.config.name}: MSFRaids main`, err);
			setTimeout(() => this.scheduleReminders(), this.config.retryTimeout);
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

			switch (command) {
				case 'help':
					this.helpReply(msg);
					break;

				case 'start':
					if (msg.member.roles.has(this.config.roles.officer))
						this.startRaid(msg, args);
					break;
			}
		});
	}

	helpReply(msg) {
		msg.reply(`__MSFRaids__ commands:
\`-start [name] [duration hours (optional) - default: 24]\` *- officer only*.

Examples:
\`-start ultimus\` - starts ultimus raid with 24h duration
\`-start special 12\` - starts special raid with 12h duration`
		);
	}

	scheduleReminders() {
		const now = new Date().getTime();

		this.clearTimeouts();

		if (!this.data.raids.length) return;

		let deletedCount = 0;

		this.data.raids.forEach((raid, raidIndex) => {
			this.data.config.hours.forEach(hour => {
				const ms = hour * 60 * 60 * 1000;
				const timeout = raid.endTimestamp - ms;

				if (now > raid.endTimestamp) {

					this.data.raids.splice(raidIndex, 1);
					deletedCount++;

				} else if (timeout > now) {

					this.timeouts.push(setTimeout(() => {
						const reminderText = this.data.config.reminder
							.replace('#NAME#', raid.name)
							.replace('#HOURS#', hour)
							.replace('#HOURS_STRING#', hour > 1 ? 'hours' : 'hour');

						this.channels.raids_comm.send(`<@&${this.config.roles.member}> ${reminderText}`);
					}, timeout - now));

				}
			});
		});

		if (deletedCount) {
			helpers.updateJSON(this.config, 'msfRaids', this.data, () => {
				console.log(`${this.config.name}: deleted ${deletedCount} old ${deletedCount > 1 ? 'raids' : 'raid'}`);
				this.main();
			});
		}
	}

	startRaid(msg, args) {
		const raid = {};
		const name = args[0];
		let duration = args[1] || 24;

		if (!name) {
			msg.reply(`what is the name of the raid?
Type \`-start [name] [duration - optional]\`.`);
			return
		}

		if (isNaN(duration)) {
			msg.reply(`${duration} is not a valid number! Try \`12\` or \`24\`.`);
			return;
		} else {
			duration = Math.floor(parseInt(duration));
		}

		raid.name = args[0];
		raid.duration = duration;
		raid.createdTimestamp = msg.createdTimestamp;
		raid.endTimestamp = new Date(raid.createdTimestamp + (raid.duration * 60 * 60 * 1000)).getTime();

		this.data.raids.push(raid);

		helpers.updateJSON(this.config, 'msfRaids', this.data, () => {
			const reminderText = this.data.config.reminder
				.replace('#NAME#', raid.name)
				.replace('#HOURS#', `${duration}`)
				.replace('#HOURS_STRING#', duration > 1 ? 'hours' : 'hour');

			console.log(`${this.config.name}: added new raid`, raid);

			msg.reply(`added new ${args[0]} raid with ${duration}h duration!`);
			this.channels.raids_comm.send(`<@&${this.config.roles.member}> ${reminderText}`);

			this.main();
		});
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
