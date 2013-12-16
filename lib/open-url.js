'use strict';

const tabs = require('sdk/tabs');

function openURL({ url, base }) {
  url = URL(url, base).toString();

  for (let tab of tabs) {
    if (tab.url == url) {
      tab.activate();
      return;
    }
  }

  if (tabs.activeTab) {
    tabs.activeTab.url = url;
    return;
  }

  tabs.open(url);
}
exports.openURL = openURL;
