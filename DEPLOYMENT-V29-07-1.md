# FLOQR Deployment - v29.07.1

v29.07.1 is a minor, backward-compatible patch to v29.07. It adds display-aware template previews and administrator-controlled message limits and text sizing. No Firestore rule or Cloud Function change is required for this patch.

## Deploy

1. Preserve the current v29.07 package as the rollback artifact.
2. Upload the complete v29.07.1 package to the GitHub Pages repository root.
3. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.07.1`.
4. Open Master Admin > Template Management and confirm the Available Templates list shows `View`, `Preview`, `Edit`, and either `Activate` or `Deactivate` for each template.

## Required checks

1. Click `Preview` on an available template. Switch among 96 x 48 cm / 624 x 312, 64 x 48 cm / 416 x 312, and 64 x 32 cm / 416 x 208. Confirm the simulated display changes aspect ratio and identifies the selected physical and pixel dimensions.
2. Click `Edit`, change preview message text, main/subtext limits, and main/subtext size, then click `Preview Template` before saving. Confirm the modal reflects the unsaved values.
3. Save the template, reload Master Admin, edit it again, and confirm all limits and sizes persist.
4. Submit a test ShoutOut with that template. Confirm the patron input respects the saved limits and the display uses the saved display-relative text sizes.
5. Deactivate a test template, confirm the row offers `Activate`, then reactivate it.

## Compatibility notes

- Existing templates without the new fields use safe defaults: 60 subtext characters, 16% display-height main text, and 6% display-height subtext.
- Existing ShoutOut records continue to render. New submissions carry a snapshot of the template limits, visual class, media support, and text sizes so later template edits do not unexpectedly change queued content.
- The Traditional Black and White board retains automatic line fitting while respecting the configured main-size scale within safe bounds.
