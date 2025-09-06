
// This file is now configured for a real Firebase project.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, Timestamp, query, where, limit, orderBy, runTransaction, FieldValue, increment, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y",
  authDomain: "batchscale-monitor.firebaseapp.com",
  projectId: "batchscale-monitor",
  storageBucket: "batchscale-monitor.firebasestorage.app",
  messagingSenderId: "425726816093",
  appId: "1:425726816093:web:93af9e102298d4d07082b4"
};

// Initialize Firebase.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { 
    db,
    collection, 
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDocs,
    getDoc,
    addDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    query,
    where,
    limit,
    orderBy,
    runTransaction,
    FieldValue,
    increment,
    writeBatch
};
