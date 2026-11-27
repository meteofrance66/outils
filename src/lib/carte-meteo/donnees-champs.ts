/**
 * Prévisions des « cartes en couleurs » lues côté navigateur : France entière (96 départements) ou un département (ses villes et ses
 * communes de montagne), jour par jour, au format de la planche (`PointChampJour`).
 */
import { COORDS_DEPARTEMENTS } from './departements-coords';
import type { PointChampJour } from './planche-champs';
import type { PointCarte } from './previsions-modeles';

const versChamp = (p: PointCarte): PointChampJour | null => {
  const lat = p.lat ?? COORDS_DEPARTEMENTS[p.code]?.lat;
  const lon = p.lon ?? COORDS_DEPARTEMENTS[p.code]?.lon;
  return lat == null || lon == null ? null : { code: p.code, nom: p.ville ?? p.nom, lat, lon, tx: p.maxi, tn: p.mini, pluie: p.pluieJournee, rafale: p.rafaleJournee };
};

async function lire(url: string, signal?: AbortSignal): Promise<PointChampJour[]> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
  return (((await r.json()) as { points?: PointCarte[] }).points ?? []).map(versChamp).filter((x): x is PointChampJour => x != null);
}

/** Un jour pour la France (`dep` null) ou un département : null si rien n'est disponible. */
export async function chargerJourChamps(modele: string, date: string, dep: string | null, signal?: AbortSignal): Promise<PointChampJour[] | null> {
  const base = `/api/carte-meteo/previsions/?modele=${modele}&date=${date}`;
  if (!dep) {
    const points = await lire(base, signal);
    return points.length > 0 ? points : null;
  }
  const [villes, montagne] = await Promise.all([lire(`${base}&dep=${dep}`, signal), lire(`${base}&dep=${dep}&montagne=1&alt=1000`, signal).catch(() => [] as PointChampJour[])]);
  if (villes.length === 0) return null;
  // Une commune de montagne à moins de 3 km d'une ville est écartée (deux valeurs différentes au même endroit feraient une tache).
  const loin = montagne.filter((m) => villes.every((v) => Math.hypot((v.lat - m.lat) * 111, (v.lon - m.lon) * 82) > 3));
  return [...villes, ...loin];
}

/** Plusieurs jours : un jour sans prévision vaut null (la carte l'écrit). */
export async function chargerJoursChamps(modele: string, dates: string[], dep: string | null, signal?: AbortSignal): Promise<Record<string, PointChampJour[] | null>> {
  const r = await Promise.all(dates.map(async (d) => [d, await chargerJourChamps(modele, d, dep, signal).catch((e: Error) => (e.name === 'AbortError' ? Promise.reject(e) : null))] as const));
  return Object.fromEntries(r);
}
