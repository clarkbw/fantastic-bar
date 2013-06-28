'use strict';

const winUtils = require('sdk/deprecated/window-utils');
const { isBrowser } = require('sdk/window/utils');
const { data } = require('sdk/self');
const { Panel } = require('sdk/panel');
const tabs = require('sdk/tabs');

const { load: loaddSS } = require('pathfinder/userstyles');
const { listen } = require('pathfinder/xul/listen');

const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';

tabs.open(data.url('urlBar.html'));

// hide the old junk
loaddSS(data.url('browser.css'));

let urlPanel = Panel({
  width: 800,
  height: 400,
  focus: false,
  contentURL: data.url('urlBar.html'),
  contentScriptFile: data.url('urlBar.js')
});

let previewPanel = Panel({
  width: 1200,
  height: 400,
  focus: false
});

winUtils.WindowTracker({
  onTrack: function(window) {
  	if (!isBrowser(window)) return;

    let urlBar = window.document.getElementById('urlbar');
    listen(window, urlBar, 'keyup', function(evt) {
      let query = urlBar.value;

      if (!query) {
        return urlPanel.hide();
      }

      if (query.match(/^google\s.+/i)) {
        previewPanel.hide();
        previewPanel.contentURL = GOOGLE_SEARCH_URL + encodeURIComponent(query);
        previewPanel.show();
      }

      return;
      if (!urlPanel.isShowing) {
        urlPanel.show();
      }

      urlPanel.port.emit('query', {
        query: query
      });
    }, false);
  }
});
