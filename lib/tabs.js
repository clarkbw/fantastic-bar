'use strict';

const { defer } = require('sdk/core/promise');
const simplePrefs = require('sdk/simple-prefs');
const tabs = require('sdk/tabs');

function getTabs({ query }) {
    let tabsSearchQry = defer();
    let tabsAry = [];

    if (!simplePrefs.prefs['ignoreTabs']) {
      for (let tab of tabs) {
        if (tab.title.match(query) || tab.url.match(query)) {
          tabsAry.push({ title: tab.title, url: tab.url, priority: 0.9 })
        }
      }
    }

    tabsSearchQry.resolve(tabsAry);

    return tabsSearchQry.promise;
}
exports.getTabs = getTabs;
