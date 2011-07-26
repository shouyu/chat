//
// socket.io.js
//
// messages from client
// - auth {cookie}
// - join {channel}
// - leave {channel}
// - say {message}
// - add_memo {memoid, body}
// - edit_memo {memoid, body}
// - rem_memo {memoid, body}
//
// mesages to client
// - channel
// - log { channel, log }
// - memo { channel, memo }
// - join
// - say
// - disconnect
//

module.exports = function(options) {
  var redis  = require('redis').createClient();
  var publisher = require('redis').createClient();
  var io = require('socket.io').listen(options.app);
  var objid = require('mongodb').BSONPure.ObjectID.createFromHexString;
  var userids = {};
  
  io.sockets.on('connection', function(client) {
    var subscriber = require('redis').createClient();
    var user;

    //
    // auth
    //
    client.on('auth', function(data) {
      console.log('auth');
      // get sessionid from cookie
      var parseCookie = require('connect').utils.parseCookie;
      var sid = parseCookie(data.cookie)['connect.sid'];
      options.session.get(sid, function(err, session) {
        if(err) return;
        // get user from session
        user = session.user;
        // set id
        if(!userids[user.userid]) {
          userids[user.userid] = [];
        }
        userids[user.userid].push(client.id);
        console.log('auth user:' + user.userid);
        // send channel list
        var usermodel = options.mongoose.model('user');
        usermodel.findOne({
          userid:user.userid
        }, function(err, doc) {
          user = doc;
          console.log('send channels to ' + user.userid);
          var channels = doc.channel;
          console.log('channels:' + channels);
          client.emit('channel', channels);
        });
        usermodel.find({}, function(err, docs){
          var arr = [];
          docs.forEach(function(ele) {
            arr.push(ele.userid);
          });
          client.emit('allusers', arr);
        });
      });
    });
    //
    // join
    //
    client.on('join', function(msg) {
      if(user) {
      console.log("user:" + user.userid + " joined channel:" + msg.channel);
      var cname = msg.channel;
      // add joined channel to set
      redis.sadd("channel:"+cname+":online", user.userid);
      var chanmodel = options.mongoose.model('channel');
      chanmodel.collection.update({ name:cname }, { $addToSet: { member: user.userid }}, { upsert:true });
      chanmodel.findOne({ name:cname }, function(err, doc) {
        var chanmember = doc.member;
        var cid = doc._id;
        var onlinemember = redis.smembers("channel:"+cname+":online", function(err, smembers) {
          client.emit('chanmem', {
            id:doc._id,
            channel:cname,
            member: chanmember,
            online: smembers
          });
        
        var usermodel = options.mongoose.model('user');
        usermodel.collection.update({ userid:user.userid }, { $addToSet: { channel: cname }});
        // subscribe channel
        subscriber.subscribe(cid);
        console.log('user: ' + user.userid + ' subscribed: '+ cname);
        // send log
        // -> send join msg
        // -> send memo
        var logmodel = options.mongoose.model('log.'+cid, options.mongoose.LogSchema, 'log.'+cid);
        logmodel.find({}).limit(10).sort('_id', -1).run( function(err, docs) {
          // send to client
          client.emit('log', {
            channel:cid,
            log:docs
          });

          // send join msg
          var joinmsg = {
            channel: cname,
            date: new Date().getTime(),
            userid: user.userid
          };
          publisher.publish(cid, JSON.stringify({
            join:joinmsg
          }));

          // send memo
          var memomodel = options.mongoose.model('memo.' + cid, options.mongoose.MemoSchema, 'memo.'+cid);
          memomodel.find({}).sort('date', 1).run( function(err, docs) {
            // send to client
            client.emit('memo', {
                channel:cid,
                memo:docs
            });
          });
        });
          
        });
      });
      }
    });
    //
    // leave
    //
    client.on('leave', function(msg) {
      console.log("user:" + user.userid + " leaved channel:" + msg.channel);
      var cid = msg.channel;
      // remove user from channel
      var chanmodel = options.mongoose.model('channel');
      chanmodel.findOne({ _id:cid }, function(err, doc) {
        var cname = doc.name;
        chanmodel.collection.update({ _id:objid(cid) }, { $pull: { member: user.userid }});
        var usermodel = options.mongoose.model('user');
        usermodel.collection.update({
          userid:user.userid
        }, {
          $pull: {
            channel:cname
          }
        });
        redis.srem("channel:"+cname+":online", user.userid);
        // publish leave message
        var leavemsg = {
          userid: user.userid,
          date: new Date().getTime()
        };
        // send leave message
        publisher.publish(cid, JSON.stringify({
          leave:leavemsg
        }));
        subscriber.unsubscribe(cid);
      });
    });
    //
    // say
    //
    client.on('say', function(msg) {
      console.log(msg);
      var cname = msg.channel;
      var saymsg = {
        'userid': user.userid,
        'body': msg.message,
        'date': new Date().getTime()
      };
      var logmodel = options.mongoose.model('log.'+cname, options.mongoose.LogSchema, 'log.'+cname);
      var log = new logmodel(saymsg);
      log.save();
      // publish message
      publisher.publish(cname, JSON.stringify({
        say: saymsg
      }));
    });
    //
    // memo_add channel, message 
    //
    client.on('memoadd', function(msg) {
      console.log(msg);
      var cname = msg.channel;
      var memomsg = {
        userid: user.userid,
        body: msg.message,
        date: new Date().getTime()
      };
      var memomodel = options.mongoose.model('memo.'+cname, options.mongoose.MemoSchema, 'memo.'+cname);
      var memo = new memomodel(memomsg);
      memo.save();
      memomsg.id = memo._id;
      publisher.publish(cname, JSON.stringify({
        memo_add: memomsg
      }));
    });
    //
    // memo_edit channel, id, message
    //
    client.on('memoedit', function(msg) {
      var cname = msg.channel;
      var id = msg.id;
      var memomsg = {
        id:id,
        userid: user.userid,
        body: msg.message,
        date: new Date().getTime()
      };
      var memomodel = options.mongoose.model('memo.'+cname, options.mongoose.MemoSchema, 'memo.'+cname);
      memomodel.findOne({_id:objid(id)}, function(err, doc){
        if(!err) {
          doc.body = memomsg.body;
          doc.date = memomsg.date;
          doc.save();
        }
      });
      publisher.publish(cname, JSON.stringify({
        memo_edit: memomsg
      }));
    });
    //
    // memo_rem channel, id
    //
    client.on('memorem', function(msg) {
      console.log(msg);
      var cname = msg.channel;
      var id = msg.id;
      var memomsg = {
        id:id,
        userid:user.userid,
        date: new Date().getTime()
      };
      var memomodel = options.mongoose.model('memo.'+cname, options.mongoose.MemoSchema, 'memo.'+cname);
      memomodel.findOne({_id:id}, function(err, doc){
        if(!err) {
          doc.remove();
        }
      });
      publisher.publish(cname, JSON.stringify({
        memo_rem: memomsg
      }));
    });
    //
    // invite
    //
    client.on('invite', function(data){
      var chanmodel = options.mongoose.model('channel');
      var usermodel = options.mongoose.model('user');
      chanmodel.findOne({ _id:data.channel }, function(err, doc) {
        for(var i=0; i<data.member.length; i++) {
          if(userids[data.member[i]].length > 0) {
           // online
           for(var j=0; j<userids[data.member[i]].length; j++) {
             io.sockets.socket(userids[data.member[i]][j]).emit('invite', doc.name);
           } 
          } else {
            // offline
            usermodel.collection.update({ userid:data.member[i] }, { $addToSet: { channel: doc.name }});
          }
        }
      });
    });
    //
    // disconnect
    //
    client.on('disconnect', function() {
      if(!user)
        return;
      console.log('disconnect');
      var idx = userids[user.userid].indexOf(client.id);
      if (idx != -1) {
        userids[user.userid].splice(idx, 1);
      }
      if (userids[user.userid].length == 0) {
      console.log("all clients disconnected");
      var dismsg = {
        userid: user.userid,
        date: new Date().getTime()
      };
      var usermodel = options.mongoose.model('user');
      var chanmodel = options.mongoose.model('channel');
      usermodel.findOne({
        userid:user.userid
      }, function(err, doc) {
        var channels = doc.channel;
        for(var i = 0; i < channels.length; i++) {
          redis.srem("channel:"+channels[i]+":online", user.userid);
          chanmodel.findOne({name:channels[i]}, function(err, doc){
            if(doc) {
              publisher.publish(doc.id, JSON.stringify({
                disconnect:dismsg
              })); 
            }
          });
        }
      });
      }
    });
    //
    // receive message from pubsub
    //
    subscriber.on('message', function(channel, msg) {
      msg = JSON.parse(msg);
      for (var key in msg) {
        // emit event
        subscriber.emit(key, {
          channel:channel,
          msg: msg[key]
        });
      }
    });
    subscriber.on('join', function(msg) {
      var joinmsg = {
          date: msg.msg.date,
          userid: msg.msg.userid,
          channel: msg.msg.channel,
          cid: msg.channel
      };
      client.emit('join', joinmsg);
    });
    subscriber.on('say', function(msg) {
      var saymsg = {
          date : msg.msg.date,
          body : msg.msg.body,
          userid : msg.msg.userid,
          channel: msg.channel
      };
      client.emit('say', saymsg);
    });
    subscriber.on('memo_add', function(msg) {
      var memomsg = {
          id: msg.msg.id,
          date : msg.msg.date,
          body : msg.msg.body,
          userid: msg.msg.userid,
          channel: msg.channel
      };
      client.emit('memoadd', memomsg);
    });
    subscriber.on('memo_edit', function(msg) {
      var memomsg = {
          id: msg.msg.id,
          date : msg.msg.date,
          body : msg.msg.body,
          userid: msg.msg.userid,
          channel: msg.channel
      };
      client.emit('memoedit', memomsg);
    });
    subscriber.on('memo_rem', function(msg) {
      var memomsg = {
          id: msg.msg.id,
          userid: msg.msg.userid,
          channel: msg.channel
      };
      client.emit('memorem', memomsg);
    });
    subscriber.on('leave', function(msg) {
      var leavemsg = {
          date : msg.msg.date,
          userid: msg.msg.userid,
          channel: msg.channel
      };
      client.emit('leave', leavemsg);
    });
    subscriber.on('disconnect', function(msg) {
      var dismsg = {
          date : msg.msg.date,
          userid: msg.msg.userid,
          channel: msg.channel
      };
      client.emit('userdisconnect', dismsg);
    });
  });
}