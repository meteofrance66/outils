'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajouterJours, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { versMonde } from '@/lib/carte-meteo/projection-france';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { SIGMA_FRANCE_KM, THEMES_CHAMPS, dessinerPlancheChamps, jourLong, titreAuto, type GeoChamps, type PointChampJour, type ThemeChamp } from '@/lib/carte-meteo/planche-champs';
import { encoderVideoChamps, preparerVideoChamps, type VideoChamps } from '@/lib/carte-meteo/video-champs';
import { BOITE_FRANCE, FICHIERS_CONTOURS, useContours } from './CarteMeteo';

/** Formats de l'image (pixels). La vidéo est toujours en 9:16. */
const FORMATS = [
  { id: 'tiktok', libelle: 'TikTok, Reels (9:16)', l: 1080, h: 1920 },
  { id: 'facebook', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];

/** Villes repères d'un département (carte du département seulement). */
const VILLES_REPERES: Record<string, { nom: string; lat: number; lon: number }[]> = {
  '66': [
    { nom: 'Perpignan', lat: 42.699, lon: 2.895 },
    { nom: 'Prades', lat: 42.617, lon: 2.422 },
    { nom: 'Céret', lat: 42.486, lon: 2.748 },
    { nom: 'Font-Romeu-Odeillo-Via', lat: 42.505, lon: 2.039 },
    { nom: 'Argelès-sur-Mer', lat: 42.546, lon: 3.023 },
    { nom: 'Saint-Paul-de-Fenouillet', lat: 42.809, lon: 2.503 },
  ],
};
/** Rayon du lissage pour un département (km) : ses villes sont bien plus proches que les chefs-lieux. */
const SIGMA_DEPARTEMENT_KM = 9;

const bouton = (actif: boolean) => `rounded-lg border px-3 py-1.5 text-sm ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;

const versChamp = (p: PointCarte): PointChampJour | null =>
  p.lat == null || p.lon == null ? null : { code: p.code, nom: p.nom, lat: p.lat, lon: p.lon, tx: p.maxi, tn: p.mini, pluie: p.pluieJournee, rafale: p.rafaleJournee };

/** Prévisions d'un département pour un jour : ses villes, plus les communes de montagne loin de toute ville (relief). */
async function chargerDepartement(modele: string, date: string, dep: string, signal: AbortSignal): Promise<PointChampJour[] | null> {
  const lire = async (suite: string) => {
    const r = await fetch(`/api/carte-meteo/previsions/?modele=${modele}&date=${date}&dep=${dep}${suite}`, { signal });
    if (!r.ok) return [];
    return (((await r.json()) as { points?: PointCarte[] }).points ?? []).map(versChamp).filter((x): x is PointChampJour => x != null);
  };
  const [villes, montagne] = await Promise.all([lire(''), lire('&montagne=1&alt=1000').catch(() => [])]);
  if (villes.length === 0) return null;
  // Une commune de montagne à moins de 3 km d'une ville est écartée (deux valeurs différentes au même endroit feraient une tache).
  const loin = montagne.filter((m) => villes.every((v) => Math.hypot((v.lat - m.lat) * 111, (v.lon - m.lon) * 82) > 3));
  return [...villes, ...loin];
}

/**
 * Planche « cartes en couleurs » : 2 ou 4 cartes (une par jour, dès demain par défaut), champ coloré, isolignes et étiquettes de
 * fourchette, pour les maxi, les mini, la pluie ou les rafales ; France entière (`jours`, lus côté serveur) ou un département
 * (`departement`, prévisions lues ici) ; export en JPG et vidéo TikTok en MP4.
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
  const [etatVideo, setEtatVideo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
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
    Promise.all(manquants.map(async (d) => [d, await chargerDepartement(modeleApi, d, departement, controleur.signal).catch(() => null)] as const))
      .then((r) => setJoursDep((avant) => ({ ...avant, ...Object.fromEntries(r) })))
      .catch(() => {})
      .finally(() => setChargement(false));
    return () => controleur.abort();
  }, [departement, isos, joursDep, modeleApi]);
  const jours = departement ? joursDep : (joursFrance ?? {});

  const contoursBruts = useContours(FICHIERS_CONTOURS.departements);
  // Département : pays et départements voisins en gris (terres d'Europe, Natural Earth).
  const [europe, setEurope] = useState<number[][] | null>(null);
  useEffect(() => {
    if (!departement) return;
    fetch('/geo/europe.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][] }>) : Promise.reject()))
      .then((j) => setEurope(j.terres))
      .catch(() => setEurope([]));
  }, [departement]);
  const geo = useMemo<GeoChamps | null>(() => {
    if (contoursBruts.length === 0) return null;
    if (!departement) {
      const departements = contoursBruts.map((c) => new Path2D(c.d));
      const terres = new Path2D();
      for (const d of departements) terres.addPath(d);
      return { departements, terres, boite: BOITE_FRANCE, sigmaKm: SIGMA_FRANCE_KM };
    }
    const c = contoursBruts.find((x) => x.code === departement);
    if (!c || europe === null) return null;
    const etranger = new Path2D();
    for (const anneau of europe) {
      for (let k = 0; k < anneau.length; k += 2) {
        const { x, y } = versMonde(anneau[k + 1], anneau[k]);
        if (k === 0) etranger.moveTo(x, y);
        else etranger.lineTo(x, y);
      }
      etranger.closePath();
    }
    const voisins = [etranger, ...contoursBruts.filter((x) => x.code !== departement).map((x) => new Path2D(x.d))];
    return { departements: [], terres: new Path2D(c.d), boite: c.boite, voisins, sigmaKm: SIGMA_DEPARTEMENT_KM, villes: VILLES_REPERES[departement] };
  }, [contoursBruts, departement, europe]);

  const joursPlanche = useMemo(() => isos.map((iso) => ({ iso, points: jours[iso] ?? null })), [isos, jours]);
  const pret = !!geo && joursPlanche.every((j) => j.iso in jours);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !geo || lecture) return;
    c.width = format.l;
    c.height = format.h;
    dessinerPlancheChamps({ ctx, largeur: format.l, hauteur: format.h, theme, jours: joursPlanche, titre, geo, source: sourceTexte });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, format, theme, joursPlanche, titre[0], titre[1], sourceTexte, lecture]);

  const nomFichier = (ext: string) => `carte-${departement ?? 'france'}-${theme}-${isos[0]}-${duree}-jours${ext === 'mp4' ? '' : `-${format.id}`}.${ext}`;
  const telecharger = (blob: Blob, nom: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const exporter = () => canvasRef.current?.toBlob((blob) => blob && telecharger(blob, nomFichier('jpg')), 'image/jpeg', 0.93);

  const video = (): VideoChamps | null =>
    geo ? preparerVideoChamps({ largeur: 1080, hauteur: 1920, theme, jours: joursPlanche, titre, geo, source: sourceTexte, zone: nomZone }) : null;

  // Aperçu de la vidéo dans le cadre de la planche.
  const lectureRef = useRef(0);
  const lire = () => {
    const v = video();
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!v || !c || !ctx) return;
    setLecture(true);
    c.width = 1080;
    c.height = 1920;
    const debut = performance.now();
    const boucle = () => {
      const t = (performance.now() - debut) / 1000;
      if (t >= v.duree) {
        setLecture(false);
        return;
      }
      v.dessiner(ctx, t);
      lectureRef.current = requestAnimationFrame(boucle);
    };
    boucle();
  };
  useEffect(() => () => cancelAnimationFrame(lectureRef.current), []);
  const arreter = () => {
    cancelAnimationFrame(lectureRef.current);
    setLecture(false);
  };

  const exporterVideo = async () => {
    setErreur(null);
    arreter();
    const v = video();
    if (!v) return;
    try {
      setEtatVideo('Encodage de la vidéo… 0 %');
      const blob = await encoderVideoChamps(v, 1080, 1920, (f) => setEtatVideo(`Encodage de la vidéo… ${Math.round(f * 100)} %`));
      telecharger(blob, nomFichier('mp4'));
    } catch (e) {
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtatVideo(null);
    }
  };

  return (
    <section id="planche-champs" className="scroll-mt-20">
      <h2 className="text-2xl font-extrabold">{departement ? `${DEPARTEMENTS_FR[departement] ?? departement} : cartes en couleurs sur 2 ou 4 jours` : 'France : cartes en couleurs sur 2 ou 4 jours'}</h2>
      <p className="mt-2 max-w-3xl text-muted">
        Une carte par jour, en couleurs, avec les lignes de même valeur et les fourchettes écrites dessus (« 22 à 24 °C ») : températures maxi ou mini, pluie, rafales.
        Modèle {modele}, valeurs {departement ? 'des villes et des communes de montagne' : 'des 96 départements'} lissées. Titre modifiable, export en JPG, et vidéo TikTok (MP4) des mêmes cartes.
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
          <button type="button" onClick={exporter} disabled={!pret || lecture} className="rounded-lg bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">
            Exporter la planche en JPG
          </button>
          <div className="rounded-lg border border-border p-3">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-primary">🎬 Vidéo TikTok (9:16)</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={lecture ? arreter : lire} disabled={!pret || !!etatVideo} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50">
                {lecture ? '■ Arrêter' : '▶ Aperçu'}
              </button>
              <button type="button" onClick={exporterVideo} disabled={!pret || !!etatVideo} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
                Exporter la vidéo MP4
              </button>
            </div>
            <span className="mt-2 block text-xs text-muted">Ouverture, une grande carte par jour, puis la planche complète (environ {Math.round(2.4 + duree * 3.4 + 3.4)} s).</span>
            {etatVideo && <p className="mt-2 text-sm">{etatVideo}</p>}
            {erreur && <p role="alert" className="mt-2 text-sm text-danger">{erreur}</p>}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {(!geo || chargement) && <p className="text-muted">{!geo ? 'Chargement du fond de carte…' : 'Chargement des prévisions…'}</p>}
          <canvas ref={canvasRef} className="h-auto w-full max-w-[540px] rounded-lg shadow" style={{ aspectRatio: lecture ? '1080 / 1920' : `${format.l} / ${format.h}` }} />
        </div>
      </div>
    </section>
  );
}
