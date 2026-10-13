// The page and all essential links work without JavaScript.
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
