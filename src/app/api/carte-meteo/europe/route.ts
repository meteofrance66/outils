import { gunzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { VILLES_EUROPE, type GrilleEurope } from '@/lib/carte-meteo/isobares';
import { calculerFronts } from '@/lib/carte-meteo/fronts';

export const dynamic = 'force-dynamic';

/**
 * Pression au niveau de la mer sur l'Europe (carte des isobares des cartes infos), et pour le style « pluie et
 * températures » (?complet=1) la pluie de la période et la température à 2 m des grandes villes.
 *   - CEP : grilles « CEV1 » (sondes) des cartes Europe du pipeline CEP (ECMWF IFS 0,25°, Mercator -45° à 41°, 28° à 61° N,
 *     toutes les 3 h puis 6 h jusqu'à +240 h), dépôt meteofrance66/ECMWF, branche data (index : maps-europe/index.json) ;
 *   - GFS : plus de grilles Europe publiées (le dépôt GFS ne contient que la France) : pas de choix GFS ici.
 *   GET /api/carte-meteo/europe/?modele=cep                  → passage et échéances disponibles
 *   GET /api/carte-meteo/europe/?modele=cep&h=24[&complet=1] → grilles (× 10, régulières en latitude et longitude)
 */
const SOURCE_CEP = 'https://raw.githubusercontent.com/meteofrance66/ECMWF/data';
const INDEX_TTL_MS = 10 * 60_000;

interface Echeance {
  h: number;
  valide: string;
  /** Fichier de l'échéance dans la source : grille de pression (CEV1). */
  fichier: string;
  /** Grilles de pluie (depuis l'échéance précédente) et de température. */
  pluie?: string;
  temperature?: string;
  /** Température, humidité et géopotentiel à 850 hPa (fronts). */
  t850?: string;
  hr850?: string;
  z850?: string;
  /** Durée (h) de la période de pluie qui se termine à l'échéance. */
  periode?: number;
}
interface Index {
  run: string;
  genere: string;
  echeances: Echeance[];
  bornes?: { south: number; west: number; north: number; east: number };
}

/** Index du passage CEP, relu toutes les 10 minutes. */
let indexCourant: { lu: number; donnees: Index } | null = null;
/** Grilles déjà extraites (clé : passage, échéance, style), les plus anciennes retirées au-delà de 40. */
const grilles = new Map<string, GrilleEurope>();

async function lire(url: string): Promise<Response> {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  if (!r.ok) throw new Error(`Carte Europe : ${r.status} sur ${url}`);
  return r;
}

async function indexCep(): Promise<Index> {
  if (indexCourant && Date.now() - indexCourant.lu < INDEX_TTL_MS) return indexCourant.donnees;
  const j = (await (await lire(`${SOURCE_CEP}/maps-europe/index.json`)).json()) as {
    run_time: string;
    generated_at: string;
    bounds: Index['bornes'];
    steps: { lead_hour: number; valid_time: string; probes?: Record<string, string> }[];
  };
  const etapes = j.steps.filter((s) => s.probes?.pression);
  const donnees: Index = {
    run: j.run_time,
    genere: j.generated_at,
    bornes: j.bounds,
    echeances: etapes.map((s, k) => ({
      h: s.lead_hour,
      valide: s.valid_time,
      fichier: s.probes!.pression,
      pluie: s.probes!.pluie_1h,
      temperature: s.probes!.temperature,
      t850: s.probes!.temperature_850,
      hr850: s.probes!.humidite_850,
      z850: s.probes!.geopotentiel_850,
      periode: k > 0 ? s.lead_hour - etapes[k - 1].lead_hour : undefined,
    })),
  };
  indexCourant = { lu: Date.now(), donnees };
  return donnees;
}

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const cheminSur = (f?: string) => f != null && /^[\w./-]+$/.test(f) && !f.includes('..');

/**
 * Grille CEP « CEV1 » (gzip) : en-tête <4sHHff (« CEV1 », largeur, hauteur, minimum, maximum), puis largeur × hauteur entiers
 * 16 bits (ligne 0 au nord, Mercator), 65535 = hors domaine. Renvoie la valeur interpolée en un point (lon, lat).
 */
function lecteurCep(brut: Buffer, bornes: NonNullable<Index['bornes']>) {
  // Fichier .gz servi tel quel (ou déjà décompressé si le serveur l'a envoyé avec Content-Encoding : gzip).
  const b = brut[0] === 0x1f && brut[1] === 0x8b ? gunzipSync(brut) : brut;
  if (b.toString('latin1', 0, 4) !== 'CEV1') throw new Error('Grille CEP inattendue');
  const w = b.readUInt16LE(4);
  const h = b.readUInt16LE(6);
  const min = b.readFloatLE(8);
  const max = b.readFloatLE(12);
  const brute = (r: number, c: number) => {
    const q = b.readUInt16LE(16 + 2 * (r * w + c));
    return q === 65535 ? null : min + (q / 65534) * (max - min);
  };
  const yN = merc(bornes.north);
  const yS = merc(bornes.south);
  return (lon: number, lat: number): number | null => {
    const fr = ((yN - merc(lat)) / (yN - yS)) * (h - 1);
    const fc = ((lon - bornes.west) / (bornes.east - bornes.west)) * (w - 1);
    if (fr < 0 || fc < 0 || fr > h - 1 || fc > w - 1) return null;
    const r0 = Math.min(h - 2, Math.floor(fr));
    const c0 = Math.min(w - 2, Math.floor(fc));
    const dr = fr - r0;
    const dc = fc - c0;
    const q = [brute(r0, c0), brute(r0, c0 + 1), brute(r0 + 1, c0), brute(r0 + 1, c0 + 1)];
    if (q.some((x) => x == null)) return null;
    const [a, bb, c, d] = q as number[];
    return (a * (1 - dc) + bb * dc) * (1 - dr) + (c * (1 - dc) + d * dc) * dr;
  };
}

/** Champ échantillonné sur la grille régulière de la réponse (× 10, entiers). */
function echantillonner(lecteur: (lon: number, lat: number) => number | null, lat0: number, lon0: number, pas: number, nLat: number, nLon: number) {
  const sortie: (number | null)[] = [];
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const v = lecteur(lon0 + j * pas, lat0 + i * pas);
      sortie.push(v == null ? null : Math.round(v * 10));
    }
  return sortie;
}

const temperaturesVilles = (lecteur: (lon: number, lat: number) => number | null) =>
  VILLES_EUROPE.flatMap(([nom, lat, lon]) => {
    const t = lecteur(lon, lat);
    return t == null ? [] : [{ nom, lat, lon, t: Math.round(t) }];
  });

async function grilleCep(idx: Index, e: Echeance, complet: boolean, avecFronts: boolean): Promise<GrilleEurope> {
  const bornes = idx.bornes!;
  const charger = async (f: string) => lecteurCep(Buffer.from(await (await lire(`${SOURCE_CEP}/${f}`)).arrayBuffer()), bornes);
  const pas = 0.25;
  const nLat = Math.round((bornes.north - bornes.south) / pas) + 1;
  const nLon = Math.round((bornes.east - bornes.west) / pas) + 1;
  const frontsPossibles = avecFronts && cheminSur(e.t850) && cheminSur(e.hr850) && cheminSur(e.z850);
  const [pression, pluie, temperature, t850, hr850, z850] = await Promise.all([
    charger(e.fichier),
    complet && cheminSur(e.pluie) ? charger(e.pluie!) : null,
    complet && cheminSur(e.temperature) ? charger(e.temperature!) : null,
    frontsPossibles ? charger(e.t850!) : null,
    frontsPossibles ? charger(e.hr850!) : null,
    frontsPossibles ? charger(e.z850!) : null,
  ]);
  const fronts = t850 && hr850 && z850 ? calculerFronts(t850, hr850, z850, { sud: bornes.south, ouest: bornes.west, nord: bornes.north, est: bornes.east }, {}, pression) : undefined;
  return {
    run: idx.run,
    valide: e.valide,
    h: e.h,
    lat0: bornes.south,
    lon0: bornes.west,
    pas,
    nLat,
    nLon,
    p: echantillonner(pression, bornes.south, bornes.west, pas, nLat, nLon),
    ...(fronts ? { fronts } : {}),
    ...(complet
      ? {
          pluie: pluie ? echantillonner(pluie, bornes.south, bornes.west, pas, nLat, nLon) : undefined,
          periodePluie: e.periode,
          villes: temperature ? temperaturesVilles(temperature) : [],
          t: temperature ? echantillonner(temperature, bornes.south, bornes.west, pas, nLat, nLon) : undefined,
        }
      : {}),
  };
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-europe:${ip}`, 60, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const url = new URL(req.url);
  // Seul le CEP publie des grilles Europe : tout autre modèle est refusé clairement.
  if (url.searchParams.get('modele') === 'gfs') {
    return NextResponse.json({ erreur: 'Carte Europe : seul le modèle CEP est disponible.' }, { status: 404 });
  }
  const complet = url.searchParams.get('complet') === '1';
  // Fronts : CEP (champs à 850 hPa).
  const avecFronts = url.searchParams.get('fronts') === '1';
  try {
    const idx = await indexCep();
    const h = url.searchParams.get('h');
    if (h == null) {
      return NextResponse.json(
        { modele: 'cep', run: idx.run, genere: idx.genere, echeances: idx.echeances.map(({ h, valide }) => ({ h, valide })) },
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      );
    }
    const e = idx.echeances.find((x) => String(x.h) === h);
    if (!e || !cheminSur(e.fichier)) return NextResponse.json({ erreur: 'Échéance inconnue.' }, { status: 404 });

    const cle = `${idx.run}|${idx.genere}|${e.h}|${complet ? 'complet' : 'pression'}|${avecFronts ? 'fronts' : ''}`;
    let grille = grilles.get(cle);
    if (!grille) {
      grille = await grilleCep(idx, e, complet, avecFronts);
      grilles.set(cle, grille);
      if (grilles.size > 40) grilles.delete(grilles.keys().next().value!);
    }
    return NextResponse.json(grille, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (erreur) {
    console.error('Carte Europe cep', erreur);
    return NextResponse.json({ erreur: 'Données du modèle momentanément indisponibles.' }, { status: 503 });
  }
}
