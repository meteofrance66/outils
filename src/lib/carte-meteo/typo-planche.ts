import { useEffect, useState } from 'react';
import { POLICE_INTER, attendreInter } from './styles-tableau';

/** Typographie de la planche par jour : « standard » (celle du style choisi) ou « facebook » (Inter partout, lisible sur smartphone). */
export type TypoPlanche = 'standard' | 'facebook';
export const TYPOS_PLANCHE: { id: TypoPlanche; libelle: string }[] = [
  { id: 'standard', libelle: 'Standard' },
  { id: 'facebook', libelle: '👍 Facebook : Inter, lisible sur smartphone' },
];

/** Graisses d'Inter de la typographie « Facebook », par élément de la planche. */
export const GRAISSES_PLANCHE = {
  titre: 800,
  sousTitre: 700,
  jour: 700,
  maxi: 800,
  mini: 700,
  separateur: 500,
  geo: 600,
  source: 500,
  elaboration: 600,
  pastille: 800,
  libelle: 700,
  message: 600,
} as const;

export { POLICE_INTER };

/** Largeur (px) d'un texte en Inter, mesurée à 100 px de taille (la largeur est proportionnelle à la taille) ; estimation si la page n'est pas dans un navigateur. */
export function largeurTexteInter(texte: string, graisse: number, espacementEm = 0): number {
  if (typeof document === 'undefined') return texte.length * 66;
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-family:${POLICE_INTER};font-size:100px;font-weight:${graisse};font-optical-sizing:none;letter-spacing:${espacementEm}em;`;
  s.textContent = texte;
  document.body.appendChild(s);
  const w = s.getBoundingClientRect().width;
  s.remove();
  return w;
}

/**
 * Taille de police qui fait tenir tous les textes (chacun sur une ligne) dans `largeurDispo` : `tailleBase` si ça tient, sinon réduite,
 * sans descendre sous `plancher` × `tailleBase`. Les lettres ne sont jamais compressées : seule la taille change.
 */
export function tailleAjustee(textes: string[], graisse: number, tailleBase: number, largeurDispo: number, plancher = 0.6, espacementEm = 0): number {
  if (!(largeurDispo > 0)) return tailleBase;
  const plusLarge = Math.max(...textes.map((t) => largeurTexteInter(t, graisse, espacementEm)), 1);
  return Math.max(tailleBase * plancher, Math.min(tailleBase, (largeurDispo / plusLarge) * 100));
}

/** Vrai quand les graisses d'Inter sont chargées (les mesures de texte attendent ce moment) ; `actif` faux : rien n'est chargé. */
export function useInterPret(actif: boolean): boolean {
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    attendreInter().then(() => vivant && setPret(true));
    return () => {
      vivant = false;
    };
  }, [actif]);
  return actif && pret;
}

/** Contour blanc fin et net autour d'un texte : seize ombres sans flou sur un cercle (arrondi, sans pointes), de rayon proportionné à la taille. */
export function contourBlanc(taillePolice: number): string {
  const r = Math.min(2.4, Math.max(1.3, taillePolice * 0.032));
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    return `${(r * Math.cos(a)).toFixed(2)}px ${(r * Math.sin(a)).toFixed(2)}px 0 #fff`;
  }).join(', ');
}

/** Température arrondie, avec le vrai signe moins (« − ») plus lisible que le trait d'union devant des chiffres tabulaires. */
export const texteTemperature = (n: number) => String(Math.round(n)).replace('-', '−');
