const token = process.env.HEROKU_API_KEY;
const appName = 'swgoh-bots';
const dynoName = 'worker';
const resetTimeUTC = {
	hour: 23,
	minute: 44
};

export default class Heroku {
	constructor() {
		this.scheduleRestart(appName, dynoName);
	}

	scheduleRestart(appName, dynoName) {
		let now = new Date(),
			reset = new Date(now),
			diff;

		reset.setUTCHours(resetTimeUTC.hour, resetTimeUTC.minute, 0, 0);
		if (reset < now) reset.setDate(reset.getDate() + 1);
		this.resetDay = reset.getUTCDay();
		diff = reset.getTime() - now.getTime();

		setTimeout(() => {
			this.restartDyno(appName, dynoName);
		}, diff);

		console.log(`Heroku.restartDyno ${appName}/${dynoName} in [${this.getReadableTime(diff)}]`);
	}

	restartDyno(appName, dynoName) {
		if (appName && dynoName) {
			let xhr = new XMLHttpRequest();

			xhr.open(
				'DELETE',
				'https://api.heroku.com/apps/' + appName + '/dynos/' + dynoName
			);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.setRequestHeader('Accept', 'application/vnd.heroku+json; version=3');
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.onload = function () {
				console.log(xhr.response);
			};
			xhr.send();
		}
	}

	getReadableTime(time, showSeconds = false) {
		time = new Date(time);

		if (showSeconds) {
			time = `${String(time.getUTCHours()).padStart(2, '00')}:${String(time.getUTCMinutes()).padStart(2, '00')}:${String(time.getUTCSeconds()).padStart(2, '00')}`;
		} else {
			time = `${String(time.getUTCHours()).padStart(2, '00')}:${String(time.getUTCMinutes()).padStart(2, '00')}`;
		}

		return time;
	}
}
