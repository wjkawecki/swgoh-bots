import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class Guild {
	constructor(config) {
		this.Client = new Discord.Client();
		this.Client.login(config.botToken);
		this.Client.on('ready', () => this.initGuild(config));
		this.Client.on('error', error => console.log(`${config.guildName}: Client error`, error.message));
	}

	initGuild(config) {
		try {
			console.log(`${config.guildName}: Client ready`);
			this.Client.user.setActivity(config.guildName);

			new Raids(this.Client, config);
			new DailyActivities(this.Client, config);
		} catch (err) {
			console.log(`${config.guildName}: initGuild error`, err.message);
			this.initGuild(config);
		}
	}
}
