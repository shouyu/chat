var socket;
var stop = false;

function isscrolling(elem) {
  var scrolltop = $(elem).prop('scrollTop');
  var scrollheight = $(elem).prop('scrollHeight');
  var windowheight = $(elem).prop('clientHeight');
  var scrolloffset = 150;
  return (scrolltop >= (scrollheight-(windowheight+scrolloffset)));
}

function decorate_message(textdata) {
  // convert < & >
  textdata = textdata.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // add a tag
  textdata = textdata.replace(/h?ttp(s?:\/\/[\x21-\x7e]+)/gi, "<a href='http$1' target='_blank'>$&</a>");
  // wrap p tag
	textdata = '<p>' + textdata + '</p>';
  textdata = $(textdata);
  // add thumbnail
  $('a', textdata).each(function() {
    var atag = $(this).clone(true);
    atag.empty();
    var href = $(atag).attr('href');
    var ptag = document.createElement('p');
    $(ptag).append(atag);
    // youtube
    if(href.match(/(youtu\.be\/|www\.youtube\.com\/watch\?v\=)([\d\-\w]+)/gi)) {
			var img =$(document.createElement('img')).attr('src', 'http://i.ytimg.com/vi/'+RegExp.$2+'/hqdefault.jpg');
      atag.append(img);
    }
    // nico2
    if(href.match(/www\.nicovideo\.jp\/watch\/([a-z]*?)([\d]+)\??/gi)) {
      var img =$(document.createElement('img')).attr('src', 'http://tn-skr.smilevideo.jp/smile?i='+RegExp.$2);
      atag.append(img);
    }
    // nicoms
    if(href.match(/nico\.ms\/([sn]m)([\d]+)\??/gi)) {
      var img =$(document.createElement('img')).attr('src', 'http://tn-skr.smilevideo.jp/smile?i='+RegExp.$2);
      atag.append(img);
    }
    // .png .jpg .jpeg .bmp .gif
    if(href.match(/(.png|.jpg|.jpeg|.bmp|.gif)$/gi)) {
      var img =$(document.createElement('img')).attr('src', href);
      atag.append(img);
    }
    $(this).append(ptag);
  });
  // add p tag
  textdata = '<p>' + textdata.html() + '</p>';
  // convert \n & \r & \r\n
	textdata = textdata.replace(/\r\n/gi, "</p><p>");
	textdata = textdata.replace(/(\n|\r)/gi, "</p><p>");
  
  return textdata;
}

function simpledecorate(textdata) {
  // convert < & >
  textdata = textdata.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // add a tag
  textdata = textdata.replace(/((ttp:|http:|https:)\/\/[\x21-\x7e]+)/gi, "<a href='$1' target='_blank'>$1</a>");
  // wrap p tag
	textdata = '<p>' + textdata + '</p>';
  // convert \n & \r & \r\n
	textdata = textdata.replace(/\r\n/gi, "</p><p>");
	textdata = textdata.replace(/(\n|\r)/gi, "</p><p>");

  return textdata;
}

function leave(target) {
  $('#channels').accordion('destroy');
  var contentid = $(target).parent().find('.switchchannel').attr('id');
  $(target).parent().next().remove();
  $(target).parent().remove();
  $('#channels').accordion({
    autoHeight: false,
    active: $('#channels h3').length - 1
  });
  var newid = $('#channels h3:last').find('.switchchannel').attr('id');
  switchchannel(newid);
  socket.emit('leave', { channel: contentid });
  removechannel(contentid);
}

function formatDate(date) {
  var month = date.getMonth() + 1;
  var dd = date.getDate();
  var hour = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();

  if (month < 10)
    month = '0' + month;
  if (dd < 10)
    dd = '0' + dd;
  if (hour < 10)
    hour = '0' + hour;
  if (min < 10)
    min = '0' + min;
  if (sec < 10)
    sec = '0' + sec;

  return month + '/' + dd + ' ' + hour + ':' + min + ':' + sec;
}

function trace(s) {
  if (this.console && typeof console.log != 'undefined')
    console.log(s);
}

function addchannel(channel) {
  if ($('#' + channel.id).length == 0) {
    $('#channels h3').unbind('click');
    $('#channels').accordion('destroy');
    $('#content > div').hide();
    $('#memolist > div').hide();
    var leavebutton = $('<span title="チャンネルを抜ける" class="leavebutton ui-state-default ui-corner-all ui-accordion-icon ui-icon-close ui-helper-hidden" />');
    var unread = $('<span title="未読メッセージあり" class="unread ui-state-highlight ui-corner-all ui-accordion-icon ui-icon-notice" style="display:none"></span>');
    var acclink = $('<a class="switchchannel" id="' + channel.id + '" href="#"></a>').text(channel.channel);
    var members = $('<div id="member_' + channel.id + '"><div class="online"></div><div class="offline"></div></div>');
    $('#channels').append($('<h3></h3>').append(leavebutton, unread, acclink));
    $('#channels').append(members);
    $('#channels h3').click( function(ev) {
      if (stop) {
        leave($(this).find('span.leavebutton'));
        ev.stopImmediatePropagation();
        ev.preventDefault();
        stop = false;
      }
    });
    $('#channels').accordion({
      autoHeight: false,
      active: $('#channels h3').length - 1
    });
    $('#content').append("<div id='content_" + channel.id + "'></div>");
    $('#memolist').append("<div id='memolist_" + channel.id + "'></div>");
    // $("#content_"+channel.id).show();
    // $('#content_'+ channel.id).append("<dl id='chat_" + channel.id + "'>" + '</dl>');
    $('#content_'+ channel.id).append("<div id='val_" + channel.id + "' class='ui-helper-hidden'></div>");
    $('#val_'+ channel.id).text(channel.channel);
    $('#maincontent h3').text(channel.channel);
    $('#activechannel').text(channel.id);
    bindchatbox(channel.id);
  } else {
    switchchannel(channel.id);
  }
}

function removechannel(channel) {
  $('#content_'+ channel).remove();
  $('#val_'+ channel).remove();
}

function addOnlineMember(channel, member) {
  // remove from list
  $('#member_' + channel + ' div.user-' + member).remove();
  // add to online
  $('#member_' + channel + ' .online').append('<div class="user-' + member + '"><span class="ui-icon ui-icon-person"></span><span>' + member + '</span></div>');
}

function addOfflineMember(channel, member) {
  // remove from list
  $('#member_' + channel + ' div.user-' + member).remove();
  // add to offline
  $('#member_' + channel + ' .offline').append('<div class="user-' + member + '"><span class="ui-icon ui-icon-person"></span><span>' + member + '</span></div>');
}

function removeMember(channel, member) {
  // remove from list
  $('#member_' + chanmem.channel + ' .user-' + chanmem.member[i]).remove();
}

function showMemo(memoid) {
  $('#memoid').text(memoid);
  $('#memodate').text($('#' + memoid + ' p:nth-child(1)').text());
  $('#memouser').text($('#' + memoid + ' p:nth-child(2)').text());
  $('#memobody').html(simpledecorate($('#' + memoid + ' p:nth-child(3)').text()));
  $('#editmemoarea').val($('#' + memoid + ' p:nth-child(3)').text());
}

function connect() {
  socket = io.connect();

  socket.on('connect', function() {
    socket.emit('auth', {cookie: document.cookie});
    $('#channels').empty();
    $('#content').empty();
    $('#memolist').empty();
    $('#invitemember').empty();
  });
  
  socket.on('allusers', function(data) {
    for (var i = 0; i < data.length; i++){
        $('#invitemember').append('<option value="'+ data[i] +'">' + data[i] + '</options>');
      }
      $('#invitemember').multiSelect({selectableHeader: '<h4>メンバー一覧</h4>', selectedHeader: '<h4>招待するメンバー</h4>'});
  });
  
  socket.on('channel', function(data) {
    for (var i = 0; i < data.length; i++) {
        socket.emit('join', { channel: data[i] });
    }
  });
  
  socket.on('chanmem', function(data) {
    addchannel(data);
    for (var i = 0; i < data.member.length; i++) {
      addOfflineMember(data.id, data.member[i]);
    }
    for (var i = 0; i < data.online.length; i++) {
      addOnlineMember(data.id, data.online[i]);
    }
  });
  
  socket.on('log', function(data) {
    for (var i = 0; i < data.log.length; i++) {
      var date = new Date(data.log[i].date);
      var msg = $('<div />').addClass('message');
      var timestamp = $('<div />').text(formatDate(date)).addClass('timestamp');
      var user = $('<div />').text(data.log[i].userid).addClass('speaker');
      var text = $('<div />').html(decorate_message(data.log[i].body)).addClass('text');
      msg.append(timestamp, user, text);
      $('#content_' + data.channel).prepend(msg);
    }
    setTimeout(function() {
      $('#maincontent div.ui-layout-content').scrollTo('#content_'+data.channel+' div:last');
    }, 100);
  });
  
  socket.on('memo', function(data) {
    for (var i = 0; i < data.memo.length; i++) {
      var date = new Date(data.memo[i].date);
      var cdate = $('<p/>').text('更新日時:' + formatDate(date));
      var cuser = $('<p/>').text('作成者:' + data.memo[i].userid);
      var cbody = $('<p/>').text(data.memo[i].body);
      var memodiv = $('<div id="' + data.memo[i]._id + '" class="memolist" />').append(cdate, cuser, cbody).addClass('ui-state-default ui-corner-all');
      $('#memolist_' + data.channel).prepend(memodiv);
    }
  });
  
  socket.on('memoadd', function(data) {
    var date = new Date(data.date);
    var cdate = $('<p/>').text('更新日時:' + formatDate(date));
    var cuser = $('<p/>').text('作成者:' + data.userid);
    var cbody = $('<p/>').text(data.body);
    var memodiv = $('<div id="' + data.id + '" class="memolist" />').append(cdate, cuser, cbody).addClass('ui-state-default ui-corner-all');
    $(memodiv).hide().prependTo('#memolist_' + data.channel).show('blind', 'slow');
  });
  
  socket.on('memoedit', function(data){
    $('#' + data.id).hide('highlight', 'slow', function() {
      $(this).remove();
      var date = new Date(data.date);
      var cdate = $('<p/>').text('更新日時:' + formatDate(date));
      var cuser = $('<p/>').text('作成者:' + data.userid);
      var cbody = $('<p/>').text(data.body);
      var memodiv = $('<div id="' + data.id + '" class="memolist" />').append(cdate, cuser, cbody).addClass('ui-state-default ui-corner-all');
      $(memodiv).hide().prependTo('#memolist_' + data.channel).show('blind', 'slow');
    });
  });
  
  socket.on('memorem', function(data) {
      $('#' + data.id).hide('highlight', 'slow', function() {
        $(this).remove();
      });
  });
  
  socket.on('join', function(data) {
      var date = new Date(data.date);
      var msg = $('<div />').addClass('chanmessage');
      var timestamp = $('<div />').text(formatDate(date)).addClass('timestamp');
      var text = $('<div />').text(data.userid + ' has joined.').addClass('text', 'ui-helper-clearfix');
      msg.append(timestamp, text);
      $('#content_' + data.cid).append(msg);
      msg.hide().show('highlight', 500);
      if(!($('#content_' + data.cid).css('display') == 'none')) {
        if(isscrolling('#maincontent div.ui-layout-content')) {
          $('#maincontent div.ui-layout-content').stop().scrollTo(msg, 500);
        }
      }
      addOnlineMember(data.cid, data.userid);
  });
  
  socket.on('say', function(data) {
      var date = new Date(data.date);
      var msg = $('<div />').addClass('message');
      var timestamp = $('<div />').text(formatDate(date)).addClass('timestamp');
      var user = $('<div />').text(data.userid).addClass('speaker');
      var text = $('<div />').html(decorate_message(data.body)).addClass('text');
      msg.append(timestamp, user, text);
      $('#content_' + data.channel).append(msg);
      msg.hide().show('highlight', 500);
      if($('#content_' + data.channel).css('display') == 'none') {
        // show unread
        $('#'+data.channel).parent().find('.unread').show('highlight', 'fast');
      } else {
        if(isscrolling('#maincontent div.ui-layout-content')) {
          $('#maincontent div.ui-layout-content').stop().scrollTo(msg, 500);
        }
      }
  });
  
  socket.on('leave', function(data) {
      var date = new Date(data.date);
      var msg = $('<div />').addClass('chanmessage');
      var timestamp = $('<div />').text(formatDate(date)).addClass('timestamp');
      var text = $('<div />').text(data.userid + ' has left.').addClass('text', 'ui-helper-clearfix');
      msg.append(timestamp, text);
      $('#content_' + data.channel).append(msg);
      msg.hide().show('highlight', 500);
      if(!($('#content_' + data.channel).css('display') == 'none')) {
        if(isscrolling('#maincontent div.ui-layout-content')) {
          $('#maincontent div.ui-layout-content').stop().scrollTo(msg, 500);
        }
      }
      $('#member_' + data.channel + ' .user-' + data.userid).remove();
  });
  
  socket.on('userdisconnect', function(data) {
      var date = new Date(data.date);
      var msg = $('<div />').addClass('chanmessage');
      var timestamp = $('<div />').text(formatDate(date)).addClass('timestamp');
      var text = $('<div />').text(data.userid + ' has disconnected.').addClass('text', 'ui-helper-clearfix');
      msg.append(timestamp, text);
      $('#content_' + data.channel).append(msg);
      msg.hide().show('highlight', 500);
      if(!($('#content_' + data.channel).css('display') == 'none')) {
        if(isscrolling('#maincontent div.ui-layout-content')) {
          $('#maincontent div.ui-layout-content').stop().scrollTo(msg, 500);
        }
      }
      addOfflineMember(data.channel, data.userid);
  });
  
  socket.on('message', function(msg) {
    trace(msg);
  });
  
  socket.on('disconnect', function() {
    trace('disconnect');
  });
}

function bindchatbox(id) {
  $('#chat').unbind('submit');
  $('#chat').bind('submit', function() {
    var mode = $('input[name="sendmode"]:checked').attr('id');
    var message = $('#message');
    if (mode == 'sendchat') {
      socket.emit('say', {
          message: message.val(),
          channel: id
      });
    } else {
      socket.emit('memoadd', {
          message: message.val(),
          channel: id
      });
    }
    message.val('');
    message.trigger('change');
    return false;
  });
}

function switchchannel(contentid, noactivate) {
  $('#activechannel').text(contentid);
  if(!noactivate) {
    $('#channels').accordion('activate', $('#channels h3').index($('#' + contentid).parent()));
  }
  $('#content > div').hide();
  $('#memolist > div').hide();
  $('#maincontent h3').text($('#val_' + contentid).text());
  $('#content_'+ contentid).show();
  $('#memolist_'+ contentid).show();
  bindchatbox(contentid);
  $('#maincontent div.ui-layout-content').scrollTop($('#content_'+contentid).height());
  // hide unread
  $('#'+contentid).parent().find('.unread').hide();
}

$( function() {
  $('#channeljoin').bind('submit', function() {
    var channel = $('#channel');
    socket.emit('join', {
        channel: channel.val()
    });
    channel.attr('value', '');
    return false;
  });
  $('#editmemo').bind('click', function() {
    if($('#memoid').text().length != 0) {
      $('#editmemo-dialog').dialog('open');
    }
  });
  $('#remmemo').bind('click', function() {
    if($('#memoid').text().length != 0) {
      socket.emit('memorem', {
        channel: $('#activechannel').text(),
        id: $('#memoid').text()
      });
    }
  });
  $('#channels a.switchchannel').live('click', function() {
    var contentid = $(this).attr('id');
    switchchannel(contentid, true);
  });
  //
  // Accordion
  //
  $('span.leavebutton').live('mouseenter', function(ev) {
    stop = true;
  });
  $('span.leavebutton').live('mouseleave', function(ev) {
    stop = false;
  });
  //
  // Textarea
  //
  $('#chat').bind('submit', function() {
    return false;
  });
  $('#chat textarea').tbHinter({
    text: 'Enterで送信 Shift+Enterで改行',
    classname: 'hint'
  });
  $('#chat textarea').live('keypress', function(e) {
    if (e.which == 13) {
      if (e.shiftKey) {
      } else {
        e.stopPropagation();
        e.preventDefault();
        if($('#chat textarea').val().length == 0) {
          return;
        }
        $('#message').submit();
      }
    }
  });
  $('#chat textarea').live('keyup change', function(e) {
    if ($('#chat textarea').val().length == 0) {
      // $('#chat input[type="submit"]').attr('disabled', true);
      $('#chat input[type="submit"]').button('disable');
    } else {
      $('#chat input[type="submit"]').button('enable');
    }
  });
  $('div.memolist').live('mouseenter', function() {
    $(this).addClass('ui-state-hover');
  });
  $('div.memolist').live('mouseleave', function() {
    $(this).removeClass('ui-state-hover');
  });
  $('div.memolist').live('mousedown', function() {
    $(this).addClass('ui-state-active');
    showMemo($(this).attr('id'));
  });
  $('div.memolist').live('mouseup', function() {
    $(this).removeClass('ui-state-active');
  });
  //
  //  Toolbar
  //
  $('#sendmode').buttonset();
  $('#invitechat').button().bind('click', function(){ $('#invite-dialog').dialog('open') });
  $('#chat input[type="submit"]').button();
  $('#editmemo').button();
  $('#remmemo').button();
  $('#joinbutton').button();
  //
  // Multiselect
  //
  //
  // Dialog
  //
  $('#editmemo-dialog').dialog({
    autoOpen: false,
    height: 300,
    width: 350,
    modal: true,
    buttons: {
      '送信': function() {
        socket.emit('memoedit', {
            channel: $('#activechannel').text(),
            id: $('#memoid').text(),
            message: $('#editmemoarea').val()
        });
        $(this).dialog('close');
      },
      Cancel: function() {
        $(this).dialog('close');
      }
    },
    close: function() {
    }
  });
  $('#invite-dialog').dialog({
    autoOpen: false,
    height: 400,
    width: 450,
    modal: true,
    buttons: {
      '招待': function() {
        socket.emit('invite', {
          channel: $('#activechannel').text(),
          member: $('#invitemember').val()
        });
        $(this).dialog('close');
      },
      Cancel: function() {
        $(this).dialog('close');
      }
    },
    close: function() {
    }
  });
  
  connect();
});