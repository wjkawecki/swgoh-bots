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

	getMilisecondsToEvent: (hour = 0, minute = 0) => {
		const dates = getDates(hour, minute);

		return dates.event.getTime() - dates.now.getTime();
	},

	getEventDay: (hour = 0, minute = 0) => {
		const dates = getDates(hour, minute);

		return dates.event.getUTCDay();
	}
};

export default helpers;
