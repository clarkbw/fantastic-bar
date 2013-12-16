'use strict';

const { defer } = require('sdk/core/promise');
const { data } = require('sdk/self');
const { setTimeout } = require('sdk/timers');
const { Worker: WorkerTrait } = require('sdk/content/worker');
const { WindowTracker } = require('sdk/deprecated/window-utils');
const { isBrowser } = require('sdk/window/utils');

const { load: loaddSS } = require('pathfinder/userstyles');
const { panel: urlPanel, viewFor } = require('./fantastic-panel');

// hide the old junk
loaddSS(data.url('browser.css'));


const Worker = WorkerTrait.resolve({
  _injectInDocument: '__injectInDocument'
}).compose({
  get _injectInDocument() false
});
exports.Worker = Worker;

function onTrack(f) {
  WindowTracker({
    onTrack: function(window) {
      if (!isBrowser(window)) return;
      f(window);
    }
  });
}
exports.onTrack = onTrack;

function waitForLoad(window) {
  let { promise, resolve, reject } = defer();

  let loc;
  try {
    if (window.closed || window.top.closed) {
      reject();
    }

    loc = window.location.href;
  }catch(e) { reject() }

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

function watchFrame(window) {
  let { promise, reject } = defer();

  if (!('document' in window && 'frameElement' in window && window.document.documentElement)) {
    reject();
    return promise;
  }

  if (window.parent !== viewFor(urlPanel).getElementsByTagName('iframe')[0].contentWindow) {
    reject();
    return promise;
  }

  return waitForLoad(window);
}
exports.watchFrame = watchFrame;
