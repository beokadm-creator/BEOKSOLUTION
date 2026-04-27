import { initializeApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_TRANSLATION_FIREBASE_API_KEY ?? import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_TRANSLATION_FIREBASE_AUTH_DOMAIN ?? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_TRANSLATION_FIREBASE_PROJECT_ID ?? import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_TRANSLATION_FIREBASE_STORAGE_BUCKET ?? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_TRANSLATION_FIREBASE_MESSAGING_SENDER_ID ?? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_TRANSLATION_FIREBASE_APP_ID ?? import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_TRANSLATION_FIREBASE_DATABASE_URL ?? import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

const requiredKeys = ['apiKey', 'projectId', 'appId', 'databaseURL'] as const;
const hasAllRequired = requiredKeys.every((key) => !!firebaseConfig[key]);

let translationDb: Database | null = null;

if (hasAllRequired) {
  const translationApp = initializeApp(firebaseConfig, "translationApp");
  translationDb = getDatabase(translationApp);
}

export { translationDb };
