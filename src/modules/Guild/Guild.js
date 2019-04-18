import Discord from 'discord.js';
import * as mongodb from 'mongodb';
import * as fs from 'fs';

import Utility from './modules/Utility';
import Raids from './modules/Raids';
import DailyActivities from './modules/DailyActivities';
import TerritoryBattles from './modules/TerritoryBattles';
import CourtOfLaw from './modules/CourtOfLaw';
import ReadCheck from './modules/ReadCheck';
import MSFRaids from './modules/MSFRaids';

export default class Guild {
  constructor(config) {
    this.readMongo(config);
  }

  async readMongo(config) {
    try {
      mongodb.MongoClient.connect(
        config.mongoUrl,
        {
          useNewUrlParser: true
        },
        (err, client) => {
          if (err) throw err;
          client
            .db()
            .collection(config.mongoCollection)
            .findOne()
            .then(mongo => this.createLocalJSON(config, mongo))
            .then(mongo => this.initClient(config, mongo))
            .then(() => client.close());
        }
      );
    } catch (err) {
      console.log(`${config.name}: readMongo error`, err.message);
      setTimeout(() => this.readMongo(config), config.retryTimeout);
    }
  }

  createLocalJSON(config, mongo) {
    if (config.DEV) {
      const jsonMongoPath = __dirname + '/../../..' + config.jsonMongoPath.replace('#name#', config.name);
      const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#name#', config.name);

      fs.writeFileSync(jsonMongoPath, JSON.stringify(mongo));

      try {
        JSON.parse(fs.readFileSync(jsonLocalPath));
      } catch (err) {
        fs.writeFileSync(jsonLocalPath, JSON.stringify(mongo));
      }
    }

    return mongo;
  }

  initClient(config, mongo) {
    const jsonLocalPath = __dirname + '/../../..' + config.jsonLocalPath.replace('#name#', config.name);
    let data = null;

    if (config.DEV) {
      try {
        data = JSON.parse(fs.readFileSync(jsonLocalPath));
      } catch (err) {
        data = mongo;
      }
    } else {
      data = mongo;
    }

    this.Client = new Discord.Client({
      messageCacheMaxSize: -1,
      fetchAllMembers: true,
      sync: true
    });
    this.Client.on('ready', () => this.initGuild(config, data));
    this.Client.on('error', error => console.log(`${config.name}: Client error:`, error.message));
    this.Client.on('reconnecting', () => console.log(`${config.name}: Client reconnecting`));
    this.Client.on('resume', replayed => console.log(`${config.name}: Client resume:`, replayed));
    this.Client.on('disconnect', () => console.log(`${config.name}: Client disconnect`));
    this.loginClient(config);
  }

  loginClient(config) {
    this.Client.login(config.botToken).catch(err => {
      console.log(`${config.name}: Client.login error: `, err.message);
      setTimeout(() => this.readMongo(config), config.retryTimeout);
    });
  }

  initGuild(config, data) {
    try {
      const channels = this.initChannels(config);
      const guild = this.Client.guilds.first();

      this.Client.user.setActivity(config.name);

      console.log(`=== ${config.name}: ${guild.memberCount} members | ${guild.channels.size} channels ===`);

      if (config.DEV) {
        // channels.bot_playground.send('DEV reporting for duty!');
      } else {
        channels.bot_playground.send(':white_check_mark: `Reporting for duty!`');
      }

      // GUILD MODULES

      if (!this.Utility) this.Utility = new Utility(this.Client, config, channels);

      if (config.resetTimeUTC && Object.keys(config.resetTimeUTC).length && !this.DailyActivities)
        this.DailyActivities = new DailyActivities(this.Client, config, channels);

      if (data.raids && Object.keys(data.raids).length && !this.Raids) this.Raids = new Raids(this.Client, config, channels, data.raids);

      if (data.lstb && Object.keys(data.lstb).length && !this.LSTB)
        this.LSTB = new TerritoryBattles(this.Client, config, channels, data.lstb);

      if (data.dstb && Object.keys(data.dstb).length && !this.DSTB)
        this.DSTB = new TerritoryBattles(this.Client, config, channels, data.dstb);

      if (data.courtOfLaw && Object.keys(data.courtOfLaw).length && !this.CourtOfLaw)
        this.CourtOfLaw = new CourtOfLaw(this.Client, config, channels, data.courtOfLaw);

      if (data.readCheck && Object.keys(data.readCheck).length && !this.ReadCheck)
        this.ReadCheck = new ReadCheck(this.Client, config, channels, data.readCheck);

      if (data.msfRaids && !this.MSFRaids) this.MSFRaids = new MSFRaids(this.Client, config, channels, data.msfRaids);
    } catch (err) {
      console.log(`${config.name}: initGuild error`, err.message);
      setTimeout(() => this.initGuild(config, data), config.retryTimeout);
    }
  }

  initChannels(config) {
    const channels = {};

    for (let key in config.channels) {
      if (config.DEV) {
        channels[key] = this.Client.channels.get(config.channels.bot_playground);
      } else {
        channels[key] = this.Client.channels.get(config.channels[key]);
      }
    }

    return channels;
  }
}
