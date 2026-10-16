@echo off
cd /d "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08"
set FUNCTIONS_DISCOVERY_TIMEOUT=120
set FIREBASE_CLI_DISABLE_UPDATE_CHECK=true
npx --yes firebase-tools@latest deploy --only functions:createFloqrCheckoutSession,functions:confirmFloqrCheckoutSession --project shoutoutdemo-5b402 --non-interactive --force
