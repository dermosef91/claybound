// Pictograms for the instruction panel, drawn to be pressed into clay rather
// than printed on it: chunky rounded strokes, solid silhouettes, and one idea
// per icon. Each names the mechanism the hint is about, so the shape orients
// the player before they finish reading. Stroke colour follows the panel ink.
const wrap=body=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const solid='fill="currentColor" stroke="none"';

const ICONS={
  // Movement and the two airborne verbs.
  walk:`<circle cx="13.1" cy="4.5" r="2.6" ${solid}/><path d="M13.3 8.6 11.3 12.9"/><path d="M14.2 9.6 17.4 11.7"/><path d="M12.2 9.4 8.7 9"/><path d="M11.3 12.9 9.7 17 7.6 20.4"/><path d="M11.3 12.9 14.7 15.8 15.6 20.4"/>`,
  jump:`<path d="M12 20.2V6.4"/><path d="M6.6 11.6 12 5.8 17.4 11.6"/><path d="M4.6 22.2h14.8"/>`,
  drop:`<path d="M12 3.4v10.2"/><path d="M7.2 9.4 12 14.4 16.8 9.4"/><path d="M3.8 19.2h5.4"/><path d="M14.8 19.2h5.4"/>`,
  // Canyon.
  updraft:`<path d="M6.9 17.8 12 13.1 17.1 17.8"/><path d="M6.9 11.4 12 6.7 17.1 11.4"/><path d="M5.2 21.2h13.6"/>`,
  sink:`<path d="M4.4 8.6h15.2" stroke-width="3.4"/><path d="M8.7 12.6v5.6"/><path d="M6.4 15.9 8.7 18.5 11 15.9"/><path d="M15.3 12.6v5.6"/><path d="M13 15.9 15.3 18.5 17.6 15.9"/>`,
  // Wildwood.
  mushroom:`<path d="M3.9 11.7a8.1 8.1 0 0 1 16.2 0Z" ${solid}/><path d="M9.5 11.7v5.1a2.5 2.5 0 0 0 5 0v-5.1"/>`,
  balloon:`<circle cx="12" cy="8.9" r="5.7"/><path d="M12 14.6v1.9"/><path d="M12 16.5q2.1 1.7 0 3.4"/>`,
  // Glowing caverns.
  relay:`<rect x="8.1" y="3.2" width="7.8" height="5.4" rx="1.8" ${solid}/><path d="M12 8.6v7.2"/><path d="M5.6 15.8h12.8"/><path d="M8.4 15.8v4.4"/><path d="M15.6 15.8v4.4"/>`,
  ferry:`<path d="M5 13.4h14" stroke-width="3.4"/><path d="M7.6 11.6V8.2"/><path d="M16.4 11.6V8.2"/><path d="M3.4 18.6q2.9-2.2 5.7 0t5.7 0 5.8 0"/>`,
  wheel:`<circle cx="12" cy="12" r="7.3"/><path d="M6.8 6.8 17.2 17.2"/><path d="M17.2 6.8 6.8 17.2"/><circle cx="12" cy="12" r="1.9" ${solid}/>`,
  spitter:`<circle cx="9.6" cy="12" r="6.3"/><circle cx="8" cy="10.2" r="1.3" ${solid}/><path d="M15.9 12h2"/><circle cx="21" cy="12" r="1.7" ${solid}/>`,
  // Hanging Quarter.
  beam:`<path d="M4.2 9.2 19.8 13.2"/><path d="M12 11.4 8.6 19.2h6.8Z" ${solid}/><rect x="17.2" y="14.2" width="4.6" height="4.2" rx="1.3" ${solid}/>`,
  gondola:`<path d="M2.6 6.2h18.8"/><path d="M7.4 6.2v2.3"/><rect x="4" y="8.5" width="6.8" height="5" rx="1.6" ${solid}/><path d="M16.6 6.2v5.3"/><rect x="13.2" y="11.5" width="6.8" height="5" rx="1.6" ${solid}/>`,
  // Clay playground stations, one per gesture.
  lift:`<path d="M5.2 8.4h13.6" stroke-width="3.4"/><path d="M12 10.8v3.2"/><path d="M9.2 11.6 12 14.6 14.8 11.6"/><path d="M5.2 19.8h13.6" stroke-width="3.4"/>`,
  ramp:`<path d="M4.2 18.6h15.6L4.2 10.4Z" ${solid}/><path d="M13.4 5.6h5.8"/><path d="M16.6 3 19.2 5.6 16.6 8.2"/>`,
  landing:`<path d="M4.6 17.4h14.8" stroke-width="3.6"/><path d="M7.4 12.8H3.2"/><path d="M5.8 10.2 3 12.8l2.8 2.6"/><path d="M16.6 12.8h4.2"/><path d="M18.2 10.2 21 12.8l-2.8 2.6"/>`,
  stairs:`<path d="M3.8 19.6h5.1v-4.4h5.1v-4.4h5.2V6.4"/>`,
  bridge:`<path d="M4.4 11.4h15.2" stroke-width="3.4"/><path d="M5.6 13.4v6.2"/><path d="M18.4 13.4v6.2"/><path d="M12 3.2v4.8"/><path d="M9.2 5.4 12 8.4 14.8 5.4"/>`,
  // Goal, and the fallback for a hint that names no icon.
  bell:`<path d="M12 3.4a5.6 5.6 0 0 0-5.6 5.6c0 4.7-1.9 6.6-1.9 6.6h15s-1.9-1.9-1.9-6.6A5.6 5.6 0 0 0 12 3.4Z"/><path d="M10 18.2a2.1 2.1 0 0 0 4 0"/>`,
  spark:`<path d="M12 3.2 14.1 9.9 20.8 12 14.1 14.1 12 20.8 9.9 14.1 3.2 12 9.9 9.9Z"/>`
};

export const HINT_ICON_NAMES=Object.keys(ICONS);
export const hintIcon=name=>wrap(ICONS[name]||ICONS.spark);
