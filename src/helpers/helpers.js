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
	getReadableTime: (seconds, showSeconds = false) => {
		const time = new Date(seconds),
			secondsString = `:${String(time.getUTCSeconds()).padStart(2, '00')}`;

		return `${String(time.getUTCHours()).padStart(2, '00')}:${String(time.getUTCMinutes()).padStart(2, '00')}${showSeconds ? secondsString : ''}`;
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

	getEventDay: (hour = 0, minute = 0) => {
		const dates = getDates(hour, minute);

		return dates.event.getUTCDay();
	},

	updateJSON: (config, key, value, cb) => {
		if (config.DEV) {
			const jsonLocalPath = __dirname + '/../..' + config.jsonLocalPath.replace('#guildName#', config.guildName);
			let localData = JSON.parse(fs.readFileSync(jsonLocalPath));

			fs.writeFileSync(jsonLocalPath, JSON.stringify({
				...localData,
				[key]: value
			}));

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
