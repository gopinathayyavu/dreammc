import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7WHatcQ3QsHcoQqxAY2rJ4XVjVLY4CYQ",
  authDomain: "dearmc-7bcee.firebaseapp.com",
  databaseURL: "https://dearmc-7bcee-default-rtdb.firebaseio.com",
  projectId: "dearmc-7bcee",
  storageBucket: "dearmc-7bcee.appspot.com",
  messagingSenderId: "690002837359",
  appId: "1:690002837359:web:4046447df9b969c881f29a",
  measurementId: "G-7G5928KRZ1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
