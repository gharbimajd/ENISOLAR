/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 * 1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 * 2. Application imports. Files imported after ZoneJS that should be loaded before your main
 * file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes recent versions of Safari, Chrome (including
 * Opera), Edge on the desktop, and iOS and Chrome on mobile.
 *
 * Learn more in https://angular.io/guide/browser-support
 */

/***************************************************************************************************
 * BROWSER POLYFILLS
 */

// =========================================================================
// ⚡ ZONE.JS PERFORMANCE FLAGS (MUST BE BEFORE 'zone.js' IMPORT)
// =========================================================================

// 1. Disable Angular change detection for Ionic's custom web components
(window as any).__Zone_disable_customElements = true;

// 2. Gag Zone.js: Stop it from listening to high-frequency map and slider events
(window as any).__zone_symbol__UNPATCHED_EVENTS = [
  'scroll',
  'mousemove',
  'touchmove',
  'touchstart',
  'touchend',
  'pointermove' // Catches modern stylus/finger movements
];

// 3. Hardware Acceleration: Tell the browser these events won't block the UI
(window as any).__zone_symbol__PASSIVE_EVENTS = [
  'scroll',
  'touchmove',
  'touchstart'
];

// (Note: If you had an import './zone-flags'; here, it is no longer needed 
// because we put the flags directly in this file for safety).

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js';  // Included with Angular CLI.


/***************************************************************************************************
 * APPLICATION IMPORTS
 */