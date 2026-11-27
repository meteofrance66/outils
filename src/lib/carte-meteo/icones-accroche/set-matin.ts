/**
 * Jeu « Bonjour » : médaillon d'un lever de soleil sur la Méditerranée (ciel violet, rose et or, reflet qui scintille, oiseaux)
 * en haut, tasse de café catalane fumante avec un cœur dans la mousse en bas, et une aube chaude : halo et rayons qui montent du
 * bas de l'écran, poussière dorée, oiseaux qui passent (ambiance).
 */
import { alea, boucle, cercle, clamp, etincelle, lineaire, lisse, lueur, radial, rect, reduite, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

const TAU = Math.PI * 2;

/** Oiseau en « v » aux ailes qui battent (silhouette sombre). */
function oiseau(ctx: Ctx, x: number, y: number, k: number, t: number, ph: number, couleur = '#2a1840') {
  const battement = Math.sin(t * 7 + ph);
  const aile = 5 * k;
  const haut = (2.6 + 2.2 * battement) * k;
  ctx.beginPath();
  ctx.moveTo(x - aile, y - haut);
  ctx.quadraticCurveTo(x - aile * 0.45, y - haut * 0.2 - 1.2 * k, x, y);
  ctx.quadraticCurveTo(x + aile * 0.45, y - haut * 0.2 - 1.2 * k, x + aile, y - haut);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.7 * k;
  ctx.strokeStyle = couleur;
  ctx.stroke();
}

// ── Icône du haut : médaillon du lever de soleil ────────────────────────────────────────────────────────────────────────

const R_MEDAILLON = 50;
const HORIZON = 12;

function leverDeSoleil(ctx: Ctx, t: number) {
  const R = R_MEDAILLON;
  ctx.save();
  cercle(ctx, 0, 0, R);
  ctx.clip();
  // Ciel de l'aube.
  ctx.fillStyle = lineaire(ctx, 0, -R, 0, HORIZON, [[0, '#3b2a78'], [0.38, '#c0407a'], [0.72, '#ff8a3d'], [1, '#ffd36b']]);
  ctx.fillRect(-R, -R, 2 * R, R + HORIZON);
  // Rayons qui tournent lentement autour du soleil.
  const sy = 3 + Math.sin(t * 0.8) * 1.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, 0, sy, 62, [[0, 'rgba(255,240,200,0.42)'], [1, 'rgba(255,240,200,0)']]);
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16 + t * 0.25;
    const w = i % 2 ? 0.05 : 0.09;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.arc(0, sy, 62, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  lueur(ctx, 0, sy, 34, '#ffe8a8', 0.75);
  // Soleil.
  cercle(ctx, 0, sy, 18);
  ctx.fillStyle = radial(ctx, 0, sy, 18, [[0, '#fffbe6'], [0.45, '#ffeb7a'], [0.85, '#ffc02e'], [1, '#ff9a1a']], -4, sy - 5, 1);
  ctx.fill();
  // Nuages effilés, éclairés par en dessous.
  const derive = Math.sin(t * 0.35) * 3;
  for (const [x, y, w, h] of [[-22 + derive, -24, 36, 6], [20 - derive, -34, 30, 5], [26 + derive * 0.6, -14, 20, 3.6]] as const) {
    rect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = lineaire(ctx, 0, y - h / 2, 0, y + h / 2, [[0, 'rgba(255,205,215,0.95)'], [0.6, 'rgba(255,160,140,0.95)'], [1, 'rgba(255,214,120,0.95)']]);
    ctx.fill();
  }
  // Mer : dégradé, reflet du soleil qui scintille, vaguelettes.
  ctx.fillStyle = lineaire(ctx, 0, HORIZON, 0, R, [[0, '#ff9e5e'], [0.18, '#d9607a'], [0.6, '#6a3a86'], [1, '#2a2260']]);
  ctx.fillRect(-R, HORIZON, 2 * R, R - HORIZON);
  for (let k = 0; k < 10; k++) {
    const y = HORIZON + 2.6 + k * 3.6;
    const w = (17 - k * 0.9) * (0.55 + 0.45 * Math.sin(t * 3.2 + k * 1.7));
    const x = Math.sin(t * 1.5 + k) * 1.5;
    rect(ctx, x - w, y, 2 * w, 1.6, 0.8);
    ctx.fillStyle = `rgba(255,228,150,${(0.95 - k * 0.07).toFixed(3)})`;
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const y = HORIZON + 5 + k * 6;
    const x = -40 + 80 * alea(k * 3.1) + Math.sin(t * 0.9 + k) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,190,200,0.45)';
    ctx.stroke();
  }
  // Horizon lumineux.
  ctx.fillStyle = lineaire(ctx, -R, 0, R, 0, [[0, 'rgba(255,230,170,0)'], [0.5, 'rgba(255,246,210,1)'], [1, 'rgba(255,230,170,0)']]);
  ctx.fillRect(-R, HORIZON - 0.7, 2 * R, 1.4);
  // Deux oiseaux.
  oiseau(ctx, -24 + Math.sin(t * 0.6) * 4, -12 + Math.sin(t * 1.1) * 1.5, 1.15, t, 0);
  oiseau(ctx, -12 + Math.sin(t * 0.6 + 0.5) * 4, -20 + Math.sin(t * 1.3) * 1.5, 0.85, t, 1.9);
  // Bord du médaillon plus sombre.
  ctx.fillStyle = radial(ctx, 0, 0, R, [[0, 'rgba(30,10,50,0)'], [0.8, 'rgba(30,10,50,0)'], [1, 'rgba(30,10,50,0.35)']]);
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  // Cerclage doré et filet blanc.
  cercle(ctx, 0, 0, R);
  ctx.lineWidth = 5;
  ctx.strokeStyle = lineaire(ctx, -R, -R, R, R, [[0, '#fff1a8'], [0.35, '#ffb83a'], [0.7, '#ff7a1a'], [1, '#c2410c']]);
  ctx.stroke();
  cercle(ctx, 0, 0, R - 3.3);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  reflet(ctx, -22, -30, 17, 6, -0.75, 0.42);
}

// Réduit : le médaillon fait 100 unités de diamètre, cerclage et liseré en plus.
const haut: Icone = reduite({
  arriere: (ctx, t) => {
    // Couronne de rayons chauds derrière le médaillon.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, 0, 0, 68, [[0, 'rgba(255,214,150,0.7)'], [0.75, 'rgba(255,190,120,0.35)'], [1, 'rgba(255,190,120,0)']]);
    for (let i = 0; i < 18; i++) {
      const a = (i * TAU) / 18 - t * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 68 + 3 * Math.sin(t * 2 + i), a - 0.07, a + 0.07);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    lueur(ctx, 0, 0, 64, '#ffb46b', 0.45 + 0.08 * Math.sin(t * 2));
  },
  corps: leverDeSoleil,
  effets: (ctx, t) => {
    const pts: [number, number, number, number][] = [[-42, -36, 9, 0.3], [44, -30, 7, 2.1], [38, 44, 8, 3.6], [-48, 30, 6, 5.0]];
    pts.forEach(([x, y, r, ph]) => etincelle(ctx, x, y, r, t * 0.3, '#fff4d0', Math.max(0, Math.sin(t * 2.9 + ph)) ** 2));
  },
}, 0.88);

// ── Icône du bas : tasse de café ────────────────────────────────────────────────────────────────────────────────────────

const RIM_Y = -6;

function traceTasse(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-33, RIM_Y);
  ctx.bezierCurveTo(-33, 16, -28, 32, -14, 35);
  ctx.quadraticCurveTo(0, 37.5, 14, 35);
  ctx.bezierCurveTo(28, 32, 33, 16, 33, RIM_Y);
  ctx.ellipse(0, RIM_Y, 33, 8, 0, 0, Math.PI, true);
  ctx.closePath();
}

/** Bande entre deux ellipses (moitié avant) : une rayure qui fait le tour de la tasse. */
function bande(ctx: Ctx, y0: number, y1: number) {
  ctx.beginPath();
  ctx.ellipse(0, y0, 36, 8, 0, 0, Math.PI);
  ctx.lineTo(-36, y1);
  ctx.ellipse(0, y1, 36, 8, 0, Math.PI, 0, true);
  ctx.closePath();
}

function tasse(ctx: Ctx, t: number) {
  ctx.save();
  // Soucoupe.
  ctx.beginPath();
  ctx.ellipse(0, 40, 50, 11, 0, 0, TAU);
  ctx.fillStyle = lineaire(ctx, 0, 29, 0, 51, [[0, '#ffffff'], [0.5, '#e4eaf3'], [1, '#b4c0d2']]);
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = '#1f3a66';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 39, 33, 6.8, 0, 0, TAU);
  ctx.fillStyle = 'rgba(120,140,175,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(2, 37.5, 28, 5, 0, 0, TAU);
  ctx.fillStyle = 'rgba(30,50,90,0.35)';
  ctx.fill();
  // Anse (sous la tasse).
  ctx.beginPath();
  ctx.moveTo(28, 1);
  ctx.bezierCurveTo(53, -4, 55, 28, 26, 24);
  ctx.lineCap = 'round';
  ctx.lineWidth = 11.5;
  ctx.strokeStyle = '#1f3a66';
  ctx.stroke();
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = lineaire(ctx, 30, 0, 54, 24, [[0, '#ffffff'], [0.6, '#dfe6f0'], [1, '#a9b6ca']]);
  ctx.stroke();
  // Corps en porcelaine blanche.
  traceTasse(ctx);
  ctx.fillStyle = lineaire(ctx, -33, 0, 33, 0, [[0, '#a7b3c8'], [0.18, '#e9eef5'], [0.38, '#ffffff'], [0.7, '#e3e9f2'], [1, '#8e9bb3']]);
  ctx.fill();
  ctx.save();
  traceTasse(ctx);
  ctx.clip();
  // Bande senyera qui fait le tour de la tasse : jaune, quatre rayures rouges.
  bande(ctx, 6, 22);
  ctx.fillStyle = '#fcdd09';
  ctx.fill();
  for (const k of [1, 3, 5, 7]) {
    bande(ctx, 6 + (k * 16) / 9, 6 + ((k + 1) * 16) / 9);
    ctx.fillStyle = '#da121a';
    ctx.fill();
  }
  // Volume du cylindre : bords sombres, reflet au centre gauche.
  ctx.fillStyle = lineaire(ctx, -33, 0, 33, 0, [[0, 'rgba(20,30,60,0.35)'], [0.25, 'rgba(20,30,60,0)'], [0.7, 'rgba(20,30,60,0)'], [1, 'rgba(20,30,60,0.42)']]);
  ctx.fillRect(-40, -20, 80, 60);
  ctx.fillStyle = lineaire(ctx, 0, 20, 0, 37, [[0, 'rgba(20,30,60,0)'], [1, 'rgba(20,30,60,0.25)']]);
  ctx.fillRect(-40, 20, 80, 20);
  ctx.restore();
  traceTasse(ctx);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = '#1f3a66';
  ctx.stroke();
  // Bord et café.
  ctx.beginPath();
  ctx.ellipse(0, RIM_Y, 33, 8, 0, 0, TAU);
  ctx.fillStyle = lineaire(ctx, 0, RIM_Y - 8, 0, RIM_Y + 8, [[0, '#c9d3e2'], [1, '#ffffff']]);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#1f3a66';
  ctx.stroke();
  ctx.save();
  ctx.translate(0, RIM_Y + 0.8);
  ctx.scale(1, 6.4 / 28.5);
  cercle(ctx, 0, 0, 28.5);
  ctx.fillStyle = radial(ctx, 0, 0, 28.5, [[0, '#e2b07a'], [0.35, '#b5783f'], [0.75, '#6e3a17'], [1, '#3b1b08']]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40,20,5,0.55)';
  ctx.stroke();
  ctx.restore();
  // Cœur dans la mousse, qui respire doucement.
  ctx.save();
  ctx.translate(0, RIM_Y + 0.8);
  const k = 0.95 + 0.04 * Math.sin(t * 2.4);
  ctx.scale(k, 0.3 * k);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-4, 6, -14, 0, -14, -6);
  ctx.bezierCurveTo(-14, -12, -6, -14, 0, -8);
  ctx.bezierCurveTo(6, -14, 14, -12, 14, -6);
  ctx.bezierCurveTo(14, 0, 4, 6, 0, 10);
  ctx.closePath();
  ctx.fillStyle = '#f7ead2';
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(150,90,40,0.55)';
  ctx.stroke();
  ctx.restore();
  // Reflets de la porcelaine.
  reflet(ctx, -22, 10, 15, 3.8, -1.45, 0.85);
  reflet(ctx, -18, RIM_Y - 4.5, 8, 1.6, -0.12, 0.8);
  reflet(ctx, -26, 40, 12, 2.2, 0.05, 0.6);
  ctx.restore();
}

// Réduite : de la soucoupe au haut de la vapeur, la tasse dépasse la rangée de l'icône.
const bas: Icone = reduite({
  arriere: (ctx, t) => lueur(ctx, 0, 8, 66, '#ffd9a0', 0.45 + 0.06 * Math.sin(t * 2)),
  corps: tasse,
  effets: (ctx, t) => {
    // Vapeur : trois rubans qui ondulent en montant (halo doux puis trait clair).
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x0 = (i - 1) * 11;
      const ph = i * 2.1;
      const pts: [number, number][] = [];
      for (let j = 0; j <= 18; j++) {
        const s = j / 18;
        pts.push([x0 + Math.sin(s * 5 - t * 3.2 + ph) * (2 + 6 * s) + s * s * 4 * (i - 1), RIM_Y - 6 - 46 * s]);
      }
      for (const [largeur, couleur, force] of [[9, '255,255,255', 0.22], [4.2, '255,255,255', 0.85]] as const) {
        for (let j = 1; j < pts.length; j++) {
          const s = j / 18;
          const a = Math.sin(Math.PI * clamp(s * 1.1)) * (0.6 + 0.3 * Math.sin(t * 2 + ph)) * force;
          if (a < 0.02) continue;
          ctx.beginPath();
          ctx.moveTo(pts[j - 1][0], pts[j - 1][1]);
          ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.lineWidth = largeur * (1 - 0.55 * s);
          ctx.strokeStyle = `rgba(${couleur},${a.toFixed(3)})`;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    etincelle(ctx, 24, 12, 7, 0, '#ffffff', Math.max(0, Math.sin(t * 2.4 + 1.2)) ** 4);
  },
}, 0.87);

// ── Ambiance plein écran ────────────────────────────────────────────────────────────────────────────────────────────────

const masque = (y: number, H: number) => 0.2 + 0.8 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.18);

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Aube : rose en haut, or en bas.
  ctx.fillStyle = lineaire(ctx, 0, 0, 0, H * 0.32, [[0, 'rgba(255,110,160,0.26)'], [1, 'rgba(255,110,160,0)']]);
  ctx.fillRect(0, 0, W, H * 0.32);
  // Lueur orangée au-dessus du pied de page, pas dessous : le site et le logo restent sur un fond assez sombre pour être lus.
  ctx.fillStyle = lineaire(ctx, 0, H * 0.55, 0, H, [[0, 'rgba(255,150,70,0)'], [0.6, 'rgba(255,150,70,0.3)'], [1, 'rgba(255,150,70,0.12)']]);
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  // Soleil qui se lève sous l'écran : halo et rayons qui montent ; tous deux s'effacent près du soleil, donc derrière le pied de page.
  ctx.globalCompositeOperation = 'lighter';
  const sx = W / 2;
  const sy = H * 1.04;
  const respire = 0.9 + 0.1 * Math.sin(t * 1.5);
  ctx.fillStyle = radial(ctx, sx, sy, H * 0.7, [[0, 'rgba(255,214,140,0)'], [0.3, `rgba(255,205,130,${(0.06 * respire).toFixed(3)})`], [0.55, `rgba(255,200,125,${(0.2 * respire).toFixed(3)})`], [1, 'rgba(255,190,120,0)']]);
  ctx.fillRect(0, H * 0.3, W, H * 0.7);
  ctx.fillStyle = radial(ctx, sx, sy, H * 1.1, [[0, 'rgba(255,232,190,0)'], [0.22, 'rgba(255,232,190,0.04)'], [0.42, 'rgba(255,232,190,0.26)'], [0.75, 'rgba(255,225,180,0.08)'], [1, 'rgba(255,225,180,0)']]);
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / (N - 1) - 0.5) * 2.1 + 0.06 * Math.sin(t * 0.7 + i);
    const w = 0.035 + 0.025 * alea(i * 3.7);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 1.3 + i * 1.9);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - w) * H * 1.2, sy + Math.sin(a - w) * H * 1.2);
    ctx.lineTo(sx + Math.cos(a + w) * H * 1.2, sy + Math.sin(a + w) * H * 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Bokeh et poussière dorée qui montent.
  for (let i = 0; i < 30; i++) {
    const v = 0.05 + 0.08 * alea(i * 3.1);
    const q = boucle(t, 1 / v, alea(i * 7.7));
    const x = alea(i * 5.3) * W + Math.sin(t * 0.8 + i * 2.1) * 16 * u;
    const y = H * (1.05 - q * 1.1);
    const a = Math.sin(q * Math.PI) * masque(y, H) * (0.6 + 0.4 * Math.sin(t * 3 + i));
    if (a < 0.03) continue;
    ctx.globalAlpha = a;
    if (i % 4 === 0) {
      cercle(ctx, x, y, (30 + 30 * alea(i * 6.3)) * u);
      ctx.fillStyle = 'rgba(255,220,160,0.12)';
      ctx.fill();
      ctx.lineWidth = 2 * u;
      ctx.strokeStyle = 'rgba(255,235,190,0.3)';
      ctx.stroke();
    } else {
      cercle(ctx, x, y, (2.5 + 3 * alea(i * 1.7)) * u);
      ctx.fillStyle = i % 2 ? '#fff1c4' : '#ffd27a';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Oiseaux qui traversent le haut de l'écran.
  for (let i = 0; i < 4; i++) {
    const p = boucle(t, 9 + 3 * alea(i * 2.3), alea(i * 4.9));
    const x = -60 * u + p * (W + 120 * u);
    const y = H * (0.1 + 0.1 * alea(i * 6.1)) + Math.sin(t * 1.2 + i) * 10 * u;
    oiseau(ctx, x, y, (3.4 + 1.6 * alea(i * 8.8)) * u, t, i * 1.3, 'rgba(40,20,60,0.75)');
  }
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'matin',
  libelle: '☕ Bonjour : lever de soleil et café fumant',
  haut,
  bas,
  ambiance,
};
