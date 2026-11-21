import type { ModeleSource } from './previsions-modeles';

/**
 * Dépôt (nom sur meteofrance66, en minuscules) de chaque modèle : clé de `tailles.json` (voir /api/carte-meteo/etat-modeles).
 * Même correspondance que l'état des runs de l'application.
 */
export const DEPOT_MODELE: Record<ModeleSource, string> = {
  arome: 'arome-meteofrance',
  harmonie: 'harmonie',
  harmonie2km: 'harmonie-dmi-2km',
  arpege: 'arpege-meteo-france',
  cep: 'ecmwf',
  gfs: 'gfs',
  aromeifs: 'arome-ifs-2.5-km',
  arpege025: 'arpege-0.25',
  icon: 'icon-global-13-km',
  ukmo: 'ukmo-global-10-km',
  aifs: 'aifs',
  iconeu: 'icon-eu-7-km',
  wrf: 'wrf-meteogalicia-12-km',
};

/** Dépôts dont le run est lancé par GitHub Actions ; les autres tournent sur le VPS. */
const LANCES_PAR_GITHUB = new Set(['gfs', 'ecmwf', 'harmonie']);

export const lancePar = (modele: ModeleSource): 'GitHub' | 'VPS' => (LANCES_PAR_GITHUB.has(DEPOT_MODELE[modele]) ? 'GitHub' : 'VPS');

/** « 1,4 Go », « 310 Mo » */
export function octets(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} Go`;
  return `${Math.max(1, Math.round(n / 1e6))} Mo`;
}
