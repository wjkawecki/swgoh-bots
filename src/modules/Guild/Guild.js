import * as mongodb from 'mongodb';
import Discord from 'discord.js';
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

				client.db().collection(config.mongoCollection).findOne({}, (err, result) => {
					if (err) throw err;

					this.initClient(config, result);
					client.close();
				});
			});
		} catch (err) {
			console.log(`${config.guildName}: readMongo error`, err.message);
			setTimeout(() => this.readMongo(config), 30);
		}
	}

	initClient(config, mongo) {
		this.Client = new Discord.Client();
		this.Client.login(config.botToken);
		this.Client.on('ready', () => this.initGuild(config, mongo));
		this.Client.on('error', err => console.log(`${config.guildName}: Client error`, err.message));

	}

	initGuild(config, mongo) {
		try {
			this.Client.user.setActivity(config.guildName);

			new Raids(this.Client, config, mongo.raids);
			new DailyActivities(this.Client, config);
		} catch (err) {
			console.log(`${config.guildName}: initGuild error`, err.message);
			setTimeout(() => this.initGuild(config, mongo), 30);
		}
	}
}
