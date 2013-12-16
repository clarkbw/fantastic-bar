'use strict';

const { data } = require('sdk/self');
const tabs = require('sdk/tabs');
const { search: searchHistory } = require("sdk/places/history");
const { search: searchBookmarks } = require("sdk/places/bookmarks");
const { defer, all } = require('sdk/core/promise');
const { union, flatten } = require('sdk/util/array');
const { merge } = require('sdk/util/object');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { on } = require('sdk/system/events');
const { add } = require('sdk/deprecated/observer-service');
const { URL } = require('sdk/url');
const simplePrefs = require('sdk/simple-prefs');

const { listen } = require('pathfinder/xul/listen');

const { GOOGLE_SUGGESTIONS_URL, PROVIDERS } = require('./providers');
const { openURL: oldOpenURL } = require('./open-url');
const { panel: urlPanel, viewFor } = require('./fantastic-panel');
const { purifyResults } = require('./results');
const { get: getGoogleSuggestions } = require('./google-suggestions');
const { watchFrame, Worker, onTrack } = require('./hacks');

const SEARCH_URL = data.url('urlBar.html') + "?q=";

let queryIndex = 0;

function openURL(options) {
  oldOpenURL(options);
  urlPanel.hide();
}

tabs.on('ready', function(tab) {
  if (tab == tabs.activeTab) {
    urlPanel.hide();
  }
})

let workers = new WeakMap();

urlPanel.port.on('goto', openURL);

function frameWatcher(window) {
  watchFrame(window).then(function() {
    urlPanel.port.emit('show-preview', { url: window.frameElement.src });

    let worker = Worker({
      window: window,
      contentScriptFile: data.url('frame-worker.js')
    });
    workers.set(window, worker);
    worker.port.on('openURL', function(data) {
      openURL(data);
    });
  })
}

add('content-document-global-created', frameWatcher, false);

onTrack(function(window) {
  let urlBar = window.document.getElementById('urlbar');
  listen(window, urlBar, 'keyup', function(evt) {
    if (evt.which == 27 || evt.which == 13){
      urlPanel.hide();
      return;
    }

    let thisQryIndex = ++queryIndex;
    let query = (urlBar.value || '').trim();

    if (!query) {
      return urlPanel.hide();
    }

    let isURL = false;
    try {
      isURL = URL(query).toString();
    }catch(e) {}

    query = encodeURIComponent(query);

    if (!urlPanel.isShowing) {
      let recentWindow = getMostRecentBrowserWindow();
      urlPanel.width = 0.9 * recentWindow.document.width;
      urlPanel.height = 0.9 * (recentWindow.document.height - 100);
      urlPanel.port.emit('size', { width: recentWindow.document.width, height: recentWindow.document.height })
      urlPanel.show();
    }

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

    let searchHistoryQry = defer();
    if (simplePrefs.prefs['ignoreHistory']) {
      searchHistoryQry.resolve([]);
    }
    else {
      searchHistory({
        query: query
      }, {
        sort: 'visitCount',
        count: 10
      }).on('end', function(results) {
        searchHistoryQry.resolve(results.filter(function(result) {
          result.priority = 0.8;
          return true;
        }));
      })
    }

    let searchBookmarksQry = defer();
    if (simplePrefs.prefs['ignoreBookmarks']) {
      searchHistoryQry.resolve([]);
    }
    else {
      searchBookmarks({
        query: query
      }, {
        sort: 'visitCount',
        count: 10
      }).on('end', function(results) {
        searchBookmarksQry.resolve(results.filter(function(result) {
          result.priority = 0.8;
          return true;
        }));
      })
    }

    let customQry = defer();
    customQry.resolve([ {
      url: 'http://work.erikvold.com',
      title: 'Erik Vold',
      priority: 0.1
    } ]);

    let previewsQry = defer();
    previewsQry.resolve([ {
        url: 'https://www.amazon.com/s/?field-keywords=' + query
      }, {
        url: 'https://duckduckgo.com/html/?q=' + query
      },
      (query.match(/time/)) ? { url: data.url("clock.html") } : {},
      (!!isURL) ? { url: isURL } : {}
    ]);

    all(searchHistoryQry.promise,
        searchBookmarksQry.promise,
        customQry.promise,
        getGoogleSuggestions({ query: query }),
        tabsSearchQry.promise).then(function(results) {
      if (queryIndex != thisQryIndex) {
        return;
      }

      all(previewsQry.promise).then(function(previews) {
        urlPanel.port.emit('query', {
          query: query,
          results: purifyResults(results),
          previews: flatten(previews).filter(function(p) !!p.url)
        });
      })
    });
  }, false);
});
