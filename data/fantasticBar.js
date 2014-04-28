'use strict';

function $(id) document.getElementById(id);

const queryNum = 0;
let lastInterval;

self.port.on('size', function({ height }) {
  let output = $('results-list').setAttribute('style', 'max-height: ' + height + 'px');
});

self.port.on('query', function({ query, results }) {
  let output = $('results-list');
  output.innerHTML = '';

  results.forEach(result => {
    let li = document.createElement('li');
    li.innerHTML = '<span class="link-title">' + result.title + '</span><span class="link">' + result.url + '</span>';
    li.addEventListener('mouseover', function(event) {
      loadPreview(result);
    }, false);
    li.addEventListener('click', function() {
      self.port.emit('goto', result);
    }, false);
    output.appendChild(li);
  })
});

function loadPreview({ url }) {
  let iframe = $('preview_iframe');
  if (iframe.getAttribute('data-url') == url) {
    return;
  }
  iframe.src = url;
  iframe.setAttribute('data-url', url);
}

function shouldStop() {

}
