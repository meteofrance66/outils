/**
 * Planche « cartes en couleurs » : une carte de France par jour (2 ou 4 jours), champ coloré lissé à partir des prévisions des 96
 * départements, isolignes blanches et étiquettes de fourchette (« 22 à 24 °C »), dans le style des planches des réseaux sociaux :
 * bandeau rouge, échelle de couleurs, cadres violets. Thèmes : maxi, mini, pluie, rafales. Dessin en canvas 2D, sans React.
 */
import { PALETTES } from './animation-releves';
import { ajusterVue, versEcran, versMonde, type Boite, type Vue } from './projection-france';

export type ThemeChamp = 'tx' | 'tn' | 'pluie' | 'rafales';

/** Prévision d'un département pour un jour (valeurs du chef-lieu). */
export interface PointChampJour {
  code: string;
  /** Ville dont viennent les valeurs (chiffres clés de la vidéo). */
  nom?: string;
  lat: number;
  lon: number;
  tx: number | null;
  tn: number | null;
  pluie: number | null;
  rafale: number | null;
}

type RGB = [number, number, number];
type Palier = [number, RGB];

interface DefTheme {
  id: ThemeChamp;
  /** Menu. */
  libelle: string;
  /** Titres de la planche. */
  titre: string;
  /** Titre de l'échelle de couleurs. */
  legende: string;
  paliers: Palier[];
  /** Bornes de l'échelle de couleurs et valeurs écrites dessous. */
  echelle: [number, number];
  graduations: number[];
  /** Échelle logarithmique (pluie). */
  log?: boolean;
  /** En dessous : terres sans couleur (pas de pluie). */
  sec?: number;
  valeur: (p: PointChampJour) => number | null;
  /** Niveaux des isolignes, d'après les valeurs extrêmes de la planche. */
  niveaux: (min: number, max: number) => number[];
  /** Étiquette de la bande comprise entre deux niveaux (null : sous le premier ou au-dessus du dernier) ; null = pas d'étiquette. */
  bande: (a: number | null, b: number | null) => string | null;
}

/** Niveaux de `pas` en `pas` (températures) : 2 °C, ou 4 °C si l'écart est grand. */
function niveauxReguliers(min: number, max: number): number[] {
  const pas = max - min > 20 ? 4 : 2;
  const o: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max; v += pas) o.push(v);
  return o;
}

const bandeTemperature = (a: number | null, b: number | null) => (a == null ? `moins de ${b} °C` : b == null ? `plus de ${a} °C` : `${a} à ${b} °C`);

export const THEMES_CHAMPS: Record<ThemeChamp, DefTheme> = {
  tx: {
    id: 'tx',
    libelle: '🌡️ Maxi',
    titre: 'TEMPÉRATURES MAXIMALES',
    legende: 'Température maximale (°C)',
    paliers: PALETTES.t.paliers,
    echelle: [-10, 40],
    graduations: [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
    valeur: (p) => p.tx,
    niveaux: niveauxReguliers,
    bande: bandeTemperature,
  },
  tn: {
    id: 'tn',
    libelle: '🥶 Mini',
    titre: 'TEMPÉRATURES MINIMALES',
    legende: 'Température minimale (°C)',
    paliers: PALETTES.t.paliers,
    echelle: [-15, 30],
    graduations: [-15, -10, -5, 0, 5, 10, 15, 20, 25, 30],
    valeur: (p) => p.tn,
    niveaux: niveauxReguliers,
    bande: bandeTemperature,
  },
  pluie: {
    id: 'pluie',
    libelle: '🌧️ Pluie',
    titre: 'CUMULS DE PLUIE',
    legende: 'Pluie sur 24 h (mm)',
    paliers: [
      [0.5, [205, 232, 250]],
      [2, [130, 190, 250]],
      [5, [50, 120, 235]],
      [10, [40, 175, 90]],
      [20, [250, 205, 20]],
      [40, [240, 80, 20]],
      [80, [160, 20, 150]],
    ],
    echelle: [0.5, 100],
    graduations: [1, 2, 5, 10, 20, 40, 80],
    log: true,
    sec: 0.5,
    valeur: (p) => p.pluie,
    niveaux: (_min, max) => [1, 5, 10, 20, 40, 80].filter((v) => v < max),
    bande: (a, b) => (a == null ? null : b == null ? `plus de ${a} mm` : `${a} à ${b} mm`),
  },
  rafales: {
    id: 'rafales',
    libelle: '💨 Rafales',
    titre: 'RAFALES DE VENT',
    legende: 'Rafales maximales (km/h)',
    paliers: PALETTES.raf.paliers,
    echelle: [0, 140],
    graduations: [0, 20, 40, 60, 80, 100, 120, 140],
    valeur: (p) => p.rafale,
    niveaux: (_min, max) => [30, 50, 70, 90, 110, 130].filter((v) => v < max),
    bande: (a, b) => (a == null ? null : b == null ? `plus de ${a} km/h` : `${a} à ${b} km/h`),
  },
};

const SEC: RGB = [236, 236, 228];

export function couleurChamp(theme: DefTheme, v: number): RGB {
  if (theme.sec != null && v < theme.sec) return SEC;
  const p = theme.paliers;
  if (v <= p[0][0]) return p[0][1];
  for (let k = 1; k < p.length; k++) {
    if (v <= p[k][0]) {
      const [v0, c0] = p[k - 1];
      const [v1, c1] = p[k];
      const f = (v - v0) / (v1 - v0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as RGB;
    }
  }
  return p[p.length - 1][1];
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const NOMS_JOURS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
const NOMS_MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const jourSemaine = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const quantieme = (iso: string) => (Number(iso.slice(8, 10)) === 1 ? '1ER' : String(Number(iso.slice(8, 10))));
const mois = (iso: string) => NOMS_MOIS[Number(iso.slice(5, 7)) - 1];
/** « SAM 28 » */
export const jourCourt = (iso: string) => `${NOMS_JOURS[jourSemaine(iso)].slice(0, 3)} ${Number(iso.slice(8, 10))}`;
/** « SAMEDI 28 NOVEMBRE » */
export const jourLong = (iso: string) => `${NOMS_JOURS[jourSemaine(iso)]} ${quantieme(iso)} ${mois(iso)}`;
/** « DU 28 AU 29 NOVEMBRE » ou « DU 30 NOVEMBRE AU 1ER DÉCEMBRE » */
export const plageCourte = (a: string, b: string) => (mois(a) === mois(b) ? `DU ${quantieme(a)} AU ${quantieme(b)} ${mois(b)}` : `DU ${quantieme(a)} ${mois(a)} AU ${quantieme(b)} ${mois(b)}`);
/** Titre automatique de la planche (deux lignes). */
export const titreAuto = (theme: ThemeChamp, jours: string[], zone?: string): [string, string] => [
  zone ? `${THEMES_CHAMPS[theme].titre} : ${zone}` : THEMES_CHAMPS[theme].titre,
  jours.length === 2 && mois(jours[0]) === mois(jours[1])
    ? `${NOMS_JOURS[jourSemaine(jours[0])]} ${quantieme(jours[0])} ET ${NOMS_JOURS[jourSemaine(jours[1])]} ${quantieme(jours[1])} ${mois(jours[1])}`
    : jours.length === 2
      ? `${jourLong(jours[0])} ET ${jourLong(jours[1])}`
      : `DU ${jourLong(jours[0])} AU ${jourLong(jours[jours.length - 1])}`,
];

// ── Champ, isolignes, étiquettes ────────────────────────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Grille {
  x0: number;
  y0: number;
  pas: number;
  nx: number;
  ny: number;
  /** Valeurs aux nœuds (nx × ny), ligne par ligne. */
  v: Float32Array;
  /** Nœud sur les terres (France). */
  terre: Uint8Array;
}

/** Rayon du lissage (km), France entière : un peu moins que l'écart entre deux chefs-lieux voisins. */
export const SIGMA_FRANCE_KM = 48;

/** Valeurs aux nœuds d'une grille couvrant `r` : moyenne des points pondérée par une gaussienne de la distance. */
function calculerGrille(points: PointChampJour[], theme: DefTheme, vue: Vue, r: Rect, pas: number, terres: Path2D, sigmaKm: number): Grille | null {
  const pts = points.flatMap((p) => {
    const v = theme.valeur(p);
    if (v == null || !Number.isFinite(v)) return [];
    const e = versEcran(versMonde(p.lat, p.lon), vue);
    return [{ x: e.x, y: e.y, v }];
  });
  if (pts.length < 6) return null;
  const pxKm = Math.abs(versEcran(versMonde(46, 2), vue).y - versEcran(versMonde(46 + 1 / 111.2, 2), vue).y);
  const s2 = 2 * (sigmaKm * pxKm) ** 2;
  const nx = Math.ceil(r.w / pas) + 1;
  const ny = Math.ceil(r.h / pas) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = r.y + j * pas;
    for (let i = 0; i < nx; i++) {
      const x = r.x + i * pas;
      let somme = 0;
      let poids = 0;
      let proche = Infinity;
      let vProche = 0;
      for (const p of pts) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        const w = Math.exp(-d2 / s2);
        somme += w * p.v;
        poids += w;
        if (d2 < proche) {
          proche = d2;
          vProche = p.v;
        }
      }
      v[j * nx + i] = poids > 1e-9 ? somme / poids : vProche;
    }
  }
  // Masque des terres : la France dessinée à la résolution de la grille (un pixel par nœud).
  const m = document.createElement('canvas');
  m.width = nx;
  m.height = ny;
  const mc = m.getContext('2d', { willReadFrequently: true })!;
  mc.setTransform(1 / pas, 0, 0, 1 / pas, -r.x / pas + 0.5, -r.y / pas + 0.5);
  mc.translate(vue.tx, vue.ty);
  mc.scale(vue.echelle, vue.echelle);
  mc.fillStyle = '#000';
  mc.fill(terres);
  const a = mc.getImageData(0, 0, nx, ny).data;
  const terre = new Uint8Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) terre[k] = a[k * 4 + 3] > 100 ? 1 : 0;
  return { x0: r.x, y0: r.y, pas, nx, ny, v, terre };
}

type Pt = [number, number];

/** Isolignes d'un niveau (carrés marchants), en polylignes lissées. */
function isolignes(g: Grille, niveau: number): Pt[][] {
  const { nx, ny, v, pas, x0, y0 } = g;
  const val = (i: number, j: number) => v[j * nx + i];
  const point = new Map<string, Pt>();
  const voisins = new Map<string, string[]>();
  const arete = (id: string, ax: number, ay: number, bx: number, by: number, va: number, vb: number) => {
    if (!point.has(id)) {
      const f = vb === va ? 0.5 : (niveau - va) / (vb - va);
      point.set(id, [x0 + (ax + (bx - ax) * f) * pas, y0 + (ay + (by - ay) * f) * pas]);
    }
    return id;
  };
  const lier = (a: string, b: string) => {
    (voisins.get(a) ?? voisins.set(a, []).get(a)!).push(b);
    (voisins.get(b) ?? voisins.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = val(i, j);
      const tr = val(i + 1, j);
      const br = val(i + 1, j + 1);
      const bl = val(i, j + 1);
      const cas = (tl >= niveau ? 8 : 0) | (tr >= niveau ? 4 : 0) | (br >= niveau ? 2 : 0) | (bl >= niveau ? 1 : 0);
      if (cas === 0 || cas === 15) continue;
      const haut = () => arete(`h${i},${j}`, i, j, i + 1, j, tl, tr);
      const droite = () => arete(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1, tr, br);
      const bas = () => arete(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1, bl, br);
      const gauche = () => arete(`v${i},${j}`, i, j, i, j + 1, tl, bl);
      const centre = (tl + tr + br + bl) / 4 >= niveau;
      switch (cas) {
        case 1: case 14: lier(gauche(), bas()); break;
        case 2: case 13: lier(bas(), droite()); break;
        case 3: case 12: lier(gauche(), droite()); break;
        case 4: case 11: lier(haut(), droite()); break;
        case 6: case 9: lier(haut(), bas()); break;
        case 7: case 8: lier(gauche(), haut()); break;
        case 5:
          if (centre) { lier(gauche(), haut()); lier(bas(), droite()); } else { lier(haut(), droite()); lier(gauche(), bas()); }
          break;
        case 10:
          if (centre) { lier(haut(), droite()); lier(gauche(), bas()); } else { lier(gauche(), haut()); lier(bas(), droite()); }
          break;
      }
    }
  }
  // Chaînage : on part des extrémités (bords de la grille) puis des boucles.
  const vus = new Set<string>();
  const lignes: Pt[][] = [];
  const suivre = (depart: string) => {
    const ids = [depart];
    vus.add(depart);
    let cour = depart;
    for (;;) {
      const suivant = (voisins.get(cour) ?? []).find((n) => !vus.has(n));
      if (!suivant) break;
      vus.add(suivant);
      ids.push(suivant);
      cour = suivant;
    }
    const pts = ids.map((id) => point.get(id)!);
    if ((voisins.get(depart) ?? []).includes(cour) && ids.length > 2) pts.push(pts[0]);
    if (pts.length > 2) lignes.push(lisser(pts, 2));
  };
  for (const [id, n] of voisins) if (n.length === 1 && !vus.has(id)) suivre(id);
  for (const id of voisins.keys()) if (!vus.has(id)) suivre(id);
  return lignes;
}

/** Lissage de Chaikin (les extrémités restent en place). */
function lisser(pts: Pt[], passes: number): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const o: Pt[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[i + 1];
      o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    o.push(p[p.length - 1]);
    p = o;
  }
  return p;
}

/** Une étiquette par zone d'une même bande, au point le plus éloigné de ses bords, sans chevauchement. */
function placerEtiquettes(ctx: CanvasRenderingContext2D, g: Grille, niveaux: number[], theme: DefTheme, r: Rect, taille: number, interdits: Rect[]) {
  const { nx, ny, v, terre, pas } = g;
  const bandeDe = (x: number) => {
    let b = 0;
    while (b < niveaux.length && x >= niveaux[b]) b++;
    return b;
  };
  const bande = new Int16Array(nx * ny).fill(-1);
  for (let k = 0; k < nx * ny; k++) if (terre[k]) bande[k] = bandeDe(v[k]);
  const zone = new Int32Array(nx * ny).fill(-1);
  const minimum = Math.max(30, (70 * 70) / (pas * pas));
  const candidats: { texte: string; noeuds: number[]; prof: Int16Array; taille: number }[] = [];
  let n = 0;
  for (let k0 = 0; k0 < nx * ny; k0++) {
    if (bande[k0] < 0 || zone[k0] >= 0) continue;
    const b = bande[k0];
    const noeuds: number[] = [];
    const pile = [k0];
    zone[k0] = n;
    while (pile.length) {
      const k = pile.pop()!;
      noeuds.push(k);
      const i = k % nx;
      const j = (k - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const kk = jj * nx + ii;
        if (zone[kk] < 0 && bande[kk] === b) {
          zone[kk] = n;
          pile.push(kk);
        }
      }
    }
    const texte = theme.bande(b === 0 ? null : niveaux[b - 1], b === niveaux.length ? null : niveaux[b]);
    if (texte && noeuds.length >= minimum) {
      // Profondeur : distance (en nœuds) au bord de la zone, par propagation depuis les nœuds du bord.
      const prof = new Int16Array(nx * ny).fill(-1);
      let front: number[] = [];
      for (const k of noeuds) {
        const i = k % nx;
        const j = (k - i) / nx;
        const bord = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
          const ii = i + di;
          const jj = j + dj;
          return ii < 0 || jj < 0 || ii >= nx || jj >= ny || zone[jj * nx + ii] !== n;
        });
        if (bord) {
          prof[k] = 0;
          front.push(k);
        }
      }
      while (front.length) {
        const suivant: number[] = [];
        for (const k of front) {
          const i = k % nx;
          const j = (k - i) / nx;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
            const kk = jj * nx + ii;
            if (zone[kk] === n && prof[kk] < 0) {
              prof[kk] = prof[k] + 1;
              suivant.push(kk);
            }
          }
        }
        front = suivant;
      }
      candidats.push({ texte, noeuds, prof, taille: noeuds.length });
    }
    n++;
  }
  // Les plus grandes zones d'abord : leurs étiquettes passent avant celles des petites.
  candidats.sort((a, b) => b.taille - a.taille);
  const police = Math.round(17 * taille);
  ctx.font = `bold ${police}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pris = [...interdits];
  for (const c of candidats.slice(0, 14)) {
    const lw = ctx.measureText(c.texte).width + 16 * taille;
    const lh = police + 10 * taille;
    const ordre = [...c.noeuds].sort((a, b) => c.prof[b] - c.prof[a]).slice(0, 60);
    for (const k of ordre) {
      if (c.prof[k] < 2) break;
      const i = k % nx;
      const j = (k - i) / nx;
      const x = g.x0 + i * pas;
      const y = g.y0 + j * pas;
      const boite = { x: x - lw / 2, y: y - lh / 2, w: lw, h: lh };
      if (boite.x < r.x + 2 || boite.y < r.y + 2 || boite.x + lw > r.x + r.w - 2 || boite.y + lh > r.y + r.h - 2) continue;
      if (pris.some((p) => p.x < boite.x + boite.w + 4 && boite.x < p.x + p.w + 4 && p.y < boite.y + boite.h + 3 && boite.y < p.y + p.h + 3)) continue;
      pris.push(boite);
      ctx.fillStyle = 'rgba(28,24,30,0.86)';
      ctx.beginPath();
      ctx.roundRect(boite.x, boite.y, lw, lh, 6 * taille);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.texte, x, y + 1);
      break;
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Planche ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface GeoChamps {
  /** Limites intérieures (départements ; pixels monde). */
  departements: Path2D[];
  /** Zone coloriée (France, ou un département). */
  terres: Path2D;
  /** Cadre de la zone (pixels monde). */
  boite: Boite;
  /** Terres autour de la zone (pays et départements voisins), en gris foncé. */
  voisins?: Path2D[];
  /** Rayon du lissage (km). */
  sigmaKm: number;
  /** Villes repères (point et nom). */
  villes?: { nom: string; lat: number; lon: number }[];
}

export interface ParamsPlancheChamps {
  ctx: CanvasRenderingContext2D;
  largeur: number;
  hauteur: number;
  theme: ThemeChamp;
  jours: { iso: string; points: PointChampJour[] | null }[];
  titre: [string, string];
  geo: GeoChamps;
  /** Ligne du bas (source). */
  source: string;
}

const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const VIOLET = '#3b2a8a';

/** Texte centré, réduit pour tenir dans `largeurMax`. */
export function texteAjuste(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, taille: number, largeurMax: number, police = POLICE, graisse = '') {
  let t = Math.round(taille);
  ctx.font = `${graisse} ${t}px ${police}`;
  while (ctx.measureText(texte).width > largeurMax && t > 12) {
    t -= 1;
    ctx.font = `${graisse} ${t}px ${police}`;
  }
  ctx.fillText(texte, x, y);
}

export function fondCiel(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2c69c9');
  g.addColorStop(0.5, '#5b9fe8');
  g.addColorStop(1, '#2a63c2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Quelques nuages flous.
  for (const [fx, fy, r] of [[0.15, 0.3, 0.22], [0.85, 0.42, 0.26], [0.3, 0.72, 0.24], [0.8, 0.88, 0.2]]) {
    const x = fx * W;
    const y = fy * H;
    const R = r * W;
    const n = ctx.createRadialGradient(x, y, 0, x, y, R);
    n.addColorStop(0, 'rgba(255,255,255,0.32)');
    n.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = n;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.6, 0.6);
    ctx.translate(-x, -y);
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    ctx.restore();
  }
}

/** Hauteur du bandeau rouge pour une image de hauteur H. */
export const hauteurBandeau = (H: number) => Math.round(Math.min(200, Math.max(130, H * 0.1)));

/** Bandeau rouge du titre (deux lignes). */
export function bandeau(ctx: CanvasRenderingContext2D, W: number, hb: number, titre: [string, string]) {
  const gb = ctx.createLinearGradient(0, 0, 0, hb);
  gb.addColorStop(0, '#f2423a');
  gb.addColorStop(1, '#c9151c');
  ctx.fillStyle = gb;
  ctx.fillRect(0, 0, W, hb);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, hb, W, 6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(80,0,0,0.6)';
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  texteAjuste(ctx, titre[0], W / 2, hb * 0.44, hb * 0.34, W - 50);
  texteAjuste(ctx, titre[1], W / 2, hb * 0.86, hb * 0.3, W - 50);
  ctx.restore();
}

/** Pied de page : site et source. */
export const HAUTEUR_PIED = 50;
export function pied(ctx: CanvasRenderingContext2D, W: number, H: number, source: string) {
  const hp = HAUTEUR_PIED;
  ctx.fillStyle = 'rgba(8,24,60,0.55)';
  ctx.fillRect(0, H - hp, W, hp);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('www.alertes-meteo.com', 20, H - hp / 2 + 9);
  ctx.textAlign = 'right';
  ctx.font = '19px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(source, W - 20, H - hp / 2 + 7);
  ctx.textAlign = 'left';
}

export const HAUTEUR_ECHELLE = 108;

export function echelleCouleurs(ctx: CanvasRenderingContext2D, idTheme: ThemeChamp, r: Rect) {
  const theme = THEMES_CHAMPS[idTheme];
  ctx.fillStyle = 'rgba(12,14,30,0.88)';
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  texteAjuste(ctx, theme.legende, r.x + r.w / 2, r.y + 32, 26, r.w - 40, 'Arial, sans-serif', 'bold');
  const x0 = r.x + 36;
  const x1 = r.x + r.w - 36;
  const yb = r.y + 46;
  const hb = 22;
  const [min, max] = theme.echelle;
  const pos = (v: number) => (theme.log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  for (let x = x0; x <= x1; x++) {
    const f = (x - x0) / (x1 - x0);
    const v = theme.log ? min * (max / min) ** f : min + f * (max - min);
    const [cr, cg, cb] = couleurChamp(theme, v);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.fillRect(x, yb, 1.5, hb);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x0, yb, x1 - x0, hb, hb / 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px Arial, sans-serif';
  for (const gr of theme.graduations) ctx.fillText(String(gr), x0 + pos(gr) * (x1 - x0), yb + hb + 24);
  ctx.textAlign = 'left';
}

/** Nom court d'une ville repère. */
const nomCourt = (nom: string) => nom.replace('Font-Romeu-Odeillo-Via', 'Font-Romeu').replace(/^Saint-/, 'St-').replace(/-sur-Mer$/, '');

/**
 * Une carte : terres voisines, champ coloré sur la zone, isolignes, limites, villes repères, étiquettes de fourchette, puis le jour.
 * `jour` : étiquette violette dans un coin (null : aucune).
 */
export function carteChamp(ctx: CanvasRenderingContext2D, idTheme: ThemeChamp, niveaux: number[], points: PointChampJour[] | null, iso: string, r: Rect, geo: GeoChamps, coinJour: 'gauche' | 'droite' | null) {
  const theme = THEMES_CHAMPS[idTheme];
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const vue = ajusterVue(geo.boite, { gauche: r.x, haut: r.y, droite: r.x + r.w, bas: r.y + r.h }, geo.voisins ? 0.02 : 0.015);
  const taille = Math.min(1.35, Math.max(0.75, Math.min(r.w, r.h * 1.1) / 520));
  const pas = 5;
  const g = points ? calculerGrille(points, theme, vue, r, pas, geo.terres, geo.sigmaKm) : null;
  const versVue = () => {
    ctx.translate(vue.tx, vue.ty);
    ctx.scale(vue.echelle, vue.echelle);
  };
  if (geo.voisins) {
    ctx.save();
    versVue();
    ctx.fillStyle = '#2b2d38';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1 / vue.echelle;
    for (const v of geo.voisins) {
      ctx.fill(v);
      ctx.stroke(v);
    }
    ctx.restore();
  }
  // Étiquette du jour (violette, dans un coin) : réservée avant les étiquettes de fourchette.
  ctx.font = `${Math.round(30 * taille)}px ${POLICE}`;
  const texteJour = jourCourt(iso);
  const lj = ctx.measureText(texteJour).width + 28 * taille;
  const hj = 48 * taille;
  const boiteJour = coinJour ? { x: coinJour === 'gauche' ? r.x : r.x + r.w - lj, y: r.y, w: lj, h: hj } : null;
  if (g) {
    const img = document.createElement('canvas');
    img.width = g.nx;
    img.height = g.ny;
    const ic = img.getContext('2d')!;
    const data = ic.createImageData(g.nx, g.ny);
    for (let k = 0; k < g.nx * g.ny; k++) {
      const [cr, cg, cb] = couleurChamp(theme, g.v[k]);
      data.data[k * 4] = cr;
      data.data[k * 4 + 1] = cg;
      data.data[k * 4 + 2] = cb;
      data.data[k * 4 + 3] = 255;
    }
    ic.putImageData(data, 0, 0);
    // Champ découpé sur la zone.
    ctx.save();
    versVue();
    ctx.clip(geo.terres);
    ctx.scale(1 / vue.echelle, 1 / vue.echelle);
    ctx.translate(-vue.tx, -vue.ty);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, r.x - pas / 2, r.y - pas / 2, g.nx * pas, g.ny * pas);
    // Isolignes : liseré sombre discret puis trait blanc.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const niveau of niveaux) {
      for (const ligne of isolignes(g, niveau)) {
        ctx.beginPath();
        ligne.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = 5 * taille;
        ctx.strokeStyle = 'rgba(60,20,20,0.25)';
        ctx.stroke();
        ctx.lineWidth = 2.8 * taille;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Limites intérieures et contour de la zone.
  ctx.save();
  versVue();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,10,10,0.32)';
  ctx.lineWidth = 0.6 / vue.echelle;
  for (const d of geo.departements) ctx.stroke(d);
  ctx.strokeStyle = 'rgba(10,5,5,0.9)';
  ctx.lineWidth = 1.6 / vue.echelle;
  ctx.stroke(geo.terres);
  ctx.restore();
  // Villes repères : point blanc et nom, réservés avant les étiquettes.
  const interdits: Rect[] = boiteJour ? [boiteJour] : [];
  const reperes: { x: number; y: number; nom: string; gauche: boolean }[] = [];
  ctx.font = `bold ${Math.round(18 * taille)}px Arial, sans-serif`;
  for (const v of geo.villes ?? []) {
    const e = versEcran(versMonde(v.lat, v.lon), vue);
    const nom = nomCourt(v.nom);
    const l = ctx.measureText(nom).width;
    const gauche = e.x + l + 14 * taille > r.x + r.w - 6;
    reperes.push({ x: e.x, y: e.y, nom, gauche });
    interdits.push({ x: gauche ? e.x - l - 14 * taille : e.x - 6 * taille, y: e.y - 12 * taille, w: l + 20 * taille, h: 24 * taille });
  }
  if (g) placerEtiquettes(ctx, g, niveaux, theme, r, taille, interdits);
  else {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('Prévision indisponible', r.x + r.w / 2, r.y + r.h / 2);
    ctx.textAlign = 'left';
  }
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const p of reperes) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * taille, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.font = `bold ${Math.round(18 * taille)}px Arial, sans-serif`;
    ctx.textAlign = p.gauche ? 'right' : 'left';
    const tx = p.gauche ? p.x - 9 * taille : p.x + 9 * taille;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(p.nom, tx, p.y);
    ctx.fillText(p.nom, tx, p.y);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Jour.
  if (boiteJour) {
    ctx.fillStyle = VIOLET;
    ctx.beginPath();
    ctx.roundRect(boiteJour.x, boiteJour.y, lj, hj, coinJour === 'gauche' ? [0, 0, 10 * taille, 0] : [0, 0, 0, 10 * taille]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(30 * taille)}px ${POLICE}`;
    ctx.fillText(texteJour, boiteJour.x + lj / 2, boiteJour.y + hj / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** Niveaux des isolignes de toute la planche (valeurs extrêmes de tous les jours) : les mêmes lignes sur toutes les cartes. */
export function niveauxPlanche(idTheme: ThemeChamp, jours: ParamsPlancheChamps['jours']): number[] {
  const theme = THEMES_CHAMPS[idTheme];
  let min = Infinity;
  let max = -Infinity;
  for (const j of jours) {
    for (const p of j.points ?? []) {
      const v = theme.valeur(p);
      if (v == null || !Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  return Number.isFinite(min) ? theme.niveaux(min, max) : [];
}

/** Rapport largeur / hauteur de la zone à l'écran. */
export const rapportZone = (b: Boite) => (b.maxX - b.minX) / Math.max(1, b.maxY - b.minY);

/** Titre violet d'un cadre. */
export function titreCadre(ctx: CanvasRenderingContext2D, texte: string, r: Rect) {
  ctx.fillStyle = VIOLET;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, [12, 12, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  texteAjuste(ctx, texte, r.x + r.w / 2, r.y + r.h * 0.72, r.h * 0.6, r.w - 30);
  ctx.textAlign = 'left';
}

export function dessinerPlancheChamps({ ctx, largeur: W, hauteur: H, theme: idTheme, jours, titre, geo, source }: ParamsPlancheChamps) {
  const theme = THEMES_CHAMPS[idTheme];
  const niveaux = niveauxPlanche(idTheme, jours);
  ctx.save();
  fondCiel(ctx, W, H);
  const hb = hauteurBandeau(H);
  bandeau(ctx, W, hb, titre);

  // Mise en page : une ou deux cartes par cadre, selon ce qui donne les plus grandes cartes (France : par deux ; département allongé : une par cadre).
  const pad = 20;
  const hl = HAUTEUR_ECHELLE;
  const hp = HAUTEUR_PIED;
  const ht = 56;
  const gapMin = 14;
  const a = rapportZone(geo.boite) * (geo.voisins ? 1.05 : 1);
  const essai = (parCadre: number) => {
    const n = Math.ceil(jours.length / parCadre);
    const dispo = H - hb - 6 - hl - hp - (n + 2) * gapMin - n * ht;
    const lc = (W - 2 * pad) / parCadre;
    const hc = dispo / n;
    return { parCadre, n, lc, hc, echelle: Math.min(lc / a, hc), dispo };
  };
  const choix = [essai(2), essai(1)].reduce((m, e) => (e.echelle > m.echelle * 1.05 ? e : m));
  const { parCadre, n, lc: largeurCarte, dispo } = choix;
  // Hauteur des cartes : la zone entière à la largeur disponible (un peu plus pour la France, qui est presque carrée), sans dépasser la place.
  const hCarte = Math.min(Math.max(largeurCarte / a, largeurCarte * 0.5) * (geo.voisins ? 1.06 : 0.98), dispo / n);
  const reste = dispo - n * hCarte;
  const gap = gapMin + reste / (n + 2);
  const cadres: (typeof jours)[] = [];
  for (let k = 0; k < jours.length; k += parCadre) cadres.push(jours.slice(k, k + parCadre));
  let y = hb + 6 + gap;
  echelleCouleurs(ctx, idTheme, { x: pad, y, w: W - 2 * pad, h: hl });
  y += hl + gap;
  for (const cadre of cadres) {
    const libelle = cadre.length === 1 ? `${theme.titre} · ${jourLong(cadre[0].iso)}` : `${theme.titre} ${plageCourte(cadre[0].iso, cadre[cadre.length - 1].iso)}`;
    titreCadre(ctx, libelle, { x: pad, y, w: W - 2 * pad, h: ht });
    y += ht;
    ctx.fillStyle = '#0c0c12';
    ctx.beginPath();
    ctx.roundRect(pad, y, W - 2 * pad, hCarte, [0, 0, 12, 12]);
    ctx.fill();
    cadre.forEach((j, k) => carteChamp(ctx, idTheme, niveaux, j.points, j.iso, { x: pad + k * largeurCarte, y, w: largeurCarte, h: hCarte }, geo, k === 0 ? 'gauche' : 'droite'));
    y += hCarte + gap;
  }
  pied(ctx, W, H, source);
  ctx.restore();
}
