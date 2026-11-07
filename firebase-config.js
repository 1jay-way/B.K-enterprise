/*
=========================================================
B.K ENTERPRISE — FIREBASE CONFIGURATION
=========================================================
Independent Firebase project for B.K Enterprise.
=========================================================
*/
import {
   initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
   getAuth
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
   getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
/*
=========================================================
B.K ENTERPRISE FIREBASE CREDENTIALS
=========================================================
*/
const firebaseConfig = {
   apiKey: "AIzaSyCeGHwxCJUo7gLe9iabChe9et-zMmGbUgQ",
   authDomain: "bk-enterprise-e4e4a.firebaseapp.com",
   projectId: "bk-enterprise-e4e4a",
   storageBucket: "bk-enterprise-e4e4a.firebasestorage.app",
   messagingSenderId: "335483922853",
   appId: "1:335483922853:web:0ed600353710226ca7204c",
   measurementId: "G-M2RFCZDKY6"
};
/*
=========================================================
ADMIN USERS
=========================================================
*/
const ADMIN_UIDS = [
   "IEQJVQWnW4dR6rlyxGOQ7ReZfPf1",
   "p1bNDTkoYMhzSXTAz1HgBUMP1pv1"
];
/*
=========================================================
INITIALIZE FIREBASE
=========================================================
*/
const firebaseReady =
   Object.values(firebaseConfig).every(
      value => Boolean(value)
   );
let app = null;
let auth = null;
let db = null;
if (firebaseReady) {
   app = initializeApp(firebaseConfig);
   auth = getAuth(app);
   db = getFirestore(app);
}
/*
=========================================================
CLOUDINARY
=========================================================
Separate B.K Enterprise Cloudinary setup.
=========================================================
*/
const CLOUDINARY_CLOUD_NAME = "ch27o4fh";
const CLOUDINARY_UPLOAD_PRESET = "bk_enterprise_products";
const CLOUDINARY_UPLOAD_URL =
   CLOUDINARY_CLOUD_NAME ?
   `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload` :
   "";
/*
=========================================================
EXPORTS
=========================================================
*/
export {
   firebaseReady,
   firebaseConfig,
   ADMIN_UIDS,
   app,
   auth,
   db,
   CLOUDINARY_CLOUD_NAME,
   CLOUDINARY_UPLOAD_PRESET,
   CLOUDINARY_UPLOAD_URL
};