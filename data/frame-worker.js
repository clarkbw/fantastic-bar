
function setup() {
  console.log('frame setup ' + window.location.href);
  for(var i = 0; i < document.links.length; i++) {
	let link = document.links[i];
	link.addEventListener('click', function(evt) {
      self.port.emit('openURL', { url: link.href, base: window.location.href })
      evt.stopPropagation();
      return false;
    }, true);
  }
}

if (window.document.readyState != 'complete')
  window.addEventListener('load', setup, true);

setup();