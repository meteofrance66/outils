'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { chargerJoursChamps } from '@/lib/carte-meteo/donnees-champs';
import { THEMES_CHAMPS, dessinerPlancheChamps, jourLong, titreAuto, type PointChampJour, type ThemeChamp } from '@/lib/carte-meteo/planche-champs';
import { REPERES_66, useGeoChamps } from './useGeoChamps';

/** Formats de l'image (pixels). */
const FORMATS = [
  { id: 'tiktok', libelle: 'TikTok, Reels (9:16)', l: 1080, h: 1920 },
  { id: 'facebook', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];

const bouton = (actif: boolean) => `rounded-lg border px-3 py-1.5 text-sm ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;

/**
 * Planche « cartes en couleurs » : 2 ou 4 cartes (une par jour, dès demain par défaut), champ coloré, isolignes et étiquettes de
 * fourchette, pour les maxi, les mini, la pluie ou les rafales ; France entière (`jours`, lus côté serveur) ou un département
 * (`departement`, prévisions lues ici) ; export en JPG. La vidéo TikTok de ces cartes est sur la page vidéo.
 */
export default function PlancheChamps({ aujourdhui, jours: joursFrance, departement, modele, modeleApi = 'cep', joursMax = 9 }: { aujourdhui: string; jours?: Record<string, PointChampJour[] | null>; departement?: string; modele: string; modeleApi?: string; joursMax?: number }) {
  const [theme, setTheme] = useState<ThemeChamp>('tx');
  const [duree, setDuree] = useState<2 | 4>(4);
  const [depart, setDepart] = useState(1);
  const [formatId, setFormatId] = useState<FormatId>('tiktok');
  const [titre1, setTitre1] = useState('');
  const [titre2, setTitre2] = useState('');
  const [joursDep, setJoursDep] = useState<Record<string, PointChampJour[] | null>>({});
  const [chargement, setChargement] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = FORMATS.find((f) => f.id === formatId)!;
  const nomZone = departement ? (DEPARTEMENTS_FR[departement] ?? departement).toUpperCase() : 'FRANCE';

  const nbDates = departement ? joursMax : Object.keys(joursFrance ?? {}).length;
  const departMax = Math.max(1, nbDates - duree);
  const departEff = Math.min(depart, departMax);
  const isos = useMemo(() => Array.from({ length: duree }, (_, k) => ajouterJours(aujourdhui, departEff + k)), [aujourdhui, departEff, duree]);
  const auto = titreAuto(theme, isos, departement ? nomZone : undefined);
  const titre: [string, string] = [titre1.trim() || auto[0], titre2.trim() || auto[1]];
  const sourceTexte = `Prévisions du modèle ${modele}`;

  // Département : prévisions des jours affichés, lues à la demande et gardées.
  useEffect(() => {
    if (!departement) return;
    const manquants = isos.filter((d) => !(d in joursDep));
    if (manquants.length === 0) return;
    const controleur = new AbortController();
    setChargement(true);
    chargerJoursChamps(modeleApi, manquants, departement, controleur.signal)
      .then((r) => setJoursDep((avant) => ({ ...avant, ...r })))
      .catch(() => {})
      .finally(() => setChargement(false));
    return () => controleur.abort();
  }, [departement, isos, joursDep, modeleApi]);
  const jours = departement ? joursDep : (joursFrance ?? {});

  const geo = useGeoChamps(departement, departement === '66' ? REPERES_66 : undefined);
  const joursPlanche = useMemo(() => isos.map((iso) => ({ iso, points: jours[iso] ?? null })), [isos, jours]);
  const pret = !!geo && joursPlanche.every((j) => j.iso in jours);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !geo) return;
    c.width = format.l;
    c.height = format.h;
    dessinerPlancheChamps({ ctx, largeur: format.l, hauteur: format.h, theme, jours: joursPlanche, titre, geo, source: sourceTexte });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, format, theme, joursPlanche, titre[0], titre[1], sourceTexte]);

  const exporter = () =>
    canvasRef.current?.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carte-${departement ?? 'france'}-${theme}-${isos[0]}-${duree}-jours-${format.id}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      'image/jpeg',
      0.93
    );

  return (
    <section id="planche-champs" className="scroll-mt-20">
      <h2 className="text-2xl font-extrabold">{departement ? `${DEPARTEMENTS_FR[departement] ?? departement} : cartes en couleurs sur 2 ou 4 jours` : 'France : cartes en couleurs sur 2 ou 4 jours'}</h2>
      <p className="mt-2 max-w-3xl text-muted">
        Une carte par jour, en couleurs, avec les lignes de même valeur et les fourchettes écrites dessus (« 22 à 24 °C ») : températures maxi ou mini, pluie, rafales.
        Modèle {modele}, valeurs {departement ? 'des villes et des communes de montagne' : 'des 96 départements'} lissées. Titre modifiable, export en JPG.
      </p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-4 lg:w-80">
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Thème</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(THEMES_CHAMPS) as ThemeChamp[]).map((id) => (
                <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)} className={bouton(theme === id)}>
                  {THEMES_CHAMPS[id].libelle}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Nombre de cartes</span>
            <div className="flex gap-2">
              {([2, 4] as const).map((d) => (
                <button key={d} type="button" aria-pressed={duree === d} onClick={() => setDuree(d)} className={bouton(duree === d)}>
                  {d} jours
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Premier jour</span>
            <select value={departEff} onChange={(e) => setDepart(Number(e.target.value))} className="w-full rounded-lg border border-border bg-surface p-1.5 text-sm">
              {Array.from({ length: departMax }, (_, k) => k + 1).map((k) => (
                <option key={k} value={k}>
                  {k === 1 ? 'Demain' : `J+${k}`} ({jourLong(ajouterJours(aujourdhui, k)).toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Format de l’image</span>
            <select value={formatId} onChange={(e) => setFormatId(e.target.value as FormatId)} className="w-full rounded-lg border border-border bg-surface p-1.5 text-sm">
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Titre (bandeau rouge)</span>
            <input value={titre1} onChange={(e) => setTitre1(e.target.value)} placeholder={auto[0]} className="mb-2 w-full rounded-lg border border-border bg-surface p-1.5 text-sm" />
            <input value={titre2} onChange={(e) => setTitre2(e.target.value)} placeholder={auto[1]} className="w-full rounded-lg border border-border bg-surface p-1.5 text-sm" />
            <span className="mt-1 block text-xs text-muted">Vide : titre automatique.</span>
          </label>
          <button type="button" onClick={exporter} disabled={!pret} className="rounded-lg bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">
            Exporter la planche en JPG
          </button>
          <a href={`/outils/carte-meteo/video/?type=cartes&zone=${departement ?? 'FR'}&format=tiktok`} className="rounded-lg border-2 border-primary bg-surface px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary hover:text-white">
            🎬 Vidéo TikTok de ces cartes →
          </a>
        </div>
        <div className="min-w-0 flex-1">
          {(!geo || chargement) && <p className="text-muted">{!geo ? 'Chargement du fond de carte…' : 'Chargement des prévisions…'}</p>}
          <canvas ref={canvasRef} className="h-auto w-full max-w-[540px] rounded-lg shadow" style={{ aspectRatio: `${format.l} / ${format.h}` }} />
        </div>
      </div>
    </section>
  );
}
