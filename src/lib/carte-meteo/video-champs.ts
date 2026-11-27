/**
 * Vidéo TikTok (9:16) des « cartes en couleurs » : ouverture (titre et période), puis une grande carte par jour qui balaie la
 * précédente, et pour finir la planche complète. Tout est précalculé une fois (cartes et planche), chaque image n'est qu'un montage.
 */
import {
  HAUTEUR_ECHELLE,
  HAUTEUR_PIED,
  THEMES_CHAMPS,
  bandeau,
  carteChamp,
  dessinerPlancheChamps,
  echelleCouleurs,
  fondCiel,
  hauteurBandeau,
  jourLong,
  niveauxPlanche,
  pied,
  rapportZone,
  titreCadre,
  type ParamsPlancheChamps,
} from './planche-champs';

const DUREE_INTRO = 2.4;
const DUREE_JOUR = 3.4;
const DUREE_FIN = 3.4;
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const sortie = (x: number) => 1 - (1 - clamp(x)) ** 3;
/** Ressort : dépasse un peu puis se pose (0 → 1). */
const ressort = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-5.5 * x) * Math.cos(10 * x));

const nomCourt = (nom: string) => nom.replace('Font-Romeu-Odeillo-Via', 'Font-Romeu').replace(/^Saint-/, 'St-').replace(/^Sainte-/, 'Ste-').toUpperCase();
const arrondi = (v: number) => Math.round(v);

/** Chiffres clés d'un jour : [texte, couleur], une ou deux lignes. */
function chiffresCles(theme: ParamsPlancheChamps['theme'], points: ParamsPlancheChamps['jours'][number]['points']): [string, string][] {
  const def = THEMES_CHAMPS[theme];
  const pts = (points ?? []).flatMap((p) => {
    const v = def.valeur(p);
    return v == null || !Number.isFinite(v) || !p.nom ? [] : [{ nom: nomCourt(p.nom), v }];
  });
  if (pts.length === 0) return [];
  const max = pts.reduce((m, p) => (p.v > m.v ? p : m));
  const min = pts.reduce((m, p) => (p.v < m.v ? p : m));
  const CHAUD = '#ffb066';
  const FROID = '#8fd3ff';
  switch (theme) {
    case 'tx':
      return [[`PLUS CHAUD : ${max.nom} ${arrondi(max.v)} °C`, CHAUD], [`PLUS FRAIS : ${min.nom} ${arrondi(min.v)} °C`, FROID]];
    case 'tn':
      return [[`PLUS FROID : ${min.nom} ${arrondi(min.v)} °C`, FROID], [`PLUS DOUX : ${max.nom} ${arrondi(max.v)} °C`, CHAUD]];
    case 'pluie':
      return max.v < 0.5 ? [['PAS DE PLUIE NOTABLE', '#ffe27a']] : [[`PLUS ARROSÉ : ${max.nom}`, FROID], [`${max.v < 10 ? max.v.toFixed(1).replace('.', ',') : arrondi(max.v)} MM EN 24 H`, '#ffffff']];
    case 'rafales':
      return [[`RAFALE MAXI : ${max.nom}`, '#ffe27a'], [`${arrondi(max.v / 5) * 5} KM/H`, '#ffffff']];
  }
}

export interface VideoChamps {
  duree: number;
  dessiner: (ctx: CanvasRenderingContext2D, t: number) => void;
}

type Params = Omit<ParamsPlancheChamps, 'ctx'> & { zone: string };

export function preparerVideoChamps(p: Params): VideoChamps {
  const { largeur: W, hauteur: H, theme, jours, titre, geo, source, zone } = p;
  const def = THEMES_CHAMPS[theme];
  const niveaux = niveauxPlanche(theme, jours);
  const hb = hauteurBandeau(H);
  const pad = 20;
  const ht = 64;
  const yEchelle = hb + 6 + 22;
  const yCadre = yEchelle + HAUTEUR_ECHELLE + 26;
  const dispo = H - HAUTEUR_PIED - 70 - (yCadre + ht);
  const lc = W - 2 * pad;
  const hc = Math.min(dispo, (lc / rapportZone(geo.boite)) * (geo.voisins ? 1.12 : 1.02));
  // Carte, puis les chiffres clés du jour dessous ; l'ensemble est centré dans la place libre.
  const hFaits = 190;
  const hcF = Math.min(hc, dispo - hFaits - 30);
  const yCarte = yCadre + ht + Math.max(0, (dispo - hcF - hFaits - 30) / 2);
  const yFaits = yCarte + hcF + 30;

  // Cartes du jour, en grand.
  const cartes = jours.map((j) => {
    const c = document.createElement('canvas');
    c.width = lc;
    c.height = Math.round(hcF);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0c0c12';
    ctx.fillRect(0, 0, c.width, c.height);
    carteChamp(ctx, theme, niveaux, j.points, j.iso, { x: 0, y: 0, w: c.width, h: c.height }, geo, 'gauche');
    return c;
  });
  // Planche complète (fin de la vidéo).
  const planche = document.createElement('canvas');
  planche.width = W;
  planche.height = H;
  dessinerPlancheChamps({ ...p, ctx: planche.getContext('2d')! });
  // Fond commun (ciel), dessiné une fois.
  const ciel = document.createElement('canvas');
  ciel.width = W;
  ciel.height = H;
  fondCiel(ciel.getContext('2d')!, W, H);

  const faits = jours.map((j) => chiffresCles(theme, j.points));
  const n = jours.length;
  const duree = DUREE_INTRO + n * DUREE_JOUR + DUREE_FIN;

  const dessiner = (ctx: CanvasRenderingContext2D, t: number) => {
    ctx.save();
    ctx.drawImage(ciel, 0, 0);
    // Bandeau : il descend à l'ouverture.
    const b = sortie(t / 0.45);
    ctx.save();
    ctx.translate(0, -(1 - b) * (hb + 10));
    bandeau(ctx, W, hb, titre);
    ctx.restore();

    if (t < DUREE_INTRO) {
      // Ouverture : thème, zone et nombre de jours, en gros au centre.
      const cy = H * 0.5;
      const k = ressort((t - 0.25) / 0.7);
      ctx.save();
      ctx.globalAlpha = clamp((t - 0.2) / 0.25) * (1 - clamp((t - DUREE_INTRO + 0.25) / 0.25));
      ctx.translate(W / 2, cy);
      ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      const lignes: [string, number, string][] = [
        [zone, 90, '#ffe27a'],
        [def.titre, 104, '#ffffff'],
        [`${n} JOURS EN CARTES`, 86, '#ff5a4f'],
      ];
      lignes.forEach(([texte, taille, couleur], i) => {
        const y = (i - 1) * 125;
        ctx.font = `${taille}px ${POLICE}`;
        let tt = taille;
        while (ctx.measureText(texte).width > W * 0.9 && tt > 30) {
          tt -= 2;
          ctx.font = `${tt}px ${POLICE}`;
        }
        ctx.lineWidth = tt * 0.12;
        ctx.strokeStyle = 'rgba(10,20,60,0.85)';
        ctx.strokeText(texte, 0, y);
        ctx.fillStyle = couleur;
        ctx.fillText(texte, 0, y);
      });
      ctx.restore();
    } else if (t < DUREE_INTRO + n * DUREE_JOUR) {
      const local = t - DUREE_INTRO;
      const k = Math.min(n - 1, Math.floor(local / DUREE_JOUR));
      const tl = local - k * DUREE_JOUR;
      // Échelle de couleurs (elle glisse à l'entrée du premier jour).
      const e = sortie(local / 0.5);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate((1 - e) * -W * 0.3, 0);
      echelleCouleurs(ctx, theme, { x: pad, y: yEchelle, w: W - 2 * pad, h: HAUTEUR_ECHELLE });
      ctx.restore();
      // Titre du cadre : le jour.
      titreCadre(ctx, jourLong(jours[k].iso), { x: pad, y: yCadre, w: lc, h: ht });
      ctx.fillStyle = '#0c0c12';
      ctx.fillRect(pad, yCarte, lc, hcF);
      // Carte précédente dessous, nouvelle carte qui la balaie de gauche à droite en se posant (léger zoom).
      if (k > 0) ctx.drawImage(cartes[k - 1], pad, yCarte);
      const w = sortie(tl / 0.75);
      // Pas de zoom ici : il rognerait l'étiquette du jour en haut de la carte.
      const z = 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, yCarte, lc * w, hcF);
      ctx.clip();
      ctx.translate(pad + lc / 2, yCarte + hcF / 2);
      ctx.scale(z, z);
      ctx.drawImage(cartes[k], -lc / 2, -hcF / 2);
      ctx.restore();
      // Bord lumineux du balayage.
      if (w < 1) {
        const x = pad + lc * w;
        const g = ctx.createLinearGradient(x - 40, 0, x + 4, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.85)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, yCarte, 44, hcF);
      }
      // Chiffres clés : ils montent une fois la carte posée.
      const lignes = faits[k];
      if (lignes.length > 0) {
        const f = sortie((tl - 0.7) / 0.45);
        ctx.save();
        ctx.globalAlpha = f;
        ctx.translate(0, (1 - f) * 60);
        ctx.fillStyle = 'rgba(12,14,30,0.88)';
        ctx.beginPath();
        ctx.roundRect(pad, yFaits, lc, hFaits, 18);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        lignes.forEach(([texte, couleur], i) => {
          const y = yFaits + (lignes.length === 1 ? hFaits / 2 + 22 : 76 + i * 78);
          let tt = 60;
          ctx.font = `${tt}px ${POLICE}`;
          while (ctx.measureText(texte).width > lc - 50 && tt > 26) {
            tt -= 2;
            ctx.font = `${tt}px ${POLICE}`;
          }
          ctx.fillStyle = couleur;
          ctx.fillText(texte, W / 2, y);
        });
        ctx.restore();
      }
      // Points de progression.
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(W / 2 + (i - (n - 1) / 2) * 40, H - HAUTEUR_PIED - 32, i === k ? 11 : 8, 0, Math.PI * 2);
        ctx.fillStyle = i === k ? '#ffffff' : 'rgba(255,255,255,0.45)';
        ctx.fill();
      }
      pied(ctx, W, H, source);
    } else {
      // Fin : la planche complète arrive en se posant.
      const tf = t - DUREE_INTRO - n * DUREE_JOUR;
      const a = sortie(tf / 0.6);
      const z = 1.08 - 0.08 * sortie(tf / 1.2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.drawImage(planche, -W / 2, -H / 2);
      ctx.restore();
    }
    ctx.restore();
  };
  return { duree, dessiner };
}

