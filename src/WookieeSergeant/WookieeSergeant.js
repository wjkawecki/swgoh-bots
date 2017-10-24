import Client from './modules/client/Client';
import Raids from './modules/raids/Raids';

export default class WookieeSergeant {
	constructor(botToken) {
		console.log('WookieeSergeant ready');

		this.Client = new Client(botToken).client;
		this.Client.on('ready', async () => {
			new Raids(this.Client);
		});
	}
}
