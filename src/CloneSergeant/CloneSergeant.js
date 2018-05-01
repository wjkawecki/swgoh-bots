import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class CloneSergeant {
	constructor() {
		console.log('CloneSergeant ready');

		this.Client = new Discord.Client();
		this.Client.login(process.env.TOKEN_CLONESERGEANT);
		this.Client.on('ready', async () => {
			console.log('CloneSergeant.Client');

			this.Client.user.setGame('FTB DST');

			new Raids(this.Client);
			new DailyActivities(this.Client);
		});
	}
}
