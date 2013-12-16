'use strict';

const { defer } = require('sdk/core/promise');
const simplePrefs = require('sdk/simple-prefs');
const { search: searchHistory } = require('sdk/places/history');

function geHistory({ query }) {
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
    return searchHistoryQry.promise;
}
exports.geHistory = geHistory;
