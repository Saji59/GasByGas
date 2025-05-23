const admin = require("firebase-admin");

// Load service account key from JSON file
const serviceAccount = require("./gasbygasdb-firebase-adminsdk-cnhjg-d64d171ed7.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gasbygasdb-default-rtdb.firebaseio.com"
  });

const firestoredb = admin.firestore(); 
module.exports = { admin, firestoredb };
