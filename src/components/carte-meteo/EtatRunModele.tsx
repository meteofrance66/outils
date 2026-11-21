'use client';

import { useEffect, useState } from 'react';
import { DEPOT_MODELE, lancePar, octets } from '@/lib/carte-meteo/etat-modeles';
import type { ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';

type Taille = { dernier_run_octets: number | null; depot_octets: number | null };

/** Ligne d'état du modèle choisi : où il est lancé, taille du dernier run et du dépôt. */
export default function EtatRunModele({ modele }: { modele: ModeleMeteo }) {
  const [tailles, setTailles] = useState<Record<string, Taille>>({});

  useEffect(() => {
    let annule = false;
    fetch('/api/carte-meteo/etat-modeles')
      .then((r) => r.json())
      .then((d: { modeles?: Record<string, Taille> }) => {
        if (!annule) setTailles(d.modeles ?? {});
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  if (modele === 'moyenne') return null;
  const depot = DEPOT_MODELE[modele];
  const taille = tailles[depot];

  return (
    <p className="w-full text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
      Lancé sur {lancePar(modele)}
      {taille && (
        <>
          {' '}· Dernier run : <b>{octets(taille.dernier_run_octets)}</b>
          {taille.depot_octets != null && (
            <>
              {' '}· Dépôt : <b>{octets(taille.depot_octets)}</b>
            </>
          )}
        </>
      )}
    </p>
  );
}
