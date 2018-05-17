import './secret';

const DEV = process.env.DEV_MODE || false;

const CONFIG = {
	DEV,
	mongoUrl: process.env.MONGODB_URI,
	jsonPath: '../../../data/raids.json',
	jsonStablePath: '../../../data/raidsstable.json',
};

const GUILDS = [
	{
		guildName: 'TeN DST',
		mongoCollection: 'TeN_DST',
		botToken: process.env.TOKEN_TeN_DST,
		channels: {
			guild_lounge: '440636860100902915',
			sergeants_office: '440640683624103936',
			raid_log: '440795802777157642',
			raids_comm: '440641211066482707',
			bot_playground: '371742456653414410'
		},
		roles: {
			officer: DEV ? 'DST officer' : '440635030658613269',
			member: DEV ? 'DST member' : '440634741826256896'
		},
		resetTimeUTC: {
			hour: 23,
			minute: 30
		}
	},
	{
		guildName: 'TeN TiNT',
		mongoCollection: 'TeN_TiNT',
		botToken: process.env.TOKEN_TeN_TiNT,
		channels: {
			guild_lounge: '423829996461621248',
			sergeants_office: '426510072584077316',
			raid_log: '425797428642316288',
			raids_comm: '424322828167413770',
			bot_playground: '371742456653414410'
		},
		roles: {
			officer: DEV ? 'TiNT officer' : '423875440806199305',
			member: DEV ? 'TiNT member' : '423827855420686336'
		},
		resetTimeUTC: {
			hour: 23,
			minute: 30
		}
	}
];

import Heroku from './Heroku/Heroku';
import BB8 from './BB8/BB8';
// import CloneSergeant from './CloneSergeant/CloneSergeant';
// import EwokSergeant from './EwokSergeant/EwokSergeant';
import Guild from './Guild/Guild';

new Heroku();
new BB8();
// new CloneSergeant();
// new EwokSergeant();
GUILDS.forEach(guild => new Guild({ ...CONFIG, ...guild}));
