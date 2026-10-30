var konamiStep = 0;
var konamiFallbackTimer = null;
var konamiTriggered = false;

function triggerKonami() {
  if (konamiTriggered) return;
  konamiTriggered = true;
  konamiStep = 0;
  if (konamiFallbackTimer) {
    clearTimeout(konamiFallbackTimer);
    konamiFallbackTimer = null;
  }

  const url = 'https://exunclan.com';
  try {
    const newTab = window.open(url, '_blank');
    if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
      window.location.href = url;
    }
  } catch (err) {
    window.location.href = url;
  }

  setTimeout(() => {
    konamiTriggered = false;
  }, 3000);
}

function handleKonamiInput(e) {
  if (isScrollAnimationActive) return;

  const k = e.key.toLowerCase();
  let inputType = null;

  if (k === 'arrowup' || k === 'w') {
    inputType = 'up';
  } else if (k === 'arrowdown' || k === 's') {
    inputType = 'down';
  } else if (k === 'arrowleft' || (k === 'a' && konamiStep !== 9)) {
    inputType = 'left';
  } else if (k === 'arrowright' || k === 'd') {
    inputType = 'right';
  } else if (k === 'b') {
    inputType = 'b';
  } else if (k === 'a') {
    inputType = 'a';
  }

  if (!inputType) {
    if ((konamiStep === 8 || konamiStep === 10) && (k === 'enter' || k === ' ')) {
      triggerKonami();
      return;
    }
    konamiStep = 0;
    if (konamiFallbackTimer) {
      clearTimeout(konamiFallbackTimer);
      konamiFallbackTimer = null;
    }
    return;
  }

  const EXPECTED = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

  if (inputType === EXPECTED[konamiStep]) {
    konamiStep++;

    if (konamiStep === 8) {
      if (konamiFallbackTimer) clearTimeout(konamiFallbackTimer);
      konamiFallbackTimer = setTimeout(() => {
        if (konamiStep === 8) {
          triggerKonami();
        }
      }, 1400);
    } else if (konamiStep === 9) {
      if (konamiFallbackTimer) {
        clearTimeout(konamiFallbackTimer);
        konamiFallbackTimer = null;
      }
    } else if (konamiStep === 10) {
      if (konamiFallbackTimer) {
        clearTimeout(konamiFallbackTimer);
        konamiFallbackTimer = null;
      }
      triggerKonami();
    }
  } else {
    if (konamiFallbackTimer) {
      clearTimeout(konamiFallbackTimer);
      konamiFallbackTimer = null;
    }
    if (inputType === EXPECTED[0]) {
      konamiStep = 1;
    } else {
      konamiStep = 0;
    }
  }
}

