const DEV = true;

import * as mongodb from 'mongodb';
import path from 'path';
import * as fs from 'fs';

const MongoClient = mongodb.MongoClient,
	mongoUrl = process.env.MONGODB_URI,
	jsonPath = '../../../data/raids.json',
	jsonStablePath = '../../../data/raidsstable.json',
	channels = {
		sergeants_office: '440640683624103936',
		raid_log: '440795802777157642',
		raids_comm: '440641211066482707',
		bot_playground: '371742456653414410'
	},
	roles = {
		officer: DEV ? 'officer' : '440635030658613269',
		member: DEV ? 'member' : '440634741826256896'
	};

export default class Raids {
	constructor(Client) {
		console.log(`CloneSergeant.Raids ready${DEV ? ' (DEV mode)' : ''}`);

		this.Client = Client;
		this.timeouts = {};

		this.initChannels(channels);
		this.listenToMessages();

		if (DEV) {
			this.clearChannel(this.channels.bot_playground, true);
			this.restoreJSON();
		} else {
			this.channels.bot_playground.send(`CloneSergeant.Raids on duty!`);
		}

		this.main();
	}

	initChannels(channels) {
		this.channels = {};

		for (let key in channels) {
			if (DEV) {
				this.channels[key] = this.Client.channels.get(channels.bot_playground);
			} else {
				this.channels[key] = this.Client.channels.get(channels[key]);
			}
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			switch (msg.content.toLowerCase()) {

				case '-start rancor':
				case '- start rancor':
					if (msg.member.roles.has(roles.officer))
						this.startRaid('Rancor', msg);
					break;

				case '-start aat':
				case '- start aat':
					if (msg.member.roles.has(roles.officer))
						this.startRaid('AAT', msg);
					break;

				case '-start sith':
				case '- start sith':
					if (msg.member.roles.has(roles.officer))
						this.startRaid('Sith', msg);
					break;

				case '-undo':
				case '- undo':
					if (msg.member.roles.has(roles.officer))
						this.undo(msg);
					break;

				case '-json':
				case '- json':
					if (msg.member.roles.has(roles.officer))
						console.log(JSON.stringify(this.json, null, 4));
					break;

				case '-help':
				case '- help':
				case '!help':
					this.helpReply(msg);
					break;
			}

			if (this.isBotMentioned(msg))
				this.helpReply(msg);
		});
	}

	helpReply(msg) {
		msg.reply(`here is the list of my __Raids__ commands:
\`-start rancor\` *- officer only*. Starts next Rancor according to schedule.
\`-start aat\` *- officer only*. Starts next AAT according to schedule.
\`-start sith\` *- officer only*. Starts next Sith according to schedule.
\`-undo\` *- officer only*. Undo your last action!
\`-help\` - this is what you are reading right now.`);
	}

	undo(msg) {
		if (this.undoJson) {
			msg.reply(`I have reverted your last action. Just like nothing happened!`);

			this.json = JSON.parse(JSON.stringify(this.undoJson));
			this.undoJson = null;

			if (!DEV) {
				this.clearChannel(this.channels.raid_log);
			}

			this.updateJSON();
			this.main();
		} else {
			msg.reply(`I am so sorry, but there is nothing I can do! Maybe <@209632024783355904> can help?`);
		}
	}

	isBotMentioned(msg) {
		return msg.mentions.users.has(this.Client.user.id);
	}

	async main(raid = '') {
		try {
			console.log(`CloneSergeant.Raids.main(${raid})`);
			this.readJSON(raid);
		} catch (err) {
			console.log(err);
		}
	}

	async clearChannel(channel, removeAll = false) {
		console.log(`CloneSergeant.Raids.clearChannel()`);

		if (removeAll) {
			const messages = await channel.fetchMessages();

			if (messages) {
				messages.forEach(async (message) => {
					await message.delete();
				});
			}
		} else {
			const message = await channel.fetchMessage(this.lastMessageId);

			if (message)
				await message.delete();
		}
	}

	readJSON(raid) {
		let that = this;

		if (DEV) {
			this.json = this.json || JSON.parse(fs.readFileSync(path.resolve(__dirname, jsonPath))).raids;
			console.log(`CloneSergeant.Raids.readJSON(${raid}): local ${typeof that.json}`);
			this.processRaids(raid);
		} else {
			if (!this.json) {
				MongoClient.connect(mongoUrl, function (err, db) {
					if (err) throw err;
					db.collection('CloneSergeant').findOne({}, function (err, result) {
						if (err) throw err;
						that.json = result.raids;
						db.close();
						console.log(`CloneSergeant.Raids.readJSON(${raid}): MongoDB ${typeof that.json}`);
						that.processRaids(raid);
					});
				});
			} else {
				console.log(`CloneSergeant.Raids.readJSON(${raid}): local ${typeof that.json}`);
				this.processRaids(raid);
			}
		}

	}

	updateJSON() {
		if (DEV) {
			fs.writeFileSync(path.resolve(__dirname, jsonPath), JSON.stringify({'raids': this.json}));
			// this.channels.bot_playground.send(JSON.stringify(this.json));
		} else {
			let that = this,
				json = {raids: that.json};

			MongoClient.connect(mongoUrl, function (err, db) {
				if (err) throw err;
				db.collection('CloneSergeant').updateOne({}, json, function (err, result) {
					if (err) throw err;
					console.log(`CloneSergeant.Raids.updateJSON(): MongoDB updated (${result.result.nModified})`);
					db.close();
				});
			});
		}
	}

	restoreJSON() {
		if (DEV) {
			console.log(`CloneSergeant.Raids.restoreJSON()`);

			let jsonStable = fs.readFileSync(path.resolve(__dirname, jsonStablePath));

			fs.writeFileSync(path.resolve(__dirname, jsonPath), jsonStable);
		}
	}

	processRaids(raid) {
		if (raid) {
			this.clearTimeouts(raid);
			this.scheduleReminder(this.findNextEvents().find(event => event.type === raid));
		} else {
			this.findNextEvents().forEach(event => this.scheduleReminder(event));
		}
	}

	startRaid(raidName, msg) {
		const raid = this.json[raidName],
			nextRotationTimeUTC = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(raid.next.rotationTimeUTC))[0] || raid.config.rotationTimesUTC[0];

		if (raid.active) {
			msg.reply(`don't fool me! __${raidName}__ is already active!`);
		} else {
			msg.reply(`yes sir! Adding new __${raidName}__ to the <#${channels.raid_log}>`);

			this.undoJson = JSON.parse(JSON.stringify(this.json));

			if (raid.config.registrationHours > 0) {
				this.json[raidName].active = {
					rotationTimeUTC: raid.next.rotationTimeUTC,
					initiatorID: msg.author.id,
					phase: 0
				};

				this.channels.raids_comm.send(`__${raidName}__ is now open for registration.`);
			} else {
				let nextPhase = (raid.config.phases.count > 1) ? `P1 ` : '';

				this.json[raidName].active = {
					rotationTimeUTC: raid.next.rotationTimeUTC,
					initiatorID: msg.author.id,
					phase: 1
				};

				this.channels.raids_comm.send(`<@&${roles.member}> ${nextPhase}__${raidName}__ is now OPEN! :boom:`);
			}

			if (!DEV) {
				let that = this;

				this.channels.raid_log
					.send(`__${raidName}__ ${raid.next.rotationTimeUTC} UTC started by <@${msg.author.id}>`)
					.then(msg => that.saveLastMessage(msg.id));
			}

			this.json[raidName].next = {
				rotationTimeUTC: nextRotationTimeUTC
			};

			this.updateJSON();
			this.main(raidName);
		}
	}

	saveLastMessage(msgId) {
		this.lastMessageId = msgId;
	}

	findNextEvents() {
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

		return nextEvents;
	}

	scheduleReminder(raid) {
		let remindMinutesBefore = 5,
			diff = raid.diff - (remindMinutesBefore * 60 * 1000),
			nextRaidDiff,
			nextRaidDiffVerbose;

		this.timeouts[raid.type] = this.timeouts[raid.type] || [];

		if (raid.phase === 0) { // remind @Officer to start raid
			if (raid.config.registrationHours === 0) {
				let phaseHold = raid.config.phases.holdHours * 60 * 60 * 1000;

				if (raid.diff > phaseHold) {
					nextRaidDiff = raid.diff - phaseHold;
					nextRaidDiffVerbose = `${raid.config.phases.holdHours} hours`;
				} else {
					nextRaidDiff = remindMinutesBefore * 60 * 1000;
					nextRaidDiffVerbose = this.getReadableTime(raid.diff - nextRaidDiff);
				}

				this.timeouts[raid.type].push(setTimeout(() => {
					this.channels.raids_comm.send(
						`Next __${raid.type}__ will probably start in ${nextRaidDiffVerbose} (if we have tickets).`
					);
				}, nextRaidDiff));
			}

			this.timeouts[raid.type].push(setTimeout(() => {
				this.channels.sergeants_office.send(
					`<@&${roles.officer}> Prepare to start ${raid.type} in ${remindMinutesBefore} minutes.`,
					{'tts': true}
				);
			}, diff));

			this.timeouts[raid.type].push(setTimeout(() => {
				this.channels.sergeants_office.send(
					`<@&${roles.officer}> Start __${raid.type}__ NOW and type \`-start ${raid.type.toLowerCase()}\``
				);
			}, raid.diff));

			this.timeouts[raid.type].push(setTimeout(() => {
				this.main(raid.type);
			}, raid.diff + 120000));

			console.log(`CloneSergeant.Raids.scheduleReminder(${raid.type}): ${raid.type} starts in ${this.getReadableTime(raid.diff)}`);
		} else if (raid.phase > 0 && raid.phase <= raid.config.phases.count) { // remind @Shaved Wookiee about open phase
			let nextPhase = (raid.config.phases.count > 1) ? `P${raid.phase} ` : '';

			if (raid.config.phases.count <= 1) {
				this.timeouts[raid.type].push(setTimeout(() => {
					this.channels.raids_comm.send(
						`<@&${roles.member}> ${nextPhase}__${raid.type}__ will open in ${remindMinutesBefore} minutes.`
					);
				}, diff));
			}

			this.timeouts[raid.type].push(setTimeout((isLastPhase = (raid.phase === raid.config.phases.count)) => {
				this.channels.raids_comm.send(
					`<@&${roles.member}> ${nextPhase}__${raid.type}__ is now OPEN! :boom:`
				);

				if (isLastPhase) { // this was the last phase - move raid to logs
					delete this.json[raid.type].active.phase;
					this.json[raid.type].log.push(this.json[raid.type].active);
					this.json[raid.type].active = null;
				} else {
					this.json[raid.type].active.phase++;
				}

				this.updateJSON();
			}, raid.diff));

			this.timeouts[raid.type].push(setTimeout(() => {
				this.main(raid.type);
			}, raid.diff + 120000));

			console.log(`CloneSergeant.Raids.scheduleReminder(${raid.type}): ${nextPhase}${raid.type} opens in ${this.getReadableTime(raid.diff)}`);
		}
	}

	clearTimeouts(raid) {
		console.log(`CloneSergeant.Raids.clearTimeouts(${raid}): ${this.timeouts[raid].length} timeouts`);

		if (raid && this.timeouts[raid]) {
			this.timeouts[raid].forEach((timeout) => {
				clearTimeout(timeout);
			});
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
