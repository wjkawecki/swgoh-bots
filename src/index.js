const initBot = () => {
  const CONFIG = {
    DEV: process.env.DEV_MODE === undefined ? false : process.env.DEV_MODE,
    retryTimeout: 30 * 1000,
    commandPrefix: '-',
    mongoUrl: process.env.MONGODB_URI
  };

  const CONFIG_ARENA = {
    ...CONFIG,
    jsonMongoPath: `/data/Arena/mongo/#name#_mongo.json`,
    jsonLocalPath: `/data/Arena/local/#name#_local.json`,
    sniperIcon: ':skull:'
  };

  const CONFIG_GUILD = {
    ...CONFIG,
    jsonMongoPath: `/data/Guild/mongo/#name#_mongo.json`,
    jsonLocalPath: `/data/Guild/local/#name#_local.json`,
    thumbnails: {
      rancor: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_rancor.jpg',
      aat: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_aat.jpg',
      sith: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_triumvirate.jpg'
    }
  };

  const ARENAS = [
    {
      name: 'Squad Arena',
      mongoCollection: 'Squad_Arena',
      botToken: process.env.TOKEN_SQUAD_ARENA,
      channels: {
        payout: '360337936203382796',
        snipers: '524954639360327682'
      },
      roles: {
        admin: '364111046111395840'
      }
    },
    {
      name: 'Fleet Arena',
      mongoCollection: 'Fleet_Arena',
      botToken: process.env.TOKEN_FLEET_ARENA,
      channels: {
        payout: '522792224744931328',
        snipers: '524929501201825793'
      },
      roles: {
        admin: '384026564792156160'
      }
    }
  ];

  const GUILDS = [
    {
      name: 'Empîre VENGEANCE',
      mongoCollection: 'EMPIRE_VENG',
      botToken: process.env.TOKEN_EMPIRE_VENG,
      channels: {
        guild_lounge: '404677793432207370',
        officer_chat: '404697828703600640',
        sergeants_office: '603143120305127454',
        raids_log: '603143120305127454',
        raids_comm: '404697955052945408',
        territory_battles: '404698512027025408',
        bot_playground: '602763251318652929'
        // court_of_law: '602458926499233823',
        // tickets_log: '602458853824659456'
      },
      roles: {
        officer: '404681050212663296',
        member: '404678561577041942'
      },
      // resetTimeUTC: {
      //   hour: 23,
      //   minute: 30
      // },
      remindMinutesBefore: 60
    },
    {
      name: 'TiNT',
      mongoCollection: 'TeN_TiNT',
      botToken: process.env.TOKEN_TeN_TiNT,
      channels: {
        guild_lounge: '602443313622024213',
        officer_chat: '602443466198220800',
        sergeants_office: '602247189418475540',
        raids_log: '602247189418475540',
        raids_comm: '602246555600158729',
        territory_battles: '602246125919141926',
        bot_playground: '602763251318652929',
        court_of_law: '602458926499233823',
        tickets_log: '602458853824659456'
      },
      roles: {
        officer: '601817123483942922',
        member: '601817882036273173'
      },
      resetTimeUTC: {
        hour: 23,
        minute: 30
      },
      remindMinutesBefore: 60
    },
    {
      name: 'RoF',
      mongoCollection: 'TeN_RoF',
      botToken: process.env.TOKEN_TeN_RoF,
      channels: {
        guild_lounge: '401427486531125248',
        officer_chat: '401428642955264000',
        sergeants_office: '471294810993721344',
        raids_log: '445592372206764043',
        raids_comm: '401427486531125248',
        territory_battles: '401427882490200073',
        bot_playground: '401432399180857345',
        court_of_law: '551589070216888331'
      },
      roles: {
        officer: '401426523447361537',
        member: '403959166244356116'
      },
      resetTimeUTC: {
        hour: 23,
        minute: 30
      },
      remindMinutesBefore: 60
    },
    {
      name: 'PAW Purge',
      mongoCollection: 'PAW_Purge',
      botToken: process.env.TOKEN_PAW_Purge,
      channels: {
        command: '488471372130156545',
        raids_comm: '519782490177536020',
        bot_playground: '515618816219152386'
      },
      roles: {
        officer: '488473061105074176',
        member: '488472348975038465'
      }
    },
    {
      name: 'PAW Anarchy',
      mongoCollection: 'PAW_Anarchy',
      botToken: process.env.TOKEN_PAW_Anarchy,
      channels: {
        command: '481257004753616906',
        raids_comm: '519782670645854228',
        bot_playground: '515618816219152386'
      },
      roles: {
        officer: '481306970427490304',
        member: '481311931496398868'
      }
    },
    {
      name: 'PAW Wreckless',
      mongoCollection: 'PAW_Wreckless',
      botToken: process.env.TOKEN_PAW_Wreckless,
      channels: {
        command: '481533518153777153',
        raids_comm: '519782777978355712',
        bot_playground: '515618816219152386'
      },
      roles: {
        officer: '481541628322906112',
        member: '481541136389767208'
      }
    },
    {
      name: 'PAW Puny Gods',
      mongoCollection: 'PAW_Puny_Gods',
      botToken: process.env.TOKEN_PAW_Puny_Gods,
      channels: {
        command: '489263506068078603',
        raids_comm: '528682160731979788',
        bot_playground: '515618816219152386'
      },
      roles: {
        officer: '489259760017735680',
        member: '489260001680949248'
      }
    }
  ];

  console.log('=== CONFIG.DEV ' + CONFIG.DEV);

  new Heroku(CONFIG.DEV);
  // new BB8(CONFIG.retryTimeout);

  ARENAS.forEach(arena => new Arena({ ...CONFIG_ARENA, ...arena }));
  GUILDS.forEach(guild => new Guild({ ...CONFIG_GUILD, ...guild }));
};

import Heroku from './modules/Heroku/Heroku';
import BB8 from './modules/BB8/BB8';
import Arena from './modules/Arena/Arena';
import Guild from './modules/Guild/Guild';

import('./secret')
  .then(initBot)
  .catch(initBot);
