# FloqR OIDC client for FloqMedia Spatial Studio

FloqR is the identity issuer. FloqMedia Spatial Studio is a **public** OIDC client (authorization code + PKCE S256). There is no FloqMedia signup and no second user database.

Authorize HTML is live on GitHub Pages. `issueFloqrOidcAuthCode` / `floqrOidcToken` deploy with `[firebase-deploy-spatial]`. Feature catalog writes (`setFeatureServiceFlags` / `seedFeatureServices`) deploy with `[firebase-deploy-features]`. Token HMAC is Secret Manager `FLOQR_OIDC_JWT_SECRET` (`defineSecret`). Production Firestore/Storage rules are not applied (`docs/spatial-studio-floqr-rules-draft.md`).

## Auth audit (this repo)

| Piece | Finding |
|---|---|
| Identity | Firebase Auth in `firebase-config.js` (`shoutoutdemo-5b402`). Providers: Google, Microsoft, Facebook, Email OTP, SMS, WhatsApp. |
| Private pages | `floqr-auth-gate.js` redirects unsigned visitors to Search `returnTo` (all methods). Master Admin keeps its own allow-listed UI. |
| Satellites | `floqr-session-shell.js` — `./?profileRequired=sign-in&returnTo=<file+query>` (strips `v`). Authorize + Si-nema bind this shell. |
| Parallel signup | None. OIDC authorize reuses `auth.currentUser`. `sub` is the Firebase uid. |

## Registration values FloqMedia must receive

Set these on the FloqMedia site (already read as `NEXT_PUBLIC_*`):

```
NEXT_PUBLIC_FLOQR_ISSUER=https://jadzadco.github.io/shoutout-demo
NEXT_PUBLIC_FLOQR_CLIENT_ID=floqmedia-spatial-studio
NEXT_PUBLIC_FLOQR_AUTHORIZE_URL=https://jadzadco.github.io/shoutout-demo/floqr-oidc-authorize.html
NEXT_PUBLIC_FLOQR_TOKEN_URL=https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/floqrOidcToken
```

Authorize query (FloqMedia already sends): `response_type=code`, `scope=openid`, `code_challenge_method=S256`, `redirect_uri={floqmedia-origin}/spatial-studio/auth/callback`.

Allowed production redirects:

- `https://www.floqmedia.com/spatial-studio/auth/callback`
- `https://floqmedia.com/spatial-studio/auth/callback`

Localhost redirects are **off** unless Functions env `FLOQR_OIDC_ALLOW_LOCALHOST=1`.

## Token

POST `application/x-www-form-urlencoded` to the token URL:

`grant_type=authorization_code&code=&redirect_uri=&client_id=floqmedia-spatial-studio&code_verifier=`

Response JWT (`id_token` and `access_token`, same HMAC-signed token): payload includes `sub` (Firebase uid), `iss`, `exp`, plus `name` / `preferred_username` / `email` when present. FloqMedia does **not** verify the signature in the browser. Production cloud save still needs a **server** that verifies HMAC with `FLOQR_OIDC_JWT_SECRET`. Do not put tokens in the spatial project file.

HMAC secret: Firebase Secret Manager `FLOQR_OIDC_JWT_SECRET` (`defineSecret` on `floqrOidcToken` / `floqrSpatialGrant`; accounts profile account `floqrOidc`). Never git, Pages, or FloqMedia `NEXT_PUBLIC_*`. Token exchange fails closed if the secret is missing. CI creates the secret once if absent (value not logged).

## Grant HTTP (after OIDC)

`POST https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/floqrSpatialGrant`  
`Authorization: Bearer <id_token>`

Body is a grant **reference** only (`projectId`, destination, permissions, `pinRevisionId`). `editableUntil` is always `null` on the grant. Files stay on FloqMedia.
