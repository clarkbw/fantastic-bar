'use strict';

const winUtils = require('sdk/deprecated/window-utils');
const { isBrowser } = require('sdk/window/utils');
const { data } = require('sdk/self');
const { Panel } = require('sdk/panel');
const tabs = require('sdk/tabs');
const { search: searchHistory } = require("sdk/places/history");
const { search: searchBookmarks } = require("sdk/places/bookmarks");
const { defer, all } = require('sdk/core/promise');
const { union, flatten } = require('sdk/util/array');
const { merge } = require('sdk/util/object');
const { Request } = require('sdk/request');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

const { GOOGLE_SUGGESTIONS_URL, PROVIDERS } = require('./providers');
const { load: loaddSS } = require('pathfinder/userstyles');
const { listen } = require('pathfinder/xul/listen');

const SEARCH_URL = data.url('urlBar.html') + "?q=";

let queryIndex = 0;

// hide the old junk
loaddSS(data.url('browser.css'));

let urlPanel = Panel({
  focus: false,
  contentURL: data.url('urlBar.html'),
  contentScriptWhen: 'ready',
  contentScriptFile: data.url('urlBar.js')
});

urlPanel.port.on('goto', function({ url }) {
  for (let tab of tabs) {
    if (tab.url == url) {
      tab.activate();
      urlPanel.hide();
      return;
    }
  }

  tabs.open(url);
  urlPanel.hide();
})

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
      let query = encodeURIComponent(urlBar.value);

      if (!query) {
        return urlPanel.hide();
      }

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
        url: 'http://ca.search.yahoo.com/search?p=' + query
      }, {
        url: 'https://www.amazon.com/s/?field-keywords=' + query
      }, {
        url: 'https://duckduckgo.com/html/?q=' + query
      } ]);

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
            previews: flatten(previews)
          });
        })
      });
    }, false);
  }
});

function purifyResults(results) {
  let seen = Object.create(null);

  return flatten(results).filter(function(r) {
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
