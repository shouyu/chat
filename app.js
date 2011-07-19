//
// Module dependencies.
//
var express = require('express');
var ejs = require('ejs');

var app = module.exports = express.createServer();
var port = 8000;
var mongoose = require('./lib/chat-mongodb');
var sstore = new (require('connect-redis')(express))();
var auth = require('./lib/auth');
var uuid = require('node-uuid');

//
// Configuration
//
app.configure( function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.set('view options', {
		layout:false
	});
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({
		secret: 'BFLFLfl, gshlVFUHGKFhcekusybkc, f',
		cookie: {
			httpOnly: false,
			maxAge: 14 * 24 * 60 * 60 * 1000
		},
		store : sstore
	}));
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function() {
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true
	}));
});

app.configure('production', function() {
	app.use(express.errorHandler());
});


//
// Routes
//
//
// GET
//
app.get('/', function(req, res) {
  console.log(req.session.user);
	if (!req.session.user) {
		// redir to login
		res.redirect('/login');
	} else {
		res.render('index', {
			locals: {
				title: 'Express',
				port: port
			}
		});
	}
});

app.get('/login', function(req, res) {
	if(req.cookies.authcode) {
		auth.authFromCode(req.cookies.authcode, function(err, user) {
			console.log('auth from authcode code:'+req.cookies.authcode);
			if (user) {
				req.session.regenerate( function() {
					req.session.user = user;
					req.session.cookie.httpOnly=false;
					req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000;
					var id = uuid();
					res.cookie('authcode', id, {
						maxAge: 14 * 24 * 60 * 60 * 1000,
						httpOnly: false
					});
					var authmodel = mongoose.model('auth');
					authmodel.collection.update({userid:user.userid}, { $set: { code:id }}, { upsert:true });

					res.redirect('/');
				});
			} else {
				res.render('login', {
					locals: {
						title:'Express'
					}
				});
			}
		});
	} else {
		// render login.ejs
		res.render('login', {
			locals: {
				title:'Express'
			}
		});
	}
});

app.get('/signup', function(req, res) {
	res.render('signup');
});

app.get('/logout', function(req, res) {
  if(req.session.user) {
      var authmodel = mongoose.model('auth');
      authmodel.collection.update({userid:req.session.user.userid}, { $set: { code:"" }}, { upsert:true });
  }
  req.session.regenerate(function(){
    res.redirect('/');
  });
});

//
// POST
//
app.post('/login', function(req, res) {
	auth.auth(req.body.username, req.body.password, function(err, user) {
		if (user) {
			req.session.regenerate( function() {
				req.session.user = user;
				req.session.cookie.httpOnly=false;
				req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000;
				var id = uuid();
				res.cookie('authcode', id, {
					maxAge: 14 * 24 * 60 * 60 * 1000,
					httpOnly: false
				});
				var authmodel = mongoose.model('auth');
        authmodel.collection.update({userid:user.userid}, { $set: { code:id }}, { upsert:true });

				res.redirect('/');
			});
		} else {
			req.session.error = 'Check Username and Password';
			res.redirect('/login');
		}
	});
});

app.post('/signup', function(req, res) {
	if(req.body.password1 == req.body.password2) {
		auth.createNewUser(req.body.username, req.body.password1, function(err, user) {
			if (user) {
				req.session.regenerate( function() {
					req.session.user = user;
					req.session.cookie.httpOnly=false;
					req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000;
					var id = uuid();
					res.cookie('authcode', id, {
						maxAge: 14 * 24 * 60 * 60 * 1000,
						httpOnly: false
					});
          var authmodel = mongoose.model('auth');
          authmodel.collection.update({userid:user.userid}, { $set: { code:id }}, { upsert:true });

					res.redirect('/');
				});
			} else {
				req.session.error = 'Check Username and Password';
				res.redirect('/signup');
			}
		});
	} else {
		console.log('wrong passwords');
		res.redirect('/signup');
	}
});

//
// Only listen on $ node app.js
//
if (!module.parent) {
	app.listen(port);
	console.log("Express server listening on port %d", app.address().port);
}

//
// Socket
//
require('./lib/socket.io.js')({
	app: app,
	session: sstore,
	mongoose: mongoose
});