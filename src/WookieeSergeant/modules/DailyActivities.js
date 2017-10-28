const DEV = true;

const channels = {
		the_guild_lounge: '324023862771712011',
		bot_playground: '371742456653414410'
	},
	roles = {
		officer: '324139861709946901',
		shavedWookiee: '324184776871510016'
	};

export default class DailyActivities {
	constructor(Client) {
		console.log(`WookieeSergeant.DailyActivities ready${DEV ? ' (DEV mode)' : ''}`);

		this.Client = Client;
		this.timeouts = [];

		this.initChannels(channels);
		this.listenToMessages();
		this.main();
	}

	async main() {
		try {
			console.log('WookieeSergeant.DailyActivities.main()');

			// do something
			// this.clearTimeout();
			// this.setTimeout();
		} catch (err) {
			console.log(err);
		}
	}

	initChannels(channels) {
		this.channels = {};

		for (let key in channels) {
			if (DEV) {
				this.channels[key] = this.Client.channels.get(channels.bot_playground);
			} else {
				this.channels[key] = this.Client.channels.get(channels[key]);
			}
		}
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			switch (msg.content.toLowerCase()) {

				case '-help':
					this.helpReply(msg);
					break;
			}

			if (this.isBotMentioned(msg))
				this.helpReply(msg);
		});
	}

	helpReply(msg) {
		msg.reply(`Here is the list of my __DailyActivities__ commands:\n\`-help\` - this is what you are reading right now.`);
	}

	isBotMentioned(msg) {
		return msg.mentions.users.has(this.Client.user.id);
	}
}
