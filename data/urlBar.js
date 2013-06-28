'use strict';

function $(id) document.getElementById(id);

const queryNum = 0;

const results = $('results-list');
const preview = $('preview');

self.port.on('query', function(msg) {
  // clear old results
  results.innerHTML = '';

  // clear the preview
  // preview.innerHTML = '';

  let li = document.createElement('li');
  li.innerHTML = msg.value;
  results.appendChild(li);
});

