/** Variantes non destructives : seuls les contours des nuages sont amincis de 10 %. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const chemins = {};
for (const jeu of ['pictos-alertes', 'pictos-alertes-pro']) {
  const sortie = `public/pictos-sauge/${jeu}`;
  mkdirSync(sortie, { recursive: true });
  for (const nom of readdirSync(`public/${jeu}`).filter((f) => f.endsWith('.svg'))) {
    const source = readFileSync(`public/${jeu}/${nom}`, 'utf8');
    // Forme de nuage commune aux deux jeux (y compris pluie, neige, éclaircies et nuit).
    const fin = source.replace(/<path\b[^>]*\bd="M10 30H38A10[^>]*>/g, (nuage) =>
      nuage.replace(/stroke-width="([\d.]+)"/, (_, largeur) => `stroke-width="${Number((Number(largeur) * 0.9).toFixed(4))}"`));
    if (fin === source) continue;
    writeFileSync(join(sortie, nom), fin);
    chemins[`/${jeu}/${nom}`] = `/pictos-sauge/${jeu}/${nom}`;
  }
}
writeFileSync('src/lib/carte-meteo/pictos-sauge.json', JSON.stringify(chemins, null, 2) + '\n');
console.log(`${Object.keys(chemins).length} variantes de nuages affinées.`);
