'use strict';

const { data } = require('sdk/self');

const { Panel, viewFor } = require('./panel');
exports.viewFor = viewFor;

let urlPanel = Panel({
  focus: false,
  contentURL: data.url('fantasticBar.html'),
  contentScriptWhen: 'ready',
  contentScriptFile: data.url('fantasticBar.js'),
  position: {
    top: 0,
    left: 0
  }
});
exports.panel = urlPanel;

