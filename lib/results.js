'use strict';

const { flatten } = require('sdk/util/array');

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
    return(a.priority < b.priority ? 1 : ( (a.priority === b.priority) ? 0 : -1));
  });
}
exports.purifyResults = purifyResults;
