'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _discord = require('discord.js');

var _discord2 = _interopRequireDefault(_discord);

var _nightmare = require('nightmare');

var _nightmare2 = _interopRequireDefault(_nightmare);

var _xlsx = require('xlsx');

var _xlsx2 = _interopRequireDefault(_xlsx);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const nightmare = (0, _nightmare2.default)({
	show: true,
	openDevTools: {
		mode: 'detach'
	}
});

const readChannelId = '360337936203382796';
const writeChannelId = '360337936203382796';
const xlsxUrl = 'https://onedriv	e.live.com/view.aspx?resid=B92275A9BF72C170!40986&ithint=file%2cxlsx&app=Excel&authkey=!AJDJRXahXJTfaUU';

class Bot {
	constructor(botToken) {
		this.main = this.main.bind(this);

		this.botToken = botToken;

		this.client = new _discord2.default.Client();
		this.client.on("ready", async () => {
			this.client.user.setGame('live countdowns until payout');
			this.readChannel = this.client.channels.get(readChannelId);
			this.writeChannel = this.client.channels.get(writeChannelId);

			this.initializeBot();
			console.log('Bot initialized');
		});

		this.client.login(botToken);

		// scrape Excel online
		// TODO not working right now, nightmare is unable to find elements by selectors
		// await this.scrapeXlsx()
		// TODO workaround: parse local xlsx file
		this.sheet = _xlsx2.default.utils.sheet_to_json(_xlsx2.default.readFile(_path2.default.resolve(__dirname, '../SWGoH_Shard.xlsx')).Sheets.Sheet1);

		this.parseXlsx();

		this.main();
	}

	async main() {
		try {
			if (this.message) {
				this.calculateSecondsUntilPayout();
				await this.sendMessage();
			}
		} catch (err) {
			console.log(err);
		} finally {
			setTimeout(this.main, 60000 - Date.now() % 60000);
		}
	}

	async initializeBot() {
		// fetch message. create a new one if necessary
		/* const a = (await this.writeChannel.fetchMessages()).array()
  for (let i in a) {
    await a[i].delete()
  } */
		const messages = await this.writeChannel.fetchMessages();
		if (messages.array().length === 0) {
			try {
				this.message = await this.writeChannel.send({ embed: new _discord2.default.RichEmbed() });
			} catch (err) {
				console.log(err);
			}
		} else {
			if (messages.first().embeds.length === 0) {
				await messages.first().delete();
				this.message = await this.writeChannel.send({ embed: new _discord2.default.RichEmbed() });
			} else {
				this.message = messages.first();
			}
		}
	}

	async scrapeXlsx() {
		try {
			// TODO oh my god, please let me scrape you, Excel online
			nightmare.goto(xlsxUrl).wait(5000).evaluate(() => {
				// console.log(document.querySelector('#m_excelWebRenderer_ewaCtl_commandUIPlaceHolder'))
				return document.querySelector('body');
			}).end().then(res => {
				console.log(res);
			});
		} catch (err) {
			console.error(err);
		}
	}

	parseXlsx() {
		this.mates = [];
		for (let i in this.sheet) {
			const user = this.sheet[i];
			this.mates.push({
				name: user.Name,
				payout: parseInt(user.UTC.substr(0, 2)),
				discordId: user.ID,
				flag: user.Flag,
				swgoh: user.SWGOH
			});
		}
		const matesByTime = {};
		for (let i in this.mates) {
			const mate = this.mates[i];
			if (!matesByTime[mate.payout]) {
				matesByTime[mate.payout] = {
					payout: mate.payout,
					mates: []
				};
			}
			matesByTime[mate.payout].mates.push(mate);
		}
		this.mates = Object.values(matesByTime);
	}

	calculateSecondsUntilPayout() {
		const now = new Date();
		for (let i in this.mates) {
			const mate = this.mates[i];
			const p = new Date();
			p.setUTCHours(mate.payout, 0, 0, 0);
			if (p < now) p.setDate(p.getDate() + 1);
			mate.timeUntilPayout = p.getTime() - now.getTime();
			let dif = new Date(mate.timeUntilPayout);
			const round = dif.getTime() % 60000;
			if (round < 30000) {
				dif.setTime(dif.getTime() - round);
			} else {
				dif.setTime(dif.getTime() + 60000 - round);
			}
			mate.time = `${String(dif.getUTCHours()).padStart(2, '00')}:${String(dif.getUTCMinutes()).padStart(2, '00')}`;
		}
		this.mates.sort((a, b) => {
			return a.timeUntilPayout - b.timeUntilPayout;
		});
	}

	async sendMessage() {
		let embed = new _discord2.default.RichEmbed().setColor(0x00AE86).setThumbnail('https://swgoh.gg/static/img/swgohgg-nav.png');
		let desc = '**Time until next payout**:';
		for (let i in this.mates) {
			desc += `\n\`${this.mates[i].time}\`   `;
			for (let j in this.mates[i].mates) {
				const mate = this.mates[i].mates[j];
				desc += `${mate.flag} [${mate.name}](${mate.swgoh})   `;
			}
		}

		/*18:00 SGT  | 10:00 GMT
  Pinnnkky
  18:00 MSK  | 15:00 GMT
  Gorra
  18:00 CEST | 16:00 GMT - #payout_cest
  Andreas Angin
  Ansirus
  Mops56
  Ronron
  Xilentis
  17:00 EST  | 21:00 GMT
  Faroer Laike
  18:00 EST  | 22:00 GMT - #payout_est
  Afatkid
  Kyle Katarn
  Rylb89
  18:00 PST  | 01:00 GMT - #payout_pst
  gnarlee
  Jezza
  Kabob
  Mascularn*/
		embed.setDescription(desc);
		embed.addField("18:00 SGT | 10:00 GMT", "Pinnnkky");
		embed.addField("18:00 MSK | 15:00 GMT", "Gorra");
		embed.addField("18:00 CEST | 16:00 GMT - #payout_cest", "Andreas Angin\nAnsiruss\nMops56\nRonron\nXilentis");
		embed.addField("17:00 EST  | 21:00 GMT", "Faroer Laike");
		embed.addField("18:00 EST  | 22:00 GMT - #payout_est", "Afatkid\nKyle Katarn\nRylb89");
		embed.addField("18:00 PST  | 01:00 GMT - #payout_pst", "gnarlee\nJezza\nKabob\nMascularn");
		await this.message.edit({ embed });
	}
}
exports.default = Bot;