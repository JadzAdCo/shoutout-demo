/*
  firebase-config.js
  Firebase web config for FLOQR ShoutOut demo.

  IMPORTANT:
  This file uses Firebase Compat syntax.
  Do not use: export const firebaseConfig = ...
*/
window.firebaseConfig = {
    apiKey: "AIzaSyB68VIfHGE-HicL0L8pocXq3pdK7LHBW_g",
    authDomain: "shoutoutdemo-5b402.firebaseapp.com",
    projectId: "shoutoutdemo-5b402",
    storageBucket: "shoutoutdemo-5b402.firebasestorage.app",
    messagingSenderId: "858205816285",
    appId: "1:858205816285:web:d5c1ea010001122ecfa234",
    measurementId: "G-9VZ3SJYHC9"
};

/*
  App Check (reCAPTCHA Enterprise score key).
  This site key is public client material — safe in Pages JS.
  Registered in Firebase Console > App Check for web app ShoutOut_Demo.
  Domains: jadzadco.github.io, shoutoutdemo-5b402.firebaseapp.com, shoutoutdemo-5b402.web.app
  Do NOT add localhost to the production key. Do NOT enable backend enforcement until metrics look healthy.
*/
window.FLOQR_APP_CHECK = {
  enabled: true,
  provider: "recaptcha-enterprise",
  siteKey: "6LcoLhYtAAAAAFPydMFPIXQwmbIHY-S1Dl9J3P-T",
  enforceBackend: false
};
