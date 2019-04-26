import Discord from 'discord.js';
import helpers from '../../../helpers/helpers';

export default class DailyActivities {
  constructor(Client, config, channels) {
    this.Client = Client;
    this.config = config;
    this.channels = channels;

    this.listenToMessages();
    this.main();
  }

  main() {
    try {
      this.scheduleReminder();
    } catch (err) {
      console.log(`${this.config.name}: DailyActivities main`, err);
      setTimeout(() => this.scheduleReminder(), this.config.retryTimeout);
    }
  }

  listenToMessages() {
    this.Client.on('message', msg => {
      const args =
        msg.content
          .toLowerCase()
          .slice(this.config.commandPrefix.length)
          .trim()
          .split(/ +/g) || [];
      const command = args.shift();

      if (msg.channel.type !== 'text') return;
      if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
      if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
      if (msg.author.bot) return;

      switch (command) {
        case 'tickets':
          if (msg.member.roles.has(this.config.roles.officer)) this.scheduleReminder(true);
          break;

        case 'help':
          if (msg.member.roles.has(this.config.roles.member)) this.helpReply(msg);
          break;
      }
    });
  }

  helpReply(msg) {
    msg.reply(`__DailyActivities__ commands:
\`-tickets\` - sends a global motivating message with remaining time to guild reset.`);
  }

  scheduleReminder(manualReminder = false) {
    let remindMinutesBefore = this.config.remindMinutesBefore || 30,
      hour = this.config.resetTimeUTC.hour,
      minute = this.config.resetTimeUTC.minute,
      diff;

    this.resetDay = helpers.getEventDay(hour, minute);
    diff = helpers.getMillisecondsToEvent(hour, minute);

    if (manualReminder) {
      this.channels.guild_lounge.send(
        `<@&${this.config.roles.member}> we have ${helpers.getReadableTime(
          diff
        )} left to get as many raid tickets as possible. Go grab them now!`
      );
    } else {
      let reminderDiff = diff - remindMinutesBefore * 60 * 1000;

      if (reminderDiff > 0) {
        setTimeout(() => {
          const channel = this.channels.tickets_log || this.channels.guild_lounge;

          channel.send(
            `<@&${
              this.config.roles.member
            }> :six::zero::zero: **Tickets Reminder** - guild reset in __**${remindMinutesBefore} minutes**__.`
          );
        }, reminderDiff);
      }

      this.channels.tickets_log &&
        setTimeout(() => {
          this.channels.tickets_log.send(':repeat: **Guild Reset** - thank you for your tickets contribution!');
        }, diff);

      setTimeout((resetDay = this.resetDay) => {
        let embed = new Discord.RichEmbed(),
          activity = '',
          desc = '';

        switch (resetDay) {
          case 0: // Sunday
            activity = 'Cantina Battles';
            desc = `
:zap:  **Spend** Cantina Energy
:heavy_multiplication_x:  **Save** Normal Energy`;
            break;

          case 1: // Monday
            activity = 'Light Side Battles';
            desc = `
:zap:  **Spend** Normal Energy on Light Side Battles
:heavy_multiplication_x:  **Save** any other Energy (don't forget your 600)`;
            break;

          case 2: // Tuesday
            activity = 'Energy Battles';
            desc = `
:zap:  **Spend** any Energy in Battles`;
            break;

          case 3: // Wednesday
            activity = 'Hard Mode Battles';
            desc = `
:zap:  **Spend** Normal Energy on Hard Mode Battles
:heavy_multiplication_x:  **Save** Challenges`;
            break;

          case 4: // Thursday
            activity = 'Challenges';
            desc = `
:boom:  **Complete** Challenges
:heavy_multiplication_x:  **Save** Normal Energy`;
            break;

          case 5: // Friday
            activity = 'Dark Side Battles';
            desc = `
:zap:  **Spend** Normal Energy on Dark Side Battles
:heavy_multiplication_x:  **Save** Arena Battles`;
            break;

          case 6: // Saturday
            activity = 'Arena Battles';
            desc = `
:boom:  **Complete** Arena Battles
:heavy_multiplication_x:  **Save** Cantina Energy`;
            break;
        }

        desc += `

Thank you for your raid tickets contribution!`;

        embed
          .setAuthor(`New Guild Activity: ${activity}`)
          .setDescription(desc)
          .setColor(0x7289da);

        this.channels.guild_lounge.send(embed);

        this.main();
      }, diff);
    }
  }
}
