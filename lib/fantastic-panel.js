'use strict';

const { data } = require('sdk/self');
const tabs = require('sdk/tabs');

const { Panel, viewFor } = require('./panel');
exports.viewFor = viewFor;


let urlPanel = Panel({
  focus: false,
  contentURL: 'chrome://fantasticbar/content/fantasticBar.html',
  contentScriptWhen: 'ready',
  contentScriptFile: data.url('fantasticBar.js'),
  position: {
    top: 0,
    left: 0
  }
});
exports.panel = urlPanel;

// HACK: auto hide
tabs.on('ready', function(tab) {
  if (tab == tabs.activeTab) {
    urlPanel.hide();
  }
});
