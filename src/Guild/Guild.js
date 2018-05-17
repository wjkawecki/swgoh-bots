import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class Guild {
	constructor(config) {
		console.log(`${config.guildName} ready`);
		this.Client = new Discord.Client();
		this.Client.login(config.botToken);
		this.Client.on('ready', async () => {
			console.log(`${config.guildName}.Client`);

			this.Client.user.setActivity(config.guildName);

			new Raids(this.Client, config);
			new DailyActivities(this.Client, config);
		});
	}
}