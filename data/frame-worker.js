
function setup() {
  if (!window.document || !window.document.body) {
    return;
  }

  window.document.body.addEventListener('click', function(e) {
    let { target } = e;
    target = getLink({target: target});
    if (target) {
      self.port.emit('openURL', { url: target.href, base: window.location.href })
      e.stopPropagation();
      return false;
    }
  }, true);
}

function getLink({target}) {
  if (target.tagName == 'A') {
  	return target;
  }
  if (target.parent) {
  	return getLink({ target: target.parentNode })
  }
  return undefined;
}

if (window.document.readyState != 'complete')
  window.addEventListener('load', setup, true);

setup();
