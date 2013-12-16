'use strict';

const { data } = require('sdk/self');
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
const { geHistory } = require('./history');
const { getBookmarks } = require('./bookmarks');
const { getTabs } = require('./tabs');
const { watchFrame, Worker, onTrack } = require('./hacks');

let queryIndex = 0;

function openURL(options) {
  oldOpenURL(options);
  urlPanel.hide();
}

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
  const urlBar = window.document.getElementById('urlbar');

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

    all(geHistory({ query: query }),
        getBookmarks({ query: query }),
        customQry.promise,
        getGoogleSuggestions({ query: query }),
        getTabs({ query: query })).then(function(results) {
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
