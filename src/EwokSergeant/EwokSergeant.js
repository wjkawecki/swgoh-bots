import Discord from 'discord.js';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';

export default class EwokSergeant {
	constructor() {
		console.log('EwokSergeant ready');

		this.Client = new Discord.Client();
		this.Client.login(process.env.TOKEN_EWOKSERGEANT);
		this.Client.on('ready', async () => {
			console.log('EwokSergeant.Client');

			this.Client.user.setGame('FTB TiNT');

			new Raids(this.Client);
			new DailyActivities(this.Client);
		});
	}
}
