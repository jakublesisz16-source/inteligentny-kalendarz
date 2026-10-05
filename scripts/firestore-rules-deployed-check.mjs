const PROJECT_ID = 'inteligentny-kalendarz-s-2cfc9';
const PROBE_USER_ID = '__ik_anonymous_release_probe__';
const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${PROBE_USER_ID}/sync/current`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 12_000);

try {
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: controller.signal,
  });
  const body = await response.text();

  if (response.status === 401 || response.status === 403) {
    console.log(`FIRESTORE_DEPLOYED_RULES_ANONYMOUS_DENY_OK status=${response.status}`);
    process.exit(0);
  }

  console.error(`FIRESTORE_DEPLOYED_RULES_ANONYMOUS_DENY_FAIL status=${response.status}`);
  console.error(body.slice(0, 1200));
  console.error('Anonymous access to users/{uid}/sync/current was not denied. Treat this as a release blocker.');
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FIRESTORE_DEPLOYED_RULES_ANONYMOUS_DENY_ERROR ${message}`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
