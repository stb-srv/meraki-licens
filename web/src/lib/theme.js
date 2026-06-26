/*
 * Theme handling (dark/light) shared across pages.
 * Ported from public/index.html (lines 3150-3180). Same behaviour and same
 * localStorage key ('theme') so existing users keep their choice.
 *
 * The original toggleTheme() hard-coded a call to loadOverview() to re-render
 * charts after a theme switch. That coupling is page-specific, so here it is an
 * optional `onChange(theme)` callback the page can supply.
 */

const THEME_KEY = 'theme';
const DEFAULT_THEME = 'dark';

const SUN_ICON =
    '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>';
const MOON_ICON = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>';

/** Read the persisted theme (defaults to dark). */
export function getTheme() {
    return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

/** Swap the toggle button's icon to match the active theme. */
export function updateThemeBtn(theme) {
    const svg = document.getElementById('theme-svg');
    if (!svg) return;
    svg.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
}

/**
 * Flip between dark and light, persist, update the button icon, and fire the
 * optional onChange callback (e.g. to re-render Chart.js with new colors).
 */
export function toggleTheme(onChange) {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeBtn(next);
    if (typeof onChange === 'function') onChange(next);
}

/** Sync the button icon to the persisted theme on page load. */
export function initThemeButton() {
    updateThemeBtn(getTheme());
}
