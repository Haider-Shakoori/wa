/* RelayWA cookie notice: UI for the EXISTING optional-analytics preference.
 * Does not load third-party tags, collect identifiers or alter essential cookies.
 * The live site's GoogleAnalytics component listens for the choice-changed event.
 */
(() => {
  'use strict';
  const KEY = 'relaywa_analytics_consent';
  const CHANGE = 'relaywa:analytics-choice-changed';
  const ID = 'relaywa-cookie-message';
  function storedChoice() {
    try {
      const value = window.localStorage.getItem(KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch { return null; }
  }
  function choose(value) {
    try {
      window.localStorage.setItem(KEY, value);
      window.dispatchEvent(new Event(CHANGE));
      // Also makes the existing SPA listeners aware if a different tab changes its choice.
      const notice = document.getElementById(ID);
      notice?.remove();
    } catch {
      // Avoid claiming a durable preference when browser storage is unavailable.
      window.location.assign('/analytics-preferences');
    }
  }
  function show() {
    if (storedChoice() || document.getElementById(ID)) return;
    const notice = document.createElement('aside');
    notice.id = ID;
    notice.className = 'rw-cookie-message';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-labelledby', 'rw-cookie-heading');
    notice.innerHTML = `
      <div class="rw-cookie-copy">
        <strong id="rw-cookie-heading">We use cookies</strong>
        <p>Essential cookies keep RelayWA working. Optional analytics help us improve
        our public pages, based on your region and preferences. You can change your choice
        at any time.</p>
      </div>
      <div class="rw-cookie-actions">
        <button type="button" data-cookie-choice="granted">Accept optional</button>
        <button type="button" data-cookie-choice="denied">Reject optional</button>
        <a href="/analytics-preferences">Cookie settings</a>
      </div>`;
    for (const button of notice.querySelectorAll('button[data-cookie-choice]')) {
      button.addEventListener('click', () => choose(button.dataset.cookieChoice));
    }
    document.body.append(notice);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show, { once: true });
  } else {
    show();
  }
  window.addEventListener('storage', event => {
    if (event.key === KEY && storedChoice()) document.getElementById(ID)?.remove();
  });
  window.addEventListener(CHANGE, () => {
    if (storedChoice()) document.getElementById(ID)?.remove();
  });
})();
