import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class WookieeSergeant {
	constructor(botToken) {
		console.log('WookieeSergeant ready');

		this.Client = new Discord.Client();
		this.Client.login(botToken);
		this.Client.on('ready', async () => {
			console.log('WookieeSergeant.Client');

			this.Client.user.setGame('FTB Shaved Wookiees');

			new Raids(this.Client);
			new DailyActivities(this.Client);
		});
	}
}
