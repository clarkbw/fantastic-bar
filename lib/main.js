'use strict';

const { data } = require('sdk/self');
const { defer, all } = require('sdk/core/promise');
const { union, flatten } = require('sdk/util/array');
const { merge } = require('sdk/util/object');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { on } = require('sdk/system/events');
const { URL } = require('sdk/url');
const { setTimeout, clearTimeout } = require('sdk/timers');

const { listen } = require('pathfinder/xul/listen');

const { GOOGLE_SUGGESTIONS_URL, PROVIDERS } = require('./providers');
const { openURL: oldOpenURL } = require('./open-url');
const { panel: urlPanel, viewFor } = require('./fantastic-panel');
const { purifyResults } = require('./results');
const { get: getGoogleSuggestions } = require('./google-suggestions');
const { geHistory } = require('./history');
const { getBookmarks } = require('./bookmarks');
const { getTabs } = require('./tabs');
const { watchFrame, onTrack } = require('./hacks');
const { Worker } = require("sdk/content/worker");

let lastQuery = "";
let queryIndex = 0;
let queryTimeout;

function openURL(options) {
  oldOpenURL(options);
  urlPanel.hide();
}

let workers = new WeakMap();

urlPanel.port.on('goto', openURL);

function frameWatcher(window) {
  watchFrame(window).then(function() {
    urlPanel.port.emit('show-preview', {
      url: window.frameElement.src
    });

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
on('content-document-global-created', frameWatcher);

onTrack(function(window) {
  const urlBar = window.document.getElementById('urlbar');

  listen(window, urlBar, 'keyup', function(evt) {
    if (evt.which == 27 || evt.which == 13) {
      urlPanel.hide();
      return;
    }

    clearTimeout(queryTimeout);
    queryTimeout = setTimeout(_ => {
      let thisQryIndex = ++queryIndex;
      let query = (urlBar.value || '').trim();
      let cleanQuery = query;
      lastQuery = cleanQuery;

      if (!cleanQuery) {
        return urlPanel.hide();
      }

      let isURL = false;
      try {
        isURL = URL(query).toString();
      }
      catch(e) {}

      query = encodeURIComponent(query);

      if (!urlPanel.isShowing) {
        // HACK
        let recentWindow = getMostRecentBrowserWindow();
        urlPanel.width = 0.9 * recentWindow.document.width;
        urlPanel.height = 0.9 * (recentWindow.document.height - 100);
        urlPanel.port.emit('size', { width: recentWindow.document.width, height: recentWindow.document.height })

        urlPanel.show();
      }

      let customQry = defer();
      customQry.resolve([ {
        url: 'http://work.erikvold.com',
        title: 'Erik Vold',
        priority: 0.1
      }, {
        url: 'https://google.com#q=' + query,
        title: 'Search for ' + query,
        priority: 0.99
      } ]);

      all(geHistory({ query: query }),
          getBookmarks({ query: query }),
          customQry.promise,
          getGoogleSuggestions({ query: query }),
          getTabs({ query: query })).then(function(results) {

        if (queryIndex != thisQryIndex) {
          return;
        }

        if (lastQuery != cleanQuery) {
          return;
        }

        urlPanel.port.emit('query', {
          query: query,
          results: purifyResults(results)
        });
      });
    }, 50);
  }, false);
});
