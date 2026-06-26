// @ts-check
import { defineConfig } from 'astro/config';

// Static build → output goes to ./dist, which the existing Express server serves
// in place of public/. The /api backend stays untouched.
export default defineConfig({
    output: 'static',
    outDir: './dist',
    base: '/',
    // Astro defaults to directory-style URLs (/setup/). 'ignore' lets both
    // /setup and /setup/ resolve, preserving existing bookmarks/links.
    trailingSlash: 'ignore',
    build: {
        // Keep asset URLs stable and predictable under /assets/.
        assets: 'assets',
    },
});
