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
		console.log('WookieeSergeant.Raids ready');
		this.initChannels(Client, channels);
		this.main = this.main.bind(this);
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
		this.findNextEvents();
		this.setTimeouts();
	}

	updateJSON() {
		fs.writeFileSync(path.resolve(__dirname, jsonPath), JSON.stringify(this.json));
	}

	findNextEvents() {
		let now = new Date(),
			nowHour = now.getUTCHours();

		this.nextEvents = [];

		for (let raid in this.json) {
			let nextEvent = {};
			nextEvent.type = raid;
			raid = this.json[raid];

			if (raid.active) {
				nextEvent.hour = (raid.active.rotationTimeUTC + raid.config.registrationHours + raid.active.phase * raid.config.phases.holdHours) % 24;
				nextEvent.phase = raid.active.phase + 1;
			} else if (raid.next) {
				nextEvent.hour = raid.next.rotationTimeUTC;
				nextEvent.phase = 0;
			} else {
				nextEvent.hour = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(nowHour))[0] || raid.config.rotationTimesUTC[0];
				nextEvent.phase = 0;
			}

			nextEvent.config = raid.config;

			this.nextEvents.push(nextEvent);
		}
	}

	setTimeouts() {
		let now = new Date();

		for (let raid of this.nextEvents) {
			let raidTime = new Date(),
				diff;

			console.log(raid);

			raidTime.setUTCHours(raid.hour, 0, 0, 0);
			if (raidTime < now) raidTime.setDate(raidTime.getDate() + 1);
			diff = raidTime.getTime() - now.getTime();

			console.log('diff: ' + diff / 60000 / 60);

			if (raid.phase === 0) { // remind @Officer to start raid
				setTimeout(() => {
					this.channels.bot_playground.send(`${roles.officer} start ${raid.type} NOW! After that type here "--start ${raid.type}"`);

					this.main;
				}, diff);
			} else if (raid.phase > 0 && raid.phase <= raid.config.phases.count) { // remind @Shaved Wookiee about open phase
				let nextPhase = (raid.config.phases.count > 1) ? `Phase ${raid.phase} ` : '';

				setTimeout((isLastPhase = (raid.phase === raid.config.phases.count), json = this.json) => {
					this.channels.bot_playground.send(`${roles.shavedWookiee} ${nextPhase}${raid.type} is now OPEN!`);

					if (isLastPhase) { // this was the last phase - move raid to logs
						json[raid.type].log.push(json[raid.type].active);
						json[raid.type].active = null;
					} else {
						json[raid.type].active.phase++;
					}

					this.updateJSON();
					this.main;
				}, diff);
			}
		}
	}


	findNextLaunchHour(nowHour) {
		return function (rotationTimesUTC) {
			return (rotationTimesUTC > nowHour);
		}
	}
}
