'use client';

import { useEffect, useMemo, useState } from 'react';
import { versMonde } from '@/lib/carte-meteo/projection-france';
import { SIGMA_FRANCE_KM, type GeoChamps } from '@/lib/carte-meteo/planche-champs';
import { BOITE_FRANCE, FICHIERS_CONTOURS, useContours } from './CarteMeteo';

/** Villes repères d'un département (point et nom sur la carte). */
export interface VilleRepere {
  nom: string;
  lat: number;
  lon: number;
}

/** Villes repères choisies à la main (carte des Pyrénées-Orientales). */
export const REPERES_66: VilleRepere[] = [
  { nom: 'Perpignan', lat: 42.699, lon: 2.895 },
  { nom: 'Prades', lat: 42.617, lon: 2.422 },
  { nom: 'Céret', lat: 42.486, lon: 2.748 },
  { nom: 'Font-Romeu-Odeillo-Via', lat: 42.505, lon: 2.039 },
  { nom: 'Argelès-sur-Mer', lat: 42.546, lon: 3.023 },
  { nom: 'Saint-Paul-de-Fenouillet', lat: 42.809, lon: 2.503 },
];

/** Rayon du lissage pour un département (km) : ses villes sont bien plus proches que les chefs-lieux. */
const SIGMA_DEPARTEMENT_KM = 9;

/**
 * Fond de carte des « cartes en couleurs » : la France (limites des départements) ou un département avec ses voisins en gris.
 * `departement` absent : France ; `actif` faux : rien n'est chargé.
 */
export function useGeoChamps(departement: string | undefined, reperes: VilleRepere[] | undefined, actif = true): GeoChamps | null {
  const contoursBruts = useContours(actif ? FICHIERS_CONTOURS.departements : null);
  // Département : pays voisins (terres d'Europe, Natural Earth).
  const [europe, setEurope] = useState<number[][] | null>(null);
  useEffect(() => {
    if (!actif || !departement) return;
    fetch('/geo/europe.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][] }>) : Promise.reject()))
      .then((j) => setEurope(j.terres))
      .catch(() => setEurope([]));
  }, [actif, departement]);
  const cleReperes = (reperes ?? []).map((v) => v.nom).join('|');
  return useMemo<GeoChamps | null>(() => {
    if (contoursBruts.length === 0) return null;
    if (!departement) {
      const departements = contoursBruts.map((c) => new Path2D(c.d));
      const terres = new Path2D();
      for (const d of departements) terres.addPath(d);
      return { departements, terres, boite: BOITE_FRANCE, sigmaKm: SIGMA_FRANCE_KM };
    }
    const c = contoursBruts.find((x) => x.code === departement);
    if (!c || europe === null) return null;
    const etranger = new Path2D();
    for (const anneau of europe) {
      for (let k = 0; k < anneau.length; k += 2) {
        const { x, y } = versMonde(anneau[k + 1], anneau[k]);
        if (k === 0) etranger.moveTo(x, y);
        else etranger.lineTo(x, y);
      }
      etranger.closePath();
    }
    const voisins = [etranger, ...contoursBruts.filter((x) => x.code !== departement).map((x) => new Path2D(x.d))];
    return { departements: [], terres: new Path2D(c.d), boite: c.boite, voisins, sigmaKm: SIGMA_DEPARTEMENT_KM, villes: reperes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contoursBruts, departement, europe, cleReperes]);
}
