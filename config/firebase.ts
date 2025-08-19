// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBU2q_8AQHMhTmtLmGnmX6bxv7XM-0VRc",
  authDomain: "rallycross-chrono.firebaseapp.com",
  projectId: "rallycross-chrono",
  storageBucket: "rallycross-chrono.firebasestorage.app",
  messagingSenderId: "960454549904",
  appId: "1:960454549904:web:63e939996e91681f719315"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);