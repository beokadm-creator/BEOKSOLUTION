import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAc52CFyXU3BxI-yrORBb5asxsH5EEFnnU",
  authDomain: "translation-comm.firebaseapp.com",
  projectId: "translation-comm",
  storageBucket: "translation-comm.firebasestorage.app",
  messagingSenderId: "485369200558",
  appId: "1:485369200558:web:1950dea22543d266b2923f",
  measurementId: "G-BJS1NMLHC4",
  databaseURL: "https://translation-comm-default-rtdb.firebaseio.com"
};

// 기존 BEOKSOLUTION Firebase 앱과 충돌하지 않도록 'translationApp' 이라는 이름을 지정
const translationApp = initializeApp(firebaseConfig, "translationApp");

// 번역 서비스는 Realtime Database(rtdb)를 사용하므로 rtdb 인스턴스만 export
export const translationDb = getDatabase(translationApp);
