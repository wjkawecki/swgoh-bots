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
			const args = msg.content.slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift().toLowerCase();

			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			if (command === 'help' && msg.member.roles.has(this.config.roles.member))
				this.helpReply(msg);

			if (command !== this.json.config.key) return;

			switch (args[0].toLowerCase()) {
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
						this.printConfig(msg);
					break;

				case 'edit':
					if (msg.member.roles.has(this.config.roles.officer))
						this.editConfig(msg, args);
					break;
			}
		});
	}

	helpReply(msg) {
		msg.reply(`__${this.json.config.name}__ commands:
\`-${this.json.config.key} start\` *- officer only*. Start ${this.json.phases[0].name} of ${this.json.config.key.toUpperCase()}.
\`-${this.json.config.key} end\` *- officer only*. End active ${this.json.config.key.toUpperCase()}.
\`-${this.json.config.key} phase [1-6]\` *- officer only*. Change current phase of ${this.json.config.key.toUpperCase()}.
\`-${this.json.config.key} config\` *- officer only*. Display current configuration of ${this.json.config.key.toUpperCase()}.
\`-${this.json.config.key} edit\` *- officer only*. Edit config of ${this.json.config.key.toUpperCase()}. Type \`-${this.json.config.key} config\` for more info.`);
	}

	scheduleReminders() {
		const milisecondsToPhaseEnd = helpers.getMilisecondsToEvent(this.json.config.startTimeUTC);

		this.clearTimeouts();

		if (!this.json.activePhase) return;

		if (this.json.reminders && this.json.reminders.length) {
			this.json.reminders.forEach((reminder) => {
				const milisecondsToReminder = milisecondsToPhaseEnd - (reminder.hoursToPhaseEnd * 60 * 60 * 1000);

				if (milisecondsToReminder > 0) {
					this.timeouts.push(setTimeout(() => {
						this.channels.territory_battles.send(
							`<@&${this.config.roles[reminder.mention]}>\n${reminder.text}`
						);
					}, milisecondsToReminder));
				}
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
			`<@&${this.config.roles.member}>\n__${this.json.config.name}: ${this.json.phases[phaseIndex].name}__\n\n${this.json.phases[phaseIndex].text}`
		);

		if (nextPhase > this.json.phases.length) {
			this.json.activePhase = null;
		} else {
			this.json.activePhase = nextPhase;
		}

		this.updateJSON();

		this.timeouts.push(setTimeout(() => {
			this.main();
		}, 30 * 1000));
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

	printConfig(msg) {
		this.channels.sergeants_office.send(`<@${msg.author.id}>, this is current ${this.json.config.name} configuration.
You can edit any of the values below.
Examples:
\`-${this.json.config.key} edit phases 2 text New text of Phase 2 start message\`
\`-${this.json.config.key} edit reminders 1 mention officer\`
\`-${this.json.config.key} edit reminders 3 hoursToPhaseEnd 2.5\``);

		this.channels.sergeants_office.send(`_ _\n----- ${this.json.config.key.toUpperCase()} CONFIG START -----`);

		if (this.json.phases && this.json.phases.length) {
			this.channels.sergeants_office.send(
				`_ _
**__Phase start messages:__** \`phases\``
			);

			this.json.phases.forEach((phase, index) => {
				this.channels.sergeants_office.send(
					`_ _
\`${index + 1}\`
- \`name\`: ${phase.name}
- \`text\`: ${phase.text}`
				);
			});
		}

		if (this.json.reminders && this.json.reminders.length) {
			this.channels.sergeants_office.send(
				`_ _
				
**__Reminders sent each phase:__** \`reminders\``
			);

			this.json.reminders.forEach((reminder, index) => {
				this.channels.sergeants_office.send(
					`_ _
\`${index + 1}\`
- \`hoursToPhaseEnd\`: ${reminder.hoursToPhaseEnd}
- \`mention\`: ${reminder.mention}
- \`text\`: ${reminder.text}`
				);
			});
		}

		this.channels.sergeants_office.send(`_ _\n----- ${this.json.config.key.toUpperCase()} CONFIG END -----`);
	}

	editConfig(msg, args) {
		try {
			const oldValue = this.json[args[1]][args[2] - 1][args[3]],
				newValue = msg.content.split(`${args[1]} ${args[2]} ${args[3]} `).pop();

			if (!oldValue) throw 'wrong path';

			this.json[args[1]][args[2] - 1][args[3]] = newValue;

			msg.reply(
				`succesfully edited \`${args[1]} ${args[2]} ${args[3]}\`.

__Old value__:
${oldValue}

__New value__:
${newValue}`
			);

			this.updateJSON();

			this.timeouts.push(setTimeout(() => {
				this.main();
			}, 30 * 1000));

		} catch (err) {
			msg.reply(`there is nothing tu edit under \`${args[1]} ${args[2]} ${args[3]}\`. Try again with different parameters. Type \`-${this.json.config.key} config\` for more info.`);
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
