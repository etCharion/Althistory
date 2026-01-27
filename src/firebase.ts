import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyByFtwK4GoGPPcxHf7NvxyBMTOLz2b1_R0",
  authDomain: "althistory-feb4e.firebaseapp.com",
  projectId: "althistory-feb4e",
  storageBucket: "althistory-feb4e.firebasestorage.app",
  messagingSenderId: "536705983159",
  appId: "1:536705983159:web:ec8e15d72473daaa602332"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
