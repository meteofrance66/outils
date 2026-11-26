import { useEffect, useRef, useState } from 'react';

/** Part de la hauteur d'une image de picto laissée transparente en bas (0 à 1), par fichier : mesurée une fois, gardée en mémoire. */
const BAS_TRANSPARENT = new Map<string, number>();
const EN_COURS = new Set<string>();

async function mesurer(src: string): Promise<number> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const taille = 100;
  const toile = document.createElement('canvas');
  toile.width = taille;
  toile.height = taille;
  const g = toile.getContext('2d', { willReadFrequently: true });
  if (!g) return 0;
  g.drawImage(img, 0, 0, taille, taille);
  const pixels = g.getImageData(0, 0, taille, taille).data;
  for (let y = taille - 1; y >= 0; y--) {
    for (let x = 0; x < taille; x++) if (pixels[(y * taille + x) * 4 + 3] > 20) return (taille - 1 - y) / taille;
  }
  return 0;
}

/**
 * Espace transparent sous chaque picto : la température se rapproche du dessin lui-même, pas du bord de son image
 * (selon le picto, 0 à 35 % de l'image est vide en bas). Renvoie une fonction : fichier → part vide (0 tant que la mesure n'est pas faite).
 */
export function useBasTransparentPictos(sources: string[]): (src: string) => number {
  const [, setVersion] = useState(0);
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);
  const cle = [...new Set(sources)].sort().join('|');
  useEffect(() => {
    for (const src of cle.split('|')) {
      if (!src || BAS_TRANSPARENT.has(src) || EN_COURS.has(src)) continue;
      EN_COURS.add(src);
      mesurer(src)
        .catch(() => 0)
        .then((part) => {
          BAS_TRANSPARENT.set(src, part);
          EN_COURS.delete(src);
          if (monte.current) setVersion((v) => v + 1);
        });
    }
  }, [cle]);
  return (src) => BAS_TRANSPARENT.get(src) ?? 0;
}
