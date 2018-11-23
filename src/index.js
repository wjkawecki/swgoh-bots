const initBot = () => {
	const CONFIG = {
		DEV: process.env.DEV_MODE === undefined ? false : process.env.DEV_MODE,
		retryTimeout: 30* 1000,
		commandPrefix: '-',
		mongoUrl: process.env.MONGODB_URI,
		jsonMongoPath: `/data/Guild/mongo/#guildName#_mongo.json`,
		jsonLocalPath: `/data/Guild/local/#guildName#_local.json`,
		thumbnails: {
			rancor: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_rancor.jpg',
			aat: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_aat.jpg',
			sith: 'https://swgoh.gg/static/img/assets/raids/tex.guild_events_triumvirate.jpg'
		}
	};

	const GUILDS = [
		{
			guildName: 'DST',
			mongoCollection: 'TeN_DST',
			botToken: process.env.TOKEN_TeN_DST,
			channels: {
				guild_lounge: '440636860100902915',
				officer_chat: '440637450616963072',
				sergeants_office: '440640683624103936',
				raids_log: '440795802777157642',
				raids_comm: '440641211066482707',
				territory_battles: '440640976684449792',
				bot_playground: '371742456653414410',
				court_of_law: '456166218878025738'
			},
			roles: {
				officer: '440635030658613269',
				member: '440634741826256896'
			},
			resetTimeUTC: {
				hour: 23,
				minute: 30
			}
		},
		{
			guildName: 'TiNT',
			mongoCollection: 'TeN_TiNT',
			botToken: process.env.TOKEN_TeN_TiNT,
			channels: {
				guild_lounge: '423829996461621248',
				officer_chat: '423838294766256137',
				sergeants_office: '426510072584077316',
				raids_log: '425797428642316288',
				raids_comm: '424322828167413770',
				territory_battles: '424322614169960448',
				bot_playground: '371742456653414410',
				court_of_law: '456166218878025738'
			},
			roles: {
				officer: '423875440806199305',
				member: '423827855420686336'
			},
			resetTimeUTC: {
				hour: 23,
				minute: 30
			}
		},
		{
			guildName: 'RoF',
			mongoCollection: 'RoF',
			botToken: process.env.TOKEN_RoF,
			channels: {
				guild_lounge: '401427486531125248',
				sergeants_office: '471294810993721344',
				raids_log: '445592372206764043',
				raids_comm: '401427486531125248',
				territory_battles: '401427882490200073',
				bot_playground: '401432399180857345'
			},
			roles: {
				officer: '401426523447361537',
				member: '403959166244356116'
			},
			resetTimeUTC: {
				hour: 23,
				minute: 30
			}
		},
		{
			guildName: 'PAW Purge',
			mongoCollection: 'PAW_Purge',
			botToken: process.env.TOKEN_PAW_Purge,
			channels: {
				command: '488471372130156545',
				raids_comm: '488471411426459648',
				bot_playground: '515618816219152386'
			},
			roles: {
				officer: '488473061105074176',
				member: '488472348975038465'
			}
		},
		{
			guildName: 'PAW Anarchy',
			mongoCollection: 'PAW_Anarchy',
			botToken: process.env.TOKEN_PAW_Anarchy,
			channels: {
				command: '481257004753616906',
				raids_comm: '481259556865835008',
				bot_playground: '515618816219152386'
			},
			roles: {
				officer: '481306970427490304',
				member: '481311931496398868'
			}
		},
		{
			guildName: 'PAW Wreckless',
			mongoCollection: 'PAW_Wreckless',
			botToken: process.env.TOKEN_PAW_Wreckless,
			channels: {
				command: '481533518153777153',
				raids_comm: '481533589926969344',
				bot_playground: '515618816219152386'
			},
			roles: {
				officer: '481541628322906112',
				member: '481541136389767208'
			}
		}
	];

	console.log('=== CONFIG.DEV ' + CONFIG.DEV);

	new Heroku(CONFIG.DEV);
	new BB8(CONFIG.retryTimeout);

	GUILDS.forEach(guild => new Guild({...CONFIG, ...guild}));
};

import Heroku from './modules/Heroku/Heroku';
import BB8 from './modules/BB8/BB8';
import Guild from './modules/Guild/Guild';
import('./secret')
	.then(initBot)
	.catch(initBot);
