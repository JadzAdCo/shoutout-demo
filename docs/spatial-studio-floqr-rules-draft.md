# Spatial Studio / Si-nema Firestore rules draft — NOT APPLIED

Stop before production Firebase rules, storage rules, or a production deploy.

This pass classifies the collections and writes them with the Admin SDK from Cloud Functions only. Live `firestore.rules` / `storage.rules` are **unchanged**. Until rules are approved, client SDKs cannot read or write these docs (default deny).

## Intended match blocks (do not paste until owner approval)

```
match /oidcAuthCodes/{codeId} {
  allow read, write: if false; // Functions-write; 60s TTL
}
match /spatialGrantRefs/{grantId} {
  allow read, write: if false; // Functions-write grant references; no files, no tokens
}
match /sinemaScenes/{sceneId} {
  allow read, write: if false; // Functions-write pins + 48h clock
}
```

Storage: no new paths. Photos, poses, meshes, and semantic geometry stay on FloqMedia.

HMAC: `FLOQR_OIDC_JWT_SECRET` is a Functions secret, never a Firestore field.
