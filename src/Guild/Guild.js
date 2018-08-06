import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class Guild {
	constructor(config) {
		console.log(`${config.guildName} ready`);
		this.Client = new Discord.Client();
		this.Client.login(config.botToken).catch(console.error);
		this.Client.on('ready', config => this.initGuild(config));
	}

	async initGuild(config) {
		try {
			this.Client.user.setActivity(config.guildName).catch(console.error);

			new Raids(this.Client, config);
			new DailyActivities(this.Client, config);
		} catch (err) {
			console.log('initGuild', err.message);
			this.initGuild();
		}
	}
}
