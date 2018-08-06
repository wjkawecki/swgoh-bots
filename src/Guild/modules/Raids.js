import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import path from 'path';
import * as fs from 'fs';

const MongoClient = mongodb.MongoClient;

export default class Raids {
	constructor(Client, config) {
		this.config = config;

		// console.log(`=== ${config.guildName}.Raids ready${config.DEV ? ' (DEV mode)' : ''}`);

		this.Client = Client;
		this.timeouts = {};

		this.initChannels(config.channels);
		this.listenToMessages();

		if (config.DEV) {
			// this.clearChannel(this.channels.bot_playground, true);
			this.restoreJSON();
		} else {
			// this.channels.bot_playground.send(`${config.guildName}.Raids on duty!`);
		}

		this.main();
	}

	initChannels(channels) {
		this.channels = {};

		for (let key in channels) {
			if (this.config.DEV) {
				this.channels[key] = this.Client.channels.get(channels.bot_playground).catch(console.error);
			} else {
				this.channels[key] = this.Client.channels.get(channels[key]).catch(console.error);
			}
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.toLowerCase().slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift();

			switch (command) {

				case 'start':
					if (msg.member.roles.has(this.config.roles.officer))
						this.startRaid(msg, args[0]);
					break;

				case 'raids':
				case 'raid':
					if (msg.member.roles.has(this.config.roles.officer))
						this.printRaid(msg, args[0]);
					break;

				case 'next':
					if (msg.member.roles.has(this.config.roles.officer))
						this.nextRaid(msg, args[0]);
					break;

				case 'undo':
					if (msg.member.roles.has(this.config.roles.officer))
						this.undo(msg);
					break;

				case 'json':
					if (msg.member.roles.has(this.config.roles.officer))
						console.log(JSON.stringify(this.json, null, 4));
					break;

				case 'help':
					if (msg.member.roles.has(this.config.roles.member))
						this.helpReply(msg);
					break;
			}

			if (this.isBotMentioned(msg))
				if (msg.member.roles.has(this.config.roles.member))
					this.helpReply(msg);
		});
	}

	printRaid(msg, raidKey = null) {
		if (raidKey && this.json[raidKey]) {
			this.Client.channels.get(msg.channel.id).send(this.buildRaidEmbed(raidKey)).catch(console.error);
		} else {
			for (let raidKey in this.json) {
				this.Client.channels.get(msg.channel.id).send(this.buildRaidEmbed(raidKey)).catch(console.error);
			}
		}
	}

	nextRaid(msg, raidKey = null) {
		if (raidKey && this.json[raidKey]) {
			const raid = this.json[raidKey],
				nextRotationTimeUTC = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(raid.next.rotationTimeUTC))[0] || raid.config.rotationTimesUTC[0];

			raid.active = null;

			raid.next = {
				rotationTimeUTC: nextRotationTimeUTC
			};

			this.updateJSON();
			this.printRaid(msg, raidKey);
			this.main(raidKey);
		} else {
			msg.reply(`please specify which raid (\`${Object.keys(this.json).join('`, `')}\`) you want to change. Example: \`-next rancor\``).catch(console.error);
		}
	}

	buildRaidEmbed(raidKey) {
		let embed, raid, desc, thumbnailSrc;

		raid = this.json[raidKey];
		thumbnailSrc = this.config.thumbnails[raidKey] || null;

		desc = `:repeat: UTC Rotations: ${raid.config.rotationTimesUTC && raid.config.rotationTimesUTC.map(hour => this.convert24to12(hour)).join(', ')}
		
:arrow_forward: Active: ${raid.active ? this.convert24to12(raid.active.rotationTimeUTC) : '-'}
:fast_forward: Next: ${raid.next ? this.convert24to12(raid.next.rotationTimeUTC) : '-'}
${raid.active ? '' : `
\`-start ${raidKey}\` to start ${this.convert24to12(raid.next.rotationTimeUTC)} raid.`}
\`-next ${raidKey}\` to move to next rotation without starting.
\`-undo\` to revert your last action.`;

		embed = new Discord.RichEmbed()
			.setAuthor(`${raidKey ? this.json[raidKey].name : this.config.guildName} Raid Settings`)
			.setDescription(desc)
			.setThumbnail(thumbnailSrc)
			.setColor(0x7289da);

		return embed;
	}

	helpReply(msg) {
		msg.reply(`here is the list of my __Raids__ commands:]
\`-raid [${Object.keys(this.json).join(', ')}]\` *- officer only*. Display current [raid] settings.
\`-start [${Object.keys(this.json).join(', ')}]\` *- officer only*. Starts next [raid] according to schedule.
\`-next [${Object.keys(this.json).join(', ')}]\` *- officer only*. Change [raid] setting to next rotation.
\`-undo\` *- officer only*. Undo your last action!
\`-help\` - this is what you are reading right now.`);
	}

	undo(msg) {
		if (this.undoJsonArray && this.undoJsonArray.length > 1) {
			msg.reply(`I have reverted your last action. Just like nothing happened!`).catch(console.error);

			console.log(JSON.stringify(this.undoJsonArray, null, 4));

			this.undoJsonArray.pop();
			this.json = JSON.parse(JSON.stringify(this.undoJsonArray.pop())).catch(console.error);

			if (!this.config.DEV) {
				this.clearChannel(this.channels.raids_log);
			}

			this.updateJSON();
			this.printRaid(msg);
			this.main();
		} else {
			msg.reply(`I am so sorry, but there is nothing I can do! Maybe <@209632024783355904> can help?`).catch(console.error);
		}
	}

	isBotMentioned(msg) {
		return msg.mentions.users.has(this.Client.user.id);
	}

	async main(raidKey = '') {
		try {
			// console.log(`${this.config.guildName}.Raids.main(${raid})`);
			this.readJSON(raidKey);
		} catch (err) {
			console.log('main', err.message);
			this.readJSON(raidKey);
		}
	}

	async clearChannel(channel, removeAll = false) {
		// console.log(`${this.config.guildName}.Raids.clearChannel()`);
		try {
			if (removeAll) {
				const messages = await channel.fetchMessages().catch(console.error);

				if (messages) {
					messages.forEach(async (message) => {
						await message.delete().catch(console.error);
					});
				}
			} else {
				const message = await channel.fetchMessage(this.lastMessageId).catch(console.error);

				if (message)
					await message.delete().catch(console.error);
			}
		} catch (err) {
			console.log('clearChannel', err.message);
		}
	}

	readJSON(raidKey) {
		let that = this;

		if (this.config.DEV) {
			this.json = this.json || JSON.parse(fs.readFileSync(path.resolve(__dirname, this.config.jsonPath))).raids;
			// console.log(`${this.config.guildName}.Raids.readJSON(${raid}): local ${typeof that.json}`);
			this.processRaids(raidKey);
		} else {
			if (!this.json) {
				try {
					MongoClient.connect(this.config.mongoUrl, function (err, db) {
						if (err) throw err;
						db.collection(that.config.mongoCollection).findOne({}, function (err, result) {
							if (err) throw err;
							that.json = result.raids;
							that.undoJsonArray = that.undoJsonArray || [];
							that.undoJsonArray.push(JSON.parse(JSON.stringify(that.json)));
							db.close();
							// console.log(`${that.config.guildName}.Raids.readJSON(${raid}): MongoDB ${typeof that.json}`);
							that.processRaids(raidKey);
						});
					}).catch(console.error);
				} catch (err) {
					console.log(`${that.config.guildName}.Raids.readJSON(): MongoDB read error`, err.message);
					this.readJSON(raidKey);
				}
			} else {
				// console.log(`${this.config.guildName}.Raids.readJSON(${raid}): local ${typeof that.json}`);
				this.undoJsonArray = this.undoJsonArray || [];
				this.undoJsonArray.push(JSON.parse(JSON.stringify(this.json)));
				this.processRaids(raidKey);
			}
		}

	}

	updateJSON() {
		if (this.config.DEV) {
			fs.writeFileSync(path.resolve(__dirname, this.config.jsonPath), JSON.stringify({'raids': this.json}));
			// this.channels.bot_playground.send(JSON.stringify(this.json));
		} else {
			let that = this,
				json = {raids: that.json};

			try {
				MongoClient.connect(this.config.mongoUrl, function (err, db) {
					if (err) throw err;
					db.collection(that.config.mongoCollection).updateOne({}, json, function (err, result) {
						if (err) throw err;
						// console.log(`${that.config.guildName}.Raids.updateJSON(): MongoDB updated (${result.result.nModified})`);
						db.close();
					});
				}).catch(console.error);
			} catch (err) {
				console.log(`${that.config.guildName}.Raids.updateJSON(): MongoDB update error`, err.message);
				this.updateJSON();
			}
		}
	}

	restoreJSON() {
		if (this.config.DEV) {
			// console.log(`${this.config.guildName}.Raids.restoreJSON()`);

			let jsonStable = fs.readFileSync(path.resolve(__dirname, this.config.jsonStablePath));

			fs.writeFileSync(path.resolve(__dirname, this.config.jsonPath), jsonStable);
		}
	}

	processRaids(raidKey) {
		if (raidKey) {
			this.clearTimeouts(raidKey);
			this.scheduleReminder(this.findNextEvents().find(event => event.raidKey === raidKey));
		} else {
			this.findNextEvents().forEach(event => this.scheduleReminder(event));
		}
	}

	startRaid(msg, raidKey) {
		if (raidKey && this.json[raidKey]) {
			const raidName = this.json[raidKey].name || raidKey;
			const raid = this.json[raidKey],
				nextRotationTimeUTC = raid.config.rotationTimesUTC.filter(this.findNextLaunchHour(raid.next.rotationTimeUTC))[0] || raid.config.rotationTimesUTC[0];

			if (raid.active) {
				msg.reply(`don't fool me! __${raidName}__ is already active!`).catch(console.error);
			} else {
				msg.reply(`added __${raidName}__ to the <#${this.config.channels.raids_log}>\nNext rotation: :clock${this.convert24to12(nextRotationTimeUTC, false)}: **${this.convert24to12(nextRotationTimeUTC)} UTC**`).catch(console.error);

				if (raid.config.registrationHours > 0) {
					this.json[raidKey].active = {
						rotationTimeUTC: raid.next.rotationTimeUTC,
						initiatorID: msg.author.id,
						phase: 0
					};

					this.channels.raids_comm.send(`__${raidName}__ registration is now open for ${raid.config.registrationHours} hours.`).catch(console.error);
				} else {
					let nextPhase = raid.config.phases[0].text;
					let nextPhaseHold = raid.config.phases[1] && raid.config.phases[1].holdHours ? `\nNext phase opens in ${raid.config.phases[1].holdHours} hours.` : '';

					this.json[raidKey].active = {
						rotationTimeUTC: raid.next.rotationTimeUTC,
						initiatorID: msg.author.id,
						phase: 1
					};

					this.channels.raids_comm.send(`<@&${this.config.roles.member}> __${raidName}__ ${nextPhase} is now OPEN! :boom:${nextPhaseHold}`).catch(console.error);
				}

				if (!this.config.DEV) {
					let that = this;

					this.channels.raids_log
						.send(`__${raidName}__: ${this.convert24to12(raid.next.rotationTimeUTC)} UTC started by <@${msg.author.id}>\nNext rotation: :clock${this.convert24to12(nextRotationTimeUTC, false)}: **${this.convert24to12(nextRotationTimeUTC)} UTC**`)
						.then(msg => that.saveLastMessage(msg.id))
						.catch(console.error);
				}

				this.json[raidKey].next = {
					rotationTimeUTC: nextRotationTimeUTC
				};

				this.updateJSON();
				this.main(raidKey);
			}
		} else {
			msg.reply(`please specify which raid (\`${Object.keys(this.json).join('`, `')}\`) you want to start. Example: \`-start rancor\``).catch(console.error);
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

			nextEvent.raidKey = raid;
			raid = this.json[raid];

			if (raid.active) {
				const holdHours = raid.config.phases.reduce((total, phase, index) => index <= raid.active.phase ? total + phase.holdHours : total, 0);
				nextEvent.hour = (raid.active.rotationTimeUTC + raid.config.registrationHours + holdHours) % 24;
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
			nextEvent.name = raid.name;

			nextEvents.push(nextEvent);
		}

		nextEvents.sort(function (a, b) {
			return a.diff - b.diff;
		});

		return nextEvents;
	}

	scheduleReminder(raid) {
		let remindMinutesBefore = 5,
			remindHoursBefore = 1,
			diffMinutes = raid.diff - (remindMinutesBefore * 60 * 1000),
			diffHours = raid.diff - (remindHoursBefore * 60 * 60 * 1000);
			// nextRaidDiff,
			// nextRaidDiffVerbose;

		this.timeouts[raid.raidKey] = this.timeouts[raid.raidKey] || [];

		if (raid.phase === 0) { // remind @Officer to start raid
			// if (raid.config.registrationHours === 0) {
			// 	let reminderTime = remindHoursBefore * 60 * 60 * 1000;
			//
			// 	if (raid.diff > reminderTime) {
			// 		nextRaidDiff = raid.diff - reminderTime;
			// 		nextRaidDiffVerbose = `${remindHoursBefore} hours`;
			//
			// 		this.timeouts[raid.type].push(setTimeout(() => {
			// 			this.channels.raids_comm.send(
			// 				`__${raid.type}__ will _probably_ start in ${nextRaidDiffVerbose} - ${raid.hour} UTC (__if we have tickets__).`
			// 			);
			// 		}, nextRaidDiff));
			// 	}
			// }

			this.timeouts[raid.raidKey].push(setTimeout(() => {
				this.channels.sergeants_office.send(
					`<@&${this.config.roles.officer}> Prepare to start ${raid.name} in ${remindMinutesBefore} minutes.`,
					{'tts': true}
				).catch(console.error);
			}, diffMinutes));

			this.timeouts[raid.raidKey].push(setTimeout(() => {
				this.channels.sergeants_office.send(
					`<@&${this.config.roles.officer}> Start __${raid.name}__ NOW and type \`-start ${raid.raidKey}\``
				).catch(console.error);
			}, raid.diff));

			this.timeouts[raid.raidKey].push(setTimeout(() => {
				this.main(raid.raidKey);
			}, raid.diff + 120000));

			console.log(`${this.config.guildName}: ${raid.name} starts in ${this.getReadableTime(raid.diff)}`);
		} else if (raid.phase > 0 && raid.phase <= raid.config.phases.length) { // remind members about open phase
			// let nextPhase = (raid.config.phases.length > 1) ? `P${raid.phase} ` : '';
			let nextPhase = raid.config.phases[raid.phase - 1].text;

			if (raid.diff > (remindHoursBefore * 60 * 60 * 1000) && raid.config.phases.length <= 1) {
				this.timeouts[raid.raidKey].push(setTimeout(() => {
					this.channels.raids_comm
						.send(`__${raid.name}__ ${nextPhase} opens in ${remindHoursBefore} ${remindHoursBefore > 1 ? 'hours' : 'hour'} - ${this.convert24to12(raid.hour)} UTC.`).catch(console.error);
				}, diffHours));
			}

			if (raid.diff > (remindMinutesBefore * 60 * 1000) && raid.config.phases.length <= 1) {
				this.timeouts[raid.raidKey].push(setTimeout(() => {
					this.channels.raids_comm
						.send(`<@&${this.config.roles.member}> __${raid.name}__ ${nextPhase} opens in ${remindMinutesBefore} minutes.`).catch(console.error);
				}, diffMinutes));
			}

			this.timeouts[raid.raidKey].push(setTimeout((isLastPhase = (raid.phase === raid.config.phases.length)) => {
				let nextPhaseHold;

				if (isLastPhase) { // this was the last phase
					nextPhaseHold = '';
					this.json[raid.raidKey].active = null;
				} else {
					nextPhaseHold = raid.config.phases[raid.phase] && raid.config.phases[raid.phase].holdHours ? `\n\n[next phase opens in ${raid.config.phases[raid.phase].holdHours}h]` : '';
					this.json[raid.raidKey].active.phase++;
				}

				this.channels.raids_comm.send(
					`<@&${this.config.roles.member}> __${raid.name}__ ${nextPhase} is now OPEN! :boom:${nextPhaseHold}`
				).catch(console.error);

				this.updateJSON();
			}, raid.diff));

			this.timeouts[raid.raidKey].push(setTimeout(() => {
				this.main(raid.raidKey);
			}, raid.diff + 120000));

			console.log(`${this.config.guildName}: ${raid.name} ${nextPhase} opens in ${this.getReadableTime(raid.diff)} / next in ${raid.config.phases[raid.phase] && raid.config.phases[raid.phase].holdHours} h`);
		}
	}

	clearTimeouts(raidKey) {
		// console.log(`${this.config.guildName}.Raids.clearTimeouts(${raid}): ${this.timeouts[raid].length} timeouts`);

		if (raidKey && this.timeouts[raidKey]) {
			this.timeouts[raidKey].forEach((timeout) => {
				clearTimeout(timeout);
			});
		}
	}

	findNextLaunchHour(nowHour) {
		return function (rotationTimesUTC) {
			return (rotationTimesUTC > nowHour);
		}
	}

	convert24to12(hour, returnString = true) {
		const string = hour < 12 ? ' AM' : ' PM';
		return `${(hour % 12) || 12}${returnString ? string : ''}`;
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
