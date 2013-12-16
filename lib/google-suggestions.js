
const { defer } = require('sdk/core/promise');
const simplePrefs = require('sdk/simple-prefs');
const { Request } = require('sdk/request');
const { flatten } = require('sdk/util/array');

const { GOOGLE_SUGGESTIONS_URL, PROVIDERS } = require('./providers');

function get({ query }) {
    let googleSuggestions = defer();

    if (simplePrefs.prefs['ignoreSearchSuggestions']) {
      googleSuggestions.resolve([])
    }
    else {
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
    }

    return googleSuggestions.promise;
}
exports.get = get;