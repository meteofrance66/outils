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
const DUREE_JOUR_DEFAUT = 3.4;
const DUREE_FIN_DEFAUT = 3.4;
/** Durée de la vidéo (hors « Abonnez-vous ! ») quand on n'en demande pas : ouverture, une carte de 3,4 s par jour, planche. */
export const dureeParDefautChamps = (nbJours: number) => DUREE_INTRO + nbJours * DUREE_JOUR_DEFAUT + DUREE_FIN_DEFAUT;
/** Durée la plus courte permise (hors « Abonnez-vous ! ») : 2 s par carte au moins. */
export const dureeMiniChamps = (nbJours: number) => DUREE_INTRO + nbJours * 2 + 2.5;
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

/** Façon dont chaque carte entre à l'écran. */
export type ApparitionCarte = 'swipe' | 'pop' | '3d' | 'balayage' | 'fondu';
export const APPARITIONS_CARTES: { id: ApparitionCarte; libelle: string }[] = [
  { id: 'swipe', libelle: '⬆️ Swipe Up (style TikTok)' },
  { id: 'pop', libelle: '💥 Pop Zoom (moderne)' },
  { id: '3d', libelle: '🧊 Reveal 3D (immersif)' },
  { id: 'balayage', libelle: '➡️ Balayage de gauche à droite' },
  { id: 'fondu', libelle: '🌫️ Fondu simple (sans mouvement)' },
];

/** Décélération progressive (cubic-bezier proche de « ease-out »). */
const decel = (x: number) => 1 - (1 - clamp(x)) ** 3;

/**
 * Entrée de la carte `carte` (rectangle `r`) à l'instant `tl` (secondes depuis le début de son écran), par-dessus la précédente :
 * - Swipe Up (350 ms) : la nouvelle monte du bas (100 % → 0 %, opacité 0 → 1), la précédente part vers le haut ;
 * - Pop Zoom (400 ms) : échelle 85 % → 103 % → 100 %, flou 8 px → 0, opacité 0 → 1 ;
 * - Reveal 3D (450 ms) : rotation X 45° → 0° en perspective (800 px), translation 50 px → 0, opacité 0 → 1 ;
 * - Balayage (750 ms) et fondu (400 ms) : les entrées d'avant.
 * Les durées et valeurs sont celles d'un écran de 1080 px de large (les distances en px suivent la largeur de la vidéo).
 */
function apparitionCarte(ctx: CanvasRenderingContext2D, effet: ApparitionCarte, precedente: HTMLCanvasElement | null, carte: HTMLCanvasElement, tl: number, r: { x: number; y: number; w: number; h: number }) {
  const echellePx = r.w / 1040;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (effet === 'swipe') {
    const p = decel(tl / 0.35);
    if (precedente && p < 1) ctx.drawImage(precedente, r.x, r.y - p * r.h * 0.35);
    ctx.globalAlpha = clamp(tl / 0.35);
    ctx.drawImage(carte, r.x, r.y + (1 - p) * r.h);
  } else if (effet === 'pop') {
    const p = clamp(tl / 0.4);
    if (precedente && p < 1) {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(precedente, r.x, r.y);
    }
    // 85 % → 103 % (aux deux tiers) → 100 %, chaque morceau avec décélération.
    const e = p < 0.65 ? 0.85 + 0.18 * decel(p / 0.65) : 1.03 - 0.03 * decel((p - 0.65) / 0.35);
    const flou = 8 * (1 - decel(p)) * echellePx;
    ctx.globalAlpha = decel(p / 0.6);
    if (flou > 0.3) ctx.filter = `blur(${flou.toFixed(1)}px)`;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(e, e);
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
    ctx.filter = 'none';
  } else if (effet === '3d') {
    const p = decel(tl / 0.45);
    if (precedente && p < 1) {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(precedente, r.x, r.y);
    }
    ctx.globalAlpha = clamp(tl / 0.3);
    const theta = ((45 * Math.PI) / 180) * (1 - p);
    const dy = 50 * echellePx * (1 - p);
    if (theta < 0.002) ctx.drawImage(carte, r.x, r.y + dy);
    else {
      // Perspective par bandes horizontales : chaque bande est projetée (rotation autour de l'axe horizontal du milieu de la carte).
      const P = 800 * echellePx * 2;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2 + dy;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const bande = 3;
      for (let yb = 0; yb < r.h; yb += bande) {
        const y0 = yb - r.h / 2;
        const y1 = Math.min(yb + bande, r.h) - r.h / 2;
        const proj = (y: number) => {
          const z = y * sin;
          const f = P / (P - z);
          return { y: y * cos * f, f };
        };
        const a = proj(y0);
        const b = proj(y1);
        const f = (a.f + b.f) / 2;
        const hb = Math.max(0.5, b.y - a.y + 0.6);
        ctx.drawImage(carte, 0, yb, r.w, Math.min(bande, r.h - yb), cx - (r.w / 2) * f, cy + a.y, r.w * f, hb);
      }
    }
  } else if (effet === 'balayage') {
    if (precedente) ctx.drawImage(precedente, r.x, r.y);
    const w = sortie(tl / 0.75);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w * w, r.h);
    ctx.clip();
    ctx.drawImage(carte, r.x, r.y);
    if (w < 1) {
      const x = r.x + r.w * w;
      const g = ctx.createLinearGradient(x - 40, 0, x + 4, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, r.y, 44, r.h);
    }
  } else {
    const p = clamp(tl / 0.4);
    if (precedente && p < 1) ctx.drawImage(precedente, r.x, r.y);
    ctx.globalAlpha = p;
    ctx.drawImage(carte, r.x, r.y);
  }
  ctx.restore();
}

export interface VideoChamps {
  duree: number;
  dessiner: (ctx: CanvasRenderingContext2D, t: number) => void;
}

/** `duree` : durée voulue de la vidéo en secondes, hors « Abonnez-vous ! » (absente : durée par défaut) ; elle s'ajuste en allongeant chaque carte. */
type Params = Omit<ParamsPlancheChamps, 'ctx'> & { zone: string; duree?: number; apparition?: ApparitionCarte };

export function preparerVideoChamps(p: Params): VideoChamps {
  const { largeur: W, hauteur: H, theme, jours, titre, geo, source, zone, apparition = 'swipe' } = p;
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
  const duree = Math.max(dureeMiniChamps(n), p.duree ?? dureeParDefautChamps(n));
  // Les secondes en plus vont aux cartes (et un peu à la planche finale, qui reste affichée plus longtemps).
  const DUREE_FIN = duree > dureeParDefautChamps(n) ? Math.max(DUREE_FIN_DEFAUT, duree * 0.12) : DUREE_FIN_DEFAUT;
  const DUREE_JOUR = (duree - DUREE_INTRO - DUREE_FIN) / n;

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
      apparitionCarte(ctx, apparition, k > 0 ? cartes[k - 1] : null, cartes[k], tl, { x: pad, y: yCarte, w: lc, h: hcF });
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

