'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { THEMES_CHAMPS, dessinerPlancheChamps, jourLong, titreAuto, type GeoChamps, type PointChampJour, type ThemeChamp } from '@/lib/carte-meteo/planche-champs';
import { BOITE_FRANCE, FICHIERS_CONTOURS, useContours } from './CarteMeteo';

/** Formats de l'image (pixels). */
const FORMATS = [
  { id: 'tiktok', libelle: 'TikTok, Reels (9:16)', l: 1080, h: 1920 },
  { id: 'facebook', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];

const bouton = (actif: boolean) => `rounded-lg border px-3 py-1.5 text-sm ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;

/**
 * Planche « cartes en couleurs » : 2 ou 4 cartes de France (une par jour, dès demain par défaut), champ coloré, isolignes et
 * étiquettes de fourchette, pour les maxi, les mini, la pluie ou les rafales ; export en JPG.
 */
export default function PlancheChamps({ aujourdhui, jours, modele }: { aujourdhui: string; jours: Record<string, PointChampJour[] | null>; modele: string }) {
  const [theme, setTheme] = useState<ThemeChamp>('tx');
  const [duree, setDuree] = useState<2 | 4>(4);
  const [depart, setDepart] = useState(1);
  const [formatId, setFormatId] = useState<FormatId>('tiktok');
  const [titre1, setTitre1] = useState('');
  const [titre2, setTitre2] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = FORMATS.find((f) => f.id === formatId)!;

  const nbDates = Object.keys(jours).length;
  const departMax = Math.max(1, nbDates - duree);
  const departEff = Math.min(depart, departMax);
  const isos = useMemo(() => Array.from({ length: duree }, (_, k) => ajouterJours(aujourdhui, departEff + k)), [aujourdhui, departEff, duree]);
  const auto = titreAuto(theme, isos);
  const titre: [string, string] = [titre1.trim() || auto[0], titre2.trim() || auto[1]];

  const contoursBruts = useContours(FICHIERS_CONTOURS.departements);
  const geo = useMemo<GeoChamps | null>(() => {
    if (contoursBruts.length === 0) return null;
    const departements = contoursBruts.map((c) => new Path2D(c.d));
    const terres = new Path2D();
    for (const d of departements) terres.addPath(d);
    return { departements, terres, boite: BOITE_FRANCE };
  }, [contoursBruts]);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !geo) return;
    c.width = format.l;
    c.height = format.h;
    dessinerPlancheChamps({
      ctx,
      largeur: format.l,
      hauteur: format.h,
      theme,
      jours: isos.map((iso) => ({ iso, points: jours[iso] ?? null })),
      titre,
      geo,
      source: `Prévisions du modèle ${modele}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, format, theme, isos, jours, titre[0], titre[1], modele]);

  const exporter = () => {
    canvasRef.current?.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carte-${theme}-${isos[0]}-${duree}-jours-${format.id}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      'image/jpeg',
      0.93
    );
  };

  return (
    <section id="planche-champs" className="scroll-mt-20">
      <h2 className="text-2xl font-extrabold">France : cartes en couleurs sur 2 ou 4 jours</h2>
      <p className="mt-2 max-w-3xl text-muted">
        Une carte de France par jour, en couleurs, avec les lignes de même valeur et les fourchettes écrites dessus (« 22 à 24 °C ») : températures maxi ou mini, pluie, rafales.
        Modèle {modele}, valeurs des 96 départements lissées. Titre modifiable, export en JPG.
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
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Format</span>
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
          <button type="button" onClick={exporter} disabled={!geo} className="rounded-lg bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">
            Exporter la planche en JPG
          </button>
        </div>
        <div className="min-w-0 flex-1">
          {!geo && <p className="text-muted">Chargement du fond de carte…</p>}
          <canvas ref={canvasRef} className="h-auto w-full max-w-[540px] rounded-lg shadow" style={{ aspectRatio: `${format.l} / ${format.h}` }} />
        </div>
      </div>
    </section>
  );
}
