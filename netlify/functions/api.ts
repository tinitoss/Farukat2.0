import serverless from 'serverless-http';
import { app, getClientFirestoreInstance } from '../../server';
import { initTursoTables } from '../../src/server/tursoDb';

let initialized = false;
const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  if (!initialized) {
    initialized = true;
    Promise.all([
      getClientFirestoreInstance(),
      initTursoTables()
    ]).catch(e => console.error('[Netlify Serverless] Init warning:', e));
  }
  
  if (event.path) {
    if (event.path.startsWith('/.netlify/functions/api')) {
      event.path = event.path.replace(/^\/\.netlify\/functions\/api/, '/api');
    }
    if (!event.path.startsWith('/api/') && event.path !== '/api') {
      event.path = '/api' + (event.path.startsWith('/') ? '' : '/') + event.path;
    }
  }
  
  return serverlessHandler(event, context);
};

