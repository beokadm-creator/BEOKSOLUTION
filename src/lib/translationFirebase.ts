import { initializeApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const fallbackConfig = {
  apiKey: "AIzaSyAc52CFyXU3BxI-yrORBb5asxsH5EEFnnU",
  authDomain: "translation-comm.firebaseapp.com",
  projectId: "translation-comm",
  storageBucket: "translation-comm.firebasestorage.app",
  messagingSenderId: "485369200558",
  appId: "1:485369200558:web:1950dea22543d266b2923f",
  measurementId: "G-BJS1NMLHC4",
  databaseURL: "https://translation-comm-default-rtdb.firebaseio.com",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_TRANSLATION_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_TRANSLATION_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_TRANSLATION_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_TRANSLATION_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_TRANSLATION_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_TRANSLATION_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: import.meta.env.VITE_TRANSLATION_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
  databaseURL: import.meta.env.VITE_TRANSLATION_FIREBASE_DATABASE_URL || fallbackConfig.databaseURL,
};

const requiredKeys = ['apiKey', 'projectId', 'appId', 'databaseURL'] as const;
const hasAllRequired = requiredKeys.every((key) => !!firebaseConfig[key]);

let translationDb: Database | null = null;

if (hasAllRequired) {
  const translationApp = initializeApp(firebaseConfig, "translationApp");
  translationDb = getDatabase(translationApp);
}

export { translationDb };
