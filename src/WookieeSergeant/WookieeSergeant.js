import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class WookieeSergeant {
	constructor() {
		console.log('WookieeSergeant ready');

		this.Client = new Discord.Client();
		this.Client.login(process.env.TOKEN_WOOKIEESERGEANT);
		this.Client.on('ready', async () => {
			console.log('WookieeSergeant.Client');

			this.Client.user.setGame('FTB FiWi');

			new Raids(this.Client);
			new DailyActivities(this.Client);
		});
	}
}
