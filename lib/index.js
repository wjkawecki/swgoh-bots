'use strict';

var _Bot = require('./Bot');

var _Bot2 = _interopRequireDefault(_Bot);

var _secret = require('./secret');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

new _Bot2.default(_secret.botToken);