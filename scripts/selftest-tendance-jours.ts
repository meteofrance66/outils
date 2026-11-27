import assert from 'node:assert/strict';
import type { PointCarte } from '../src/lib/carte-meteo/previsions-modeles';
import { agregerTendance, dureeMaxPermise, joursDeLaTendance, libellePeriode, pictoDominant, type JourTendance } from '../src/lib/carte-meteo/tendance-jours';

/** Point minimal : seuls les champs lus par la tendance comptent. */
const point = (code: string, v: Partial<PointCarte>): PointCarte => ({ code, nom: code, mini: null, maxi: null, ...v }) as PointCarte;

// --- Durée permise par l'échéance du modèle ------------------------------------------------------------------------------
assert.equal(dureeMaxPermise(4, 1, 15), 4); // demain + 4 jours : le CEP suffit
assert.equal(dureeMaxPermise(4, 1, 1), 1); // AROME ne va que jusqu'à demain
assert.equal(dureeMaxPermise(4, 1, 3), 2); // ARPEGE (J+3) : demain, après-demain... mais pas 4 jours
assert.equal(dureeMaxPermise(2, 0, 1), 2); // aujourd'hui et demain
assert.equal(dureeMaxPermise(2, 1, 1), 1);
assert.equal(dureeMaxPermise(1, 5, 15), 1);

// --- Jours et libellé de la période --------------------------------------------------------------------------------------
assert.deepEqual(joursDeLaTendance('2026-11-28', 2), ['2026-11-28', '2026-11-29']);
assert.deepEqual(joursDeLaTendance('2026-11-29', 4), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
assert.equal(libellePeriode('2026-11-28', '2026-11-29'), 'DU SAMEDI 28 AU DIMANCHE 29 NOVEMBRE 2026');
assert.equal(libellePeriode('2026-11-29', '2026-12-02'), 'DU DIMANCHE 29 NOVEMBRE AU MERCREDI 2 DÉCEMBRE 2026');
assert.equal(libellePeriode('2026-12-30', '2027-01-02'), 'DU MERCREDI 30 DÉCEMBRE 2026 AU SAMEDI 2 JANVIER 2027');

// --- Picto dominant ------------------------------------------------------------------------------------------------------
const soleil: JourTendance = { codeJournee: null, nuagesJournee: 5, pluieJournee: 0, maxi: 15 };
const pluie: JourTendance = { codeJournee: null, nuagesJournee: 90, pluieJournee: 8, maxi: 11 };
const nuageux: JourTendance = { codeJournee: null, nuagesJournee: 70, pluieJournee: 0, maxi: 12 };
const pictoDe = (j: JourTendance) => ((j.pluieJournee ?? 0) > 0 ? 'pluie' : (j.nuagesJournee ?? 0) > 50 ? 'nuageux' : 'soleil');
assert.equal(pictoDominant([soleil, soleil, pluie, pluie], pictoDe), 'pluie', 'égalité : la pluie l\'emporte sur le soleil, même en second');
assert.equal(pictoDominant([pluie, soleil], pictoDe), 'pluie', 'deux jours différents : le temps le plus chargé');
assert.equal(pictoDominant([soleil, pluie, soleil], pictoDe), 'soleil', 'le plus fréquent d\'abord');
assert.equal(pictoDominant([soleil, nuageux], pictoDe), 'nuageux', 'sans pluie : le ciel le plus couvert');

// --- Agrégation sur plusieurs jours --------------------------------------------------------------------------------------
const j1 = [
  point('11', { mini: 4, maxi: 12, rafaleApresMidi: 40, directionRafaleApresMidi: 270, ventApresMidi: 25, rafaleJournee: 45, directionRafaleJournee: 280, ventJournee: 30, codeJournee: 1, nuagesJournee: 10, pluieJournee: 0 }),
  point('66', { mini: 8, maxi: 18, rafaleApresMidi: 90, directionRafaleApresMidi: 300, ventApresMidi: 60, rafaleJournee: 90, directionRafaleJournee: 300, ventJournee: 60, nuagesJournee: 20, pluieJournee: 0 }),
  point('34', { mini: 6, maxi: 14 }),
];
const j2 = [
  point('11', { mini: 1, maxi: 16, rafaleApresMidi: 70, directionRafaleApresMidi: 330, ventApresMidi: 45, rafaleJournee: 40, directionRafaleJournee: 20, ventJournee: 28, nuagesJournee: 80, pluieJournee: 6 }),
  point('66', { mini: 9, maxi: 15, rafaleApresMidi: 30, rafaleJournee: 50, nuagesJournee: 50, pluieJournee: 0 }),
  // 34 n'a pas de prévision le second jour : retiré de la tendance.
];
assert.equal(agregerTendance([j1]), j1, 'un seul jour : rendu tel quel');
const t = agregerTendance([j1, j2]);
assert.deepEqual(t.map((p) => p.code), ['11', '66'], 'le département absent d\'un jour est retiré');
const aude = t[0];
assert.equal(aude.maxi, 16, 'maxi le plus haut de la période');
assert.equal(aude.mini, 1, 'mini le plus bas de la période');
assert.equal(aude.rafaleApresMidi, 70, 'rafale de l\'après-midi la plus forte, avec sa direction et son vent');
assert.equal(aude.directionRafaleApresMidi, 330);
assert.equal(aude.ventApresMidi, 45);
assert.equal(aude.rafaleJournee, 45, 'la rafale de la journée peut venir d\'un autre jour');
assert.equal(aude.directionRafaleJournee, 280);
assert.equal(aude.tendanceJours?.length, 2);
assert.equal(aude.tendanceJours?.[1].pluieJournee, 6);
const pyrenees = t[1];
assert.equal(pyrenees.maxi, 18);
assert.equal(pyrenees.mini, 8);
assert.equal(pyrenees.rafaleApresMidi, 90);
// Un mini inconnu un jour (série qui ne couvre pas le début de la journée) n'efface pas celui des autres.
const sansMini = agregerTendance([[point('11', { mini: null, maxi: 10 })], [point('11', { mini: 3, maxi: 9 })]]);
assert.equal(sansMini[0].mini, 3);
assert.equal(sansMini[0].maxi, 10);
const aucun = agregerTendance([[point('11', { mini: null, maxi: null })], [point('11', { mini: null, maxi: null })]]);
assert.equal(aucun[0].mini, null);
assert.equal(aucun[0].maxi, null);

console.log('selftest tendance-jours : OK');
