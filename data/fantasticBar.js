'use strict';

function $(id) document.getElementById(id);

const queryNum = 0;
let lastInterval;

self.port.on('size', function({ height }) {
  let output = $('results-list').setAttribute('style', 'max-height: ' + height + 'px');
});

self.port.on('show-preview', function({ url }) {
  let frames = document.getElementsByTagName("iframe");
  for (let i = frames.length - 1; i >= 0; i--) {
    let frame = frames[i];
    if (frame.src == url) {
      frame.removeAttribute('style');
    }
  }
});

self.port.on('query', function({ query, results, previews }) {
  let output = $('results-list');
  let preview_out = $('preview');
  // clear old results
  output.innerHTML = '';
  preview_out.innerHTML = '';

  // clear the preview
  // preview.innerHTML = '';
  let count = 0;
  let newPrewviewOutput = '';
  previews.forEach(function({ url }) {
    newPrewviewOutput += '<iframe id="frame-' + count++ + '" style="visibility: hidden;" data-url="'+url+'" frameborder="0" scrolling="yes" marginheight="0" marginwidth="0" src="' + url + '"' + (count == previews.length ? ' class="slide"' : '') + '></iframe>';
  });
  preview_out.innerHTML = newPrewviewOutput;

  let frames = document.getElementsByTagName( "iframe" );

  let displayed = count - 1;
  clearInterval(lastInterval);

  lastInterval = setInterval(function() {
    let oldD = frames[displayed];

    oldD && oldD.setAttribute('class', 'slide-off');

    let newI = (--displayed < 0 ? (displayed = previews.length - 1) : displayed);
    let newD = frames[newI];

    newD && newD.setAttribute('class', 'slide');
  }, 10000);

  results.forEach(function(result) {
    let li = document.createElement('li');
    li.innerHTML = '<span class="link-title">' + result.title + '</span><span class="link">' + result.url + '</span>';
    li.addEventListener('click', function() {
      self.port.emit('goto', result);
    }, false);
    output.appendChild(li);
  })
});	

function shouldStop() {
  
}

