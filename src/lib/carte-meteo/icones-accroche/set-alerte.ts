/**
 * Jeu « Alerte météo » : panneau de danger qui palpite au rythme d'une alarme (haut), gyrophare dont les deux faisceaux tournent et
 * éblouissent quand ils passent face à nous (bas), éclats rouges et orange qui alternent sur les bords de l'écran, comme les feux
 * d'un véhicule d'urgence (ambiance).
 */
import { alea, boucle, cercle, etincelle, lineaire, lisse, lueur, radial, rect, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

const TAU = Math.PI * 2;

/** Battement d'alarme : deux pulsations rapprochées par seconde (0 → 1). */
function battement(t: number) {
  const p = boucle(t, 1);
  return Math.max(Math.exp(-(((p - 0.12) / 0.07) ** 2)), 0.75 * Math.exp(-(((p - 0.34) / 0.07) ** 2)));
}

// ── Icône du haut : panneau de danger ───────────────────────────────────────────────────────────────────────────────────

/** Triangle équilatéral aux coins arrondis, de rayon `r` (centre de gravité en 0, pointe en haut). */
function traceTriangle(ctx: Ctx, r: number, arrondi: number) {
  const s = Math.sin(Math.PI / 3);
  const pts: [number, number][] = [[0, -r], [r * s, r / 2], [-r * s, r / 2]];
  ctx.beginPath();
  ctx.moveTo((pts[2][0] + pts[0][0]) / 2, (pts[2][1] + pts[0][1]) / 2);
  for (let i = 0; i < 3; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 3];
    ctx.arcTo(x1, y1, x2, y2, arrondi);
  }
  ctx.closePath();
}

/** Le centre de gravité du triangle est plus bas que le milieu de sa hauteur : on le descend pour centrer l'icône. */
const DY_PANNEAU = 14;

/** Point d'exclamation noir laqué, qui tremble à chaque battement. */
function exclamation(ctx: Ctx, t: number, b: number) {
  ctx.save();
  ctx.translate(0, -5);
  ctx.rotate(Math.sin(t * 42) * 0.08 * b);
  ctx.translate(0, 5);
  const noir = lineaire(ctx, -7, 0, 7, 0, [[0, '#3c3c3c'], [0.35, '#151515'], [1, '#000000']]);
  ctx.beginPath();
  ctx.arc(0, -21.5, 6.6, Math.PI, 0);
  ctx.lineTo(3.4, -0.5);
  ctx.arc(0, -0.5, 3.4, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = noir;
  ctx.fill();
  cercle(ctx, 0, 11.5, 5.4);
  ctx.fillStyle = noir;
  ctx.fill();
  // Reflets laqués.
  reflet(ctx, -2.4, -22, 2.4, 1.3, -1.4, 0.55);
  reflet(ctx, -1.8, 9.8, 1.8, 1.1, -0.7, 0.5);
  ctx.restore();
}

function panneau(ctx: Ctx, t: number) {
  const b = battement(t);
  ctx.save();
  ctx.translate(0, DY_PANNEAU);
  ctx.scale(1 + 0.05 * b, 1 + 0.05 * b);
  // Bordure rouge épaisse et bombée.
  traceTriangle(ctx, 60, 13);
  ctx.fillStyle = lineaire(ctx, -30, -60, 30, 32, [[0, '#ff6a55'], [0.35, '#e8202a'], [0.75, '#b30d16'], [1, '#7a060c']]);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#4d0307';
  ctx.stroke();
  // Biseau : liseré clair côté lumière.
  traceTriangle(ctx, 56.5, 11.5);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = lineaire(ctx, -40, -50, 40, 30, [[0, 'rgba(255,225,215,0.9)'], [0.5, 'rgba(255,200,190,0.15)'], [1, 'rgba(255,200,190,0)']]);
  ctx.stroke();
  // Fond jaune lumineux.
  traceTriangle(ctx, 43, 7);
  ctx.fillStyle = radial(ctx, -4, -8, 52, [[0, '#fffbd6'], [0.35, '#ffe94a'], [0.75, '#fcc509'], [1, '#e89a00']], -8, -16, 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7a060c';
  ctx.stroke();
  ctx.save();
  traceTriangle(ctx, 43, 7);
  ctx.clip();
  // Ombre intérieure en bas, éclat blanc à chaque battement, balayage de lumière.
  ctx.fillStyle = lineaire(ctx, 0, 2, 0, 22, [[0, 'rgba(200,90,0,0)'], [1, 'rgba(200,90,0,0.4)']]);
  ctx.fillRect(-50, 2, 100, 22);
  ctx.fillStyle = `rgba(255,255,235,${(0.4 * b).toFixed(3)})`;
  ctx.fillRect(-50, -50, 100, 80);
  const s = boucle(t, 2.2, 0.3);
  if (s < 0.4) {
    const pos = (lisse(s / 0.4) * 2 - 1) * 55;
    ctx.save();
    ctx.rotate(-0.55);
    ctx.fillStyle = lineaire(ctx, pos - 9, 0, pos + 9, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(pos - 9, -70, 18, 140);
    ctx.restore();
  }
  ctx.restore();
  exclamation(ctx, t, b);
  // Reflet sur la bordure, en haut à gauche.
  reflet(ctx, -15, -29, 12, 4, -1.05, 0.75);
  ctx.restore();
}

const haut: Icone = {
  arriere: (ctx, t) => {
    const b = battement(t);
    lueur(ctx, 0, 8, 62 + 6 * b, '#ff4a1c', 0.4 + 0.45 * b);
    lueur(ctx, 0, 8, 42, '#ffd27a', 0.3 + 0.35 * b);
  },
  corps: panneau,
  effets: (ctx, t) => {
    // Ondes d'alarme de chaque côté : « ((( ! ))) ».
    ctx.save();
    ctx.lineCap = 'round';
    for (const cote of [-1, 1]) {
      const c = cote > 0 ? 0 : Math.PI;
      for (let k = 0; k < 3; k++) {
        const p = boucle(t, 1.1, k / 3);
        const r = 48 + 18 * p;
        const a = Math.sin(p * Math.PI);
        if (a < 0.03) continue;
        ctx.beginPath();
        ctx.arc(0, -2, r, c - 0.36, c + 0.36);
        ctx.lineWidth = 4.6;
        ctx.strokeStyle = `rgba(110,4,10,${(0.55 * a).toFixed(3)})`;
        ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = `rgba(255,236,150,${a.toFixed(3)})`;
        ctx.stroke();
      }
    }
    ctx.restore();
    // Étincelles qui claquent avec l'alarme.
    const b = battement(t);
    const pts: [number, number, number][] = [[-30, -40, 0.3], [34, -34, 1.9], [0, -58, 3.1]];
    pts.forEach(([x, y, ph]) => etincelle(ctx, x, y, 9, ph + t, '#fff6c8', Math.max(b, Math.max(0, Math.sin(t * 3 + ph)) ** 3)));
  },
};

// ── Icône du bas : gyrophare ────────────────────────────────────────────────────────────────────────────────────────────

/** Vitesse de rotation du gyrophare (rad/s) : un tour en 1,5 s. */
const VITESSE_GYRO = 4.2;
/** Centre de la demi-sphère du dôme et hauteur de la lampe. */
const DOME_Y = -12;
const LAMPE_Y = -2;

/** Éblouissement : 1 quand un des deux faisceaux est pile face à nous. */
function eblouissement(t: number) {
  const phi = t * VITESSE_GYRO;
  return Math.max(Math.max(0, Math.sin(phi)) ** 10, Math.max(0, Math.sin(phi + Math.PI)) ** 10);
}

function traceDome(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-30, 15);
  ctx.lineTo(-30, DOME_Y);
  ctx.arc(0, DOME_Y, 30, Math.PI, TAU);
  ctx.lineTo(30, 15);
  ctx.closePath();
}

function gyrophare(ctx: Ctx, t: number) {
  const phi = t * VITESSE_GYRO;
  ctx.save();
  // Socle sombre à grille d'aération.
  rect(ctx, -38, 20, 76, 24, 7);
  ctx.fillStyle = lineaire(ctx, 0, 20, 0, 44, [[0, '#6b7686'], [0.45, '#3a424f'], [1, '#1a1f27']]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#0a0c10';
  ctx.stroke();
  for (let x = -27; x <= 27; x += 9) {
    rect(ctx, x - 1.7, 27, 3.4, 11, 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 1.7, 28, 0.9, 9);
  }
  // Collerette chromée.
  rect(ctx, -42, 12, 84, 10, 5);
  ctx.fillStyle = lineaire(ctx, 0, 12, 0, 22, [[0, '#ffffff'], [0.4, '#c9d2de'], [0.8, '#7b8798'], [1, '#4b5563']]);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#1d232c';
  ctx.stroke();
  // Dôme de verre rouge.
  traceDome(ctx);
  ctx.fillStyle = lineaire(ctx, -30, 0, 30, 0, [[0, '#6e0006'], [0.18, '#c3121b'], [0.5, '#ff3a2e'], [0.82, '#c3121b'], [1, '#6e0006']]);
  ctx.fill();
  ctx.save();
  traceDome(ctx);
  ctx.clip();
  // Stries du verre (lentille de Fresnel).
  ctx.lineWidth = 1.3;
  for (let i = -5; i <= 5; i++) {
    const x = 30 * Math.sin(i * 0.27);
    const haut = DOME_Y - Math.sqrt(Math.max(0, 900 - x * x));
    ctx.strokeStyle = 'rgba(90,0,5,0.28)';
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x, haut);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,160,150,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + 1.3, 15);
    ctx.lineTo(x + 1.3, haut);
    ctx.stroke();
  }
  // Lampe allumée au cœur.
  ctx.fillStyle = radial(ctx, 0, LAMPE_Y, 16, [[0, 'rgba(255,246,208,0.95)'], [0.5, 'rgba(255,170,110,0.6)'], [1, 'rgba(255,80,50,0)']]);
  ctx.fillRect(-30, -45, 60, 60);
  // Taches des deux faisceaux sur le verre : plus vives devant, plus larges quand ils nous font face.
  for (const b of [phi, phi + Math.PI]) {
    const c = Math.cos(b);
    const s = Math.sin(b);
    const force = s > 0 ? 0.55 + 0.45 * s : 0.3 * (1 + s);
    const rx = 6 + 14 * Math.abs(s);
    ctx.save();
    ctx.translate(25 * c, LAMPE_Y - 2);
    ctx.scale(rx / 30, 1);
    ctx.fillStyle = radial(ctx, 0, 0, 30, [[0, `rgba(255,252,230,${force.toFixed(3)})`], [0.4, `rgba(255,175,120,${(force * 0.6).toFixed(3)})`], [1, 'rgba(255,60,40,0)']]);
    cercle(ctx, 0, 0, 30);
    ctx.fill();
    ctx.restore();
  }
  // Ombre au pied du dôme, reflet vertical à gauche.
  ctx.fillStyle = lineaire(ctx, 0, 4, 0, 15, [[0, 'rgba(60,0,0,0)'], [1, 'rgba(60,0,0,0.45)']]);
  ctx.fillRect(-30, 4, 60, 11);
  ctx.restore();
  reflet(ctx, -17, -20, 13, 4.5, -1.3, 0.8);
  reflet(ctx, -8, -36, 7, 2.4, -0.25, 0.7);
  traceDome(ctx);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3d0004';
  ctx.stroke();
  ctx.restore();
}

const bas: Icone = {
  arriere: (ctx, t) => {
    const phi = t * VITESSE_GYRO;
    // Faisceaux qui balaient de part et d'autre (lumière additive : ils éclairent le fond sans le salir).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of [phi, phi + Math.PI]) {
      const c = Math.cos(b);
      const s = Math.sin(b);
      const sens = c >= 0 ? 1 : -1;
      const L = 12 + 98 * Math.abs(c);
      const force = s > 0 ? 0.55 + 0.45 * s : 0.35 * (1 + s);
      const ouverture = 9 + 20 * (1 - Math.abs(c));
      ctx.beginPath();
      ctx.moveTo(0, LAMPE_Y - 4);
      ctx.lineTo(sens * L, LAMPE_Y - ouverture);
      ctx.lineTo(sens * L, LAMPE_Y + ouverture);
      ctx.lineTo(0, LAMPE_Y + 4);
      ctx.closePath();
      ctx.fillStyle = lineaire(ctx, 0, 0, sens * L, 0, [[0, `rgba(255,130,100,${(0.9 * force).toFixed(3)})`], [0.5, `rgba(255,60,40,${(0.4 * force).toFixed(3)})`], [1, 'rgba(255,40,30,0)']]);
      ctx.fill();
    }
    ctx.restore();
    lueur(ctx, 0, LAMPE_Y, 64, '#ff2a1a', 0.35 + 0.5 * eblouissement(t));
  },
  corps: gyrophare,
  effets: (ctx, t) => {
    // Éblouissement quand un faisceau nous fait face : halo, longue traînée horizontale et étoile.
    const g = eblouissement(t);
    if (g < 0.03) return;
    lueur(ctx, 0, LAMPE_Y, 14 + 36 * g, '#fff0dc', 0.95 * g);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(0, LAMPE_Y);
    ctx.scale(1, 0.045);
    ctx.fillStyle = radial(ctx, 0, 0, 80 * g, [[0, `rgba(255,240,230,${(0.9 * g).toFixed(3)})`], [0.5, `rgba(255,120,90,${(0.4 * g).toFixed(3)})`], [1, 'rgba(255,60,40,0)']]);
    cercle(ctx, 0, 0, 80 * g);
    ctx.fill();
    ctx.restore();
    etincelle(ctx, 0, LAMPE_Y, 22 * g, t * 0.5, '#ffffff', 1);
    etincelle(ctx, 0, LAMPE_Y, 12 * g, t * 0.5 + Math.PI / 4, '#ffd2b0', 1);
  },
};

// ── Ambiance plein écran ────────────────────────────────────────────────────────────────────────────────────────────────

/** Poids d'un point selon sa hauteur : discret dans la bande du texte (30 à 65 % de la hauteur), plein ailleurs. */
const masque = (y: number, H: number) => 0.2 + 0.8 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.18);

/** Double éclat de feu d'urgence (0 → 1), deux fois par période. */
const double = (p: number) => Math.max(Math.exp(-(((p - 0.08) / 0.045) ** 2)), Math.exp(-(((p - 0.24) / 0.045) ** 2)));

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Voile sombre et rougeâtre, coins assombris.
  ctx.fillStyle = 'rgba(60,0,12,0.16)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / H, 1);
  ctx.fillStyle = radial(ctx, 0, 0, H * 0.75, [[0, 'rgba(30,0,8,0)'], [0.6, 'rgba(30,0,8,0)'], [1, 'rgba(30,0,8,0.45)']]);
  ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();

  // Feux alternés : rouge à gauche, orange à droite, comme un véhicule d'urgence.
  const p = boucle(t, 0.8);
  const feux: [number, number, string][] = [[0, double(p), '255,30,40'], [W, double((p + 0.5) % 1), '255,150,0']];
  for (const [x, f, rgb] of feux) {
    ctx.save();
    ctx.translate(x, H * 0.48);
    ctx.scale(0.62, 1);
    const R = H * 0.62;
    const a = 0.12 + 0.5 * f;
    ctx.fillStyle = radial(ctx, 0, 0, R, [[0, `rgba(${rgb},${a.toFixed(3)})`], [0.45, `rgba(${rgb},${(a * 0.45).toFixed(3)})`], [1, `rgba(${rgb},0)`]]);
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
    ctx.restore();
  }

  // Projecteurs depuis les coins du bas, qui balaient en se croisant.
  ctx.globalCompositeOperation = 'lighter';
  for (const [x0, sens] of [[0, 1], [W, -1]] as const) {
    const a = -Math.PI / 2 + sens * (0.35 + 0.3 * Math.sin(t * 1.4 + (sens > 0 ? 0 : 1.7)));
    const L = H * 1.1;
    const w = 0.07;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    ctx.lineTo(x0 + Math.cos(a - w) * L, H + Math.sin(a - w) * L);
    ctx.lineTo(x0 + Math.cos(a + w) * L, H + Math.sin(a + w) * L);
    ctx.closePath();
    ctx.fillStyle = radial(ctx, x0, H, L, [[0, 'rgba(255,220,190,0.3)'], [0.5, 'rgba(255,200,170,0.1)'], [1, 'rgba(255,200,170,0)']]);
    ctx.fill();
  }

  // Braises qui montent sur les bords.
  for (let i = 0; i < 34; i++) {
    const v = 0.08 + 0.1 * alea(i * 3.1);
    const q = boucle(t, 1 / v, alea(i * 7.7));
    const f = alea(i * 5.3);
    const x = (f < 0.5 ? f * 0.36 : 0.64 + (f - 0.5) * 0.72) * W + Math.sin(t * 2.3 + i) * 12 * u;
    const y = H * (1.04 - q * 1.1);
    const a = Math.sin(q * Math.PI) * (0.55 + 0.45 * Math.sin(t * 7 + i * 2.7)) * masque(y, H);
    if (a < 0.03) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = i % 3 === 0 ? '#ffe9a0' : i % 3 === 1 ? '#ff9a3a' : '#ff4a2a';
    cercle(ctx, x, y, (2.5 + 3.5 * alea(i * 1.9)) * u);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'alerte',
  libelle: '⚠️ Alerte météo : panneau de danger et gyrophare',
  haut,
  bas,
  ambiance,
};
