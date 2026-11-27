/**
 * Jeux d'icônes de l'écran d'accroche (« QUEL TEMPS / CHEZ NOUS ? ») : quinze jeux, chacun avec deux icônes animées (une au-dessus du texte,
 * une dessous) et une ambiance plein écran. Voir `commun.ts` pour le cadre (autocollant, composition) et `set-*.ts` pour les jeux.
 */
import type { JeuAccroche } from './commun';
import { jeu as soleil } from './set-soleil';
import { jeu as orage } from './set-orage';
import { jeu as pluie } from './set-pluie';
import { jeu as neige } from './set-neige';
import { jeu as vent } from './set-vent';
import { jeu as chaleur } from './set-chaleur';
import { jeu as froid } from './set-froid';
import { jeu as nuit } from './set-nuit';
import { jeu as arcenciel } from './set-arcenciel';
import { jeu as mer } from './set-mer';
import { jeu as couvert } from './set-couvert';
import { jeu as alerte } from './set-alerte';
import { jeu as tempete } from './set-tempete';
import { jeu as radar } from './set-radar';
import { jeu as matin } from './set-matin';

export { dessinerAmbianceAccroche, dessinerIconesAccroche } from './commun';
export type { JeuAccroche } from './commun';

/** Les jeux, dans l'ordre du menu. */
export const JEUX_ACCROCHE: readonly JeuAccroche[] = [soleil, orage, pluie, neige, vent, chaleur, froid, nuit, arcenciel, mer, couvert, alerte, tempete, radar, matin];

/** Le jeu d'identifiant `id` ; le premier si l'identifiant est inconnu ou absent (anciens réglages mémorisés). */
export const jeuAccroche = (id?: string | null): JeuAccroche => JEUX_ACCROCHE.find((j) => j.id === id) ?? JEUX_ACCROCHE[0];
