'use strict';

const { data } = require('sdk/self');

const { Panel, viewFor } = require('./panel');
exports.viewFor = viewFor;

let urlPanel = Panel({
  focus: false,
  contentURL: data.url('urlBar.html'),
  contentScriptWhen: 'ready',
  contentScriptFile: data.url('urlBar.js'),
  position: {
    top: 0,
    left: 0
  }
});
exports.panel = urlPanel;

