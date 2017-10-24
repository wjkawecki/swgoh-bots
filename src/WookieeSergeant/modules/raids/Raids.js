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
	},
	timeouts = [];

export default class Raids {
	constructor(Client) {
		console.log('WookieeSergeant.Raids ready');
		this.initChannels(Client, channels);
		this.main();
	}

	initChannels(Client, channels) {
		this.channels = {};

		for (let key in channels) {
			this.channels[key] = Client.channels.get(channels[key]);
		}
	}

	async main() {
		try {
			console.log('WookieeSergeant.Raids.main()');

			// const messages = await this.channels.bot_playground.fetchMessages();
			// if (messages) {
			// 	messages.forEach(async (message) => {
			// 		await message.delete();
			// 	});
			// }

			this.readJSON();
			this.processRaids();
		} catch (err) {
			console.log(err);
		}
	}

	readJSON() {
		this.json = JSON.parse(fs.readFileSync(path.resolve(__dirname, jsonPath)));
	}

	processRaids() {
		this.findNextEvent();
		this.setTimeout();
	}

	updateJSON() {
		fs.writeFileSync(path.resolve(__dirname, jsonPath), JSON.stringify(this.json));
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

	setTimeout() {
		let raid = this.nextEvent;

		console.log('WookieeSergeant.Raids.setTimeout()');
		console.log(raid);

		if (raid.phase === 0 && !raid.reminderTriggered) { // remind @Officer to start raid
			setTimeout(() => {
				this.channels.bot_playground.send(`${roles.officer} start ${raid.type} NOW! After that type here "--start ${raid.type}"`);

				this.json[raid.type].next.reminderTriggered = true;

				this.updateJSON();
				this.main();
			}, raid.diff);
		} else if (raid.phase > 0 && raid.phase <= raid.config.phases.count) { // remind @Shaved Wookiee about open phase
			let nextPhase = (raid.config.phases.count > 1) ? `Phase ${raid.phase} ` : '';

			setTimeout((isLastPhase = (raid.phase === raid.config.phases.count)) => {
				this.channels.bot_playground.send(`${roles.shavedWookiee} ${nextPhase}${raid.type} is now OPEN!`);

				if (isLastPhase) { // this was the last phase - move raid to logs
					this.json[raid.type].log.push(this.json[raid.type].active);
					this.json[raid.type].active = null;
				} else {
					this.json[raid.type].active.phase++;
				}

				this.updateJSON();
				this.main();
			}, raid.diff);
		}
	}

	findNextLaunchHour(nowHour) {
		return function (rotationTimesUTC) {
			return (rotationTimesUTC > nowHour);
		}
	}
}
