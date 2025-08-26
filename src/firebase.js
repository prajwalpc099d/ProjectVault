import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Added import for storage

const firebaseConfig = {
  apiKey: "AIzaSyBFOsu8QHwCttGiPmtf8sGUI6-5O0q1Iyg",
  authDomain: "projectvault-i8lc9.firebaseapp.com",
  projectId: "projectvault-i8lc9",
  storageBucket: "projectvault-i8lc9.firebasestorage.app",
  messagingSenderId: "571823609786",
  appId: "1:571823609786:web:2d25fc4e2a002a58796f83"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize storage

export { auth, db, storage };
