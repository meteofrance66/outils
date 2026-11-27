/**
 * Jeu « Tempête » : une tornade qui ondule et tourne sous un nuage noir, avec des débris qui tournoient autour (haut), un nuage
 * d'orage qui lâche un éclair et de gros grêlons de glace (bas), et un ciel de supercellule où le vent tourne en spirale, chargé de débris et
 * de grêle, avec des éclairs lointains (ambiance).
 */
import { alea, boucle, cercle, clamp, etincelle, lineaire, lisse, lueur, radial, rect, reduite, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';
import { eclair, nuage } from './formes';

const TAU = Math.PI * 2;

/** Éclair dans le nuage : bref scintillement toutes les 2,1 s (0 → 1). */
function flash(t: number, decalage = 0.55) {
  const p = boucle(t, 2.1, decalage);
  return p < 0.12 ? Math.sin((p / 0.12) * Math.PI) * (0.6 + 0.4 * Math.sin(p * 120)) : 0;
}

// ── Icône du haut : tornade ─────────────────────────────────────────────────────────────────────────────────────────────

const N_NIV = 28;

/** Géométrie de l'entonnoir : pour s de 0 (haut, sous le nuage) à 1 (pointe), centre x, ordonnée y et demi-largeur w. */
function niveau(s: number, t: number): [number, number, number] {
  const y = -22 + 74 * s;
  const w = 4 + 36 * (1 - s) ** 1.35;
  const x = Math.sin(s * 3.4 - t * 2.2) * 8 * s + 6 * s * s - 2;
  return [x, y, w];
}

function traceEntonnoir(ctx: Ctx, t: number) {
  ctx.beginPath();
  for (let i = 0; i <= N_NIV; i++) {
    const [x, y, w] = niveau(i / N_NIV, t);
    if (i) ctx.lineTo(x - w, y);
    else ctx.moveTo(x - w, y);
  }
  const [xb, yb, wb] = niveau(1, t);
  ctx.arc(xb, yb, wb, Math.PI, 0, true);
  for (let i = N_NIV; i >= 0; i--) {
    const [x, y, w] = niveau(i / N_NIV, t);
    ctx.lineTo(x + w, y);
  }
  ctx.closePath();
}

function entonnoir(ctx: Ctx, t: number) {
  ctx.save();
  traceEntonnoir(ctx, t);
  ctx.fillStyle = lineaire(ctx, -44, 0, 44, 0, [[0, '#2c3550'], [0.3, '#7d8aa8'], [0.48, '#b4bfd6'], [0.72, '#6a7795'], [1, '#252d45']]);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = '#141b2e';
  ctx.stroke();
  ctx.clip();
  // Haut assombri (il se fond dans le nuage), pointe poussiéreuse.
  ctx.fillStyle = lineaire(ctx, 0, -22, 0, 56, [[0, 'rgba(20,26,44,0.5)'], [0.45, 'rgba(20,26,44,0)'], [0.8, 'rgba(90,70,50,0)'], [1, 'rgba(90,70,50,0.4)']]);
  ctx.fillRect(-60, -25, 120, 85);
  // Anneaux qui descendent le long de l'entonnoir.
  for (let k = 0; k < 7; k++) {
    const s = boucle(t, 2.6, k / 7);
    const [x, y, w] = niveau(s, t);
    const a = Math.sin(s * Math.PI);
    ctx.beginPath();
    ctx.ellipse(x, y + 2.2, w, w * 0.26 + 1, 0, 0.1, Math.PI - 0.1);
    ctx.lineWidth = 2.6 * (1 - 0.4 * s);
    ctx.strokeStyle = `rgba(15,20,40,${(0.35 * a).toFixed(3)})`;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.26 + 1, 0, 0.05, Math.PI - 0.05);
    ctx.strokeStyle = `rgba(232,240,255,${(0.55 * a).toFixed(3)})`;
    ctx.stroke();
  }
  // Traînées en hélice : elles passent devant de gauche à droite, la tornade tourne.
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const th0 = t * 3.4 + (i * TAU) / 9;
    let prec: [number, number] | null = null;
    for (let j = 0; j <= 16; j++) {
      const s = (j / 16) * 0.95;
      const [x, y, w] = niveau(s, t);
      const th = th0 + s * 2.2;
      const vis = Math.cos(th);
      const pt: [number, number] = [x + w * Math.sin(th) * 0.92, y + w * 0.26 * vis];
      if (prec && vis > 0.05) {
        ctx.beginPath();
        ctx.moveTo(prec[0], prec[1]);
        ctx.lineTo(pt[0], pt[1]);
        ctx.lineWidth = 2 + 1.4 * (1 - s);
        ctx.strokeStyle = i % 2 ? `rgba(228,236,252,${(0.5 * vis).toFixed(3)})` : `rgba(18,24,44,${(0.4 * vis).toFixed(3)})`;
        ctx.stroke();
      }
      prec = pt;
    }
  }
  ctx.restore();
}

const BOSSES_CAP: readonly (readonly [number, number, number])[] = [
  [-38, -26, 13],
  [-18, -35, 18],
  [6, -38, 19],
  [28, -32, 15],
  [44, -24, 10],
];

function traceCap(ctx: Ctx, dx: number) {
  ctx.beginPath();
  for (const [x, y, r] of BOSSES_CAP) cercle(ctx, x + dx, y, r, false);
  rect(ctx, -50 + dx, -28, 102, 14, 7, false);
}

/** Nuage noir au sommet de la tornade, éclairé de l'intérieur par intermittence. */
function capNuage(ctx: Ctx, t: number) {
  const dx = Math.sin(t * 0.9) * 1.2;
  ctx.save();
  traceCap(ctx, dx);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#141b2e';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -57, 0, -12, [[0, '#a8b3ca'], [0.45, '#6a7795'], [1, '#323b57']]);
  ctx.fill();
  traceCap(ctx, dx);
  ctx.clip();
  for (const [x, y, r] of BOSSES_CAP) reflet(ctx, x + dx - r * 0.25, y - r * 0.45, r * 0.62, r * 0.3, -0.35, 0.4);
  ctx.fillStyle = lineaire(ctx, 0, -24, 0, -12, [[0, 'rgba(10,14,30,0)'], [1, 'rgba(10,14,30,0.45)']]);
  ctx.fillRect(-60, -24, 120, 14);
  const f = flash(t);
  if (f > 0.01) {
    ctx.fillStyle = radial(ctx, 12 + dx, -32, 34, [[0, `rgba(255,250,215,${(0.85 * f).toFixed(3)})`], [0.5, `rgba(200,215,255,${(0.35 * f).toFixed(3)})`], [1, 'rgba(200,215,255,0)']]);
    ctx.fillRect(-60, -60, 120, 50);
  }
  ctx.restore();
}

/** Débris (planches et feuilles) qui tournent autour de la tornade : ceux de derrière avant l'icône, ceux de devant après. */
function debris(ctx: Ctx, t: number, devant: boolean) {
  for (let i = 0; i < 10; i++) {
    const a = t * (3.2 + alea(i) * 1.5) + alea(i * 3.1) * TAU;
    if (Math.sin(a) > 0 !== devant) continue;
    const s = 0.42 + 0.5 * alea(i * 5.7);
    const [x, y, w] = niveau(s, t);
    const R = w + 7 + 8 * alea(i * 2.3);
    const px = x + Math.cos(a) * R;
    const py = y + Math.sin(a) * R * 0.28 - 3;
    const taille = 2.8 + 2.6 * alea(i * 4.4);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t * 7 * (alea(i * 6.1) - 0.5) * 2 + i);
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, taille * 1.2, taille * 0.55, 0, 0, TAU);
      ctx.fillStyle = '#3f9a3a';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#173d15';
      ctx.stroke();
    } else {
      rect(ctx, -taille, -taille * 0.35, taille * 2, taille * 0.7, 0.6);
      ctx.fillStyle = i % 2 ? '#8a5c34' : '#6d4526';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#2b1a0c';
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Réduite : du haut du nuage à la pointe, la tornade est plus haute que la rangée de l'icône.
const haut: Icone = reduite({
  arriere: (ctx, t) => {
    // Halo sombre, vent qui tourne autour, poussière soulevée à la pointe.
    ctx.save();
    ctx.fillStyle = radial(ctx, 0, 4, 66, [[0, 'rgba(18,26,48,0.42)'], [0.7, 'rgba(18,26,48,0.18)'], [1, 'rgba(18,26,48,0)']]);
    cercle(ctx, 0, 4, 66);
    ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a0 = t * 2.4 + (i * TAU) / 4;
      ctx.beginPath();
      ctx.ellipse(0, 8 + i * 7, 60 - i * 7, 13 - i * 1.5, -0.08, a0, a0 + 1.3);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(225,235,255,0.45)';
      ctx.stroke();
    }
    const [xb] = niveau(1, t);
    for (let i = 0; i < 6; i++) {
      const a = t * 2.8 + (i * TAU) / 6;
      const px = xb + Math.cos(a) * (12 + 6 * alea(i));
      const py = 52 + Math.sin(a) * 3;
      const r = 8 + 4 * Math.sin(t * 2 + i);
      ctx.fillStyle = radial(ctx, px, py, r, [[0, 'rgba(185,160,130,0.55)'], [1, 'rgba(185,160,130,0)']]);
      cercle(ctx, px, py, r);
      ctx.fill();
    }
    ctx.restore();
    debris(ctx, t, false);
  },
  corps: (ctx, t) => {
    entonnoir(ctx, t);
    capNuage(ctx, t);
  },
  effets: (ctx, t) => debris(ctx, t, true),
}, 0.82);

// ── Icône du bas : grêle ────────────────────────────────────────────────────────────────────────────────────────────────

/** Grêlon : boule de glace un peu bosselée, couches de glace, reflet. */
function grelon(ctx: Ctx, x: number, y: number, r: number, graine: number, rot: number) {
  if (r < 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const rr = r * (1 + (alea(graine + i * 1.3) - 0.5) * 0.16);
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = radial(ctx, 0, 0, r * 1.1, [[0, '#ffffff'], [0.45, '#e6f5ff'], [0.8, '#a9d4f5'], [1, '#6fa8de']], -r * 0.35, -r * 0.4, r * 0.05);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.2;
  ctx.strokeStyle = '#1e4f8f';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.08, r * 0.1, r * 0.55, 0.3, 2.6);
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = 'rgba(110,160,215,0.6)';
  ctx.stroke();
  ctx.restore();
  reflet(ctx, x - r * 0.35, y - r * 0.4, r * 0.34, r * 0.18, -0.7, 0.95);
}

/** Grêlons : abscisse, rayon, décalage de phase (de part et d'autre de l'éclair). */
const GRELONS: readonly (readonly [number, number, number])[] = [
  [-30, 10, 0],
  [-12, 11.5, 0.45],
  [24, 11, 0.2],
  [39, 8.5, 0.7],
];
/** Position d'un grêlon dans sa chute (p de 0 à 1) : il sort de sous le nuage et accélère. */
const chute = (p: number) => 12 + 32 * p ** 1.4;

// Réduite et un peu descendue : le nuage et les grêlons qui tombent dessous débordent de la rangée.
const bas: Icone = reduite({
  arriere: (ctx, t) => {
    lueur(ctx, 0, 6, 64, '#9fd3ff', 0.32);
    const f = flash(t, 0.05);
    if (f > 0.01) lueur(ctx, 0, -20, 66, '#e8f0ff', 0.6 * f);
    lueur(ctx, 6, 24, 26, '#ffe066', 0.35 + 0.5 * f);
  },
  corps: (ctx, t) => {
    // Éclair jaune sous le nuage, entre les grêlons (il donne la couleur et dit « orage » au premier coup d'œil).
    eclair(ctx, 6, 20, 0.36);
    // Les grêlons sortent de dessous le nuage, tombent en accélérant, puis rapetissent avant de disparaître.
    for (const [x, r, ph] of GRELONS) {
      const p = boucle(t, 1.15, ph);
      const ech = p > 0.85 ? 1 - (p - 0.85) / 0.15 : p < 0.1 ? 0.6 + (0.4 * p) / 0.1 : 1;
      grelon(ctx, x + Math.sin(p * 3 + ph * 9) * 1.5, chute(p), r * ech, x, t * 2 + ph * 5);
    }
    nuage(ctx, 0, -20, 1.18, 'orage');
    const f = flash(t, 0.05);
    if (f > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = radial(ctx, -8, -26, 36, [[0, `rgba(255,250,220,${(0.8 * f).toFixed(3)})`], [1, 'rgba(200,215,255,0)']]);
      ctx.fillRect(-60, -60, 120, 70);
      ctx.restore();
    }
  },
  effets: (ctx, t) => {
    // Éclats de glace qui rebondissent en bas, scintillements sur la glace.
    for (let i = 0; i < 6; i++) {
      const p = boucle(t, 0.7, alea(i * 2.1));
      const x0 = -40 + 80 * alea(i * 3.3);
      const x = x0 + (alea(i * 7.1) - 0.5) * 30 * p;
      const y = 56 - 56 * p * (1 - p);
      const a = 1 - p;
      ctx.globalAlpha = a;
      cercle(ctx, x, y, 2.3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = '#1e4f8f';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    GRELONS.forEach(([x, , ph], i) => {
      const p = boucle(t, 1.15, ph);
      const k = Math.max(0, Math.sin(t * 4 + i * 1.7)) ** 4;
      etincelle(ctx, x - 3, chute(p) - 4, 6, i, '#ffffff', k * clamp((0.85 - p) * 6));
    });
  },
}, 0.83, 4.5);

// ── Ambiance plein écran ────────────────────────────────────────────────────────────────────────────────────────────────

const masque = (y: number, H: number) => 0.2 + 0.8 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.18);

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Ciel de supercellule : voile vert-de-gris, coins très sombres.
  ctx.fillStyle = 'rgba(16,40,44,0.2)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / H, 1);
  ctx.fillStyle = radial(ctx, 0, 0, H * 0.75, [[0, 'rgba(6,14,24,0)'], [0.55, 'rgba(6,14,24,0)'], [1, 'rgba(6,14,24,0.6)']]);
  ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
  // Éclair lointain : l'écran s'éclaire brièvement.
  const f = flash(t, 0.3);
  if (f > 0.01) {
    ctx.fillStyle = `rgba(205,222,255,${(0.2 * f).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Vent qui tourne en spirale autour du centre de l'écran.
  const cx = W / 2;
  const cy = H * 0.47;
  const kx = Math.min(1, (W / H) * 1.15);
  ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const R = H * (0.28 + 0.5 * alea(i * 2.7));
    const a0 = alea(i * 5.3) * TAU + t * (1.1 + 0.8 * alea(i * 1.9)) * ((H * 0.45) / R);
    const len = 0.25 + 0.35 * alea(i * 3.7);
    const ym = cy + Math.sin(a0 + len / 2) * R * 0.9;
    const a = 0.32 * masque(ym, H);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * kx, R * 0.9, 0, a0, a0 + len);
    ctx.lineWidth = (2 + 3 * alea(i * 8.3)) * u;
    ctx.strokeStyle = `rgba(230,240,255,${a.toFixed(3)})`;
    ctx.stroke();
  }

  // Débris aspirés : ils tournent en se rapprochant du centre.
  for (let i = 0; i < 26; i++) {
    const per = 6 + 4 * alea(i * 4.1);
    const q = boucle(t, per, alea(i * 9.7));
    const R = H * (0.22 + 0.55 * (1 - q));
    const a = alea(i * 2.2) * TAU + t * (1.4 + alea(i * 3.3)) * ((H * 0.45) / R);
    const x = cx + Math.cos(a) * R * kx;
    const y = cy + Math.sin(a) * R * 0.9;
    const al = Math.sin(q * Math.PI) * masque(y, H);
    if (al < 0.04) continue;
    const taille = (7 + 9 * alea(i * 6.6)) * u;
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(x, y);
    ctx.rotate(t * (4 + 6 * alea(i)) + i);
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, taille, taille * 0.45, 0, 0, TAU);
      ctx.fillStyle = '#4fa54a';
    } else {
      rect(ctx, -taille, -taille * 0.3, taille * 2, taille * 0.6, taille * 0.15);
      ctx.fillStyle = '#7a5230';
    }
    ctx.fill();
    ctx.restore();
  }

  // Grêle sur les bords : petites billes de glace qui tombent vite.
  for (let i = 0; i < 36; i++) {
    const v = (1500 + 900 * alea(i * 2.9)) * u;
    const Hc = H + 100 * u;
    const y = ((alea(i * 7.3) * Hc + v * t) % Hc) - 50 * u;
    const fx = alea(i * 4.3);
    const x = (fx < 0.5 ? fx * 0.5 : 0.75 + (fx - 0.5) * 0.5) * W - y * 0.08;
    const al = 0.85 * masque(y, H);
    if (al < 0.04) continue;
    const r = (4 + 5 * alea(i * 1.3)) * u;
    ctx.globalAlpha = al * 0.35;
    ctx.beginPath();
    ctx.moveTo(x + 0.08 * 60 * u, y - 60 * u);
    ctx.lineTo(x, y);
    ctx.lineWidth = r * 0.9;
    ctx.strokeStyle = '#dff1ff';
    ctx.stroke();
    ctx.globalAlpha = al;
    cercle(ctx, x, y, r);
    ctx.fillStyle = '#f4fbff';
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = '#3a6fae';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'tempete',
  libelle: '🌪️ Tempête : tornade et grêlons',
  haut,
  bas,
  ambiance,
};
