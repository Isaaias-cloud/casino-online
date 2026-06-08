const admin = require('firebase-admin');

let db = null;
let auth = null;

function initFirebase() {
  if (admin.apps.length) return { db, auth };

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (base64) {
      const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n')
        })
      });
    } else {
      console.warn('[firebase] Admin SDK no configurado. Usando almacenamiento en memoria.');
      return { db: null, auth: null };
    }

    db = admin.firestore();
    auth = admin.auth();
    console.log('[firebase] Firestore y Authentication listos.');
  } catch (error) {
    console.warn('[firebase] No se pudo inicializar Firebase Admin:', error.message);
  }

  return { db, auth };
}

module.exports = { initFirebase };
