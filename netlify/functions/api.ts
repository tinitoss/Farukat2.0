import serverless from 'serverless-http';
import { app, getClientFirestoreInstance } from '../../server';
import { initTursoTables } from '../../src/server/tursoDb';

let initialized = false;

const handler = async (event: any, context: any) => {
  if (!initialized) {
    try {
      getClientFirestoreInstance();
      await initTursoTables();
      initialized = true;
    } catch (e) {
      console.error('Failed to init in serverless', e);
    }
  }
  
  // Rewrite event.path so Netlify matches Express route definitions (/api/...)
  if (event.path) {
    if (event.path.startsWith('/.netlify/functions/api')) {
      event.path = event.path.replace(/^\/\.netlify\/functions\/api/, '/api');
    }
    if (!event.path.startsWith('/api/') && event.path !== '/api') {
      event.path = '/api' + (event.path.startsWith('/') ? '' : '/') + event.path;
    }
  }
  
  const serverlessHandler = serverless(app);
  return serverlessHandler(event, context);
};

export { handler };
