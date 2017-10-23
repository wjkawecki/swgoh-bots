import Client from './modules/client/Client';
import Raids from './modules/raids/Raids';
import Arena from './modules/arena/Arena';

export default class WookieeSergeant {
	constructor(botToken) {
		console.log('WookieeSergeant ready');

		this.Client = new Client(botToken).client;
		this.Client.on('ready', async () => {
			new Raids(this.Client);
			// new Arena(this.Client);
		});
	}
}
