# Cursor master prompt — Mingl logo update

## Goal
Update the Mingl feature icon/logo in FLOQR to match `assets/mingl-approved-reference.png`. This file is a visual reference, not a verified vector source. Do not deploy or modify production without approval.

## Approved design
- Three white, glossy person silhouettes. Center foreground person has purple/magenta highlights and trim; left and right rear people have teal/cyan highlights and trim.
- White conversation bubble with three dark dots above the people, with restrained cyan/purple highlights.
- Below: bold italic **Mingl** wordmark, primarily white with teal/cyan treatment on the ending letters as shown, plus small TM mark.
- No cinematic filmstrip ring, no outer square, no embedded background, no halo surrounding the entire icon.
- Clean TRANSPARENT canvas; eliminate all black/white speckling, matte residue, and stray glow artifacts visible in the generated PNG reference. Maintain crisp silhouettes.
- Site Chrome owns the enclosing tile, border, shadow, glow, hover/focus state. The Mingl brand symbol can retain its intentional white/teal/purple internal accents. Provide a second `currentColor` monochrome variant where practical.

## Required work
1. Inspect existing Mingl logo/icon assets, UI component references, asset pipeline, and theme tokens in the repository. Report actual files and references before changing them.
2. Create a CLEAN, fully editable vector master SVG by recreating the approved composition with real SVG paths, circles, gradients, and editable text or outlined vector glyphs as needed. DO NOT simply wrap the PNG in an SVG `<image>` tag and call it vector. Avoid external fonts and remote assets.
3. Create a site-chrome-compatible monochrome SVG variant using `currentColor`; preserve shape, but use no hardcoded tile border/background.
4. Export optimized transparent PNG variants at 128, 256, 512 and 1024 pixels from the vector master, after visual QA. Maintain padding and legibility at 32/48/64 px.
5. Integrate only in appropriate Mingl navigation and brand locations, preserving existing behavior and accessibility labels. Do not alter Room SMARTview or invitation logic.
6. Run theme tests across all existing FLOQR Site Chrome themes, mobile/desktop checks, keyboard focus and reduced-motion checks. Ensure PNG transparency and absence of pixel artifacts. Confirm no filmstrip, no outer border, no black square.
7. Update existing canonical brand asset documentation and architecture/asset flow diagrams only where impacted. Avoid inventing new architecture.
8. Provide a file-change summary, before/after screenshots, test outcomes, any visual deviations from the reference, and rollback instructions. No deploy without approval.

## Important caveat
The supplied PNG is a generated visual reference and appears to have residual noisy edge pixels. The production master MUST be clean vector geometry. If exact typography cannot be matched without a licensed font, use a permitted font or outlined custom lettering and flag the approximation.
