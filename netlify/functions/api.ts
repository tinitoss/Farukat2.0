import serverless from 'serverless-http';
import { app, getClientFirestoreInstance } from '../../server';
import { initTursoTables } from '../../src/server/tursoDb';

// Wrap the Express app once per function instance rather than on every request.
const serverlessHandler = serverless(app);

let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      getClientFirestoreInstance();
      await initTursoTables();
    })().catch((e) => {
      console.error('[Netlify Function] Failed to initialize database:', e);
      // Clear the cache so a later invocation can retry instead of staying broken.
      initPromise = null;
    });
  }
  return initPromise;
}

const handler = async (event: any, context: any) => {
  await ensureInitialized();
  return serverlessHandler(event, context);
};

export { handler };
