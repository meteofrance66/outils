import assert from 'node:assert/strict';
import { passageCourant } from '../src/lib/carte-meteo/sources';

async function main() {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalError = console.error;
  let now = originalNow();
  let appels = 0;
  let absent = true;
  Date.now = () => now;
  console.error = () => {};
  globalThis.fetch = async () => {
    appels++;
    await Promise.resolve();
    return absent ? new Response('', { status: 404 }) : Response.json({ model: { run_time: 'run-verifie' } });
  };
  try {
    const resultats = await Promise.all(Array.from({ length: 96 }, () => passageCourant('arome')));
    assert.ok(resultats.every((r) => r === null));
    assert.equal(appels, 1, 'une seule lecture pour 96 appels concurrents, sans relance du 404');
    await passageCourant('arome');
    assert.equal(appels, 1, 'temporisation après un échec');
    now += 60_001;
    absent = false;
    assert.equal(await passageCourant('arome'), 'run-verifie');
    assert.equal(appels, 2, 'récupération après rétablissement de la source');
    now += 5 * 60_000 + 1;
    absent = true;
    assert.equal(await passageCourant('arome'), 'run-verifie', 'conserver le dernier passage connu');
    await passageCourant('arome');
    assert.equal(appels, 3, 'temporisation même avec un passage connu');
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    console.error = originalError;
  }
  console.log('Index météo : concurrence, 404, temporisation et reprise validés.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
