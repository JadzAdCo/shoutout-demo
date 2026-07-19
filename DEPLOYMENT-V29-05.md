# FLOQR v29.05 deployment and authentication setup

## 1. Publish the web app and Firebase rules

Upload the complete v29.05 package to the GitHub Pages repository root. From the Firebase project directory, publish this package's `firestore.rules` and `storage.rules`, then deploy the functions.

```bash
npm --prefix functions install
firebase deploy --only firestore:rules,storage
```

## 2. Configure five-minute custom-email OTP

1. In SendGrid, authenticate the FLOQR sending domain or verify the exact sender address.
2. Set the sender in `functions/.env` as `FLOQR_EMAIL_OTP_FROM=login@your-domain.example`.
3. Create a long random HMAC pepper and store both secrets:

```bash
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set EMAIL_OTP_PEPPER
```

4. Deploy both callable functions:

```bash
firebase deploy --only functions:requestEmailOtp,functions:verifyEmailOtp
```

The code is eight alphanumeric characters, excludes visually ambiguous characters, expires in five minutes, is single-use, allows at most five failed attempts, and cannot be read by a web client.

## 3. Configure Club Admin SMS MFA

1. Upgrade the Firebase project to Identity Platform if required for multi-factor authentication.
2. Firebase Console > Authentication > Sign-in method: enable Phone and the Google/Microsoft/Facebook providers used by Club Admins.
3. Firebase Console > Authentication > Settings: add the production GitHub Pages/custom domains to Authorized domains.
4. Identity Platform > Multi-factor authentication: enable SMS multi-factor authentication and select allowed SMS regions.
5. Add test phone numbers only for non-production verification; production admins should enroll their real international-format mobile number.
6. Master Admin > Entity Onboarding: select a club, select a patron whose `profileCompleted` value is true, and assign the patron.
7. The patron signs into `admin.html?location={clubId}`. On first use, FLOQR enrolls the mobile number. Later logins challenge the enrolled SMS factor before the Venue Command Center opens.

Protect the SMS flow with Firebase quotas, regional allowlists, reCAPTCHA, account monitoring, and a documented recovery process.

## 4. Configure localized crawler processing

1. Enable Google Places API (New) in the Google Cloud project and restrict its key to the Places API and the Firebase Functions runtime.
2. Store the key and deploy the dispatcher:

```bash
firebase functions:secrets:set GOOGLE_PLACES_API_KEY
firebase deploy --only functions:scheduledAiDiscoveryCrawl,functions:assignClubAdmin
```

3. Master Admin > AI Crawler: select the first 24-hour time, IANA timezone, daily run count, countries, languages, genres, and venue types; preview and save the plan.
4. The dispatcher wakes every 15 minutes, calculates local time in each saved timezone, and claims each scheduled slot once. It expands searches by market, venue type, genre, and native language plus English by default.
5. Download the contact CSV from Master Admin. Name, address, telephone, website, and available social-handle columns are kept separate. Missing social details remain blank for review instead of being invented.

## 5. Verify

Run Master Admin > Diagnostics > Package Install Diagnostics and Rules Smoke Test. Confirm all four progress phases complete, then download the JSON result. Test all three screen previews: 624×312, 416×312, and 416×208.
