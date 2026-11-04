"use strict";
/* ui-icons.js: the app's one line-icon set (version 2 look, 2026-11-04). Hand-drawn inline SVG on a
   24 x 24 grid, 2 px stroke, round ends, drawn in the text colour (currentColor). No icon library.
     icon(name)            -> '<svg class="ic">…</svg>'
     icon(name, "big")     -> adds a class (sizes live in tracker.css)
   Loaded after the data files and before the views, which call icon() when they draw. */
var ICONS = {
  /* navigation */
  today:    '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><rect x="8" y="13" width="3.6" height="3.6" rx=".9" fill="currentColor" stroke="none"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  chart:    '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 3 5-6"/>',
  grid:     '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  /* marks */
  check:    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  half:     '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  timer:    '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.8h5M18.6 6.4l1.4-1.4"/>',
  note:     '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8h5M9 12.5h7M9 16h5"/>',
  info:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  cog:      '<circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.8v3.7M12 17.5v3.7M2.8 12h3.7M17.5 12h3.7M5.5 5.5l2.6 2.6M15.9 15.9l2.6 2.6M5.5 18.5l2.6-2.6M15.9 8.1l2.6-2.6"/>',
  sliders:  '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  chevR:    '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  chevL:    '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevD:    '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  chevU:    '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  play:     '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  flame:    '<path d="M12 21c-3.9 0-7-2.8-7-6.5 0-3.4 2.4-5.4 3.9-7.6.3 1.9 1.3 3.3 2.6 4 .1-3.1 1.3-5.9 3.6-7.4-.2 2.9.9 4.6 2.2 6.3 1.1 1.4 1.7 3 1.7 4.8C19 18.3 15.9 21 12 21z"/>',
  house:    '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.2 10v10h11.6V10M10 20v-5.5h4V20"/>',
  heart:    '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  bolt:     '<path d="M13 3 5.5 13.5h6L10.5 21 18.5 10.5h-6z"/>',
  moon:     '<path d="M19.5 14.5A7.8 7.8 0 0 1 9.5 4.5a7.8 7.8 0 1 0 10 10z"/>',
  trophy:   '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a3 3 0 0 0 2.8 4M16 6h2.5a3 3 0 0 1-2.8 4M12 13.5V17M8.5 20.5h7M10 17h4"/>',
  star:     '<path d="m12 4 2.4 5 5.4.7-4 3.7 1.1 5.3L12 16l-4.9 2.7 1.1-5.3-4-3.7 5.4-.7z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
  search:   '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  undo:     '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  edit:     '<path d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="m14.2 7.8 3 3"/>',
  book:     '<path d="M5 5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2z"/><path d="M5 19.5a2 2 0 0 0 2 1.5h12M9 8h6"/>',
  camera:   '<path d="M4 8h3.2l1.8-2.5h6L16.8 8H20v11H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
  fork:     '<path d="M7 3v7.5M4.8 3v5a2.2 2.2 0 0 0 4.4 0V3M7 10.5V21M17.5 3c-2.2 1.6-3.2 4.2-3.2 7.3h3.2V21"/>',
  layers:   '<path d="m12 3.5 8.5 4.7L12 13 3.5 8.2z"/><path d="m3.5 12.4 8.5 4.8 8.5-4.8M3.5 16.4 12 21.2l8.5-4.8"/>',
  phone:    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.8 18.3h2.4"/>',
  refresh:  '<path d="M19.5 11A7.6 7.6 0 0 0 6 6.6L4.5 8.5"/><path d="M4.5 4v4.5H9"/><path d="M4.5 13A7.6 7.6 0 0 0 18 17.4l1.5-1.9"/><path d="M19.5 20v-4.5H15"/>',
  backspace:'<path d="M9 5.5h11v13H9l-5.5-6.5z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
  skip:     '<path d="M6 5.5v13l9-6.5z"/><path d="M18 5.5v13"/>',
  upload:   '<path d="M12 15V4.5M7.5 9 12 4.5 16.5 9"/><path d="M5 14.5v4.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4.5"/>',
  download: '<path d="M12 4.5V15M7.5 10.5 12 15l4.5-4.5"/><path d="M5 14.5v4.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4.5"/>',
  trash:    '<path d="M4.5 7h15M10 4h4M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  arrowUp:  '<path d="M12 19V5.5M6.5 11 12 5.5l5.5 5.5"/>',
  arrowDown:'<path d="M12 5v13.5M6.5 13 12 18.5l5.5-5.5"/>',
  trendUp:  '<path d="m4 17 6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  user:     '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  swap:     '<path d="M7 7.5h11l-3-3M17 16.5H6l3 3"/>',
  link:     '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bell:     '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  pulse:    '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>'
};
function icon(name, cls){
  return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + '</svg>';
}
