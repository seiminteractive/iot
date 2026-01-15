import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

type ClaimUser = {
  uid: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'plant_operator' | 'viewer';
  plantAccess: string[];
};

function initFirebaseAdmin() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    const fullPath = path.resolve(serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

async function main() {
  initFirebaseAdmin();

  const claimsFile = process.argv[2] || path.resolve('scripts/claims.json');
  const claimsRaw = fs.readFileSync(claimsFile, 'utf-8');
  const users = JSON.parse(claimsRaw) as ClaimUser[];

  for (const user of users) {
    await admin.auth().setCustomUserClaims(user.uid, {
      tenantId: user.tenantId,
      role: user.role,
      plantAccess: user.plantAccess,
    });
    console.log(`Claims set for ${user.uid}`);
  }
}

main().catch((error) => {
  console.error('Failed to set claims:', error);
  process.exit(1);
});
