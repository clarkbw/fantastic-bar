'use strict';

const { defer } = require('sdk/core/promise');
const { setTimeout } = require('sdk/timers');

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
exports.waitForLoad = waitForLoad;
