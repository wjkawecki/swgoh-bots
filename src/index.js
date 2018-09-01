import './secret';

const DEV = process.env.DEV_MODE || false;

const CONFIG = {
	DEV,
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
			sergeants_office: '440640683624103936',
			raids_log: '440795802777157642',
			raids_comm: '440641211066482707',
			territory_battles: '440640976684449792',
			bot_playground: '371742456653414410'
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
			sergeants_office: '426510072584077316',
			raids_log: '425797428642316288',
			raids_comm: '424322828167413770',
			territory_battles: '424322614169960448',
			bot_playground: '371742456653414410'
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
		guildName: 'fOuR',
		mongoCollection: 'TeN_fOuR',
		botToken: process.env.TOKEN_TeN_fOuR,
		channels: {
			guild_lounge: '451656613552455682',
			sergeants_office: '452542377320513538',
			raids_log: '452542450410586123',
			raids_comm: '451656996429627393',
			territory_battles: '451656936602075148',
			bot_playground: '371742456653414410'
		},
		roles: {
			officer: '451637963881840640',
			member: '451637316931289093'
		},
		resetTimeUTC: {
			hour: 22,
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
];

import Heroku from './modules/Heroku/Heroku';
import BB8 from './modules/BB8/BB8';
import Guild from './modules/Guild/Guild';

new Heroku(CONFIG.DEV);
new BB8(CONFIG.retryTimeout);
GUILDS.forEach(guild => new Guild({ ...CONFIG, ...guild}));
