import type { Metadata } from 'next';
import { Suspense } from 'react';
import CarteMeteo, { type DonneesCarte } from '@/components/carte-meteo/CarteMeteo';
import PlanchesJours from '@/components/carte-meteo/PlanchesJours';
import { aujourdhuiParis, ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { versPointJour, type PointJour } from '@/lib/carte-meteo/planches-jours';
import { chargerPrevisionsCarte, chargerPrevisionsCarteJours } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les prévisions elles-mêmes sont mises en cache 30 min.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carte météo France du jour — températures et rafales',
  description:
    "Carte de France des températures de l'après-midi et des rafales de vent (modèles AROME, Harmonie, CEP ou GFS), par région ou département, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/' },
};

/** Au premier chargement après un redémarrage, les 96 départements sont lus depuis GitHub : on n'attend pas plus de 9 s, le navigateur prend le relais. */
const avecDelai = <T,>(promesse: Promise<T>, ms: number) =>
  Promise.race([promesse, new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé')), ms))]);

/** Jours chargés pour la planche : aujourd'hui à J+8 (premier jour au choix jusqu'à J4, puis 4 jours ; week-end compris). */
const JOURS_PLANCHE = 9;

/**
 * Une carte de France par jour dans un seul JPG (2 ou 4 jours, à partir de demain) : modèle CEP, le seul à couvrir 4 jours après demain.
 * Chargée à part (Suspense) : la première lecture des fichiers du modèle peut prendre du temps et ne doit pas retarder les cartes du dessus.
 */
async function PlancheDemain({ aujourdhui }: { aujourdhui: string }) {
  let jours: Record<string, PointJour[] | null> | null = null;
  try {
    const dates = Array.from({ length: JOURS_PLANCHE }, (_, k) => ajouterJours(aujourdhui, k));
    const brut = await chargerPrevisionsCarteJours('cep', dates, false);
    jours = Object.fromEntries(dates.map((d) => [d, brut[d] ? brut[d]!.map(versPointJour).filter((x): x is PointJour => x != null) : null]));
  } catch (e) {
    console.error('Carte météo : planche de 2 et 4 jours indisponible', e);
  }
  if (!jours) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-border bg-surface p-4 text-danger">
        Prévisions du CEP momentanément indisponibles : la planche de 2 et 4 jours reviendra dans quelques minutes. Réessayez en rechargeant la page.
      </p>
    );
  }
  return (
    <PlanchesJours
      aujourdhui={aujourdhui}
      modele={{ id: 'cep', libelle: 'CEP', fournisseur: 'ECMWF' }}
      jours={jours}
      fondCarteMeteo
      departInitial={1}
      durees={[2, 4]}
      periodeInitiale="apres-midi-mini-maxi"
    />
  );
}

export default async function PageCarteMeteo() {
  const aujourdhui = aujourdhuiParis();
  const demain = ajouterJours(aujourdhui, 1);

  // Si un chargement échoue ici, le composant retente côté navigateur.
  const [france, franceDemain] = await Promise.allSettled([
    avecDelai(chargerPrevisionsCarte('arome', aujourdhui), 9000),
    avecDelai(chargerPrevisionsCarte('arome', demain), 9000),
  ]);
  if (france.status === 'rejected') console.error('Carte météo : France du jour indisponible', france.reason);
  if (franceDemain.status === 'rejected') console.error('Carte météo : France de demain indisponible', franceDemain.reason);

  const initial: DonneesCarte | null =
    france.status === 'fulfilled' ? { modele: 'arome', dateISO: aujourdhui, points: france.value } : null;
  const initialDemain: DonneesCarte | null =
    franceDemain.status === 'fulfilled' ? { modele: 'arome', dateISO: demain, points: franceDemain.value } : null;

  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France du jour</h1>
      <p className="mt-2 text-muted sm:whitespace-nowrap">
        Températures de l&apos;après-midi et rafales de vent, par région ou département. Pictos et valeurs modifiables avant export en JPG.
      </p>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initial} reglages={{ jeuPictos: 'alertes-pro' }} />
      </div>

      <h2 className="mt-12 text-2xl font-extrabold">France : demain après-midi, mini et maxi</h2>
      <p className="mt-2 text-muted">
        Option « Tendance » : la même carte sur 2 ou 4 jours à partir de demain, avec le mini le plus bas, le maxi le plus haut et le temps qui domine (modèle CEP).
        Pour une image avec une carte de France par jour, utilisez la planche juste dessous.
      </p>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initialDemain} reglages={{ jour: 1, miniMaxi: true, jeuPictos: 'alertes-pro', tailleIcones: 140 }} />
      </div>

      <div className="mt-12">
        <Suspense fallback={<p className="text-muted">Chargement de la planche (une carte de France par jour)…</p>}>
          <PlancheDemain aujourdhui={aujourdhui} />
        </Suspense>
      </div>
    </>
  );
}
