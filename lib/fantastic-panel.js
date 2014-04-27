'use strict';

const { data } = require('sdk/self');
const tabs = require('sdk/tabs');
const { Panel } = require('sdk/panel');
const { getNodeView, getActiveView } = require("sdk/view/core");

const { on, emit } = require('addon-communication/main');

exports.viewFor = getActiveView;

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

on(function({ data }) {

})
