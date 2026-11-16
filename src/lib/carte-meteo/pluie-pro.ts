import type { ThemeInfo } from './cartes-info';
import type { ZoneTemperature } from './zones-fourchettes';

export const PALETTE_PLUIE_PRO = ['#FFE58C', '#FFB56B', '#ED6666', '#A879C5'] as const;
export const POLICE_PLUIE_PRO = "'Montserrat Meteo', Montserrat, Arial, sans-serif";
export const estPluiePro = (theme: Pick<ThemeInfo, 'id' | 'unite' | 'texteValeur'>) =>
  /^(risque-)?pluie(?:-|$)/.test(theme.id) && theme.unite === 'mm' && !theme.texteValeur;

/** Bornes issues des données, sans élargissement artificiel pour une valeur unique. */
export function plagePluie(min: number, max: number): string {
  const nombre = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${nombre(min)} à ${nombre(max)} mm`;
}

/**
 * Habillage uniquement : conserve les membres, les centres et les valeurs locales des zones d'origine.
 * Les trois seuils supérieurs du thème restent distincts ; ses paliers inférieurs partagent le jaune.
 * Aucune limite météo nouvelle : notamment 10 / 30 / 60 / 100 mm pour les alertes pluie.
 * La couleur indique le maximum de la zone, y compris son éventuel cumul local.
 */
export function habillerPluiePro(theme: Pick<ThemeInfo, 'paliers'>, origine: ZoneTemperature[], valeurs: Record<string, number>) {
  const seuils = [...new Set(theme.paliers.filter((p) => !p.neutre && Number.isFinite(p.min)).map((p) => p.min))].sort((a, b) => a - b);
  const bornes = seuils.length > 4 ? [seuils[0], ...seuils.slice(-3)] : seuils;
  const niveau = (max: number) => Math.max(0, bornes.findLastIndex((min) => max >= min));
  const zones = origine.map((zone) => {
    const donnees = zone.departements.filter((dep) => dep !== zone.local?.departement).map((dep) => valeurs[dep]).filter(Number.isFinite);
    const min = donnees.length ? Math.min(...donnees) : zone.min;
    const max = donnees.length ? Math.max(...donnees) : zone.max;
    const local = zone.local ? { ...zone.local, valeur: valeurs[zone.local.departement] ?? zone.local.valeur } : undefined;
    return { ...zone, min, max, local, couleur: PALETTE_PLUIE_PRO[niveau(Math.max(max, local?.valeur ?? max))], couleurEtiquette: '#2468AD' };
  });
  const maximum = Math.max(0, ...zones.map((z) => Math.max(z.max, z.local?.valeur ?? z.max)));
  const legende = bornes.map((min, i) => ({
    couleur: PALETTE_PLUIE_PRO[i],
    // Dernier intervalle fermé au maximum des données ; aucun plafond fictif.
    texte: i + 1 < bornes.length
      ? `${min.toLocaleString('fr-FR')} à < ${bornes[i + 1].toLocaleString('fr-FR')} mm`
      : maximum >= min ? plagePluie(min, maximum) : 'Non atteint',
  }));
  return { zones, legende };
}
