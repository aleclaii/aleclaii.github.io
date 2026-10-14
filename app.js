// The page and all essential links work without JavaScript.
// Temporary diagnostic switch. Set this default to true to freeze every visit,
// use ?freeze=1 for one URL, or toggle window.FREEZE_ANIMATIONS in the console.
const FREEZE_ANIMATIONS_DEFAULT = false;
let animationsFrozen = false;
const pausedAnimations = new Set();

Object.defineProperty(window, 'FREEZE_ANIMATIONS', {
  configurable: true,
  get: () => animationsFrozen,
  set(value) {
    const frozen = Boolean(value);
    if (frozen === animationsFrozen) return;
    animationsFrozen = frozen;
    if (frozen) {
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'running') {
          pausedAnimations.add(animation);
          animation.pause();
        }
      }
    }
    document.documentElement.dataset.motionFrozen = String(frozen);
    if (!frozen) {
      for (const animation of pausedAnimations) if (animation.playState === 'paused') animation.play();
      pausedAnimations.clear();
    }
    document.dispatchEvent(new Event('portfolio:motionchange'));
  }
});
window.FREEZE_ANIMATIONS = FREEZE_ANIMATIONS_DEFAULT || new URLSearchParams(location.search).get('freeze') === '1';

const copyButton = document.querySelector('[data-email]');
const copyStatus = document.getElementById('copy-status');

if (copyButton && copyStatus && navigator.clipboard && window.isSecureContext) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.email);
      copyStatus.textContent = 'Email copied to clipboard.';
    } catch {
      copyStatus.textContent = 'Couldn’t copy automatically. Select the email address above to copy it.';
    }
  });
}
