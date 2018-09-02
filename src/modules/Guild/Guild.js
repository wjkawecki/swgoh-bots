import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import * as fs from 'fs';

import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';
import TerritoryBattles from './modules/TerritoryBattles';

export default class Guild {
	constructor(config) {
		this.readMongo(config);
	}

	async readMongo(config) {
		try {
			mongodb.MongoClient.connect(config.mongoUrl, { useNewUrlParser: true }, (err, client) => {
					if (err) throw err;
					client.db().collection(config.mongoCollection).findOne()
						.then(mongo => this.createLocalJSON(config, mongo))
						.then(mongo => this.initClient(config, mongo))
						.then(() => client.close());
				});
		} catch (err) {
			console.log(`${config.guildName}: readMongo error`, err.message);
			setTimeout(() => this.readMongo(config), config.retryTimeout);
		}
	}

	createLocalJSON(config, mongo) {
		if (config.DEV) {
			const jsonMongoPath = __dirname + '/../../..' + config.jsonMongoPath.replace('#guildName#', config.guildName);
			const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#guildName#', config.guildName);

			fs.writeFileSync(jsonMongoPath, JSON.stringify(mongo));

			try {
				JSON.parse(fs.readFileSync(jsonLocalPath));
			} catch (err) {
				fs.writeFileSync(jsonLocalPath, JSON.stringify(mongo));
			}
		}

		return mongo;
	}

	initClient(config, mongo) {
		const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#guildName#', config.guildName);
		let data = null;

		if (config.DEV) {
			try {
				data = JSON.parse(fs.readFileSync(jsonLocalPath));
			} catch (err) {
				data = mongo;
			}
		} else {
			data = mongo;
		}

		this.Client = new Discord.Client();
		this.Client.on('ready', () => this.initGuild(config, data));
		this.Client.on('error', err => console.log(`${config.guildName}: Client error`, err.message));
		this.loginClient(config, data);
	}

	loginClient(config, data) {
		this.Client.login(config.botToken)
			.catch(err => {
				console.log(`${config.guildName}: Client.login error`, err.message);
				setTimeout(() => this.loginClient(config, data), config.retryTimeout);
			});


	}

	initGuild(config, data) {
		try {
			const channels = this.initChannels(config);

			this.Client.user.setActivity(config.guildName);

			if (config.DEV) {
				// channels.bot_playground.send('DEV reporting for duty!');
			} else {
				channels.bot_playground.send('Reporting for duty!');
			}

			// GUILD MODULES

			if (config.resetTimeUTC && Object.keys(config.resetTimeUTC).length)
				new DailyActivities(this.Client, config, channels);

			if (data.raids && Object.keys(data.raids).length)
				new Raids(this.Client, config, channels, data.raids);

			if (data.lstb && Object.keys(data.lstb).length)
				new TerritoryBattles(this.Client, config, channels, data.lstb);

			if (data.dstb && Object.keys(data.dstb).length)
				new TerritoryBattles(this.Client, config, channels, data.dstb);

		} catch (err) {
			console.log(`${config.guildName}: initGuild error`, err.message);
			setTimeout(() => this.initGuild(config, data), config.retryTimeout);
		}
	}

	initChannels(config) {
		const channels = {};

		for (let key in config.channels) {
			if (config.DEV) {
				channels[key] = this.Client.channels.get(config.channels.bot_playground);
			} else {
				channels[key] = this.Client.channels.get(config.channels[key]);
			}
		}

		return channels;
	}
}
