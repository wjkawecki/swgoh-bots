var token = process.env.HEROKU_API_KEY;
var appName = 'swgoh-bots';
var dynoName = 'worker';

var xhr = new XMLHttpRequest();
    xhr.open(
        'DELETE',
        'https://api.heroku.com/apps/' + appName + '/dynos/' + dynoName
    );
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/vnd.heroku+json; version=3');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.onload = function() {
        console.log(xhr.response);
    };
    xhr.send();
