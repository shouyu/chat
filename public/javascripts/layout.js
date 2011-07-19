var innerLayout;
var layoutSettings_Outer = {
  scrollToBookmarkOnLoad: false,
  // options.defaults apply to ALL PANES - but overridden by pane-specific settings
  defaults: {
  },
  north: {
    size: "auto",
    spacing_open: 0,
    closable: false,
    resizable: false
  },
  south: {
    size: "auto",
    spacing_open: 0,
    closable: false,
    resizable: false
  },
  west: {
    size: .20,
    closable: false,
    resizeWhileDragging: true,
    onresize: function () { $("#channels").accordion("resize"); },
  },
  east: {
    size: .20,
    closable: false,
    resizeWhileDragging: true
  },
  center: {
    onresize: function() { resizeChatArea(); }
  }
};

var layoutSettings_EastInner = {
  scrollToBookmarkOnLoad: false,
  // options.defaults apply to ALL PANES - but overridden by pane-specific settings
  defaults: {
  },
  south: {
    size: .50,
    paneSelector: ".east-south",
    closable: false,
    hidable: false
  },
  center: {
    paneSelector: ".east-center"
  }
};

var resizeChatArea = function(){
  $('#chat textarea').outerWidth($('#chat').outerWidth() - 80);
};

$(function(){
    $('div#wrapper').layout(layoutSettings_Outer);
    innerLayout = $('div.ui-layout-east').layout(layoutSettings_EastInner);
    resizeChatArea();
});