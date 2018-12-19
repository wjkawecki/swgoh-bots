import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import * as fs from 'fs';

import Schedule from './modules/Schedule';

export default class Arena {
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
			console.log(`${config.name}: readMongo error`, err.message);
			setTimeout(() => this.readMongo(config), config.retryTimeout);
		}
	}

	createLocalJSON(config, mongo) {
		if (config.DEV) {
			const jsonMongoPath = __dirname + '/../../..' + config.jsonMongoPath.replace('#name#', config.name);
			const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#name#', config.name);

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
		const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#name#', config.name);
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

		this.Client = new Discord.Client({
			messageCacheMaxSize: -1,
			fetchAllMembers: true,
			sync: true
		});
		this.Client.on('ready', () => this.initArena(config, data));
		this.Client.on('error', error => console.log(`${config.name}: Client error:`, error.message));
		this.Client.on('reconnecting',() => console.log(`${config.name}: Client reconnecting`));
		this.Client.on('resume', replayed => console.log(`${config.name}: Client resume:`, replayed));
		this.Client.on('disconnect',() => console.log(`${config.name}: Client disconnect`));
		this.loginClient(config);
	}

	loginClient(config) {
		this.Client.login(config.botToken)
			.catch(err => {
				console.log(`${config.name}: Client.login error: `, err.message);
				setTimeout(() => this.readMongo(config), config.retryTimeout);
			});


	}

	initArena(config, data) {
		try {
			const channels = this.initChannels(config);
			const guild = this.Client.guilds.first();

			this.Client.user.setActivity(config.name);

			console.log(`=== ${config.name}: ${guild.memberCount} members | ${guild.channels.size} channels ===`);

			// ARENA MODULES

			if (data.payouts && Object.keys(data.payouts).length && !this.Payouts)
				this.Payouts = new Schedule(this.Client, config, channels.payout, data.payouts);

			if (data.snipers && Object.keys(data.snipers).length && !this.Snipers)
				this.Snipers = new Schedule(this.Client, config, channels.snipers, data.snipers);

		} catch (err) {
			console.log(`${config.name}: initArena error`, err.message);
			setTimeout(() => this.initArena(config, data), config.retryTimeout);
		}
	}

	initChannels(config) {
		const channels = {};

		for (let key in config.channels) {
			channels[key] = this.Client.channels.get(config.channels[key]);
		}

		return channels;
	}
}
