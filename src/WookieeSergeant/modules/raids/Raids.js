import path from 'path';
import * as fs from 'fs';

const jsonPath = '../../../../data/raids.json',
	channels = {
		bot_playground: '371742456653414410',
		officer_chat: '324199905017200651',
		raid_log: '358111155572441091',
	},
	roles = {
		officer: '<@&324139861709946901>',
		shavedWookiee: '<@&324184776871510016>'
	};

export default class Raids {
	constructor(Client) {
		console.log('WookieeSergeant.Raids');

		this.initChannels(Client, channels);
		this.listenToMessages(Client);
		this.timeouts = [];
		this.main();
	}

	initChannels(Client, channels) {
		this.channels = {};

		for (let key in channels) {
			this.channels[key] = Client.channels.get(channels[key]);
		}
	}

	listenToMessages(Client) {
		Client.on('message', msg => {
			if (msg.channel.id === channels.bot_playground) {
				switch (msg.content.toLowerCase()) {

					case '--start rancor':
						this.startRaid('Rancor', msg);
						break;

					case '--start aat':
						this.startRaid('AAT', msg);
						break;

					case '--json':
						console.log(JSON.stringify(this.json, null, 4));
						break;

				}
			}
		});
	}

	async main() {
		try {
			console.log('WookieeSergeant.Raids.main()');

			// this.clearChannel();
			this.readJSON();
			this.processRaids();
		} catch (err) {
			console.log(err);
		}
	}

	async clearChannel() {
		console.log(`WookieeSergeant.Raids.clearChannel()`);

		const messages = await this.channels.bot_playground.fetchMessages();
		if (messages) {
			messages.forEach(async (message) => {
				await message.delete();
			});
		}
	}

	readJSON() {
		console.log(`WookieeSergeant.Raids.readJSON(): ${typeof this.json}`);
		this.json = this.json || JSON.parse(fs.readFileSync(path.resolve(__dirname, jsonPath)));
	}

	updateJSON() {
		fs.writeFileSync(path.resolve(__dirname, jsonPath), JSON.stringify(this.json));
		this.channels.bot_playground.send(JSON.stringify(this.json));
	}

	processRaids() {
		this.findNextEvent();
		this.clearTimeout();
		this.setTimeout();
	}

	startRaid(raidName, msg) {
		const raid = this.json[raidName],
			nextRotationTimeUTC = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(raid.next.rotationTimeUTC))[0] || raid.config.rotationTimesUTC[0];

		if (raid.active) {
			msg.reply(`don't fool me! ${raidName} is already started!`);
		} else {
			msg.reply(`roger that, logging new ${raidName} in my books!`);

			if (raid.config.registrationHours > 0) {
				this.json[raidName].active = {
					rotationTimeUTC: raid.next.rotationTimeUTC,
					initiatorID: msg.author.id,
					phase: 0
				};
			} else {
				let nextPhase = (raid.config.phases.count > 1) ? `P1 ` : '';

				this.json[raidName].active = {
					rotationTimeUTC: raid.next.rotationTimeUTC,
					initiatorID: msg.author.id,
					phase: 1
				};

				this.channels.bot_playground.send(`${roles.shavedWookiee} ${nextPhase}${raidName} is now OPEN!`);
			}

			this.channels.raid_log.send(`${raidName} ${raid.next.rotationTimeUTC} UTC started by <@${msg.author.id}>`);

			this.json[raidName].next = {
				rotationTimeUTC: nextRotationTimeUTC
			};

			this.updateJSON();
			this.main();
		}
	}

	findNextEvent() {
		let now = new Date(),
			nowHour = now.getUTCHours(),
			nextEvents = [];

		for (let raid in this.json) {
			let nextEvent = {},
				now = new Date(),
				nextEventTime = new Date(),
				diff;

			nextEvent.type = raid;
			raid = this.json[raid];

			if (raid.active) {
				nextEvent.hour = (raid.active.rotationTimeUTC + raid.config.registrationHours + raid.active.phase * raid.config.phases.holdHours) % 24;
				nextEvent.phase = raid.active.phase + 1;
			} else if (raid.next) {
				nextEvent.hour = raid.next.rotationTimeUTC;
				nextEvent.reminderTriggered = raid.next.reminderTriggered;
				nextEvent.phase = 0;
			} else {
				nextEvent.hour = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(nowHour))[0] || raid.config.rotationTimesUTC[0];
				nextEvent.reminderTriggered = false;
				nextEvent.phase = 0;
			}

			nextEventTime.setUTCHours(nextEvent.hour, 0, 0, 0);
			if (nextEventTime < now) nextEventTime.setDate(nextEventTime.getDate() + 1);
			diff = nextEventTime.getTime() - now.getTime();

			nextEvent.diff = diff;
			nextEvent.config = raid.config;

			nextEvents.push(nextEvent);
		}

		nextEvents.sort(function (a, b) {
			return a.diff - b.diff;
		});

		this.nextEvent = nextEvents[0];
	}

	clearTimeout() {
		console.log(`WookieeSergeant.Raids.clearTimeout(): ${this.timeouts.length} timeouts`);

		if (this.timeouts) {
			this.timeouts.forEach((timeout) => {
				clearTimeout(timeout);
			});
		}
	}

	setTimeout() {
		let remindMinutesBefore = 2,
			raid = this.nextEvent,
			diff = new Date(raid.diff - (remindMinutesBefore * 60 * 1000));

		if (raid.phase === 0) { // remind @Officer to start raid
			this.timeouts.push(setTimeout(() => {
				this.channels.bot_playground.send(
					`${roles.officer} prepare to start ${raid.type} in ${remindMinutesBefore} minutes!\nI hope you have enough raid tickets?!`
				);
			}, diff));

			this.timeouts.push(setTimeout(() => {
				this.channels.bot_playground.send(`${roles.officer} start ${raid.type} NOW!\nAfter that type here \`--start ${raid.type.toLowerCase()}\`\nIf you don't have enough tickets I will remind you again tomorrow.`);

				this.updateJSON();
				this.main();
			}, raid.diff));

			console.log(`WookieeSergeant.Raids.setTimeout(): ${raid.type} start in ${this.getReadableTime(raid.diff)}`);
		} else if (raid.phase > 0 && raid.phase <= raid.config.phases.count) { // remind @Shaved Wookiee about open phase
			let nextPhase = (raid.config.phases.count > 1) ? `P${raid.phase} ` : '';

			this.timeouts.push(setTimeout(() => {
				this.channels.bot_playground.send(
					`${roles.shavedWookiee} ${nextPhase}${raid.type} will open in ${remindMinutesBefore} minutes. Get ready!`
				);
			}, diff));

			this.timeouts.push(setTimeout((isLastPhase = (raid.phase === raid.config.phases.count)) => {
				this.channels.bot_playground.send(
					`${roles.shavedWookiee} ${nextPhase}${raid.type} is now OPEN! Go go go!`
				);

				if (isLastPhase) { // this was the last phase - move raid to logs
					delete this.json[raid.type].active.phase;
					this.json[raid.type].log.push(this.json[raid.type].active);
					this.json[raid.type].active = null;
				} else {
					this.json[raid.type].active.phase++;
				}

				this.updateJSON();
				this.main();
			}, raid.diff));

			console.log(`WookieeSergeant.Raids.setTimeout(): ${nextPhase}${raid.type} in ${this.getReadableTime(raid.diff)}`);
		}
	}

	findNextLaunchHour(nowHour) {
		return function (rotationTimesUTC) {
			return (rotationTimesUTC > nowHour);
		}
	}

	getReadableTime(time, showSeconds = false) {
		time = new Date(time);

		if (showSeconds) {
			time = `${String(time.getUTCHours()).padStart(2, '00')}:${String(time.getUTCMinutes()).padStart(2, '00')}:${String(time.getUTCSeconds()).padStart(2, '00')}`;
		} else {
			time = `${String(time.getUTCHours()).padStart(2, '00')}:${String(time.getUTCMinutes()).padStart(2, '00')}`;
		}

		return time;
	}
}
