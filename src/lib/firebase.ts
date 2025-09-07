
// This file is now configured for a real Firebase project.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, Timestamp, query, where, limit, orderBy, runTransaction, FieldValue, increment, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD6F-pfLuauK6nQyB6-1MZl56-J6B0PTnc",
  authDomain: "laporan-b9456.firebaseapp.com",
  projectId: "laporan-b9456",
  storageBucket: "laporan-b9456.firebasestorage.app",
  messagingSenderId: "705126693863",
  appId: "1:705126693863:web:d3bf19231ef00b85491b42",
  measurementId: "G-7ZZW98YSM6"
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
