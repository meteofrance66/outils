/** Icônes vectorielles du jeu maison ; génération Pro via scripts/pictos-pro.mjs. */
import { writeFileSync } from 'node:fs';

const variantes = [
  ['neige-montagne-faible-lpn', 'Neige faible en montagne (LPN)', 1, ''],
  ['neige-montagne-lpn', 'Neige en montagne (LPN)', 2, ''],
  ['neige-montagne-forte-lpn', 'Forte neige en montagne (LPN)', 3, ''],
  ['averses-neige-montagne-lpn', 'Averses de neige en montagne (LPN)', 2, 'soleil'],
  ['pluie-neige-montagne-lpn', 'Pluie et neige en montagne (LPN)', 1, 'pluie'],
  ['neige-montagne-nuit-lpn', 'Neige en montagne de nuit (LPN)', 2, 'nuit'],
];
const flocon = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-3 0H3M-1.5 -2.6L1.5 2.6M1.5 -2.6L-1.5 2.6" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/></g>`;
for (const [id, label, nombre, decor] of variantes) {
  const ciel = decor === 'soleil'
    ? '<circle cx="46" cy="12" r="6" fill="#facc15" stroke="#eab308" stroke-width="1.5"/><path d="M46 2V4M46 20V22M36 12H38M54 12H56M39 5L40.5 6.5M51.5 17.5L53 19M39 19L40.5 17.5M51.5 6.5L53 5" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>'
    : decor === 'nuit' ? '<path d="M49 3A10 10 0 1 0 58 17A9 9 0 0 1 49 3Z" fill="#fde68a" stroke="#eab308" stroke-width="1.2"/>' : '';
  const montagne = '<path d="M3 53L18 31L28 43L40 25L61 53Z" fill="#94a3b8" stroke="#64748b" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 40L18 31L24 40L19 38L16 40ZM33 36L40 25L48 37L41 34L37 37Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.7" stroke-linejoin="round"/>';
  const nuage = `<path d="M10 30H38A10 10 0 0 0 39 10.05A13 13 0 0 0 14.5 9A10.5 10.5 0 0 0 10 30Z" transform="translate(3 1) scale(0.68)" fill="${nombre === 3 ? '#94a3b8' : '#e2e8f0'}" stroke="#64748b" stroke-width="1.5" stroke-linejoin="round"/>`;
  const neige = [[12, 27], [25, 29], [34, 22]].slice(0, nombre).map(([x, y]) => flocon(x, y)).join('');
  const pluie = decor === 'pluie' ? '<path d="M24 24L22 29M32 24L30 29" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>' : '';
  const limite = '<path d="M3 46H61" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="4 3"/><rect x="18" y="53" width="28" height="10" rx="3" fill="#0c4a6e" stroke="none"/><text x="32" y="61" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#ffffff">LPN</text>';
  writeFileSync(`public/pictos-alertes/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}">${ciel}${montagne}${nuage}${neige}${pluie}${limite}</svg>\n`);
}
console.log(`${variantes.length} pictos neige en montagne avec LPN générés.`);
