import { app, getClientFirestoreInstance } from '../server';
import { initTursoTables } from '../src/server/tursoDb';

let initialized = false;

export default async function handler(req: any, res: any) {
  if (!initialized) {
    try {
      getClientFirestoreInstance();
      await initTursoTables();
      initialized = true;
    } catch (e) {
      console.error('[Vercel Serverless] Failed to initialize database:', e);
    }
  }

  return app(req, res);
}
