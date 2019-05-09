import helpers from '../../helpers/helpers';

const token = process.env.HEROKU_API_KEY;
const appName = 'swgoh-bots';
const dynoName = 'worker';
const resetTimeUTC = {
  hour: 23,
  minute: 31
};

process.on('unhandledRejection', function(reason, p) {
  console.log('===== Possibly Unhandled Rejection at: ==PROMISE==: ', p, ' ==REASON==: ', reason);
  // application specific logging here
});

export default class Heroku {
  constructor(DEV) {
    if (!DEV) this.scheduleRestart(appName, dynoName);
    // this.scheduleWakeUp();
  }

  // scheduleWakeUp() {
  // 	setInterval(() => {
  // 		const http = require('http');
  // 		const req = http.request('http://swgoh-guilds.herokuapp.com', res => console.log(`===== swgoh-guilds.herokuapp.com WAKE UP: ${res.statusCode} =====`));
  // 		req.end();
  // 	}, 15 * 60 * 1000);
  // };

  scheduleRestart(appName, dynoName) {
    let now = new Date(),
      reset = new Date(now),
      diff;

    reset.setUTCHours(resetTimeUTC.hour, resetTimeUTC.minute, 0, 0);
    if (reset < now) reset.setDate(reset.getDate() + 1);
    diff = reset.getTime() - now.getTime();

    setTimeout(() => {
      this.restartDyno(appName, dynoName);
    }, diff);

    console.log(`=== Heroku.restartDyno ${appName}/${dynoName} in [${helpers.getReadableTime(diff)}]`);
  }

  restartDyno(appName, dynoName) {
    if (appName && dynoName) {
      const https = require('https');

      const options = {
        hostname: 'api.heroku.com',
        port: 443,
        path: '/apps/' + appName + '/dynos/' + dynoName,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.heroku+json; version=3',
          Authorization: 'Bearer ' + token
        }
      };

      const req = https.request(options, res => {
        console.log('===== Heroku.js RESET START =====');
        console.log(`== STATUS: ${res.statusCode}`);
        console.log(`== HEADERS: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8');
        res.on('data', chunk => {
          console.log(`== BODY: ${chunk}`);
        });
        res.on('end', () => {
          console.log('===== Heroku.js RESET END =====');
        });
      });

      req.on('error', e => {
        console.error(`== Problem with request: ${e.message}`);
      });

      req.end();
    }
  }
}
