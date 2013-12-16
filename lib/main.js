'use strict';

const winUtils = require('sdk/deprecated/window-utils');
const { isBrowser } = require('sdk/window/utils');
const { data } = require('sdk/self');
const { Panel, viewFor } = require('./panel');
const tabs = require('sdk/tabs');
const { search: searchHistory } = require("sdk/places/history");
const { search: searchBookmarks } = require("sdk/places/bookmarks");
const { defer, all } = require('sdk/core/promise');
const { union, flatten } = require('sdk/util/array');
const { merge } = require('sdk/util/object');
const { Request } = require('sdk/request');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { on } = require('sdk/system/events');
const { add } = require('sdk/deprecated/observer-service');
const { URL } = require('sdk/url');
const { Worker: WorkerTrait } = require('sdk/content/worker');
const { setTimeout } = require('sdk/timers')

const { GOOGLE_SUGGESTIONS_URL, PROVIDERS } = require('./providers');
const { load: loaddSS } = require('pathfinder/userstyles');
const { listen } = require('pathfinder/xul/listen');

const SEARCH_URL = data.url('urlBar.html') + "?q=";

const Worker = WorkerTrait.resolve({
  _injectInDocument: '__injectInDocument'
}).compose({
  get _injectInDocument() false
});

let queryIndex = 0;

// hide the old junk
loaddSS(data.url('browser.css'));

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

tabs.on('ready', function(tab) {
  if (tab == tabs.activeTab) {
    urlPanel.hide();
  }
})

let workers = new WeakMap();

function openURL({ url, base }) {
  url = URL(url, base).toString();

  for (let tab of tabs) {
    if (tab.url == url) {
      tab.activate();
      urlPanel.hide();
      return;
    }
  }

  tabs.open(url);
  urlPanel.hide();
}
urlPanel.port.on('goto', openURL);

function frameWatcher(window) {
  if (!('document' in window && 'frameElement' in window && window.document.documentElement)) {
    return;
  }
  if (window.parent !== viewFor(urlPanel).getElementsByTagName('iframe')[0].contentWindow) {
    return;
  }

  waitForLoad(window).then(function() {
    urlPanel.port.emit('show-preview', { url: window.frameElement.src });

    let worker = Worker({
      window: window,
      contentScriptFile: data.url('frame-worker.js')
    });
    workers.set(window, worker);
    worker.port.on('openURL', function(data) {
      openURL(data);
    });
  });
}

add('content-document-global-created', frameWatcher, false);

winUtils.WindowTracker({
  onTrack: function(window) {
  	if (!isBrowser(window)) return;

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
      for (let tab of tabs) {
        if (tab.title.match(query) || tab.url.match(query)) {
          tabsAry.push({ title: tab.title, url: tab.url, priority: 0.9 })
        }
      }
      tabsSearchQry.resolve(tabsAry);

      let searchHistoryQry = defer();
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

      let searchBookmarksQry = defer();
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

      let customQry = defer();
      customQry.resolve([ {
        url: 'http://erikvold.com',
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

      let googleSuggestions = defer();
      Request({
        url: GOOGLE_SUGGESTIONS_URL.replace('{searchTerms}', query),
        onComplete: function (response) {
          let results = flatten(response.json);
          let suggestions = [];

          PROVIDERS.forEach(function(provider) {
            results.forEach(function(result, i) {
              suggestions.push({
                url: provider.queryURL.replace('{searchTerms}', result),
                title: 'Search ' + provider.name + ' for ' + result,
                priority: 0.8 * (i + 1)
              });
            })
          });

          googleSuggestions.resolve(suggestions)
        }
      }).get();

      all(searchHistoryQry.promise,
          searchBookmarksQry.promise,
          customQry.promise,
          googleSuggestions.promise,
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
  }
});

function purifyResults(results) {
  let seen = Object.create(null);

  return flatten(results).filter(function(r) {
    if (!r.url || !r.priority) {
      return false;
    }

    if (seen[r.url]) {
      seen[r.url] = merge(seen[r.url], r);
      return false;
    }

    seen[r.url] = r;

    return true;
  }).sort(function(a, b) {
    return a.priority < b.priority ? 1 : -1;
  });
}

function waitForLoad(window) {
  let { promise, resolve, reject } = defer();

  try {
    if (window.closed || window.top.closed) {
      reject();
    }
  }catch(e) { reject() }

  let loc = window.location.href;

  if ("" != loc && "about:blank" != loc) {
    resolve(window);
  }
  else {
    setTimeout(function() {
      waitForLoad(window).then(resolve, reject)
    }, 0);
  }

  return promise;
}
