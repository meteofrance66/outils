import type { captureRequestError } from '@sentry/nextjs';

/** Suivi des erreurs (Sentry) côté serveur. Sans NEXT_PUBLIC_SENTRY_DSN, rien n'est chargé ni envoyé. */
export async function register() {
  // Cache de la carte de France préchauffé en tâche de fond (en production seulement : « next dev » ne doit pas solliciter GitHub).
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { demarrerPrechauffage } = await import('./lib/carte-meteo/prechauffage');
    demarrerPrechauffage();
    // Observations Météo-France : collecte lancée au démarrage puis vérifiée toutes les 10 minutes, sans attendre qu'un visiteur ouvre une page
    // (sinon la date de mise à jour restait bloquée sur la veille tant que personne ne venait, et le premier visiteur voyait des relevés périmés).
    const { getSnapshot, obsConfigured } = await import('./lib/obs/store');
    if (obsConfigured()) {
      const verifier = () => void getSnapshot().catch((e) => console.error('[obs] vérification périodique', e));
      setTimeout(verifier, 20_000);
      setInterval(verifier, 10 * 60_000);
    }
  }
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

export const onRequestError: typeof captureRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError: envoyer } = await import('@sentry/nextjs');
  return envoyer(...args);
};
