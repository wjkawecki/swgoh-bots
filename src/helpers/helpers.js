import * as mongodb from "mongodb";
import * as fs from 'fs';

const getDates = (hour = 0, minute = 0) => {
	const now = new Date(),
		event = new Date(now);

	event.setUTCHours(hour, minute, 0, 0);
	if (event < now) event.setDate(event.getDate() + 1);

	return { now, event };
};

const helpers = {
	getReadableTime: (milliseconds, showSeconds = false) => {
		const time = new Date(milliseconds),
			days = (Math.floor(milliseconds / 86400000)),
			hours = time.getUTCHours(),
			minutes = time.getUTCMinutes(),
			seconds = time.getUTCSeconds();

		return (`${days ? `${days} day${days > 1 ? 's' : ''} ` : ''}${hours ? `${hours} hour${hours > 1 ? 's' : ''} ` : ''}${minutes ? `${minutes} minute${minutes > 1 ? 's' : ''} ` : ''}${(showSeconds || milliseconds < 60000) && seconds ? `${seconds} second${seconds > 1 ? 's' : ''} ` : ''}`).trim();
	},

	isBotMentioned: (msg, Client) => {
		return msg.mentions.users.has(Client.user.id);
	},

	convert24to12: (hour, returnString = true) => {
		const string = hour < 12 ? ' AM' : ' PM';
		return `${(hour % 12) || 12}${returnString ? string : ''}`;
	},

	getMillisecondsToEvent: (hour = 0, minute = 0) => {
		const dates = getDates(hour, minute);

		return dates.event.getTime() - dates.now.getTime();
	},

	getMillisecondsToTime: (time) => {
		return time - new Date().getTime();
	},

	getEventDay: (hour = 0, minute = 0) => {
		const dates = getDates(hour, minute);

		return dates.event.getUTCDay();
	},

	updateJSON: (config, key, value, cb) => {
		if (config.DEV) {
			const jsonLocalPath = __dirname + '/../..' + config.jsonLocalPath.replace('#guildName#', config.guildName);
			let localData = JSON.parse(fs.readFileSync(jsonLocalPath));

			fs.writeFileSync(jsonLocalPath, JSON.stringify(Object.assign(
				{},
				localData,
				{ [key]: value }
			)));

			if (typeof cb === 'function') cb();
		} else {
			try {
				mongodb.MongoClient.connect(config.mongoUrl, { useNewUrlParser: true }, (err, client) => {
					if (err) throw err;
					client.db().collection(config.mongoCollection)
						.updateOne({}, { $set: { [key]: value } })
						.then(() => { if (typeof cb === 'function') cb(); })
						.then(() => client.close());
				});
			} catch (err) {
				console.log(`${config.guildName}.updateJSON(${key}): MongoDB update error`, err.message);
				setTimeout(() => helpers.updateJSON(config, cb), config.retryTimeout);
			}
		}
	}
};

export default helpers;
