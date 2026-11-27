/**
 * Jeu « Radar météo » : écran de radar dont le faisceau balaie des échos de pluie (vert, jaune, rouge) qui s'allument à son passage
 * (haut), satellite météo doré aux panneaux solaires, qui émet vers la Terre (bas), et un décor d'écran de contrôle : grille,
 * cercles de radar qui balaient depuis les coins, ligne de balayage (ambiance).
 */
import { alea, boucle, cercle, etincelle, lineaire, lisse, lueur, radial, rect, reduite, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

const TAU = Math.PI * 2;
/** Vitesse du faisceau du radar (rad/s) : un tour en 2,4 s. */
const VITESSE_RADAR = TAU / 2.4;
/** Angle du faisceau à l'instant t (0 = vers la droite, sens horaire à l'écran). */
const angleFaisceau = (t: number) => t * VITESSE_RADAR - Math.PI / 2 + 0.9;
/** Temps écoulé (en tours) depuis le passage du faisceau sur l'angle `a` : 0 juste après, presque 1 juste avant. */
const depuisPassage = (t: number, a: number) => ((((angleFaisceau(t) - a) / TAU) % 1) + 1) % 1;

/** Tache lisse et bosselée (écho de pluie), qui ondule lentement. */
function tache(ctx: Ctx, x: number, y: number, r: number, graine: number, t: number) {
  const n = 12;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.72 + 0.4 * alea(graine + i * 1.7) + 0.06 * Math.sin(t * 1.3 + i + graine));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85]);
  }
  ctx.beginPath();
  const mid = (i: number): [number, number] => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const [x0, y0] = mid(n - 1);
  ctx.moveTo(x0, y0);
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.closePath();
}

/** Échos de pluie : position, taille, intensité (nombre de couches : 2 = vert et jaune, 4 = jusqu'au rouge). */
const ECHOS: readonly (readonly [number, number, number, number])[] = [
  [14, -14, 13, 4],
  [-19, 9, 11, 3],
  [8, 22, 7, 2],
  [-14, -22, 6, 2],
];
const COUCHES: readonly (readonly [number, string])[] = [
  [1, '#1fd25a'],
  [0.66, '#f5e23a'],
  [0.42, '#ff8a1a'],
  [0.24, '#ff2d2d'],
];

/** Écran du radar (sans la lunette) : fond vert, grille, échos, faisceau. */
function ecran(ctx: Ctx, t: number, R: number) {
  cercle(ctx, 0, 0, R);
  ctx.fillStyle = radial(ctx, 0, 0, R, [[0, '#0f5a32'], [0.6, '#073a1f'], [1, '#021409']]);
  ctx.fill();
  ctx.save();
  cercle(ctx, 0, 0, R);
  ctx.clip();
  // Grille : cercles et axes.
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(90,255,150,0.32)';
  for (let k = 1; k <= 4; k++) {
    cercle(ctx, 0, 0, (R * k) / 4);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(-Math.cos(a) * R, -Math.sin(a) * R);
  }
  ctx.strokeStyle = 'rgba(90,255,150,0.18)';
  ctx.stroke();
  // Échos : ils s'allument au passage du faisceau puis pâlissent.
  const derive = Math.sin(t * 0.5) * 1.5;
  ECHOS.forEach(([x, y, r, n], i) => {
    const ex = x + derive;
    const ey = y - derive * 0.5;
    const vif = Math.exp(-depuisPassage(t, Math.atan2(ey, ex)) * 2.4);
    ctx.globalAlpha = 0.55 + 0.45 * vif;
    for (let c = 0; c < n; c++) {
      const [k, couleur] = COUCHES[c];
      tache(ctx, ex + c * 0.8, ey - c * 0.5, r * k, i * 13 + c * 5, t);
      ctx.fillStyle = couleur;
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  // Faisceau : traînée qui s'estompe derrière lui (tranches de plus en plus pâles), puis la ligne vive.
  const A = angleFaisceau(t);
  const tranches = 24;
  const ouverture = 1.5;
  for (let k = 0; k < tranches; k++) {
    const a1 = A - (k * ouverture) / tranches;
    const a0 = A - ((k + 1) * ouverture) / tranches;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a1 + 0.005);
    ctx.closePath();
    ctx.fillStyle = `rgba(110,255,160,${(0.5 * (1 - k / tranches) ** 2).toFixed(3)})`;
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(A) * R, Math.sin(A) * R);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(140,255,190,0.35)';
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#d8ffe6';
  ctx.stroke();
  cercle(ctx, 0, 0, 2.4);
  ctx.fillStyle = '#d8ffe6';
  ctx.fill();
  // Bord de l'écran plus sombre, vitre bombée.
  ctx.fillStyle = radial(ctx, 0, 0, R, [[0, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,10,4,0.55)']]);
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.beginPath();
  ctx.rect(-R, -R, 2 * R, 2 * R);
  ctx.moveTo(R * 0.25 + R * 1.05, R * 0.3);
  ctx.arc(R * 0.25, R * 0.3, R * 1.05, 0, TAU);
  ctx.fillStyle = lineaire(ctx, -R, -R, 0, 0, [[0, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0.04)']]);
  ctx.fill('evenodd');
  ctx.restore();
}

function radar(ctx: Ctx, t: number) {
  // Lunette métallique.
  cercle(ctx, 0, 0, 50);
  ctx.fillStyle = lineaire(ctx, -50, -50, 50, 50, [[0, '#f2f5f9'], [0.3, '#a3adbb'], [0.65, '#5b6676'], [1, '#2b3340']]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#10151d';
  ctx.stroke();
  cercle(ctx, 0, 0, 45);
  ctx.fillStyle = '#141b24';
  ctx.fill();
  // Graduations blanches sur la lunette.
  ctx.lineCap = 'round';
  for (let k = 0; k < 24; k++) {
    const a = (k * TAU) / 24;
    const long = k % 6 === 0 ? 3.4 : 1.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (47.6 - long), Math.sin(a) * (47.6 - long));
    ctx.lineTo(Math.cos(a) * 47.6, Math.sin(a) * 47.6);
    ctx.lineWidth = k % 6 === 0 ? 1.6 : 0.9;
    ctx.strokeStyle = k % 6 === 0 ? '#ffffff' : 'rgba(255,255,255,0.75)';
    ctx.stroke();
  }
  ecran(ctx, t, 42);
  cercle(ctx, 0, 0, 42);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(160,255,200,0.6)';
  ctx.stroke();
  reflet(ctx, -28, -34, 12, 3.6, -0.8, 0.8);
}

// Réduit : la lunette fait 100 unités de diamètre, liseré en plus.
const haut: Icone = reduite({
  arriere: (ctx, t) => {
    lueur(ctx, 0, 0, 66, '#3dff8a', 0.32);
    // Impulsions du radar : cercles qui s'éloignent.
    for (const dec of [0, 0.5]) {
      const p = boucle(t, 1.6, dec);
      cercle(ctx, 0, 0, 50 + 16 * p);
      ctx.lineWidth = 2.2 * (1 - p) + 0.4;
      ctx.strokeStyle = `rgba(140,255,190,${(0.7 * (1 - p)).toFixed(3)})`;
      ctx.stroke();
    }
  },
  corps: radar,
  effets: (ctx, t) => {
    // « Bip » : un petit anneau s'ouvre sur chaque écho quand le faisceau le touche.
    const derive = Math.sin(t * 0.5) * 1.5;
    for (const [x, y, r] of ECHOS) {
      const ex = x + derive;
      const ey = y - derive * 0.5;
      const d = depuisPassage(t, Math.atan2(ey, ex));
      if (d > 0.3) continue;
      const p = d / 0.3;
      cercle(ctx, ex, ey, r * (0.4 + 0.9 * p));
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(220,255,230,${(1 - p).toFixed(3)})`;
      ctx.stroke();
    }
    etincelle(ctx, -30, -30, 7, t, '#ffffff', Math.max(0, Math.sin(t * 2.6 + 1)) ** 4);
  },
}, 0.89);

// ── Icône du bas : satellite météo ──────────────────────────────────────────────────────────────────────────────────────

/** Panneau solaire de x0 à x1 : cadre sombre, cellules bleues, éclat qui le traverse. */
function panneauSolaire(ctx: Ctx, x0: number, x1: number, t: number) {
  const y0 = -15;
  const h = 30;
  rect(ctx, x0, y0, x1 - x0, h, 2.5);
  ctx.fillStyle = '#0d1c3f';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#050b1c';
  ctx.stroke();
  const cols = 4;
  const lignes = 3;
  const m = 2.4;
  const g = 1.2;
  const cw = (x1 - x0 - 2 * m - (cols - 1) * g) / cols;
  const ch = (h - 2 * m - (lignes - 1) * g) / lignes;
  const fond = lineaire(ctx, x0, y0, x1, y0 + h, [[0, '#4a92f0'], [0.5, '#1a55c0'], [1, '#0d2f7a']]);
  for (let c = 0; c < cols; c++) {
    for (let l = 0; l < lignes; l++) {
      const cx = x0 + m + c * (cw + g);
      const cy = y0 + m + l * (ch + g);
      ctx.fillStyle = fond;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = 'rgba(160,205,255,0.35)';
      ctx.fillRect(cx, cy, cw, 0.8);
    }
  }
  // Éclat de lumière en diagonale.
  const s = boucle(t, 2.8, x0 < 0 ? 0 : 0.12);
  if (s < 0.5) {
    const pos = x0 - 10 + lisse(s / 0.5) * (x1 - x0 + 20);
    ctx.save();
    rect(ctx, x0, y0, x1 - x0, h, 2.5);
    ctx.clip();
    ctx.translate(pos, 0);
    ctx.rotate(0.5);
    ctx.fillStyle = lineaire(ctx, -6, 0, 6, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(230,245,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(-6, -40, 12, 80);
    ctx.restore();
  }
}

/** Position de l'antenne parabolique et direction de son axe (vers le haut à droite), dans le repère du satellite. */
const ANTENNE = { x: -4, y: -35, axe: -Math.PI / 2 + 0.5 };

/**
 * Centre du satellite : bien en dessous du milieu de l'icône, pour que l'antenne et ses ondes (en haut) restent sous le texte
 * de l'accroche.
 */
const Y_SAT = 18;

/** Inclinaison et flottement du satellite. */
const pose = (t: number) => ({ rot: Math.sin(t * 1.1) * 0.08, dy: Y_SAT + Math.sin(t * 1.6) * 1.5 });

function satellite(ctx: Ctx, t: number) {
  const { rot, dy } = pose(t);
  ctx.save();
  ctx.translate(0, dy);
  ctx.rotate(rot);
  // Bras et articulations.
  for (const [a, b] of [[-26, -16], [16, 26]] as const) {
    rect(ctx, a, -2.2, b - a, 4.4, 1.5);
    ctx.fillStyle = lineaire(ctx, 0, -2.2, 0, 2.2, [[0, '#e6ebf2'], [1, '#7d8898']]);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2a3240';
    ctx.stroke();
  }
  panneauSolaire(ctx, -58, -25, t);
  panneauSolaire(ctx, 25, 58, t);
  // Mât et antenne parabolique.
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(ANTENNE.x, ANTENNE.y + 4);
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = '#2a3240';
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#c9d2de';
  ctx.stroke();
  ctx.save();
  ctx.translate(ANTENNE.x, ANTENNE.y);
  ctx.rotate(ANTENNE.axe + Math.PI / 2);
  // Coque (dos de la parabole), puis l'intérieur vu par le bord.
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, -16, 0, 16, 0, [[0, '#9aa8bb'], [0.4, '#f4f7fb'], [1, '#8794a8']]);
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#2a3444';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 5.5, 0, 0, TAU);
  ctx.fillStyle = lineaire(ctx, 0, -5.5, 0, 5.5, [[0, '#ffffff'], [1, '#b8c4d4']]);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -12);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#2a3444';
  ctx.stroke();
  cercle(ctx, 0, -12.5, 2.2);
  ctx.fillStyle = '#ff3b30';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // Corps en feuille d'or plissée.
  rect(ctx, -18, -21, 36, 42, 4);
  ctx.fillStyle = lineaire(ctx, -18, -21, 18, 21, [[0, '#fff3b8'], [0.2, '#ffd34a'], [0.45, '#c9921a'], [0.6, '#ffe08a'], [0.8, '#b07a10'], [1, '#7a5206']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 7; i++) {
    const x0 = -18 + 36 * alea(i * 3.7);
    const y0 = -21 + 42 * alea(i * 5.1);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (alea(i * 2.3) - 0.5) * 22, y0 + (alea(i * 8.9) - 0.2) * 18);
    ctx.lineTo(x0 + (alea(i * 4.4) - 0.5) * 26, y0 + 14 + 8 * alea(i * 6.6));
    ctx.strokeStyle = i % 2 ? 'rgba(110,70,0,0.4)' : 'rgba(255,255,215,0.6)';
    ctx.stroke();
  }
  ctx.restore();
  rect(ctx, -18, -21, 36, 42, 4);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#4a3000';
  ctx.stroke();
  // Objectif de la caméra.
  cercle(ctx, 0, 5, 9.6);
  ctx.fillStyle = lineaire(ctx, -9, -4, 9, 14, [[0, '#ffffff'], [0.5, '#a3adbb'], [1, '#4b5563']]);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#1d232c';
  ctx.stroke();
  cercle(ctx, 0, 5, 7);
  ctx.fillStyle = radial(ctx, 0, 5, 7, [[0, '#6f93c8'], [0.5, '#14284f'], [1, '#050c1c']], -2, 3, 0.5);
  ctx.fill();
  reflet(ctx, -2.6, 2.4, 2.8, 1.5, -0.7, 0.9);
  reflet(ctx, -10, -14, 6, 2.4, -1.1, 0.6);
  ctx.restore();
}

/** Point d'émission (bout de la parabole) dans le repère de l'icône, à l'instant t. */
function pointEmission(t: number): [number, number, number] {
  const { rot, dy } = pose(t);
  const lx = ANTENNE.x + Math.cos(ANTENNE.axe) * 12.5;
  const ly = ANTENNE.y + Math.sin(ANTENNE.axe) * 12.5;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [lx * c - ly * s, dy + lx * s + ly * c, ANTENNE.axe + rot];
}

const bas: Icone = {
  arriere: (ctx, t) => {
    lueur(ctx, 0, Y_SAT - 4, 66, '#7fc8ff', 0.35);
    // Orbite en pointillés qui défile.
    ctx.save();
    ctx.translate(0, Y_SAT);
    ctx.rotate(-0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, 66, 17, 0, 0, TAU);
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -t * 22;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200,235,255,0.7)';
    ctx.stroke();
    ctx.restore();
  },
  corps: satellite,
  effets: (ctx, t) => {
    // Ondes émises par l'antenne.
    const [ex, ey, axe] = pointEmission(t);
    ctx.save();
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const p = boucle(t, 1.2, k / 3);
      const r = 5 + 20 * p;
      const a = Math.sin(p * Math.PI);
      ctx.beginPath();
      ctx.arc(ex, ey, r, axe - 0.55, axe + 0.55);
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(10,40,90,${(0.45 * a).toFixed(3)})`;
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = `rgba(150,235,255,${a.toFixed(3)})`;
      ctx.stroke();
    }
    ctx.restore();
    // Voyant rouge qui clignote au bout du panneau, étoiles qui scintillent.
    const { rot, dy } = pose(t);
    const vx = 56 * Math.cos(rot) - -13 * Math.sin(rot);
    const vy = dy + 56 * Math.sin(rot) + -13 * Math.cos(rot);
    const clign = boucle(t, 1) < 0.5 ? 1 : 0.15;
    lueur(ctx, vx, vy, 7, '#ff4a3a', clign);
    const etoiles: [number, number, number][] = [[-48, -22, 0.2], [44, -26, 1.7], [-54, 46, 3.1], [50, 48, 4.4], [-22, -40, 2.5]];
    etoiles.forEach(([x, y, ph]) => etincelle(ctx, x, y, 6.5, 0, '#ffffff', Math.max(0, Math.sin(t * 2.8 + ph)) ** 3));
  },
};

// ── Ambiance plein écran ────────────────────────────────────────────────────────────────────────────────────────────────

const masque = (y: number, H: number) => 0.18 + 0.82 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.18);

/** Grand radar dans un coin de l'écran : cercles, faisceau qui tourne, échos qui s'allument. */
function radarDeCoin(ctx: Ctx, t: number, x: number, y: number, R: number, u: number, sens: number, graine: number) {
  ctx.save();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = 'rgba(90,255,160,0.2)';
  for (let k = 1; k <= 4; k++) {
    cercle(ctx, x, y, (R * k) / 4);
    ctx.stroke();
  }
  const A = sens * t * 1.4 + graine;
  const tranches = 16;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < tranches; k++) {
    const a1 = A - sens * ((k * 0.9) / tranches);
    const a0 = A - sens * (((k + 1) * 0.9) / tranches);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, R, Math.min(a0, a1), Math.max(a0, a1) + 0.004);
    ctx.closePath();
    ctx.fillStyle = `rgba(80,255,150,${(0.16 * (1 - k / tranches) ** 2).toFixed(3)})`;
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const a = alea(graine + i * 3.1) * TAU;
    const d = R * (0.2 + 0.75 * alea(graine + i * 5.7));
    const depuis = ((((sens * (A - a)) / TAU) % 1) + 1) % 1;
    const vif = Math.exp(-depuis * 3);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    ctx.fillStyle = `rgba(${i % 3 === 0 ? '255,220,60' : '60,230,110'},${(0.55 * vif).toFixed(3)})`;
    cercle(ctx, px, py, (10 + 16 * alea(graine + i)) * u);
    ctx.fill();
  }
  ctx.restore();
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Voile bleu nuit d'écran de contrôle.
  ctx.fillStyle = 'rgba(2,14,34,0.2)';
  ctx.fillRect(0, 0, W, H);
  // Grille fine, effacée dans la bande du texte.
  const pas = 72 * u;
  ctx.lineWidth = 1.5 * u;
  for (let x = (W / 2) % pas; x < W; x += pas) {
    ctx.strokeStyle = lineaire(ctx, 0, 0, 0, H, [[0, 'rgba(120,220,255,0.16)'], [0.28, 'rgba(120,220,255,0.12)'], [0.4, 'rgba(120,220,255,0.03)'], [0.55, 'rgba(120,220,255,0.03)'], [0.67, 'rgba(120,220,255,0.12)'], [1, 'rgba(120,220,255,0.16)']]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = (H / 2) % pas; y < H; y += pas) {
    ctx.strokeStyle = `rgba(120,220,255,${(0.14 * masque(y, H)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Deux grands radars : en bas à gauche et en haut à droite.
  const R = Math.max(W, H) * 0.42;
  radarDeCoin(ctx, t, 0, H, R, u, 1, 1.3);
  radarDeCoin(ctx, t, W, 0, R, u, -1, 4.7);
  // Ligne de balayage qui descend lentement.
  const yb = boucle(t, 3.2) * H * 1.1 - H * 0.05;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lineaire(ctx, 0, yb - 60 * u, 0, yb + 4 * u, [[0, 'rgba(110,230,255,0)'], [0.9, `rgba(110,230,255,${(0.18 * masque(yb, H)).toFixed(3)})`], [1, 'rgba(180,245,255,0)']]);
  ctx.fillRect(0, yb - 60 * u, W, 64 * u);
  // Points de données qui clignotent aux croisements de la grille.
  for (let i = 0; i < 16; i++) {
    const gx = Math.floor(alea(i * 3.3) * (W / pas)) * pas + ((W / 2) % pas);
    const gy = Math.floor(alea(i * 7.9) * (H / pas)) * pas + ((H / 2) % pas);
    const a = Math.max(0, Math.sin(t * (2 + 3 * alea(i)) + i * 2.1)) ** 3 * masque(gy, H);
    if (a < 0.03) continue;
    ctx.fillStyle = `rgba(150,255,210,${(0.8 * a).toFixed(3)})`;
    rect(ctx, gx - 4 * u, gy - 4 * u, 8 * u, 8 * u, 1.5 * u);
    ctx.fill();
  }
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'radar',
  libelle: '📡 Radar météo : écran radar et satellite',
  haut,
  bas,
  ambiance,
};
