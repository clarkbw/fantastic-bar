'use strict';

let { defer } = require('sdk/core/promise');
const { prefs } = require('sdk/simple-prefs');

function getPreviews() {
  let { promise, resolve } = defer();


  if (prefs['disablePreviews']) {
    resolve([]);
  }
  else {
    resolve([ {
        url: 'https://www.amazon.com/s/?field-keywords=' + query
      }, {
        url: 'https://duckduckgo.com/html/?q=' + query
      }, {
        url: 'https://google.com/search?q=' + query
      },
      (query.match(/time/)) ? { url: data.url("clock.html") } : {},
      (!!isURL) ? { url: isURL } : {}
    ]);
  }

  return promise;
}
exports.getPreviews = getPreviews;
