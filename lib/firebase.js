import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  app,
  db,
  auth,
  // Firestore helpers
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  // Auth helpers
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
