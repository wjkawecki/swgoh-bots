var token = 'b0f08e37-e3f2-47fa-9fc9-77becaa66e2d';
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