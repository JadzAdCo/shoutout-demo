# Mingl Cursor Logo Package — white / teal / purple revision

## Files
- `assets/mingl-approved-reference.png`: latest user-approved direction (raster visual reference, not vector artwork).
- `assets/mingl-clean-vector-starter.svg`: editable clean vector approximation to use as a starting point, not a pixel-exact trace.
- `assets/mingl-chrome-monochrome.svg`: monochrome, currentColor-based variant.
- `prompts/CURSOR_MASTER_PROMPT.md`: implementation and QA requirements for Cursor.

## Usage
Place this folder in the project workspace and give Cursor the master prompt. The PNG reference has visible background extraction noise; use the clean vector SVG as the production starting point and improve fidelity to the reference. Do not deploy without approval.
