(function() {
	var mongoose = require('mongoose');
	module.exports = exports = mongoose;
	var Schema = mongoose.Schema;
	var db = mongoose.connect('mongodb://localhost/nodechat');

	var ChannelSchema = new Schema({
		name: {type: String, index: {unique:true}},
		member: [String]
	});

	var UserSchema = new Schema({
		userid: {type:String, index:{unique:true}},
		password: String,
		salt: String,
		channel: [String]
	});

	var AuthCodeSchema = new Schema({
		code: String,
		userid: {type:String, index:{unique:true}}
	});

	var LogSchema = new Schema({
		userid: String,
		date: Number,
		body: String
	});

	var MemoSchema = new Schema({
		userid: String,
		date: Number,
		body: String
	});
	
  exports.ChannelSchema = ChannelSchema;
  exports.UserSchema = UserSchema;
  exports.AuthCodeSchema = AuthCodeSchema;
  exports.LogSchema = LogSchema;
  exports.MemoSchema = MemoSchema;
  exports.ObjectId = mongoose.Schema.ObjectId;
	
	mongoose.model('channel', ChannelSchema);
	mongoose.model('user', UserSchema);
	mongoose.model('auth', AuthCodeSchema);
})()