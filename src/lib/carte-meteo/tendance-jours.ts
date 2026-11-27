import { ajouterJours, type PointCarte } from './previsions-modeles';

/** Durées (jours) de la carte « tendance » : un jour seul (la carte habituelle), 2 jours ou 4 jours à partir du jour choisi. */
export const DUREES_TENDANCE_CARTE = [1, 2, 4] as const;
export type DureeTendanceCarte = (typeof DUREES_TENDANCE_CARTE)[number];

export const estDureeTendance = (n: unknown): n is DureeTendanceCarte => DUREES_TENDANCE_CARTE.some((d) => d === n);

/** La plus longue durée permise qui tient dans l'échéance du modèle (`echeanceMax` : dernier jour, en jours à partir d'aujourd'hui) pour une carte qui commence à `jour`. */
export function dureeMaxPermise(duree: DureeTendanceCarte, jour: number, echeanceMax: number): DureeTendanceCarte {
  const places = echeanceMax - jour + 1;
  return [...DUREES_TENDANCE_CARTE].reverse().find((d) => d <= duree && d <= places) ?? 1;
}

/** Les jours de la période : du premier jour (`debutISO`), `duree` dates de suite. */
export const joursDeLaTendance = (debutISO: string, duree: number): string[] => Array.from({ length: duree }, (_, k) => ajouterJours(debutISO, k));

/** « DU SAMEDI 28 AU DIMANCHE 29 NOVEMBRE 2026 » (le mois et l'année ne sont répétés que s'ils changent). */
export function libellePeriode(debutISO: string, finISO: string): string {
  const parties = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('fr-FR', { ...o, timeZone: 'UTC' });
    return { jour: `${f({ weekday: 'long' })} ${f({ day: 'numeric' })}`, mois: f({ month: 'long' }), annee: f({ year: 'numeric' }) };
  };
  const a = parties(debutISO);
  const b = parties(finISO);
  const debut = a.annee !== b.annee ? `${a.jour} ${a.mois} ${a.annee}` : a.mois !== b.mois ? `${a.jour} ${a.mois}` : a.jour;
  return `DU ${debut} AU ${b.jour} ${b.mois} ${b.annee}`.toUpperCase();
}

export type JourTendance = NonNullable<PointCarte['tendanceJours']>[number];

/** Ce qu'il faut garder de chaque jour d'un département pour choisir le picto de la période. */
const jourDe = (p: PointCarte): JourTendance => ({ codeJournee: p.codeJournee, nuagesJournee: p.nuagesJournee, pluieJournee: p.pluieJournee, maxi: p.maxi, voileJournee: p.voileJournee });

/**
 * Picto qui domine sur la période : le plus fréquent parmi ceux de chaque jour (`pictoDuJour`). À égalité (fréquent avec 2 jours), le temps le plus
 * chargé l'emporte (plus de pluie, puis plus de nuages), pour qu'un jour de pluie ne soit pas effacé par un jour de soleil ; sinon le premier jour.
 */
export function pictoDominant<T>(jours: JourTendance[], pictoDuJour: (jour: JourTendance) => T): T {
  const comptes = new Map<T, { n: number; charge: number }>();
  for (const j of jours) {
    const picto = pictoDuJour(j);
    const c = comptes.get(picto) ?? { n: 0, charge: 0 };
    c.n++;
    c.charge += (j.pluieJournee ?? 0) * 100 + (j.nuagesJournee ?? 0);
    comptes.set(picto, c);
  }
  return [...comptes.entries()].sort((a, b) => b[1].n - a[1].n || b[1].charge - a[1].charge)[0][0];
}

/** Le jour dont `champ` est le plus élevé (le premier à égalité), ou undefined si aucun n'en a. */
function jourLePlusFort(jours: PointCarte[], champ: 'rafaleApresMidi' | 'rafaleJournee'): PointCarte | undefined {
  let meilleur: PointCarte | undefined;
  for (const p of jours) if (p[champ] != null && (meilleur == null || p[champ]! > meilleur[champ]!)) meilleur = p;
  return meilleur;
}

/**
 * Tendance sur plusieurs jours : `parJour` donne, pour chaque jour de la période dans l'ordre, les points des départements.
 * Un département garde ses valeurs du premier jour, avec le maxi le plus haut et le mini le plus bas de la période, la rafale la plus forte
 * (et sa direction) et la liste des jours pour le picto dominant. Un département absent d'un des jours est retiré : ses valeurs ne couvriraient
 * pas toute la période. Avec un seul jour, la liste est rendue telle quelle.
 */
export function agregerTendance(parJour: PointCarte[][]): PointCarte[] {
  if (parJour.length <= 1) return parJour[0] ?? [];
  const parCode = parJour.map((liste) => new Map(liste.map((p) => [p.code, p])));
  const points: PointCarte[] = [];
  for (const base of parJour[0]) {
    const jours = parCode.map((m) => m.get(base.code));
    if (jours.some((j) => j == null)) continue;
    const j = jours as PointCarte[];
    const maxis = j.map((p) => p.maxi).filter((v): v is number => v != null);
    const minis = j.map((p) => p.mini).filter((v): v is number => v != null);
    const rafaleAM = jourLePlusFort(j, 'rafaleApresMidi');
    const rafaleJ = jourLePlusFort(j, 'rafaleJournee');
    points.push({
      ...base,
      maxi: maxis.length ? Math.max(...maxis) : null,
      mini: minis.length ? Math.min(...minis) : null,
      ...(rafaleAM && { rafaleApresMidi: rafaleAM.rafaleApresMidi, directionRafaleApresMidi: rafaleAM.directionRafaleApresMidi, ventApresMidi: rafaleAM.ventApresMidi }),
      ...(rafaleJ && { rafaleJournee: rafaleJ.rafaleJournee, directionRafaleJournee: rafaleJ.directionRafaleJournee, ventJournee: rafaleJ.ventJournee }),
      tendanceJours: j.map(jourDe),
    });
  }
  return points;
}
