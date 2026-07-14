# FLOQR Deployment - v29.06

v29.06 adds template-level background locks, a Club Admin patron-customization policy, club-curated background variants, patron-flow permission enforcement, and consolidated Club Public Profile media editing.

1. Upload the complete v29.06 package to the web root.
2. Deploy `firestore.rules`. The new `clubTemplateVariants` collection must be readable by signed-in patrons and writable by the authenticated Club Admin workflow.
3. Deploy `storage.rules`. Club and patron editors continue using `template-backgrounds/{uid}/{variantId}/...` for uploaded images.
4. Hard refresh the site with `?v=29.06` so the updated `shared-data.js`, `ai-template-studio.js`, `admin-app.js`, `master-admin-app.js`, and `patron-app.js` load.
5. In Master Admin > Template Management, confirm each template shows either `Background: editable` or `Background: locked`.
6. In Venue Command Center > Template Backgrounds, save the patron permission, create one club background, and confirm it appears in the patron selector under Club-Approved Backgrounds.
7. In Venue Command Center > Club Public Profile, use the one Venue Media input to upload an image and a video. Trim the video to a window no longer than 15 seconds, apply a filter, save, edit its metadata, reorder it, and verify Delete removes it from the public club page.

No new Cloud Function or secret is required for v29.06. The Firebase OTP, MFA, crawler, and assignment configuration from `DEPLOYMENT-V29-05.md` still applies.
