import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import * as fs from 'fs';
import helpers from '../../../helpers/helpers';

const MongoClient = mongodb.MongoClient;

export default class TerritoryBattles {
	constructor(Client, config, channels, data) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.json = data;
		this.timeouts = [];

		this.listenToMessages();
		this.main();
	}

	main() {
		try {
			this.scheduleReminders();
		} catch (err) {
			console.log(`${this.config.guildName}: ${this.json.config.name} main`, err);
			setTimeout(() => this.scheduleReminders(), this.config.retryTimeout);
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.toLowerCase().slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift();

			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			if (command === 'help' && msg.member.roles.has(this.config.roles.member))
				this.helpReply(msg);

			if (command !== this.json.config.key) return;

			switch (args[0]) {
				case undefined:
					this.helpReply(msg);
					break;

				case 'start':
					if (msg.member.roles.has(this.config.roles.officer))
						this.startTB(msg);
					break;

				case 'end':
					if (msg.member.roles.has(this.config.roles.officer))
						this.endTB(msg);
					break;

				case 'phase':
					if (msg.member.roles.has(this.config.roles.officer))
						this.changeTBPhase(msg, args[1]);
					break;

				case 'config':
					if (msg.member.roles.has(this.config.roles.officer))
						this.configTB(msg, args);
					break;
			}
		});
	}

	helpReply(msg) {
		msg.reply(`__${this.json.config.name}__ commands:
\`-${this.json.config.key} start\` *- officer only*. Start Phase 1 of ${this.json.config.name}.
\`-${this.json.config.key} end\` *- officer only*. End active ${this.json.config.name}.
\`-${this.json.config.key} phase [1-6]\` *- officer only*. Change current phase of ${this.json.config.name}.`);
	}

	scheduleReminders() {
		const milisecondsToPhaseEnd = helpers.getMilisecondsToEvent(this.json.config.startTimeUTC);

		this.clearTimeouts();

		if (!this.json.activePhase) return;

		if (this.json.generalReminders && this.json.generalReminders.length) {
			this.json.generalReminders.forEach((reminder) => {
				this.timeouts.push(setTimeout(() => {
					this.channels.territory_battles.send(
						`<@&${this.config.roles[reminder.mention]}>\n${reminder.text}`
					);
				}, milisecondsToPhaseEnd - (reminder.hoursToPhaseEnd * 60 * 60 * 1000)));
			});
		}

		console.log(`${this.config.guildName}: ${this.json.config.name}: ${this.json.phases[this.json.activePhase - 1].name} ends in ${helpers.getReadableTime(milisecondsToPhaseEnd)}`);

		this.timeouts.push(setTimeout(() => {
			this.startPhase(this.json.activePhase);
		}, milisecondsToPhaseEnd));
	}

	startTB(msg) {
		if (this.json.activePhase) {
			msg.reply(`${this.json.config.name} is currently in Phase ${this.json.activePhase}.`);
		} else {
			msg.reply(`starting new ${this.json.config.name}!`);
			this.startPhase(0);
		}
	}

	endTB(msg) {
		if (this.json.activePhase) {
			msg.reply(`ending active ${this.json.config.name}!`);

			this.json.activePhase = null;
			this.clearTimeouts();
			this.updateJSON();
		} else {
			msg.reply(`there is currently no active ${this.json.config.name}.`);
		}
	}

	startPhase(phaseIndex) {
		const nextPhase = Number(phaseIndex + 1);

		this.channels.territory_battles.send(
			`<@&${this.config.roles.member}>\n__${this.json.config.name}: ${this.json.phases[phaseIndex].name}__\n\n${this.json.phases[phaseIndex].startMessage}`
		);

		if (nextPhase > this.json.phases.length) {
			this.json.activePhase = null;
		} else {
			this.json.activePhase = nextPhase;
		}

		this.updateJSON();

		this.timeouts.push(setTimeout(() => {
			this.main();
		}, 2 * 60 * 1000));
	}

	changeTBPhase(msg, phaseNumber = null) {
		if (!phaseNumber) {
			if (this.json.activePhase) {
				msg.reply(`${this.json.config.name} is currently in Phase ${this.json.activePhase}.`);
			} else {
				msg.reply(`there is currently no active ${this.json.config.name}.`);
			}

			return;
		}

		const number = Math.floor(parseInt(phaseNumber));

		if (number > 0 && number <= this.json.phases.length) {
			msg.reply(`changing ${this.json.config.name} phase to ${number}!`);

			this.startPhase(number - 1);
		} else {
			msg.reply(`please use proper phase number: \`[1,2,3,4,5,6]\`.`);
		}
	}

	configTB(msg, args = []) {
		console.log(args);

		this.channels.sergeants_office.send(`<@${msg.author.id}>, ${this.json.config.name} messages:`);

		if (this.json.phases && this.json.phases.length) {
			this.channels.sergeants_office.send(`**__Phase start messages:__**`);

			this.json.phases.forEach((reminder, index) => {
				this.channels.sergeants_office.send(
					`**${index + 1}**:\n"${reminder.startMessage}"`
				);
			});
		}

		if (this.json.generalReminders && this.json.generalReminders.length) {
			this.channels.sergeants_office.send(`**__General messages:__**`);

			this.json.generalReminders.forEach((reminder, index) => {
				this.channels.sergeants_office.send(
					`**${index + 1}:**\n- Hours before phase end: ${reminder.hoursToPhaseEnd}\n- Mention role: ${reminder.mention}\n- Text: "${reminder.text}"`
				);
			});
		}
	}

	updateJSON() {
		if (this.config.DEV) {
			const jsonLocalPath = __dirname + '/../../../..' + this.config.jsonLocalPath.replace('#guildName#', this.config.guildName);
			let localData = JSON.parse(fs.readFileSync(jsonLocalPath));

			fs.writeFileSync(jsonLocalPath, JSON.stringify({
				...localData,
				[this.json.config.key]: this.json
			}));
		} else {
			try {
				MongoClient.connect(this.config.mongoUrl, { useNewUrlParser: true }, (err, client) => {
					if (err) throw err;

					client.db().collection(this.config.mongoCollection).updateOne({}, { $set: { [this.json.config.key]: this.json } }, err => {
						if (err) throw err;

						client.close();
					});
				});
			} catch (err) {
				console.log(`${this.config.guildName}.TerritoryBattles.updateJSON(): ${this.json.config.key} MongoDB update error`, err.message);
				this.updateJSON();
			}
		}
	}

	clearTimeouts() {
		this.timeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});
	}
}
