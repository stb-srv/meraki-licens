/*
 * Lucide icons — local, bundled, tree-shaken replacement for the old CDN script
 * (<script src="unpkg.com/lucide"> + lucide.createIcons()).
 *
 * The existing pages use <i data-lucide="name"> markup, much of it generated at
 * runtime inside JS (table rows built as HTML strings). A build-time icon
 * component can't cover those, so we keep the runtime createIcons() approach —
 * just sourced from the npm package instead of a CDN.
 *
 * Tree-shaking: each page imports ONLY the icons it actually uses (PascalCase,
 * e.g. import { LogIn } from 'lucide') and passes them here via makeIconRenderer.
 * That keeps the bundle small — importing the full `icons` set would pull ~1500
 * icons (~600 kB). The returned renderer takes no args so existing initIcons()
 * call sites (MutationObserver, setThemeIcon, …) stay unchanged.
 */
import { createIcons } from 'lucide';

/**
 * Build a renderer bound to a fixed icon map.
 * @param {Record<string, unknown>} icons - PascalCase icon imports from 'lucide'.
 * @returns {() => void} call to render all matching <i data-lucide> in the DOM.
 */
export function makeIconRenderer(icons) {
    return function initIcons() {
        createIcons({ icons });
    };
}
