import helpers from '../../../helpers/helpers';
import Discord from 'discord.js';

export default class Schedule {
  constructor(Client, config, channel, data) {
    this.Client = Client;
    this.config = config;
    this.channel = channel;
    this.data = data;
    this.payouts = data.payouts;

    // this.listenToMessages();
    this.main();
  }

  main() {
    try {
      if (this.message) {
        this.calculateSecondsUntilPayout();
        this.sendMessage();
      } else {
        this.fetchMessage();
      }
    } catch (err) {
      console.log(err.message);
    } finally {
      const timeout = 60000 - (Date.now() % 60000);

      if (this.config.DEV) {
        // console.log(`${this.config.name}: refresh in ${helpers.getReadableTime(timeout)}`);
      }
      setTimeout(() => this.main(), 60000 - (Date.now() % 60000));
    }
  }

  fetchMessage() {
    this.channel.fetchMessages().then(messages => {
      if (messages) {
        if (messages.array().length === 0) {
          try {
            this.message = this.channel.send({ embed: new Discord.RichEmbed() });
          } catch (err) {
            console.log(err);
          }
        } else {
          if (messages.last().embeds.length === 0) {
            messages.forEach(async message => {
              try {
                await message.delete();
              } catch (err) {
                console.log(err);
              }
            });

            this.message = this.channel.send({ embed: new Discord.RichEmbed() });
          } else {
            this.message = messages.last();
          }
        }
      }
    });
  }

  calculateSecondsUntilPayout() {
    const now = new Date();

    for (let i in this.payouts) {
      const payout = this.payouts[i];
      const p = new Date();

      // console.log(String(payout.payout), 'hour', String(payout.payout).substr(0, 2), 'min', String(payout.payout).substr(2, 2));

      p.setUTCHours(String(payout.payout).substr(0, 2), String(payout.payout).substr(2, 2), 0, 0);

      if (p < now) {
        p.setDate(p.getDate() + 1);
      }

      payout.timeUntilPayout = p.getTime() - now.getTime();

      let dif = new Date(payout.timeUntilPayout);
      const round = dif.getTime() % 60000;

      if (round < 30000) {
        dif.setTime(dif.getTime() - round);
      } else {
        dif.setTime(dif.getTime() + 60000 - round);
      }

      payout.time = `${String(dif.getUTCHours()).padStart(2, '00')}h ${String(dif.getUTCMinutes()).padStart(2, '00')}m`;
      payout.players.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.payouts.sort((a, b) => a.timeUntilPayout - b.timeUntilPayout);
  }

  async sendMessage() {
    try {
      let embed = new Discord.RichEmbed(),
        desc = '';

      for (let i in this.payouts) {
        if (i > '1') {
          desc += '\n_ _';
        }

        desc += `\n\`${this.payouts[i].time}\`_ _ _ _`;
        for (let j in this.payouts[i].players) {
          const player = this.payouts[i].players[j];

          desc += `${player.flag || this.data.defaultFlag} ${player.name.replace(/_/g, ' ').trim()} · `;
        }

        if (i === '0') {
          desc = desc.substring(0, desc.length - 3);

          desc += '\n_ _\n_ _\n__Following payouts:__\n';
        } else {
          desc = desc.substring(0, desc.length - 3);
        }
      }

      embed
        .setDescription(desc)
        .setColor(this.data.embedColor)
        .setAuthor(`Next payout - ${this.payouts[0].payout} UTC${this.config.DEV ? ' [DEV]' : ''}:`)
        .setTimestamp();

      await this.message.edit({ embed });
    } catch (err) {
      console.log('sendMessage', err.message);
    }
  }
}
