# Zebbies four-player football intro: Xibo setup

This package contains a responsive 20-second browser animation for these FLOQR display formats:

| FLOQR format | Xibo layout size | Aspect |
|---|---:|---:|
| `p125-96x48` | 768 × 384 px | 2:1 |
| `p125-64x48` | 512 × 384 px | 4:3 |
| `p125-64x32` | 512 × 256 px | 2:1 |

These are the P1.25 native pixel dimensions. The older 624×312, 416×312, and 416×208 profiles remain available only for existing non-P1.25 hardware.

The selected Zebbies panel format is saved with the paid ShoutOut and transferred to `liveContent` when a club administrator approves it.

## Quick connected test

1. Deploy the v29.08.2 frontend and `createFloqrCheckoutSession` function.
2. In Xibo CMS, create a Landscape Layout matching the exact pixel dimensions of the Zebbies panel.
3. Add one full-screen **Webpage** widget.
4. Set the URL to:

   `https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=29.08.2`

5. Use **Best Fit** (or Open Natively after testing on the actual player), no transparent background, and a 20-second duration.
6. If the Android player offers **Preload content off screen**, enable it.
7. Configure the Webpage page-load-error trigger to navigate to a locally cached fallback Layout.
8. Publish the Layout and schedule it to the Zebbies display.

The football editor includes a separate 60-character stadium-message field. The 20-second rotation gives it a dedicated high-contrast phase, wraps it into no more than three 20-character lines, and targets roughly 5–7 cm character height on the P1.25 panels for nightclub viewing from about 7 metres. Confirm final readability on the physical installation because ambient light, panel brightness, mounting height, and viewer angle still matter.

This mode receives approved ShoutOuts from Firestore. FLOQR enables Firestore persistence, caches successfully fetched roster photos in the browser Cache API, and waits for the four photos before starting the 20-second sequence. That protects playback after a successful first download, but it cannot guarantee delivery of a brand-new ShoutOut while the player is completely offline.

Xibo explicitly states that its Webpage widget is not cached and needs a valid internet connection: [Xibo Webpage documentation](https://account.xibosignage.com/manual/en/media_module_webpage.html).

## Recommended low-bandwidth production mode

For guaranteed playback during an outage, do not use the remote Webpage as the final scheduled item. Use one of these locally distributed formats:

### Preferred: H.264 MP4

1. After club approval, render the four-photo sequence to a 20-second H.264 MP4 at the exact panel resolution.
2. Upload the file directly to the Xibo Media Library; do not use a streaming URL or Local Video URL.
3. Add the uploaded file as a full-screen **Video** widget.
4. Set duration to 20 seconds (or use end detection), Loop off, Mute on, and scaling to fit the exact layout.
5. Schedule the media early enough for the player to download it completely.
6. In **Displays**, verify the player has no pending downloads and obtain a screenshot before showtime.

Xibo recommends H.264 MP4 and states that uploaded video is cached for offline playback: [Xibo Video documentation](https://account.xibosignage.com/manual/en/media_module_video). Xibo players require a Layout and its dependent resources to be completely downloaded before it is valid for playback: [Xibo scheduled Layout troubleshooting](https://account.xibosignage.com/docs/setup/my-scheduled-layouts-are-not-working).

### Alternative: self-contained HTML Package

Create a `.htz` ZIP containing the animation HTML, CSS, JavaScript, and all four image files. Every reference must be relative and the package must make no Firebase or external network requests. Upload it to Xibo's **HTML Package** widget and set the entry point to `index.html`.

Xibo distributes and extracts HTML Packages locally, so they remain available without network access: [Xibo HTML Package documentation](https://account.xibosignage.com/docs/developer/widgets/package-html).

## Player and Display Profile settings

- Collection interval: 5 minutes. This is Xibo's normal recommendation and balances responsiveness with bandwidth.
- Local library storage: Internal Storage, or a reliable External Storage device with enough free space for at least several days of media.
- Orientation: Landscape.
- Start during startup: On.
- Automatic restart: On.
- Keep a simple, already-downloaded default Layout assigned at all times.
- Schedule new paid media at least 30–60 minutes before it must play when the connection is slow.
- Confirm device date/time and timezone are correct.
- Do not delete or hard-purge the current media until the replacement shows as fully downloaded.

See [Xibo Player Settings](https://account.xibosignage.com/docs/setup/player-settings) and [Xibo Simple Scheduling](https://account.xibosignage.com/manual/en/simple_scheduling).

## Automation still required for zero-touch offline delivery

The current v29.08.2 code completes payment, creates the pending ShoutOut, supports club approval, plays the live browser animation, and returns approved content to the default Traditional Black and White screen after ten minutes. Fully automatic, outage-proof Xibo delivery additionally requires:

1. a server-side HTML-to-H.264 render job (or `.htz` package builder);
2. Xibo CMS API upload using a CMS URL, client ID, and client secret;
3. the Zebbies Xibo Display ID and target Layout/Playlist ID;
4. a readiness check that waits for the player to report the new media downloaded before scheduling it live;
5. cleanup/retention rules for expired patron media.

Until those credentials and the target display identifiers are supplied, use the connected Webpage mode for functional testing and upload a rendered MP4/HTML Package for low-bandwidth production.
