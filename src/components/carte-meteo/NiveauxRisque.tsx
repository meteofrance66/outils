import { niveauxDeRisque } from '@/lib/carte-meteo/cartes-info';

const NOMS = ['Faible', 'Modéré', 'Fort', 'Sévère'];

/** Tableau des niveaux d'une carte de risque (seuils de la grandeur), affiché sous la carte. */
export default function NiveauxRisque({ idCarte }: { idCarte: string }) {
  const n = niveauxDeRisque(idCarte);
  if (!n) return null;
  return (
    <div className="mt-3 max-w-md overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Niveau</th>
            <th className="px-3 py-2 font-semibold">{n.grandeur}</th>
          </tr>
        </thead>
        <tbody>
          {NOMS.map((nom, i) => (
            <tr key={nom} className="border-t border-border">
              <td className="px-3 py-1.5 font-semibold">{nom}</td>
              <td className="px-3 py-1.5">{n.valeurs[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {n.note && <p className="border-t border-border px-3 py-2 text-xs text-muted">{n.note}</p>}
    </div>
  );
}
