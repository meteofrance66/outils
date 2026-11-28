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
export type ApparitionCarte = 'swipe' | 'pop' | '3d' | 'slide' | 'rideau' | 'spring' | 'tilt' | 'focus' | 'stack' | 'parallax' | 'balayage' | 'fondu';
/** Effets proposés, avec leur durée par défaut (ms) : la durée se règle ensuite de 200 à 1 500 ms. */
export const APPARITIONS_CARTES: { id: ApparitionCarte; libelle: string; defaut: number }[] = [
  { id: 'swipe', libelle: '⬆️ Swipe Up (style TikTok)', defaut: 350 },
  { id: 'pop', libelle: '💥 Pop Zoom (moderne)', defaut: 400 },
  { id: '3d', libelle: '🧊 Reveal 3D (immersif)', defaut: 450 },
  { id: 'slide', libelle: '↔️ Slide latéral', defaut: 450 },
  { id: 'rideau', libelle: '🎭 Rideau Reveal', defaut: 600 },
  { id: 'spring', libelle: '🏀 Spring Bounce', defaut: 700 },
  { id: 'tilt', libelle: '🌀 Dynamic Tilt', defaut: 550 },
  { id: 'focus', libelle: '✨ Magic Focus', defaut: 600 },
  { id: 'stack', libelle: '🃏 Card Stack', defaut: 550 },
  { id: 'parallax', libelle: '🏞️ Parallax Scroll', defaut: 650 },
  { id: 'balayage', libelle: '➡️ Balayage de gauche à droite', defaut: 750 },
  { id: 'fondu', libelle: '🌫️ Fondu simple (sans mouvement)', defaut: 400 },
];
export const dureeApparitionParDefaut = (id: ApparitionCarte) => APPARITIONS_CARTES.find((a) => a.id === id)?.defaut ?? 400;

/** Décélération progressive (cubic-bezier proche de « ease-out »). */
const decel = (x: number) => 1 - (1 - clamp(x)) ** 3;
/** Accélération puis décélération (« ease-in-out »). */
const doux = (x: number) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};
/** Ressort amorti : 0 → dépasse 1 → se pose à 1 (x de 0 à 1). */
const rebond = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(13 * x));

/** Voile sombre sur la carte qui s'efface (elle « recule »). */
function voile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) {
  if (a <= 0.01) return;
  ctx.fillStyle = `rgba(6,10,24,${a.toFixed(3)})`;
  ctx.fillRect(x, y, w, h);
}

/**
 * Entrée de la carte `carte` (rectangle `r`) à l'instant `tl` (secondes depuis le début de son écran), en `d` secondes, par-dessus la
 * précédente (null pour la première) :
 * - Swipe Up : la nouvelle monte du bas (100 % → 0 %, opacité 0 → 1), la précédente part vers le haut ;
 * - Pop Zoom : échelle 85 % → 103 % → 100 %, flou 8 px → 0, opacité 0 → 1 ;
 * - Reveal 3D : rotation X 45° → 0° en perspective (800 px), translation 50 px → 0 ;
 * - Slide latéral : la nouvelle arrive de la droite, la précédente part à gauche en s'assombrissant ;
 * - Rideau Reveal : la précédente s'ouvre en deux comme un rideau de théâtre sur la nouvelle, qui se pose (105 % → 100 %) ;
 * - Spring Bounce : la nouvelle jaillit (60 % → rebonds → 100 %) ;
 * - Dynamic Tilt : la nouvelle arrive penchée (−9°) du bas à gauche, se redresse avec un léger dépassement ;
 * - Magic Focus : la nouvelle sort du flou (16 px → 0) en se resserrant (112 % → 100 %), avec un éclat de lumière ;
 * - Card Stack : la précédente recule dans la pile (92 %, plus haut, plus sombre), la nouvelle se pose dessus en venant du bas ;
 * - Parallax Scroll : le cadre monte plus vite que la carte qu'il contient, la précédente monte plus lentement (profondeur) ;
 * - Balayage et fondu : les entrées d'avant.
 * Les distances en px sont celles d'un écran de 1080 px de large (elles suivent la largeur de la vidéo).
 */
function apparitionCarte(ctx: CanvasRenderingContext2D, effet: ApparitionCarte, d: number, precedente: HTMLCanvasElement | null, carte: HTMLCanvasElement, tl: number, r: { x: number; y: number; w: number; h: number }) {
  const echellePx = r.w / 1040;
  const p0 = clamp(tl / Math.max(0.05, d));
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (p0 >= 1) {
    // Animation finie : la carte est simplement là (rien à recalculer).
    ctx.drawImage(carte, r.x, r.y);
  } else if (effet === 'swipe') {
    const p = decel(p0);
    if (precedente) ctx.drawImage(precedente, r.x, r.y - p * r.h * 0.35);
    ctx.globalAlpha = p0;
    ctx.drawImage(carte, r.x, r.y + (1 - p) * r.h);
  } else if (effet === 'pop') {
    if (precedente) {
      ctx.globalAlpha = 1 - p0;
      ctx.drawImage(precedente, r.x, r.y);
    }
    // 85 % → 103 % (aux deux tiers) → 100 %, chaque morceau avec décélération.
    const e = p0 < 0.65 ? 0.85 + 0.18 * decel(p0 / 0.65) : 1.03 - 0.03 * decel((p0 - 0.65) / 0.35);
    const flou = 8 * (1 - decel(p0)) * echellePx;
    ctx.globalAlpha = decel(p0 / 0.6);
    if (flou > 0.3) ctx.filter = `blur(${flou.toFixed(1)}px)`;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(e, e);
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
    ctx.filter = 'none';
  } else if (effet === '3d') {
    const p = decel(p0);
    if (precedente) {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(precedente, r.x, r.y);
    }
    ctx.globalAlpha = clamp(p0 / 0.65);
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
        const proj = (y: number) => {
          const f = P / (P - y * sin);
          return { y: y * cos * f, f };
        };
        const a = proj(yb - r.h / 2);
        const b = proj(Math.min(yb + bande, r.h) - r.h / 2);
        const f = (a.f + b.f) / 2;
        ctx.drawImage(carte, 0, yb, r.w, Math.min(bande, r.h - yb), cx - (r.w / 2) * f, cy + a.y, r.w * f, Math.max(0.5, b.y - a.y + 0.6));
      }
    }
  } else if (effet === 'slide') {
    const p = doux(p0);
    if (precedente) {
      ctx.drawImage(precedente, r.x - p * r.w * 0.3, r.y);
      voile(ctx, r.x, r.y, r.w, r.h, 0.55 * p);
    }
    const x = r.x + (1 - decel(p0)) * r.w;
    // Ombre portée sur la gauche de la carte qui arrive.
    const g = ctx.createLinearGradient(x - 30 * echellePx, 0, x, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 30 * echellePx, r.y, 30 * echellePx, r.h);
    ctx.drawImage(carte, x, r.y);
  } else if (effet === 'rideau') {
    // La nouvelle carte, dessous, se pose doucement ; la précédente s'ouvre en deux pans (ou un voile sombre pour la première).
    const p = doux(p0);
    const e = 1.05 - 0.05 * decel(p0);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(e, e);
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
    ctx.restore();
    const demi = r.w / 2;
    const ouverture = p * (demi + 20 * echellePx);
    for (const cote of [-1, 1]) {
      const x0 = cote < 0 ? r.x - ouverture : r.x + demi + ouverture;
      if (precedente) ctx.drawImage(precedente, cote < 0 ? 0 : demi, 0, demi, r.h, x0, r.y, demi, r.h);
      else {
        ctx.fillStyle = '#0c0c12';
        ctx.fillRect(x0, r.y, demi, r.h);
      }
      // Bord du pan : ombre et liseré de lumière.
      const bord = cote < 0 ? x0 + demi : x0;
      const g = ctx.createLinearGradient(bord - cote * 26 * echellePx, 0, bord, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(bord, bord - cote * 26 * echellePx), r.y, 26 * echellePx, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(bord - 1.5 * echellePx, r.y, 3 * echellePx, r.h);
    }
  } else if (effet === 'spring') {
    if (precedente) {
      ctx.globalAlpha = 1 - clamp(p0 / 0.35);
      ctx.drawImage(precedente, r.x, r.y);
    }
    const e = 0.6 + 0.4 * rebond(p0);
    ctx.globalAlpha = clamp(p0 / 0.25);
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(e, e);
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
  } else if (effet === 'tilt') {
    if (precedente) {
      ctx.globalAlpha = 1 - clamp(p0 / 0.6);
      ctx.drawImage(precedente, r.x, r.y);
    }
    const k = rebond(p0);
    const angle = ((-9 * Math.PI) / 180) * (1 - k);
    ctx.globalAlpha = clamp(p0 / 0.3);
    // Pivot en bas à gauche : la carte « se relève » en arrivant.
    ctx.translate(r.x - (1 - k) * r.w * 0.25, r.y + r.h + (1 - k) * r.h * 0.35);
    ctx.rotate(angle);
    const e = 0.92 + 0.08 * k;
    ctx.scale(e, e);
    ctx.drawImage(carte, 0, -r.h);
  } else if (effet === 'focus') {
    if (precedente) {
      ctx.globalAlpha = 1 - decel(p0);
      ctx.drawImage(precedente, r.x, r.y);
    }
    const p = decel(p0);
    const e = 1.12 - 0.12 * p;
    const flou = 16 * (1 - p) * echellePx;
    ctx.globalAlpha = clamp(p0 / 0.5);
    if (flou > 0.3) ctx.filter = `blur(${flou.toFixed(1)}px)`;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(e, e);
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
    ctx.restore();
    ctx.filter = 'none';
    // Éclat : une lueur blanche au centre qui s'élargit puis s'éteint (pointe au premier tiers).
    const eclat = Math.sin(Math.PI * clamp(p0 / 0.7));
    if (eclat > 0.02) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const R = r.w * (0.25 + 0.45 * p);
      const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 0, r.x + r.w / 2, r.y + r.h / 2, R);
      g.addColorStop(0, `rgba(255,250,230,${(0.45 * eclat).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else if (effet === 'stack') {
    const p = decel(p0);
    if (precedente) {
      // La précédente recule dans la pile : plus petite, plus haute, plus sombre.
      const e = 1 - 0.08 * p;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - 26 * echellePx * p);
      ctx.scale(e, e);
      ctx.drawImage(precedente, -r.w / 2, -r.h / 2);
      voile(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 0.5 * p);
      ctx.restore();
    }
    const y = r.y + (1 - p) * r.h * 0.9;
    const e = 0.95 + 0.05 * p;
    ctx.save();
    ctx.translate(r.x + r.w / 2, y + r.h / 2);
    ctx.scale(e, e);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 30 * echellePx;
    ctx.shadowOffsetY = -8 * echellePx;
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14 * echellePx * (1 - p));
    ctx.fillStyle = '#0c0c12';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();
    ctx.drawImage(carte, -r.w / 2, -r.h / 2);
    ctx.restore();
  } else if (effet === 'parallax') {
    const p = doux(p0);
    if (precedente) {
      // Plan du fond : la précédente monte lentement (30 % de la course) en s'assombrissant.
      ctx.drawImage(precedente, r.x, r.y - p * r.h * 0.3);
      voile(ctx, r.x, r.y, r.w, r.h, 0.45 * p);
    }
    // Plan du devant : le cadre monte de toute la hauteur, la carte qu'il contient n'en fait que la moitié (elle « glisse » dans son cadre).
    const yCadre = r.y + (1 - p) * r.h;
    const yCarte = r.y + (1 - p) * r.h * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, yCadre, r.w, r.h);
    ctx.clip();
    ctx.drawImage(carte, r.x, yCarte);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    if (p < 1) ctx.fillRect(r.x, yCadre, r.w, 2 * echellePx);
  } else if (effet === 'balayage') {
    if (precedente) ctx.drawImage(precedente, r.x, r.y);
    const w = sortie(p0);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w * w, r.h);
    ctx.clip();
    ctx.drawImage(carte, r.x, r.y);
    const x = r.x + r.w * w;
    const g = ctx.createLinearGradient(x - 40, 0, x + 4, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, r.y, 44, r.h);
  } else {
    if (precedente) ctx.drawImage(precedente, r.x, r.y);
    ctx.globalAlpha = p0;
    ctx.drawImage(carte, r.x, r.y);
  }
  ctx.restore();
}

export interface VideoChamps {
  duree: number;
  /** Début (s) de l'écran de chaque jour : sert à l'aperçu de l'effet d'apparition. */
  debutsJours: number[];
  dessiner: (ctx: CanvasRenderingContext2D, t: number) => void;
}

/**
 * `duree` : durée voulue de la vidéo en secondes, hors « Abonnez-vous ! » (absente : durée par défaut) ; elle s'ajuste en allongeant chaque carte.
 * `apparition` et `dureeApparition` (ms) : entrée des cartes.
 */
type Params = Omit<ParamsPlancheChamps, 'ctx'> & { zone: string; duree?: number; apparition?: ApparitionCarte; dureeApparition?: number };

export function preparerVideoChamps(p: Params): VideoChamps {
  const { largeur: W, hauteur: H, theme, jours, titre, geo, source, zone, apparition = 'swipe' } = p;
  const dApparition = (p.dureeApparition ?? dureeApparitionParDefaut(apparition)) / 1000;
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
  // L'entrée d'une carte ne dépasse pas 80 % de son écran (sinon elle n'aurait jamais le temps de se poser).
  const dEntree = Math.min(dApparition, DUREE_JOUR * 0.8);

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
      apparitionCarte(ctx, apparition, dEntree, k > 0 ? cartes[k - 1] : null, cartes[k], tl, { x: pad, y: yCarte, w: lc, h: hcF });
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
  return { duree, debutsJours: jours.map((_, k) => DUREE_INTRO + k * DUREE_JOUR), dessiner };
}

