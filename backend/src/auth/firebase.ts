import admin from 'firebase-admin';
import { config } from '../config/env.js';

let app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (app) return app;

  const privateKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  return app;
}

export async function verifyFirebaseToken(token: string) {
  const firebaseApp = getFirebaseApp();
  const decoded = await firebaseApp.auth().verifyIdToken(token);
  return decoded;
}
