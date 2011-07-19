var crypto = require('crypto');
var uuid = require('node-uuid');
var mongoose = require('mongoose');

function md5(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

exports.auth = function(name, pass, fn) {
	console.log('login: '+name);
	mongoose.model('user').findOne({ userid:name }, function(err, user) {
		if(user) {
		  console.log('user found:'+ user.userid);
			if(md5(pass + user.salt) == user.password) {
				fn(null, user);
			} else {
				fn(new Error('User:'+user.userid+' invalid password'));
			}
		} else {
			fn(new Error('User:'+name+' invalid username'));
		}
	});
};

exports.authFromCode = function(code, fn) {
	mongoose.model('auth').findOne({ code:code }, function(err, authuser) {
		if(authuser) {
			mongoose.model('user').findOne({ userid:authuser.userid }, function(err, user) {
				fn(null, user);
			});
		} else {
			fn(new Error('invalid authcode'));
		}
	});
};

exports.createNewUser = function(username, password, fn) {
	var usermodel = mongoose.model('user');
	var user = new usermodel();
	user.userid = username;
	var salt = uuid();
	user.salt = salt;
	user.password = md5(password+salt);
	user.save( function(err, user) {
		if(!err) {
			fn(null, user);
		} else {
			fn(err);
		}
	});
};