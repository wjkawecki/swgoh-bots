import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import * as fs from 'fs';

import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class Guild {
	constructor(config) {
		this.readMongo(config);
	}

	readMongo(config) {
		try {
			mongodb.MongoClient.connect(config.mongoUrl, {useNewUrlParser: true}, (err, client) => {
				if (err) throw err;

				client.db().collection(config.mongoCollection).findOne({}, (err, mongo) => {
					if (err) throw err;

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

					this.initClient(config, mongo);
					client.close();
				});
			});
		} catch (err) {
			console.log(`${config.guildName}: readMongo error`, err.message);
			setTimeout(() => this.readMongo(config), 30);
		}
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
		this.Client.login(config.botToken);
		this.Client.on('ready', () => this.initGuild(config, data));
		this.Client.on('error', err => console.log(`${config.guildName}: Client error`, err.message));
	}

	initGuild(config, data) {
		try {
			this.Client.user.setActivity(config.guildName);

			if (config.resetTimeUTC && Object.keys(config.resetTimeUTC).length)
				new DailyActivities(this.Client, config);

			if (data.raids && Object.keys(data.raids).length)
				new Raids(this.Client, config, data.raids);

		} catch (err) {
			console.log(`${config.guildName}: initGuild error`, err.message);
			setTimeout(() => this.initGuild(config, data), 30);
		}
	}
}
