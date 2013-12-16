'use strict';

const { defer } = require('sdk/core/promise');
const simplePrefs = require('sdk/simple-prefs');
const { search: searchBookmarks } = require("sdk/places/bookmarks");

function getBookmarks({ query }) {
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
    return searchBookmarksQry.promise;
}
exports.getBookmarks = getBookmarks;
