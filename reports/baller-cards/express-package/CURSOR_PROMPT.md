# Update existing Baller Alert and Amex templates

Implement these changes in the existing application. Inspect the repository, its instructions, and the current Baller Alert and Amex template definitions, input forms, preview renderer, saved data, and final display/export pipeline before editing. Reuse the existing architecture and current portrait workflow. Do not build a separate application. This package is a design and implementation handoff, not an already implemented repository patch.

## New visual source

Use `assets/ballers-express-business.png` as the new base artwork for both existing template entries. The JPEG is a convenient alternate format. The SVG is a self-contained wrapper around the same raster artwork, not a fully editable vector master. Do not apply all three assets as overlapping layers.

The heading must read **BALLER’S EXPRESS** with **BUSINESS** below. Match the supplied metallic gold lettering. The expiration stays **12/50**. Preserve the ornate border, chip, dark patterned background, and Roman warrior medallion. Use the delivered image's actual dimensions and preserve its aspect ratio. Do not stretch, crop off the border, regenerate the image, paint over it, or reintroduce the removed cardholder/company names.

The art is a reconstructed display graphic; exact original font identification and pixel-level fidelity to the original photograph are not established. The image may retain small legacy AMEX/American Express lettering inside the medallion/border. The requested change is the large heading. Do not interpret those retained marks as a request to change other branding.

## Editable inputs

1. **Name or social media @handle**: one editable text input, placed in the lower-left blank area where the original cardholder name was removed. Permit a person's name OR a social media handle. Preserve a leading @ and the user's entered casing, spaces, accents, and supported Unicode characters. No forced uppercase in stored data. Render as text, never raw HTML. Do not burn a sample name into the base artwork.
2. **Company name**: a separate editable text input on the row immediately below the name/@handle, in the area formerly occupied by `BYTES SOLUTIONS INC`. Preserve user input. If blank, leave the row visually empty without a placeholder on the finished card.
3. **Portrait**: keep the established face-replacement feature in the upper-left Roman warrior medallion. The user uploads an image from a mobile device or desktop file system, or takes a photo with the camera. Replace/composite only the face region; preserve the helmet, surrounding engraved artwork, medallion border, and chip. Inspect the existing mask and compositing implementation before changing it. Align and refine the mask to the new artwork; do not use a rectangular photo pasted over the entire medallion.

Keep these inputs editable when a saved design is reopened. Use existing model field names when appropriate; map the semantic fields `displayName`, `companyName`, and `portrait` to them rather than creating competing models. Preserve existing required/optional rules unless they conflict with the explicit blank-company behavior above.

## Portrait selection and compositing

Retain the project's working upload/camera controls. Provide usable library/file selection on desktop and mobile plus camera capture where supported. A camera failure, denied permission, cancellation, unsupported format, or invalid image must leave the editor usable and preserve the previous valid portrait. Use the project's existing file size and type validation and asset storage conventions. Do not store temporary blob URLs as permanent saved assets. Respect image orientation metadata.

Provide or retain crop, pan, and zoom with a live preview of the face mask. Preserve the existing portrait treatment where one exists; otherwise match the medallion's warm metallic/engraved appearance while keeping the person recognizable. Do not cover the chip. When there is no portrait, retain the base warrior face. Removing a portrait restores that default. Export must use the same mask, crop, and treatment as preview.

## Layout and text styling

Use one canonical coordinate space derived from the artwork's intrinsic width and height, scaled uniformly inside a responsive container. Store overlay anchors and face-mask coordinates in that coordinate space or normalized 0–1 values. Measure the actual new image and visually calibrate positions; this package does not supply a verified facial segmentation mask.

Place the two text rows in the lower-left blank region below the expiration row and above the ornate bottom border. Match the original cardholder lettering's metallic embossed look as closely as the existing renderer supports: gold/ivory face, subtle light edge and restrained dark relief. Use a close available licensed typeface or the project's existing card font. Keep the text readable on venue displays; do not use heavy glow or blur. Match the sample heading already in the artwork without drawing a duplicate heading over it.

Fit long values within a defined safe width using measured text, responsive font sizing, and the project's existing minimum readable size. Do not silently truncate, clip, stretch letters, overlap borders, or let the name collide with the company row. If a value cannot fit at the minimum size, show an actionable validation message in the editor. Empty fields render no labels or placeholder copy on the card.

Keep portrait artwork and text in separate editable layers above the immutable base image. Ensure preview, saved design reload, venue display, and any existing image/video/export path all use the same template geometry and composition. Handle font/image readiness before capturing/exporting. Preserve existing template identifiers and saved-design compatibility; update both existing entries intentionally without deleting unrelated templates or changing unrelated workflows. If the two entries share a renderer, update that shared renderer and confirm both resolve to the new asset.

## Verification and completion

Verify both Baller Alert and Amex entries on desktop and a narrow mobile viewport. Check a normal name, an @handle, accented text, a long value, a blank company, and both blank text fields. Check portrait upload, camera availability/fallback, crop adjustments, cancellation, replacement, and removal. Confirm the finished card has one BALLER’S EXPRESS BUSINESS heading, expiration 12/50, no original personal/company names, intact border/chip, correctly masked portrait, and matching preview/final output. Save and reopen a populated design to confirm the text and portrait placement survive. Run relevant existing checks and inspect a final rendered screenshot/export at full card size and typical venue-display size.

Complete the implementation using the existing project. Summarize changed files, how each existing template uses the new asset, checks performed, and any actual limitations. Do not claim an exact font match or fully vector artwork without evidence.
