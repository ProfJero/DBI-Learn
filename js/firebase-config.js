// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp,
    startAfter,
    addDoc,
    arrayRemove,
    arrayUnion,
    increment,
    runTransaction,
    Timestamp,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAoSRcE-eHx42Ta4a6hTXcquKjjqQZoNIY",
    authDomain: "dbi-learning.firebaseapp.com",
    projectId: "dbi-learning",
    storageBucket: "dbi-learning.firebasestorage.app",
    messagingSenderId: "16335728540",
    appId: "1:16335728540:web:d56c1aeb2a6c459282e259",
    measurementId: "G-BMZ67XHSM1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Export the authentication and firestore functions
export { 
    auth, 
    db,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp,
    startAfter,
    addDoc,
    arrayRemove,
    arrayUnion,
    increment,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    runTransaction,
    Timestamp,
    collectionGroup
};