import Discord from 'discord.js';
import XLSX from 'xlsx';
import path from 'path';

const readChannelId = '360337936203382796';
const writeChannelId = '360337936203382796';
const clientGame = 'Arena';

export default class BB8 {
	constructor() {
		this.main = this.main.bind(this);
		this.client = new Discord.Client();
		this.client.on('ready', async () => this.initBot());

		this.client.login(process.env.TOKEN_BB8).catch(console.error);
		this.sheet = XLSX.utils.sheet_to_json(XLSX.readFile(path.resolve(__dirname, '../../data/BB8.xlsx')).Sheets.shard);

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
			console.log(err.message);
		} finally {
			setTimeout(this.main, 60000 - Date.now() % 60000);
		}
	}

	async initBot() {
		try {
			this.client.user.setActivity(clientGame).catch(console.error);
			// this.readChannel = this.client.channels.get(readChannelId);
			this.writeChannel = this.client.channels.get(writeChannelId).catch(console.error);

			const messages = await this.writeChannel.fetchMessages().catch(console.error);

			if (messages) {
				if (messages.array().length === 0) {
					try {
						this.message = await this.writeChannel.send({embed: new Discord.RichEmbed()}).catch(console.error);
					} catch (err) {
						console.log(err);
					}
				} else {
					if (messages.last().embeds.length === 0) {
						messages.forEach(async (message) => {
							try {
								await message.delete().catch(console.error);
							} catch (err) {
								console.log(err);
							}
						});

						this.message = await this.writeChannel.send({embed: new Discord.RichEmbed()}).catch(console.error);
					} else {
						this.message = messages.last();
					}
				}
			}

			console.log('=== BB8 ready');
		} catch (err) {
			console.log(err.message);
		}
	}

	parseXlsx() {
		this.mates = [];

		for (let i in this.sheet) {
			const user = this.sheet[i];

			this.mates.push({
				name: user.Name,
				payout: parseInt(user.UTC),
				flag: user.Flag,
				swgohgg: user.SWGOHGG
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
		})
	}

	async sendMessage() {
		try {
			let embed = new Discord.RichEmbed(),
				desc = '';

			for (let i in this.mates) {
				if (i > '1') {
					desc += '\n`-`';
				}

				desc += `\n\`${this.mates[i].time}\`    `;
				for (let j in this.mates[i].mates) {
					const mate = this.mates[i].mates[j];
					if (mate.swgohgg) {
						desc += `${mate.flag.trim()} [${mate.name.trim()}](https://swgoh.gg/u/${mate.swgohgg.trim()})    `;
					} else {
						desc += `${mate.flag.trim()} ${mate.name.trim()}    `;
					}
				}

				if (i === '0') {
					desc += '\n\n\nFollowing payouts:';
				}
			}

			embed
				.setDescription(desc)
				.setColor(0x00AE86)
				.setThumbnail('https://swgoh.gg/static/img/swgohgg-nav.png')
				.setAuthor('Next payout in:')
				.setTimestamp();

			await this.message.edit({embed}).catch(console.error);
		} catch (err) {
			console.log('sendMessage', err.message);
		}
	}
}
