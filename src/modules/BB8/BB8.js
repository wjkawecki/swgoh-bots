import Discord from 'discord.js';
import XLSX from 'xlsx';
import path from 'path';

const writeChannelId = '360337936203382796';
const clientGame = 'Arena';

export default class BB8 {
	constructor(retryTimeout) {
		this.main = this.main.bind(this);

		this.sheet = XLSX.utils.sheet_to_json(XLSX.readFile(path.resolve(__dirname, '../../../data/BB8.xlsx')).Sheets.shard);
		this.parseXlsx();

		this.Client = new Discord.Client();
		this.Client.on('ready',  () => this.initBot());
		this.Client.on('error', error => console.log(`BB8: Client error:`, error.message));
		this.Client.on('reconnecting', () => console.log(`BB8: Client reconnecting`));
		this.Client.on('resume', replayed => console.log(`BB8: Client resume:`, replayed));
		this.Client.on('disconnect', () => console.log(`BB8: Client disconnect`));
		this.loginClient(retryTimeout);
	}

	loginClient(retryTimeout) {
		this.Client.login(process.env.TOKEN_BB8)
			.then(this.main)
			.catch(err => {
				console.log(`BB8: Client.login error`, err.message);
				setTimeout(() => this.loginClient(retryTimeout), retryTimeout);
			});
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
			this.Client.user.setActivity(clientGame);
			// this.readChannel = this.Client.channels.get(readChannelId);
			this.writeChannel = this.Client.channels.get(writeChannelId);

			const messages = await this.writeChannel.fetchMessages();

			if (messages) {
				if (messages.array().length === 0) {
					try {
						this.message = await this.writeChannel.send({embed: new Discord.RichEmbed()});
					} catch (err) {
						console.log(err);
					}
				} else {
					if (messages.last().embeds.length === 0) {
						messages.forEach(async (message) => {
							try {
								await message.delete();
							} catch (err) {
								console.log(err);
							}
						});

						this.message = await this.writeChannel.send({embed: new Discord.RichEmbed()});
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
				name: user.Name || '',
				payout: parseInt(user.UTC) || '',
				flag: user.Flag || '',
				swgohgg: user.SWGOHGG || ''
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
			mate.time = `${String(dif.getUTCHours()).padStart(2, '00')}h ${String(dif.getUTCMinutes()).padStart(2, '00')}m`;
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
					desc += '\n_ _';
				}

				desc += `\n\`${this.mates[i].time}\`_ _ _ _ _ _`;
				for (let j in this.mates[i].mates) {
					const mate = this.mates[i].mates[j];

					if (mate.flag.trim() !== ':skull:') {
						// desc += `${mate.flag.trim()} [${mate.name.trim()}](https://swgoh.gg/p/${mate.swgohgg.trim()}) · `;
						desc += `${mate.flag.trim()} ${mate.name.trim()} · `;
					}
				}

				if (i === '0') {
					for (let j in this.mates[i].mates) {
						const mate = this.mates[i].mates[j];

						if (mate.flag.trim() === ':skull:') {
							desc += `${mate.flag.trim()} ${mate.name.trim()} · `;
						}
					}

					desc = desc.substring(0, desc.length - 3);

					desc += '\n\n\nFollowing payouts:';
				} else {
					desc = desc.substring(0, desc.length - 3);
				}
			}

			embed
				.setDescription(desc)
				.setColor(0x00AE86)
				.setThumbnail('https://swgoh.gg/static/img/swgohgg-nav.png')
				.setAuthor('Next payout:')
				.setTimestamp();

			await this.message.edit({embed});
		} catch (err) {
			console.log('sendMessage', err.message);
		}
	}
}
