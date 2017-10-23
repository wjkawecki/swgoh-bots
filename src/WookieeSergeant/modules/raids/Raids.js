import Discord from 'discord.js';
import path from 'path';
import * as fs from 'fs';

const readChannelId = '371742456653414410', // #bot_playground
	writeChannelId = '371742456653414410', // #bot_playground
	shavedWookieeId = '<@&324184776871510016>',
	jsonPath = '../../../../data/raids.json';

export default class Raids {
	constructor(Client) {
		console.log('WookieeSergeant.Raids ready');

		this.readChannel = Client.channels.get(readChannelId);
		this.writeChannel = Client.channels.get(writeChannelId);
		this.main = this.main.bind(this);
		this.main();
	}

	async main() {
		try {
			this.readJSON();
			this.processRaids();
			this.writeJSON();

			console.log('Rancor:', this.Rancor, 'AAT:', this.AAT);
		} catch (err) {
			console.log(err);
		} finally {
			setTimeout(this.main, 60000 - Date.now() % 60000);
		}
	}

	readJSON() {
		this.json = JSON.parse(fs.readFileSync(path.resolve(__dirname, jsonPath)));
		this.Rancor = this.findNextEvent(this.json.Rancor);
		this.AAT = this.findNextEvent(this.json.AAT);

		console.log('Rancor:', this.Rancor, 'AAT:', this.AAT);
	}

	processRaids() {
		let now = new Date(),
			nowHour = now.getUTCHours();


	}

	findNextEvent(raid) {
		let now = new Date(),
			nowHour = now.getUTCHours(),
			nextEvent = {};

		if (raid.active) {
			nextEvent.hour = raid.active.rotationTimeUTC + raid.config.registrationHours + raid.active.phase * raid.config.phases.holdHours;
			nextEvent.phase = raid.active.phase + 1;
		} else if (raid.next) {
			nextEvent.hour = raid.next.rotationTimeUTC;
			nextEvent.phase = 0;
		} else {
			nextEvent.hour = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(nowHour))[0] || raid.config.rotationTimesUTC[0];
			nextEvent.phase = 0;
		}

		return nextEvent;
	}

	findNextLaunchHour(nowHour) {
		return function(rotationTimesUTC) {
			return (rotationTimesUTC > nowHour);
		}
	}
}
