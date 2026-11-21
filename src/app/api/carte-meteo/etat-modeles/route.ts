import { NextResponse } from 'next/server';

export const revalidate = 600;

/** Tailles (dernier run publié, dépôt) de chaque modèle, mesurées chaque jour sur le VPS de l'application. */
const URL_TAILLES = 'https://secheresse.alertes-meteo.com/modeles-taille/tailles.json';

/** Relais léger : le navigateur ne rappelle pas le serveur amont directement. */
export async function GET() {
  try {
    const r = await fetch(URL_TAILLES, { next: { revalidate: 600 } });
    if (!r.ok) return NextResponse.json({ modeles: {} });
    return NextResponse.json(await r.json(), { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  } catch {
    return NextResponse.json({ modeles: {} });
  }
}
