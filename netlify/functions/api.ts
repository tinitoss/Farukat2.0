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
  
  const serverlessHandler = serverless(app);
  return serverlessHandler(event, context);
};

export { handler };
