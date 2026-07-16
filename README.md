# CURRENT PACKAGE: FLOQR ShoutOut v29.08.2 Full Package

Stripe implementation planning and test-mode deployment: see `STRIPE-INTEGRATION-PLAN.md` and `STRIPE-DEPLOYMENT.md`. v29.08 adds trusted Accounts v2 recipient onboarding, backend-only club/member bindings, transfer-capability checks before destination charges, removal of manual `acct_...` browser fields, seller-scoped products, private order access, transactional inventory holds, refund/dispute webhook tracking, protected webhook/account records, and focused Connect/rules tests. Do not enable live marketplace payments until the merchant-of-record, fee, authenticated refund/transfer-reversal, and tax gates in the plan are complete.

v29.07.1 is a backward-compatible template-management patch. Master Admin now provides `View`, display-aware `Preview`, `Edit`, and status-dependent `Activate`/`Deactivate` actions in Available Templates; the edit form can preview unsaved changes; and previews switch among the supported physical display types at their correct aspect ratios and pixel dimensions. Admins can set the main-message total, lines, characters per line, subtext/attribution limit, main text size, and subtext size. Text sizes are stored as a percentage of display height, included in patron submissions, and enforced by the live display renderer.

v29.07 adds normalized club/event addresses and short public locations; collapsible crawler JSON; public/search Genres; Pickup Robotaxi simulation with four booking modes; entity Commerce with Stripe Checkout and licensed photo/video sales; paid/free guest-list distribution; role-capacity service following and campaigns; videographer/camera-operator service membership; REP permissions and approval workflow; guest-list themes, main images, and Supporting Team; staffing association approvals; paid-service invoices, shipping/digital delivery, and analytics; and Master Admin template View/Edit/Activate/Deactivate controls.

Pickup is explicitly a simulation: it makes no charge, dispatches no vehicle, and uses fictional map, vehicle, safety-contact, charge/range, distance, fare, and ETA data. The proposed future provider contract is documented in `TESLA-ROBOTAXI-SIMULATION-API.md`.

v29.06 adds controlled ShoutOut background customization and a consolidated Club Public Profile media manager. Master Admin marks each template background as editable or locked. Club Admin can enable or disable patron customization per venue and can create club-only background variants. Patrons may use every original compatible template, see club-approved backgrounds, and customize only when both the template and club permit it. Club Admin now uses one photo/video input to add, edit, replace, reorder, promote, filter, trim, or delete public-profile media. Video playback windows are adjustable and capped at 15 seconds. Template layout, text positions, media placeholders, character limits, and screen-format tags remain protected.

v29.05 adds Firebase smoke-test progress and export diagnostics, Master Admin entity onboarding and registered-patron club-admin assignment, localized scheduled venue discovery, template and display-format management, a repaired packaged ShoutOut logo, no-crop media framing, custom-email five-minute OTP sign-in, Club Admin SMS MFA enrollment/challenge handling, and one-control multi-file Mingl profile media ordering.

The default Traditional Black and White ShoutOut now declares and enforces three lines, 15 characters per line, and 45 visible characters total. The same template metadata model can define limits for new templates.

Deployment and authentication setup: see `DEPLOYMENT-V29-08.md`. Rollback instructions: see `ROLLBACK-V29-08.md`.

This ZIP is a full web app package for upload to the GitHub repo root.

Current live test URL after upload:

```text
https://jadzadco.github.io/shoutout-demo/?v=29.08.2
```

Current release highlights:

- Adds v29.04 patron-facing club public pages at `club-profile.html?location={clubLocationId}`.
- Club pages use a minimal hero-and-sections layout for the club logo, main media, description, location, genres, hours, age policy, dress code, amenities, FLOQR services, contact information, social media, gallery, upcoming events, past events, featured DJs, featured waiters/waitresses/bottle service, and promotion groups.
- Featured DJs, service staff, and promotion groups open compact profile popouts instead of expanding the main page.
- Venue Command Center > Club Public Profile now controls public page content, featured people, promotion groups, publish status, and section-by-section visibility.
- FLOQR club search result cards now include `View Club` links alongside the existing ShoutOut/select action.
- Protected patron, Mingl Chat, guest-list, club admin, promoter admin, role request, and Master Admin pages now run a required-profile guard. Signed-in users without `users/{uid}.profileCompleted === true` return to profile creation before the original safe same-site link resumes.
- FLOQR Inbox now loads user-owned messages, notifications, ShoutOuts, guest-list requests, chats, and Mingl connections through scoped Firestore queries. The optional users/employee directory loads after the Inbox renders.
- Reusable FLOQR command acknowledgement now includes an automatically closing result popout plus a manual `Close Window` button.
- `Save Mingl Friend Settings` now uses the command acknowledgement popout.
- Received Mingl requests now include `Accept Mingl` and `Deny` actions on the main Mingl page, Patron Portal Mingl Requests, and actionable Inbox request messages.
- Firestore and Storage rule headers now carry the v29.04 package version. The new club public-profile fields use the existing `clubLocations` and `clubMedia` rules; no new rule behavior is required.
- Direct rollback note for this package is `ROLLBACK-V29-04.md`; the previous known-good full package is `ShoutOut-wepApp.v29.03.zip`.

v29.04 focused manual tests:

1. Venue Command Center: open Club Public Profile, enter club copy and featured people, change section visibility, save, and confirm the acknowledgement includes `Close Window`.
2. Public club page: open `club-profile.html?location=zebbies-garden-washington-dc&v=29.04` as a completed patron. Confirm hero, club actions, event sections, and visible owner-controlled sections render.
3. Talent popouts: tap a featured DJ, waiter/waitress/bottle-service member, and promotion group. Confirm each opens a compact popout and both close controls work.
4. Required profile: use a new account to open a direct club, Inbox, Mingl Chat, guest-list, or admin link. Confirm profile creation cannot be bypassed and the original link resumes only after the profile saves.
5. Inbox speed: open Patron Portal > FLOQR Inbox and confirm messages/counts render before the optional user directory finishes loading.
6. Mingl friend settings: save settings and confirm the visible success popout auto-closes and also provides `Close Window`.
7. Mingl requests: receive a request and confirm `Accept Mingl` and `Deny` appear in Mingl, Patron Portal Mingl Requests, and the Inbox request message.
8. Request synchronization: accept one test request and deny another. Confirm the request status updates for both patrons and chat opens only for the accepted request.
9. Master Admin: run Package Install Diagnostics and Rules Smoke Test for v29.04.

- Adds v29.03 ShoutOut editor layout, preview modal, Mingl Requests status, profile status, birthday/privacy, and Mingl friend settings updates.
- ShoutOut editor now keeps the Message card first, places `Preview ShoutOut` directly inside the Message section, opens preview in a modal, and auto-closes preview after 5 seconds.
- ShoutOut recommendations are now grouped into `AI Recommendations`, `Trending ShoutOuts`, and `Generic ShoutOuts`, with helper copy behind compact `?` popouts.
- Mingl Requests now separate `Sent Mingl/Friend Request` from `Received Mingl/Friend Request`.
- Mingl Requests now show a right-side `(sent/received)` status button. Clicking it opens a request-type summary popout; clicking elsewhere closes it.
- Patron Profile now includes birthday month/day only, with no birth year.
- My Privacy now includes birthday notification choices for allowing system birthday notifications and selecting who can trigger birthday notifications.
- Patron Portal now includes `Manage Mingl Friends` for close friends, exclude from viewing, exclude from contacting, and only disappearing messages.
- Language Settings now includes emoji skin tone preference for FLOQR-provided human-style emoji actions.
- Mingl Chat message edit now opens an inline mini editor instead of the browser prompt.
- Mingl Chat message actions now include forward, do-not-forward, and immediate disappearing message options.
- The top-right signed-in profile status pill is now injected on main user/admin/backend pages, excluding display output pages.
- Firestore and Storage rule headers now carry the v29.03 package version. No new rule behavior is required for these UI/data-field changes under the current authenticated-user rule model.
- Direct rollback note for this package is `ROLLBACK-V29-03.md`; older rollback/readme history is bundled in the included rollback history ZIP.

v29.03 focused manual tests:

1. ShoutOut editor: open a ShoutOut editor, confirm `Preview ShoutOut` appears inside the Message card, click it, confirm the modal preview renders, closes via Close, and auto-closes after about 5 seconds.
2. Recommendations: confirm AI, Trending, and Generic recommendation sections appear below Message and helper copy appears only via `?` popouts.
3. Mingl Requests: send or view Mingl requests, confirm the list is grouped into Sent and Received, and click the `(sent/received)` status to view the summary popout.
4. Patron Profile: save birthday month/day only, then reload Patron Portal and confirm values persist.
5. My Privacy: save birthday notification settings and confirm they persist.
6. Manage Mingl Friends: open the tab, search mutual Mingl friends, set close friend/exclusion/disappearing-message choices, save, and reload.
7. Mingl Chat: tap your sent message, choose Edit, confirm inline mini editor appears instead of a browser prompt. Test forward, do-not-forward, and disappearing actions.
8. Profile status: confirm the top-right profile status pill appears on the main app, Patron Portal, Mingl Chat, Master Admin, Venue Admin, Guest List, Promoter Admin, and Role Request pages, but not on the Xibo display page.

- Adds v29.02 ShoutOut recommendation, grammar dictionary discovery, and location-ranking test fixes.
- ShoutOut recommendations now use recommendation style, event/audience context, venue genres, profile signals, and past ShoutOuts as guidance without inserting visible `Tone:` or `Style:` wording into patron text.
- ShoutOut templates now expose safe display caps; the editor trims AI/manual text to the selected template's main and attribution/subtext character limits.
- The ShoutOut editor now includes an Event / audience context selector for Birthday, VIP/Table, R&B, Afrobeats, Latin/Reggaeton, Romantic, Graduation, and General Party.
- Patron Portal > Language Settings now shows exactly how to test personal dictionary corrections such as `watz -> what's` and `weakend -> weekend`.
- Club/event search now shows a visible ranking status line explaining whether nearby/profile location plus preferences are being used.
- Mingl Chat composer now keeps Correct Grammar/Spelling under Edit, removes low-value draft selection helpers, and keeps emoji shortcuts only as dynamic emoji actions.
- Mingl emoji actions now send lightweight animated reactions: heart pulse, confetti pop, fire lift, laugh pop, and smile pop before settling as normal emoji messages.

v29.02 focused manual tests:

1. ShoutOut recommendations: open a ShoutOut editor, select a template, choose a Recommendation style and Event / audience context, type a draft, wait one second, then click `Improve My ShoutOut`. Confirm suggestions change by style/context and do not insert literal `Tone:` or `Style:` labels into the message.
2. Template caps: switch between Traditional Black & White and any media template. Confirm the `Template display cap` line changes and long AI/manual text is trimmed before preview/submission.
3. Personal dictionary grammar: open Patron Portal > Language Settings, add `watz -> what's` and `weakend -> weekend` under My Personal Corrections, save, open Mingl Chat, type those words, then use Correct Grammar/Spelling. Gemini is tried first; if unavailable, only your saved corrections are applied.
4. Location-aware ranking: sign in as a patron with city/state/country and music preferences, search clubs or events near that city, then allow browser location once and deny it once. Confirm the ranking status line remains visible and matching nearby/preferred venues appear above unrelated cities.

- Adds Master Admin > Club / Promoter Onboarding for single-club creation, CSV club imports, and promoter onboarding records.
- New club onboarding writes `clubLocations`, `clubs`, and `clubOnboardingRecords`, then exposes the new club admin portal URL.
- Club Admin now supports venue media policy controls: 1 main media item, 5 public images, and 5 marketing videos with DJ/promoter datapoints.
- Club Admin now supports role election scaffolding for Club Admin, DJ, Promoter, and Waiter / Waitress / Bottle Girl, with patrons as the required worker source.
- Club Admin now supports up to 6 guest list campaigns, enable/disable controls, archive/reuse status, and event type choices for Free Admission, Free Admission with RSVP, or Ticketed.
- Mingl Chat filters diagnostic/demo chat rooms such as `Diagnostics Peer` and placeholder `Mingl Chat` from the patron-facing chat list.
- Mingl Chat renders participant chat rooms first, then checks older Mingl connections, reducing the blank `0/0` loading period.
- Mingl Chat shows clear loading/ready status while rooms are being checked.
- Mingl Chat action popout is constrained inside the selected chat window and scrolls when commands exceed the visible space.
- Package diagnostic checks can now be archived after they pass.
- Package diagnostic archives store when the test ran, when it was archived, package/check labels, status, and evidence.
- Package diagnostic archives can be downloaded as CSV from Master Admin > Diagnostics.
- The archive button now gives visible working/done/error status through the diagnostics status line.
- Firestore and Storage rule headers now carry the v29.02 package version.
- Direct rollback note for this package is `ROLLBACK-V29-02.md`; older rollback/readme history is bundled in the included rollback history ZIP.
- Adds v28.99 targeted ad campaign management and ShoutOut splash targeting.
- Adds separate demo ad campaigns for Cuisine Bantu, Puff Club, and Lima DC with their own media, copy, Canva source links, targeting tags, campaign datapoints, and analytics metadata.
- Adds Master Admin > Ad Campaign Management so admins can review and edit target tags, campaign datapoints, and optional required target groups.
- ShoutOut and club action splash ads now select eligible campaigns by patron datapoints instead of forcing one highest-scored ad forever.
- Campaign location targeting is optional and only enforced when a campaign explicitly defines required target groups.
- Adds `ad-campaign-preview-v28.99.html` for reviewing the current campaign creatives.
- Fixes the ShoutOut landing logo to use the official `images/shoutout-logo.png`.
- Adds manual diagnostics archive controls and crawl contact CSV/export controls.
- Historical note: v28.99 Firestore and Storage rule headers carried the v28.99 package version.
- Historical note: v28.99 direct rollback note was `ROLLBACK-V28-99.md`.
- Adds v28.98 Mingl Chat List Diagnostics Archive fixes.
- Restores the visible Mingl Chat room list by keeping the room list card separate from the selected-chat popout.
- Master Admin Feature Diagnostics now keeps Failed, Soft Fail, and TBI checks visible while archiving passed checks behind `View Archived Passed Diagnostics`.
- Mingl Requests now show readable separated lines for patron name, request status, explanation, shared datapoints, and action buttons.
- Help `?` popouts now close when the patron clicks anywhere else on the page, presses Escape, or opens another help popout.
- Removes the visible `Mingl Chat` card/frame from the main Mingl landing page. Chat access remains through the top `Chat` shortcut and the dedicated `mingl-chat.html` page.
- Mingl Chat now opens a selected patron conversation as a focused popout instead of dropping the chat window below the list on mobile.
- The selected chat popout includes a close button and no longer auto-opens the first room before the patron chooses a conversation.
- Main Mingl page no longer renders the extra embedded chat frame or the extra `Mingl Chat` card; it keeps discovery, matching, Mingl requests, and the top shortcut to the dedicated Mingl Chat page.
- Shared-background system messages now explicitly tell the receiving patron to tap `Approve Background` or `Keep Mine Private`.
- Shared Mingl chat background requests now create a real consent card for the other patron with `Approve Background` and `Keep Mine Private`.
- The composer `+` action menu retracts after a command runs or a media/background picker opens.
- Emoji shortcuts in the `Emoji Actions` section render as actual emoji symbols and send dynamic reaction effects.
- Tapping one of your sent Mingl messages opens message commands: `Unsend`, `AutoFix`, `Edit`, `Bounce`, `Explode`, `Scroll`, and `Disappear`.
- Adds standalone Mingl Chat text animations for `Bounce`, `Explode`, `Scroll`, and `Disappear`.
- Forces the standalone Mingl Chat script to rebuild old cached/partially uploaded composer markup into the requested clean layout: message box, Send, and a right-side `+` action popout.
- Firestore rules now allow participants to read older Mingl connection records that only stored `requestedBy` / `requestedTo`, so legacy accepted chats can be found and rebuilt.
- Restores older accepted Mingl conversations on the standalone Mingl Chat page by reading mutual `minglConnections`, normalizing missing/legacy `chatRooms`, and accepting older Mingl room markers such as `mingl_...` room IDs.
- Replaces the visible chat tool row with a compact action popout on the right side of the message input. Commands are nested under `Emoji Actions`, `Add Photo/Video`, `Edit`, and `Chat Background`.
- `Correct Grammar/Spelling` is executable from the nested `Edit` section, and sent-message actions still offer `Unsend`, `AutoFix`, `Edit`, `Bounce`, `Explode`, `Scroll`, and `Disappear` when tapping your own bubble.
- Mingl Chat media upload now supports both pictures and videos. Uploaded videos render in the message bubble with native controls.
- Mingl Requests remain on the main Mingl page, separate from the standalone Mingl Chat inbox.
- Repeated helper/instruction text across app pages now collapses behind compact `?` help popouts. The shared `helper-popouts.js` also watches dynamically rendered helper text.
- The highlighted Mingl Requests description is now hidden until the patron taps the `?` popout.
- Mingl Chat now has its own page: `mingl-chat.html`. The main Mingl page links directly to it, mutual Mingl request links open it, and old `patron-portal.html?tab=chats`, `?tab=mingl`, and `?tab=mingl-chat` URLs redirect to it.
- Patron Profile and Settings no longer presents Mingl Chat as an internal settings panel. It keeps a link to the standalone Mingl Chat page only.
- Fixes the v28.88 Package Install Diagnostics cache-bust mismatch where the current diagnostics still looked for `styles.css?v=28.87-mingl-chat-diagnostics`, `patron-app.js?v=28.87-mingl-chat-diagnostics`, and `patron-portal-app.js?v=28.87-mingl-chat-diagnostics`.
- Mingl uses one canonical chat inbox on the standalone page. The public Mingl page remains for discovery and matching, then routes chat into `mingl-chat.html`.
- Mingl chat media sending uses the composer action popout. If Storage rules are not deployed, the upload error clearly names the `mingl-chat/{uid}/{roomId}` Storage path.
- Manual `Fix Grammar` now runs when clicked without requiring the language settings toggle first. Gemini/Firebase Functions remains first, and patron personal corrections remain the local fallback.
- Height now stores a `heightUnit` datapoint. U.S. and Canada profiles default to `ft/in`; all other countries default to meters, with an editable unit dropdown.
- Club admins can reset the currently live display back to that club location's default ShoutOut.
- Official ShoutOut templates now have searchable `tags`, allowing contextual searches like birthday flowers, VIP table video, tattoo/ink, summer pool party, Ferrari, Lamborghini, fast cars, coupe, and luxury ride.
- Historical note: v28.98 Firestore and Storage rule headers carried the v28.98 package version.
- Historical note: v28.98 direct rollback note was `ROLLBACK-V28-98.md`.
- Adds v28.88 Mingl grammar and profile datapoint fixes.
- `Fix Grammar` calls Gemini through Firebase Functions first. If Gemini is unavailable, the browser only applies the patron's saved personal correction pairs and preserves the patron's My Word List. There is no generalized local typo dictionary.
- Adds editable `My Word List` and `My Personal Corrections` under Patron Portal > Language Settings. Patrons can save repeated typos such as `watz -> what's` or protect names, handles, slang, and preferred spellings.
- Gemini correction prompts now allow a patron to use the suggestion, keep the original, add the changed word to My Word List, or save the correction pair for repeated future typos.
- Adds `Height` as a user profile datapoint on first-time profile setup, Patron Portal profile editing, public profile preview, privacy datapoint selection, and Mingl contextual matching/search.
- Adds Master Admin > Club Admin URLs with direct `admin.html?location=...` and `display.html?location=...` links for each club/location.
- Fixes idle ShoutOut display fallback text so a non-Zebbies location with stale/default live content shows its own venue default, such as `USE SHOUT OUT @ SHÔKO` or `USE SHOUT OUT @ JOSEPHINE`.
- Mingl chat background changes now remain local to the requesting patron until the other patron approves the shared background request.
- Patron Portal Help now contains feature help sections for Mingl, ShoutOut, Bata, and Fix Grammar; Mingl Rules are no longer shown as the main Mingl Chat content.
- Historical readme/rollback artifacts are compressed into the included rollback-history ZIP so GitHub uploads stay manageable.
- Historical note: v28.88 also carried matching Firestore and Storage rule headers for that package.
- That package's direct rollback note is `ROLLBACK-V28-88.md`.
- Adds v28.87 Mingl Chat Diagnostics fixes.
- Public Mingl Chat and My Profile and Settings > Mingl Chat now keep the text input, picture control, Fix Grammar, and Send controls visible on mobile.
- Sent Mingl message actions still open by tapping/clicking the sent bubble, and `Unsend` is available only before the recipient reads the message.
- Incoming Mingl messages are marked as read for the viewing patron. Sent messages show a small thumbs-up `Read` marker after the recipient opens the chat.
- Updates Firestore rules to `v28.87-mingl-read-receipt-rules` so participants can write their own read-receipt metadata without broad chat access.
- Master Admin > Diagnostics now has a clear `Run Diagnostics` button for rerunning feature diagnostics and saving a fresh `featureDiagnostics` record to `aiDiagnosticsReports`.
- Mingl feature diagnostics now separate installed workflow health from live Firestore data coverage: zero live Mingl records is not treated as a feature failure when no Firestore error exists.
- `Mingl matching`, `Let's Mingl request workflow`, and `Mingl chat rooms` now explain whether no records were found yet, whether an optional participant query was blocked, and when to create/accept a Mingl request before rerunning diagnostics.
- The live Firebase rules proof remains `Run Rules Smoke Test`. If the latest current-package rules smoke test shows a failed result, publish the package `firestore.rules` and `storage.rules` in Firebase Console, then rerun that smoke test separately from `Run Diagnostics`.
- That package's direct rollback note is `ROLLBACK-V28-87.md`.
- Adds v28.86 Mingl Actions, Chat Media, and Personalized ShoutOut AI fixes.
- The public Mingl hero now replaces the old explanatory sentence with two icon buttons: `Chat` and `Search for People`.
- Personalized ShoutOut recommendations are now live/contextual. They rebuild from the current draft, selected tone, selected template, venue context, the signed-in user's own profile signals, and the user's own past ShoutOuts. Gemini receives this context through Firebase Functions when deployed; local personalized fallback remains available.
- Live Preview now also calls the display iframe renderer directly after load so selected image/video media appears inside the actual ShoutOut board instead of remaining as an `IMAGE / VIDEO` placeholder.
- ShoutOut confirmation now shows `Edit ShoutOut`, `Mingl`, and `Bata` actions. The old `Create another ShoutOut`, `Choose another location`, and `Sign out` actions are not used on the confirmation splash.
- Mingl sent-message actions now open from tapping/clicking a sent message bubble. Actions include `Bounce`, `Explode`, `Throw Graffiti`, `Edit`, `Auto Correct`, `Delete after read`, and `Unsend`; the old always-visible `Edit` button is removed. `Delete after read` soft-expires after the recipient opens the thread.
- Mingl chat pictures can be shared from public Mingl chat and My Profile and Settings > Mingl Chat. My Profile and Settings also supports a per-chat background image for the current patron.
- Updates Firestore rules to `v28.86-mingl-message-action-rules` for sender-only message action metadata.
- Updates Storage rules to `v28.86-mingl-chat-media-rules` for `mingl-chat/{uid}/{roomId}/...` and `mingl-chat-backgrounds/{uid}/{roomId}/...`.
- Updates Master Admin Diagnostics package checks, storage smoke tests, and manual feature tests for the v28.86 changes.
- The v28.86 rollback note is superseded by the current direct rollback note.
- Adds v28.85 ShoutOut Preview, Confirmation Splash, and Mingl Page fixes.
- ShoutOut media helper text now uses compact popout bubbles: Media details, Video trim warning, and How AI enhancement works.
- Live Preview now receives the selected local image/video preview URL before submission and renders it inside the actual ShoutOut display board. Submission still uploads and saves Firebase Storage URLs.
- Long video preview metadata is passed into the display iframe so the preview and final ShoutOut representation both respect the first-7-seconds rule.
- The earlier v28.85 two-action confirmation splash is superseded by the v28.86 `Edit ShoutOut`, `Mingl`, and `Bata` action set.
- My Profile and Settings > Mingl now uses a minimalist dashboard. `Mingl Rules` and `Mingl Requests` are nested buttons, request details show recent 10-day activity plus unresolved requests, and mutual Mingl Chat opens on a separate page with a Back to Mingl button.
- Updates Master Admin Diagnostics package checks and manual feature tests for the ShoutOut preview, popout helper text, confirmation splash, and separate Mingl Chat page.
- The v28.85 rollback note is superseded by the current direct rollback note.
- Adds v28.84 ShoutOut Media, Mingl Chat, and Grammar Settings fixes.
- Repairs media-capable ShoutOut templates so the editor shows one clear `Upload Image or Video` card with preview, `Remove file`, AI media enhancement controls, and a visible video trim warning.
- Long ShoutOut videos are not blocked. Patrons are warned and FLOQR uses the first 7 seconds through client trim where available, or first-7-second metadata/display fallback when browser trimming is unavailable.
- Adds nested `Ai Image/Video Enhancement` commands: `Neon`, `VIP Style`, `Club Ready`, `B&W`, `Warm`, and `Original`. Each command previews immediately, shows a temporary definition bubble, and `Apply filter` saves the selected enhancement metadata.
- Keeps Gemini image enhancement routed through Firebase Functions with no frontend API key. Browser filters remain the fallback preview path.
- Updates Mingl Chat on both the public Mingl page and My Profile and Settings to behave like a normal chat thread: message bubbles, current user on the right, recipient/system messages left/center, `Start the conversation.` empty state, immediate pending bubble after Send, and no confirmation/redirect overlay after sending.
- Adds `Language Settings` under My Profile and Settings with AI grammar/spelling assistance, correction mode, highlight options, preferred language, and tone preference.
- Adds `ai-grammar-service.js` plus the Firebase callable scaffold `aiSuggestGrammarCorrection`. Grammar correction processes draft text only when the user taps `Fix Grammar`; private drafts are not indexed or stored unless the user sends the message.
- Updates Master Admin Diagnostics package checks and manual feature tests for the ShoutOut upload card, nested AI media filters, Mingl chat bubbles, Language Settings, and grammar correction workflow.
- The v28.84 rollback note is superseded by the current direct rollback note.
- Adds v28.83 Mobile Mingl Datapoints and FLOQR Inbox fixes.
- Matched public Mingl cards now use nested datapoint categories, matching the public profile behavior. The old flat paragraph of datapoints was removed from matched cards.
- Mobile/tablet datapoint panels now open inside the card instead of floating off-screen on iPhone.
- FLOQR now marks browser mode as mobile, tablet, or desktop with `data-floqr-device` and matching root classes so responsive fixes can target the right device family.
- Adds device-specific responsive layout rules for mobile, tablet, and PC across patron pages, My Profile and Settings, Mingl, Master Admin Diagnostics, and admin report cards.
- `Messages` is renamed to `FLOQR Inbox` in the patron portal tab, overview metric, message list heading, profile menu, and relevant action feedback.
- Patrons can accept a received `Friend or Mingl Request` by clicking `Mingl Back` from FLOQR Inbox or from My Profile and Settings > Mingl > Mingl Requests.
- My Privacy checkbox labels now stay inside their cards on mobile Safari/iPhone layouts.
- Adds v28.83 package diagnostics and manual tests for mobile nested datapoints, responsive device categories, FLOQR Inbox rename, and Mingl Back acceptance.
- The v28.83 rollback note is superseded by the current direct rollback note.
- Adds v28.82 Mingl Requests, My Privacy, and Public Media Sharing.
- Adds the `Let's Mingl` request flow in the public Mingl room. Matched public patrons can request to Mingl, and full Mingl Chat opens only after both parties approve.
- Creates a `Friend or Mingl Request` notification/message/audit trail with timestamp, shared datapoint context, and requester location text when available.
- Adds realtime Mingl Chat rendering with sender-owned message editing, emoji shortcuts, and AI-ready spelling/grammar cleanup with local fallback.
- Keeps deterministic Mingl participant reads as the supported safe path. The optional participant array query remains non-blocking and should not be used as a reason to loosen Firestore rules broadly.
- Renames the patron portal to `My Profile and Settings` and removes the duplicate `Settings` / `FLOQR Settings` heading.
- Moves Privacy under `My Profile and Settings` and renames it `My Privacy`.
- Adds `publicMinglDatapoints` choices so patrons choose which datapoints can be public/shared and used for Mingl matching or other privacy-respecting features.
- Adds `Public Media and Data Sharing` under My Profile and Settings. Profile media uploads live there, captions are removed, and optional GPS metadata from JPEG uploads can be added to Travel only when the patron chooses it.
- Adds the shared `floqr-action-feedback.js` overlay for clear working/success/failure feedback on the new profile, privacy, media, messaging, Mingl, and diagnostics actions.
- Updates Firestore rules to `v28.82-mingl-request-chat-rules` for Mingl audit records, system request messages, and owner message-edit support.
- Adds Master Admin Diagnostics package checks and manual feature tests for the new Mingl, privacy, media, and action-confirmation behavior.
- The prior v28.82 rollback note is superseded by the current direct rollback note. Historical rollback/readme artifacts should not be included in future full packages.
- Adds v28.81 Manual Feature Test Diagnostics under Master Admin > Diagnostics.
- Adds a checklist of implemented or changed user-facing features with plain-English test steps and expected results.
- Master Admin can mark each manual test as `Succeed` or `Failed` and add a testing/failure note.
- Plain-language result choices are Succeed or Failed so the person testing the package can record what actually happened.
- Adds a live manual diagnostic TXT output that can be copied or downloaded.
- Adds a copy-ready Codex resolution prompt that automatically includes failed manual checks and Master Admin notes.
- Adds failed manual checks to the full `Export Diagnostics TXT` attention summary and COPY/PASTE FIX PROMPT.
- Adds package install diagnostics for the manual feature checklist UI, output builder, and prompt builder.
- Keeps package hygiene: the package root includes only the live `README.md` and the current direct rollback note.
- Adds v28.80 Location-Aware ShoutOut and Template AI.
- Adds `ai-location-service.js` with `getUserLocationContext(user)`, `rankLocationsForUser(locations, userContext)`, `geminiRankLocations(locations, userContext)`, and `localRankLocations(locations, userContext)`.
- Browser geolocation is requested only as an optional ranking signal. If the patron denies geolocation, FLOQR falls back to the signed-in user's own profile/settings city, state/region, country, preferred cities, favorite genres, venue types, and interests.
- Adds Gemini contextual ranking through the safe Firebase callable `aiRankLocations` when `FLOQR_AI_ENABLED` and Firebase Functions are configured. Local deterministic ranking remains the default fallback.
- Removes the fictitious Heist Houston test record from static/local club data and seed data. Seeder cleanup now marks obsolete Heist Houston Firestore and AI index records deleted so it does not appear in patron search, contextual search, default recommendations, or club cards.
- Enables Gemini-ready ShoutOut template help through `floqrSuggestShoutOutAsync` and the backend callable `aiSuggestShoutOut`. The UI keeps curated LED-safe suggestions as fallback and never exposes Gemini API keys in frontend code.
- Adds tone shortcut buttons for ShoutOut copy help: Birthday, VIP, Romantic, Party, and Classy.
- Keeps the default ShoutOut template gallery behavior: the first view shows only Traditional Black and White ShoutOut. Search, contextual recommendations, user-owned templates, and community matches reveal other templates.
- Keeps admin/official template layouts locked. Patrons can customize only backgrounds for saved variants.
- Improves media-capable templates with one clear `Upload Image or Video` control, `Remove file`, preview, AI media enhancement controls, and first-7-second video trim/warning behavior.
- Uploaded images and videos continue to use contained mobile previews with `object-fit: contain`, so portrait photos, landscape photos, and videos do not expand out of the editor.
- Live Preview stays below text inputs, AI suggestions, media upload, AI media enhancement, and submit controls.
- Adds package diagnostics for location ranking, Gemini ShoutOut help, obsolete Heist cleanup, media remove control, and the current direct rollback file.
- Keeps package hygiene from v28.79: future full packages should include only the live `README.md` and current direct rollback note.
- v28.80 test checklist: upload the package, hard-refresh with `?v=28.80-location-template-ai`, confirm Heist Houston is absent from club search, confirm nearby/preferred clubs rank higher, confirm Traditional Black and White ShoutOut is the only default template, search for `birthday template with flowers`, upload portrait/landscape/video media on mobile, remove the selected media, submit a media ShoutOut, approve it, and verify the display page renders the selected media.
- v28.80 rollback note: use only `ROLLBACK-V28-80.md` for the direct rollback path. The rollback restores the previous package files and does not remove Firebase Auth users, user profiles, ShoutOut history, Mingl data, Bata planning data, guest lists, or uploaded media.
- Adds the FLOQR AI-ready layer as a contextual platform service instead of isolated one-off AI features.
- Adds default-off feature flags in `shared-data.js`: `FLOQR_AI_ENABLED`, `FLOQR_AI_PROVIDER`, `FLOQR_AI_FALLBACK_MODE`, `FLOQR_AI_STUDIO_ENABLED`, and `FLOQR_AI_ASSISTANT_ENABLED`.
- Adds standalone AI modules: `ai-service.js`, `ai-index-service.js`, `ai-search-service.js`, `ai-notification-service.js`, `ai-assistant-ui.js`, `ai-template-studio.js`, `ai-media-service.js`, `ai-discovery-service.js`, and `ai-diagnostics-service.js`.
- Adds Firestore-ready schemas and rules for `aiIndex`, `aiUserNotificationPreferences`, `aiUserSignals`, `aiSearchLogs`, `aiRecommendations`, `aiDiscoveryQueue`, `aiAssistantSessions`, `aiAssistantMessages`, `patronTemplateVariants`, `aiTemplatePromptHistory`, `aiDiscoverySources`, `aiDiscoveryRatingCriteria`, `aiCrawlRuns`, `aiCrawlerSchedules`, and `aiDiagnosticsReports`.
- Keeps FLOQR AI disabled by default. With all AI flags false, the app loads normally and uses local contextual search.
- Adds `floqrSearch(query, context)` with local contextual fallback for venue, event, Mingl, and ShoutOut template search.
- Adds a flag-gated `Ask FLOQR` assistant shell after login when `FLOQR_AI_ASSISTANT_ENABLED` is true.
- Adds Settings > AI Notification Preferences in the patron portal.
- Renames the patron portal framing to My Profile and Settings and adds My Profile, My Privacy, AI Notification Preferences, My ShoutOut Templates, Public Media and Data Sharing, and related account surfaces.
- Adds patron-created ShoutOut template variants. Official/admin template layout stays locked; patrons can customize only the background.
- Adds template gallery sections: Official FLOQR Templates, My Saved Templates, and Community Templates.
- Adds FLOQR Studio / Design Background with AI UI. Live image generation is not configured yet, so it uses safe placeholder behavior and does not expose API keys.
- Adds ShoutOut media AI readiness: browser filter previews, enhancement metadata, AI-ready moderation fields, and first-7-second video trim behavior with user warnings.
- Adds Super Admin discovery-review tools on Master Admin > AI Crawling for public event/venue review, rating criteria, approve/reject/delete/duplicate actions, and soft delete/restore for `clubLocations` and `events`.
- Adds Master Admin Settings > Diagnostics with app-wide feature status, package checks, Firebase rules smoke tests, diagnostic export, and status labels: Pass, Soft Fail, Failed, and TBI.
- Adds a consolidated Master Admin > AI Crawling page for crawler criteria, crawl schedule, crawl review record creation, discovery review, consolidated crawl reports, collected-record analytics, and crawler JSON/profile imports.
- Adds crawler search criteria for rooftop lounges, rooftop bars, comedy shows, Latin and Arabic music, DJs, Ticketmaster/Eventbrite/resale ticket discovery, Dubai, Istanbul, Singapore, Thailand, Shanghai, and Western European market/language searches.
- Adds public profile language publishing choices so patrons can display their public profile in their preferred/original language or the English version. AI translation is scaffolded without frontend AI keys.
- Adds Package Install Diagnostics under Master Admin > Diagnostics so each package can verify its own feature markers after upload.
- Adds Firebase Rules Smoke Test under Master Admin > Diagnostics to verify signed-in Firestore and Storage rules compatibility after publishing a package.
- Fixes the v28.44 AI search package marker diagnostic so it checks the fallback engine in `ai-service.js` and the adapters in `ai-search-service.js`.
- Adds clearer Storage unauthorized guidance when deployed Storage rules are missing the package media paths.
- Separates discovered-record workflow statuses from feature-health statuses.
- Simplifies the crawler Market Language Plan explanation with a one-line format and examples.
- Adds a clearer onboarding/profile permission message when Firestore rules block `users/{uid}` profile save.
- Adds a Master Admin rules smoke test for the exact `users/{uid}` profile save path.
- Protects already-onboarded users from being treated as new users when Firestore profile reads are blocked.
- Preserves existing profile values by not writing blank onboarding fields over populated fields.
- Preserves existing `createdAt` values by only setting `createdAt` when the user profile document does not already exist.
- Adds a visible `FLOQR FIRESTORE RULES VERSION` note at the top of `firestore.rules` so Firebase Console rules can be checked quickly.
- Adds a Master Admin Diagnostics rules status panel showing the expected Firestore rules version, package rules note status, latest live smoke-test result, and overall rules status.
- Expands `Run Rules Smoke Test` into an app-wide rules compatibility diagnostic for core app collections, AI collections, Mingl/chat queries, and Storage paths required by FLOQR.
- Adds `Export Diagnostics TXT` under Master Admin > Diagnostics. The export includes current feature diagnostics, package install diagnostics, saved `aiDiagnosticsReports`, failure reasons/evidence, and a copy/paste prompt for Codex to fix the reported issues.
- Adds plain-English rules guidance in Master Admin Diagnostics so the page explains whether the package file is current, whether live Firebase deployed rules passed, the likely fix, and a copyable prompt for Codex.
- Carries forward the v28.57 Mingl/Storage rules work and supersedes it with the v28.59 rules notes below.
- Adds a safer Mingl fallback path so patron Mingl can read deterministic participant docs if Firebase rejects participant list queries.
- Cleans up Master Admin Diagnostics so old failed rules smoke tests are shown as historical reference, not current package failures.
- Uses scoped reads for protected collections in Diagnostics instead of broad collection reads that Firebase rules should deny.
- Fixes the older v28.53 package marker check so it no longer fails on wording that was intentionally simplified later.
- Updates Firestore rules to `v28.59-diagnostic-cleanup-rules` so temporary `diagnosticRunId` Mingl connection records can be deleted by their participant during the rules smoke test.
- Updates Storage rules to `v28.88-mingl-grammar-profile-datapoints-storage-rules` so uploads still require owner, size, and file-type checks while deletes use an explicit owner delete rule, including Mingl chat image/background paths.
- Adds step-level rules smoke-test evidence so failed Mingl/chat checks identify create/read/update/delete, and failed Storage checks identify upload/download/delete.
- Clarifies `Firestore: minglConnections participant query compatibility` as an optional compatibility check. If the deterministic Mingl participant lifecycle passes but the array-contains participant query is denied, Diagnostics now reports a non-blocking Soft Fail: `Optional participant query blocked; fallback participant document reads passed.`
- Keeps Firestore rules strict for Mingl. Do not loosen Firestore rules broadly or allow all signed-in users to list `minglConnections` just to make the optional query pass.
- Adds AI Crawler Profile Import. Crawler-discovered public club/event destination data can be formatted as JSON, saved as reviewable `aiDiscoveryQueue` import drafts, applied by Master Admin as missing fields only, or sent to a Club Admin as an import link.
- Consolidates crawler reports so matching clubs/events are grouped together. If crawler sources provide different non-empty addresses for the same destination, Master Admin sees an address-conflict warning before approval/import.
- The standalone AI Discovery tab was removed because it duplicated the newer `AI Crawling` page. The useful review/approval tools remain on AI Crawling: rating criteria, Review Discovery Queue, approve/reject/duplicate/delete, and listing delete/restore.
- Adds Plain-English crawl input on Master Admin > AI Crawling. Master Admin can type a contextual request such as `search for all clubs playing hip hop and EDM in Paris, Marseille, Monaco, St. Tropez, France`, build the search plan, and create one review record per city/genre/type search.
- Expands crawl requests into structured search jobs with city, country, language, genre, event type, query, and required datapoints. The example above creates eight search jobs: Hip Hop and EDM across Paris, Marseille, Monaco, and Saint-Tropez.
- Replaces confusing discovery queue output with review cards showing record type, name, description, address, phone, website/source, ticket link, city/country, categories, genres, missing required datapoints, and source-search links.
- Blocks approval of crawler-discovered clubs, lounges, rooftop bars, beach clubs, events, and comedy shows until required datapoints are filled.
- Adds Source Detail Extraction under Master Admin > AI Crawling. After opening a Google/Eventbrite/Ticketmaster/resale/venue result, Master Admin can paste the final source URL and copied page details, extract real datapoints, and save a proper review record.
- Adds Firebase callable `aiExtractPublicSourceUrl` for server-side public URL extraction. When deployed, it can fetch public Eventbrite/source pages, parse JSON-LD/metadata/text, and return structured review records that include date, time, address, ticket URL, source URL, categories, and missing-datapoint status.
- Explains the v28.64 miss: FLOQR generated a source-search URL but did not follow the Eventbrite page, so it could not extract visible details such as `30 Crosford Road Singapore 499550`.
- Adds deployable `functions/index.js` and `functions/package.json` for the FLOQR AI functions folder.
- Adds a search-results page guard. Google search pages, Ticketmaster search pages such as `ticketmaster.com/search?q=comedy+shows`, and Eventbrite directory pages are treated as candidate-finding pages, not final event records.
- Blocks saving broad search-results pages into `aiDiscoveryQueue` as approvable review records. Master Admin must open one specific event/venue detail page, provide a final event-detail URL, or paste copied event-card details before saving.
- Adds the same search-results guard to the Firebase callable extractor so frontend and backend behavior match.
- Adds raw crawled/input data and parsed data output to Source Detail Extraction previews and AI Crawling review cards. Master Admin can now see the original input/search/source snapshot beside the exact fields FLOQR parsed and saved.
- New records include `rawCrawlInput`, `parsedData`, and `extractionAudit` so cached/saved queue records can be distinguished from freshly extracted records.
- Adds stale crawl cleanup under Master Admin > Stale Record Cleanup. This soft-clears old generated/search-plan crawl records from active review without touching approved listings, user profiles, ShoutOuts, guest lists, or audit history.
- Fixes clean crawl query generation so recognized cities use their real country/region and do not inherit broad defaults. Example: `Singapore comedy show tickets` now plans a Singapore/Singapore record with a clean crawl query such as `comedy show Singapore tickets`, not a Western Europe/France queue record.
- Adds a dedicated Master Admin > Stale Record Cleanup tab. Stale records are queue records more than 4 days old, records referencing old Firestore/Storage rules, or records referencing old/unknown locations.
- Stale cleanup now covers both AI discovery queue records and club ShoutOut queue records. ShoutOut cleanup soft-marks queue records as `status: "stale"` with `staleCleanupStatus: "stale-shoutout-cleared"` instead of deleting approved/live ShoutOut history.
- Adds Master Admin > Duplicate Records to scan likely duplicate `clubLocations`, choose the correct primary record, and merge duplicate records into safe aliases.
- Duplicate merge keeps the primary club active and marks duplicates as `status: "merged"`, `active: false`, `canonicalLocationId`, and `mergedInto` instead of deleting records.
- Creates `clubLocationAliases/{duplicateId}` so old links, admin/display URLs, search records, events, ShoutOuts, and guest list references can resolve to the primary club.
- Adds a known static Shôko Barcelona alias so `Shôko Barcelona Beach Club` resolves to `Shôko Barcelona` and the duplicate no longer appears as a separate active static listing.
- Updates patron, club admin, and display routing to resolve club aliases before rendering public search, ShoutOut selection, admin queues, and LED/display live content.
- Updates Firestore rules to `v28.70-duplicate-alias-rules` for the new alias collection. Publish `firestore.rules` after installing this package, then rerun Master Admin > Diagnostics > Run Rules Smoke Test.
- Adds `Run Merge Diagnostic` on Master Admin > Duplicate Records so Master Admin can verify whether a merge actually completed.
- Duplicate Records now labels the data source. A successful duplicate scan uses live Firestore `clubLocations`; static fallback data is used only as alias evidence, not as the live duplicate list.
- The Duplicate Merge Diagnostic checks the primary club, duplicate club, `clubLocationAliases/{duplicateId}`, static fallback aliasing, and leftover references in `events`, `shoutouts`, and `guestListRequests`.
- Fixes the stuck `Merging duplicate club records...` state by catching Firebase write failures and showing the exact failure reason.
- Adds Master Admin click feedback so button/link clicks show a visible confirmation message while the feature-specific result loads.
- Makes duplicate merge alias-resilient. FLOQR now writes the core duplicate merge to `clubLocations` first, then attempts `clubLocationAliases` and `aiIndex` as optional follow-up writes.
- If deployed Firebase rules still block `clubLocationAliases`, the core duplicate merge can still pass: the duplicate club is marked `status: "merged"`, `active: false`, and points to `canonicalLocationId`.
- Alias-document permission problems now show as a targeted Soft Fail after the core duplicate merge, with the fix: publish `firestore.rules` containing `FLOQR FIRESTORE RULES VERSION: v28.70-duplicate-alias-rules` or newer.
- Defines merge completion by the canonical duplicate document. Once `clubLocations/{duplicateId}` has `status: "merged"`, `active: false`, and `canonicalLocationId` pointing to the primary, the merge is complete even if `clubLocationAliases` is unavailable.
- Adds a `Complete / Repair Merge Now` action directly inside the failed Duplicate Merge Diagnostic report.
- Updates the patron resolver so old duplicate links can resolve by reading the duplicate `clubLocations/{duplicateId}` document directly when `clubLocationAliases` is blocked.
- Adds deployable Gemini ShoutOut image editing through the Firebase callable `aiEnhanceShoutOutMedia`.
- Adds patron-side Gemini enhancement after original photo upload. If Gemini succeeds, the enhanced image becomes the selected ShoutOut media; if Gemini is unavailable, FLOQR keeps the original media and saves the fallback reason.
- Adds Master Admin Diagnostics callable probing for Gemini media editing. `ShoutOut: Media AI panel` now passes only when the callable is deployed and the `GEMINI_API_KEY` secret is available.
- Updates Firestore rules to `v28.74-gemini-media-editing-rules` with owner-visible `aiMediaEdits` audit records.
- Adds root `firebase.json` pointing Firebase CLI to the `functions/` folder with Node 22.
- Fixes Firebase Functions deployment guidance: install backend dependencies with `npm.cmd --prefix functions install` from the repo root before deploying `aiEnhanceShoutOutMedia`.
- Adds v28.76 Diagnostics Current Signal Cleanup. Historical cache-bust marker checks now pass as superseded when the current package intentionally replaces older package URLs, so the Attention Summary focuses on current failures instead of old package markers.
- Clarifies stale rules-smoke-test wording. If no current-package smoke test has been saved yet, Diagnostics now says this is not a deployed-rules failure yet and tells Master Admin to click `Run Rules Smoke Test`.
- Adds v28.77 Optional Participant Query Pass. When deterministic Mingl participant reads pass, optional `array-contains` participant query denials are treated as a privacy-compatible `Pass`, not a Soft Fail or Firebase rules issue.
- Keeps Firestore rules strict for Mingl/chat participant list queries. Do not loosen broad reads just to make optional compatibility queries pass.
- Adds v28.78 ShoutOut Template Gallery + Mobile Media Preview Layout. Initial ShoutOut template selection now shows only the official Traditional Black and White ShoutOut template until the patron searches or a contextual template hint is present.
- Fixes mobile uploaded image/video previews so portrait photos, landscape photos, and videos fit inside the preview area with `object-fit: contain` and viewport-based max heights.
- Keeps the editor flow in the intended order: template name, text inputs, AI ShoutOut recommendations, media upload, AI media enhancement controls, submit actions, then Live Preview.
- Adds v28.79 Package Hygiene Cleanup. Future full packages should include only the live `README.md` and the current direct rollback note, not historical `README-V...`, `ROLLBACK-V...`, or `rollback-v...ps1` artifacts from older packages.

## FLOQR AI Architecture

FLOQR AI is a contextual intelligence layer across ShoutOut, Mingl, Bata, venue/event discovery, admin review, notifications, and public profile/template discovery. The static frontend remains deployable to GitHub Pages and continues to use Firebase Auth, Firestore, and Firebase Storage.

Live in this package:

- Local `floqrSearch()` fallback with typo/synonym matching.
- Privacy-aware record filtering for public/shared/owned data.
- AI-ready data models and security rule blocks.
- Ask FLOQR assistant shell, disabled by flag.
- AI Notification Preferences persistence.
- Patron template variants with locked base template layouts.
- FLOQR Studio UI with safe background values.
- ShoutOut copy improvement fallback.
- ShoutOut media enhancement preview metadata and first-7-second video trim metadata.
- Firebase callable `aiEnhanceShoutOutMedia` for live Gemini image editing when Functions and the `GEMINI_API_KEY` secret are deployed.
- Super Admin discovery review and listing soft-delete UI on Master Admin > AI Crawling.
- Source Detail Extraction for followed Eventbrite, Ticketmaster, resale, venue, and comedy pages.
- Deployable Firebase callable `aiExtractPublicSourceUrl` for server-side public page extraction.
- Master Admin Diagnostics feature matrix, package checks, rules smoke test, and TXT export.
- Master Admin > AI Crawling page for crawler controls, crawl activity reports, consolidated collected-record analytics, manual crawl queue seeding, and AI Crawler Profile Import.
- Master Admin > Duplicate Records page for club duplicate diagnostics and safe merge-to-alias cleanup.
- Master Admin Package Install Diagnostics grouped by package version.
- Master Admin Firebase Rules Smoke Test with saved reports in `aiDiagnosticsReports`.
- Master Admin Diagnostics TXT export for sharing failure reports and fix prompts.
- Public profile language mode and English translation metadata in Settings.

Requires Firebase AI / Gemini configuration for live generative AI:

- Semantic AI search provider calls.
- Gemini media understanding and moderation notes. The package includes `aiEnhanceShoutOutMedia`, but it does not pass Diagnostics until deployed with the `GEMINI_API_KEY` Firebase Functions secret.
- AI background image generation/modification.
- Scheduled crawler execution through Firebase Cloud Functions or Cloud Run. The source URL extractor function is included in `functions/` and can be deployed with Firebase Functions.
- Backend video trimming with ffmpeg or approved AI/video processor for browsers that cannot create a client-side trim.
- Email/SMS notification delivery.
- Live AI translation of public profile text.

Frontend code must never contain AI API keys. Future live AI should use Firebase AI Logic when safe, or HTTPS callable Cloud Functions / Cloud Run Functions that verify Firebase Auth, role permissions, and visibility rules before calling Gemini.

## AI Privacy And Indexing Rules

AI may index, search, summarize, recommend, or notify only from public, shared, user-owned, or permissioned data. Allowed sources include published venue/event data, public profile fields, public DJ/promoter/club fields, public Bata listings, approved ShoutOut content, public/shared Mingl datapoints, and public patron template variants.

AI must not crawl or learn from private messages, private chats, private prompts, private template backgrounds, unpublished profile fields, non-public guest lists, private admin data, payment data, sensitive personal data, unapproved ShoutOut submissions, or any document where `visibility !== "public"` unless the current user owns it or has permission.

Protected terms must not be translated or altered: FLOQR, ShoutOut, Mingl, Bata.

## Template Variant Workflow

Patrons choose an official/admin ShoutOut template, click Customize Background, choose a safe color/gradient or upload an image, optionally enter an AI prompt, and save the variant as private or public. Saved variants appear in Settings > My ShoutOut Templates. Public variants can appear in Community Templates, template search, and the patron public profile when `isPublicProfileItem` is true.

Patrons cannot change layout, text positioning, media placeholder position, video placeholder position, font rules, animation timing, template structure, approval format, or display format.

Storage paths:

```text
template-backgrounds/{uid}/{variantId}/uploaded/
template-backgrounds/{uid}/{variantId}/generated/
```

## Media AI Workflow

The ShoutOut editor has an AI Media Enhancement panel with browser filter previews: Bright, Contrast, Neon, VIP Gold, Club Ready, Black & White, and Warm. For photos, selecting `Use Enhanced` uploads the original image first, then calls the Firebase callable `aiEnhanceShoutOutMedia` when deployed. The callable verifies Firebase Auth, confirms the Storage path belongs to the signed-in user, sends the image to Gemini from the backend, stores the edited image under `enhanced/`, and returns `enhancedMediaUrl` plus provider/model metadata.

If Gemini is not configured, FLOQR does not break the ShoutOut flow. It keeps the original media, saves the fallback reason in `aiMediaSafetyNotes`, and Diagnostics keeps `ShoutOut: Media AI panel` in Soft Fail until the backend callable and secret are live.

Videos longer than 7 seconds are not blocked. The user is warned, FLOQR selects only the first 7 seconds, and the app attempts to create a trimmed browser-side WebM upload under the `trimmed/` path. If the browser cannot create the cut, the app still saves trim metadata and the display renderer loops only the first 7 seconds. Backend AI/video trimming should later replace this fallback for permanent server-side cuts.

```text
Warning: this video is longer than 7 seconds. FLOQR will cut and use only the first 7 seconds.
```

Storage paths:

```text
shoutouts/{uid}/{referenceOrId}/original/{fileName}
shoutouts/{uid}/{referenceOrId}/enhanced/{fileName}
shoutouts/{uid}/{referenceOrId}/trimmed/{fileName}
```

Firestore ShoutOut records now support selected/original/enhanced/trimmed media fields, trim metadata, trim processing mode, enhancement metadata, safety status, and safety notes.

Gemini setup:

```bash
firebase functions:secrets:get GEMINI_API_KEY --project shoutoutdemo-5b402
npm.cmd --prefix functions install
firebase deploy --only functions:aiEnhanceShoutOutMedia --project shoutoutdemo-5b402
```

If `GEMINI_API_KEY` does not exist yet, run `firebase functions:secrets:set GEMINI_API_KEY --project shoutoutdemo-5b402` before deployment.

Also publish `firestore.rules` so `aiMediaEdits` owner-visible audit records are allowed. Frontend code must never contain the Gemini key.

## AI Discovery Workflow

Backend scheduled discovery should run 4-6 times per day, prefer official APIs/feeds, respect robots.txt and site terms, and never scrape private or login-protected content. Target sources include Ticketmaster, Eventbrite, approved resale partners, official venue websites/feeds, comedy shows, nightclubs, lounges, rooftop lounges, rooftop bars, beach clubs, brunch parties, pool parties, summer parties, DJ events, promoter events, Latin music, Arabic music, and DJs.

AI Discovery is the queue/review workflow. It is not a separate Master Admin tab in this package; review and approval live under Master Admin > AI Crawling.

Flow:

```text
Public source -> crawler -> AI classification/scoring -> aiDiscoveryQueue -> Super Admin review -> approved live collection
```

Discovered records must not publish directly. Super Admin can edit, approve, reject, delete, or mark duplicates. Approved venue records write to `clubLocations`; approved event/comedy/ticket records write to `events`; both get indexed for AI/contextual search.

Club public profiles are public search records. When a club admin claims ownership by subscribing to FLOQR, they can modify the club public profile fields: address, official website, email, social media handles, and telephone number. Third-party taxi hailing is modeled as a future partner integration, not a crawler input.

## Master Admin Diagnostics

Open Master Admin > Diagnostics to review:

- App-wide feature health from authentication through ShoutOut, guest lists, Mingl, chat, Bata scaffolding, AI search, AI Crawling/discovery review, templates, club profiles, ticketing, and partner integrations.
- Status labels: `Pass`, `Soft Fail`, `Failed`, and `TBI`. `Soft Fail` means the feature is implemented and safe, but has missing optional data, a fallback mode, or a non-blocking setup gap. It is not the same as a broken feature.
- Package install diagnostics and Firebase rules smoke tests.
- Diagnostic TXT export with failure reasons and a copy/paste fix prompt.

## Master Admin AI Crawling

Open Master Admin > AI Crawling to manage crawler setup and crawler-derived data:

- Plain-English crawl input. Type one contextual request and click `Build Search Plan` to see the expanded searches before creating records.
- Search-plan expansion. FLOQR parses cities, countries, genres, languages, event types, and ticket/source intent, then expands them into city x genre x event-type jobs.
- Example: `search for all clubs playing hip hop and EDM in Paris, Marseille, Monaco, St. Tropez, France` expands into eight search jobs: two genres across four cities.
- Crawler search criteria including search text, genres, languages, cities, regions, countries, event types, and market/language plans.
- Schedule settings for every 4 hours, six times daily, daily, or manual-only mode.
- Manual crawl button that writes `aiCrawlRuns` and review-only `aiDiscoveryQueue` records with required datapoint checklists and source-search links.
- Source Detail Extraction. Paste the final Eventbrite/Ticketmaster/resale/venue source URL and copied page details, click `Extract Source Details`, then save the extracted review record into `aiDiscoveryQueue`.
- Search-results page guard. If the source URL is a broad results page, such as `ticketmaster.com/search?q=comedy+shows`, FLOQR explains that the page is not a final event/venue source and blocks saving it as an approvable review record.
- Firebase source extraction. If `aiExtractPublicSourceUrl` is deployed, FLOQR fetches the public page server-side and extracts JSON-LD/metadata/text. If the callable is unavailable, the page still parses pasted source details locally.
- Raw and parsed output. Source Detail Extraction and discovery review cards show `rawCrawlInput` and `parsedData` side by side. `rawCrawlInput` contains the plain-English crawl request, generated search job, pasted source text preview, source URL, or search-results URL. `parsedData` contains the event/club fields FLOQR will use for review, approval, search, and import.
- Stale record cleanup. Open Master Admin > Stale Record Cleanup to search AI discovery queue records and ShoutOut queue records. A stale record is a queue record more than 4 days old, a record that references old Firestore/Storage rules, or a record that points to an old/unknown location.
- Stale ShoutOut cleanup. Pending club ShoutOut queue records older than the threshold, tied to old/unknown locations, or referencing old rules can be soft-cleared. FLOQR sets `status: "stale"` and `staleCleanupStatus: "stale-shoutout-cleared"` so club admin queues stop showing the stale item while the record remains available for audit/review.
- Stale crawl cleanup. AI discovery queue cleanup marks stale queue records with `crawlResultStatus: "stale-cache-cleared"` and leaves approved listings, profiles, ShoutOuts, guest lists, live display content, and audit history untouched.
- Clean crawl query output. Fresh search-plan records use city-aware clean crawl queries. Recognized cities such as Singapore, Dubai, Istanbul, Paris, and Shanghai carry their own country/region, and generated source links avoid repeating broad criteria text across Ticketmaster, Eventbrite, Google, and resale searches.
- Crawl activity reports, consolidated collected discovery records, and analytics insights such as status mix, cities, countries, genres/tags, sources, star ratings, high-value candidates, and market gaps.
- Duplicate destination consolidation. Matching clubs/events are grouped by normalized name, city, country, and destination type.
- The consolidated report consolidates duplicate clubs/events so the same destination does not appear as separate records with conflicting addresses.
- Address-conflict warnings. If multiple crawler sources claim different non-empty addresses for the same club/event destination, Master Admin sees an address-conflict warning before approval/import.
- AI Crawler Profile Import. Public-source club/event destination data can be generated as JSON, saved as `aiDiscoveryQueue` import drafts, applied by Master Admin as missing fields only, or opened by Club Admin through a `profileImportDraft` link.
- Required datapoints. Clubs, lounges, rooftop bars, and beach clubs need name, description, address, city, country, phone, website/source, categories, and genres before approval. Events and comedy shows need name, description, location, address, city, country, phone, source/ticket link, categories, and comedy date/time when applicable.

The import workflow does not overwrite existing club profile values. Master Admin import applies missing fields only. Club Admin import links prefill the public profile editor and require the Club Admin to review and click Save Public Profile.

Automatic internet crawling runs in backend code using Firebase scheduled functions or Cloud Run. The package includes Firebase callable source extraction for public URL detail parsing. The scheduled crawler should validate official APIs and public source terms, handle robots.txt, deduplicate records, classify event/venue type, rate records from Super Admin criteria, and write only to `aiDiscoveryQueue`.

## Master Admin Duplicate Records

Open Master Admin > Duplicate Records when two public club profiles represent the same institution, such as `Shôko Barcelona Beach Club` and `Shôko Barcelona`.

- Click `Refresh Duplicate Scan` to find likely duplicate `clubLocations` by normalized club name, city, country, brand, website, and address.
- The scan summary shows whether the list came from live Firestore or failed back to static alias evidence. If it says `Live Firestore: clubLocations`, the records are not hardcoded.
- Select the record that should remain as the primary club.
- Click `Complete / Repair Merge Into Selected Primary`.
- Click `Run Merge Diagnostic` when you are unsure whether the merge completed. The report returns Pass, Soft Fail, or Failed with the specific reason.
- If the diagnostic fails, click `Complete / Repair Merge Now` inside the report. That action writes the canonical duplicate document fields directly.
- If `Alias document ... permission-denied` appears, publish the package `firestore.rules` in Firebase Console when convenient. With v28.73, you can still complete the merge before publishing rules because the canonical duplicate document no longer depends on the alias document write.
- With v28.73, the canonical duplicate document is the source of truth. `clubLocationAliases` is helpful, but not required for merge completion.
- FLOQR keeps the primary record active, adds `aliasLocationIds`, `aliasNames`, and search keywords to the primary, and marks the duplicate records as `status: "merged"` and `active: false`.
- FLOQR writes `clubLocationAliases/{duplicateId}` with the canonical primary club id. Old patron, club admin, display, and record links can then resolve to the primary club instead of showing a duplicate.
- The merge updates common related references in `events`, `shoutouts`, and `guestListRequests` where the duplicate id was stored, while preserving `previousLocationIds` for audit.
- Public/patron search hides merged records. Master Admin can still see merged/deleted records in admin cleanup tools.

This is a soft consolidation workflow. It does not hard-delete ShoutOut history, guest list history, profile ownership, audit logs, or club records.

## Public Profile Language

Settings > My Profile now includes:

- Preferred language.
- Public Profile Language: preferred/original language or English version.
- English Bio Translation field.
- Translation status metadata: `provided` or `ai-ready-not-live`.

When live AI translation is configured later, it must run through Firebase AI Logic or a Cloud Functions proxy. The frontend must not expose AI API keys. FLOQR, ShoutOut, Mingl, and Bata must never be translated or altered.

## Security And Rollback

New rules cover user-owned notification preferences, prompt history, template variants, assistant sessions/messages, and template background storage. Public variants are searchable. Private variants and private prompts remain private. Public prompts are searchable only when the patron explicitly shares the prompt and makes the variant public.

The v28.64 package does not loosen Firestore rules. It keeps the v28.59 Firestore and Storage rules versions, keeps the optional Mingl participant-query guidance, and adds natural-language crawl planning plus required-datapoint review under Master Admin > AI Crawling. If v28.59 rules have not been published yet, publish both files in Firebase Console before trusting the live smoke-test result.

Post-install rules testing:

1. Publish `firestore.rules` in Firebase Console after uploading this package.
2. Publish `storage.rules` in Firebase Console > Storage > Rules after uploading this package.
3. Sign in as Master Admin.
4. Open Master Admin > Diagnostics.
5. Click `Run Package Install Diagnostics`.
6. Click `Run Rules Smoke Test`.
7. Confirm the smoke test creates a saved `aiDiagnosticsReports` record and shows `Pass` for the app-required Firestore collections, Mingl/chat queries, and Storage paths.
8. Click `Export Diagnostics TXT` to download a text report with failure reasons and a copy/paste fix prompt.

The top of `firestore.rules` should show:

```js
// FLOQR FIRESTORE RULES VERSION: v29.02
// EXPECTED DEPLOYED RULES VERSION: v29.02 or newer
```

If Firebase Console does not show that note near the top of the rules editor, the deployed Firestore rules are not updated to this package.

The top of `storage.rules` should show:

```js
// FLOQR STORAGE RULES VERSION: v29.02
// EXPECTED DEPLOYED STORAGE RULES VERSION: v29.02 or newer
```

If Firebase Console Storage Rules does not show that note near the top, the deployed Storage rules are not updated to this package.

Master Admin > Diagnostics now also shows `Firebase Rules Smoke Test` with:

- Expected Firestore rules version.
- Current diagnostics package version.
- Whether the installed package's `firestore.rules` file contains the expected rules-version note.
- Whether the latest live Firestore/Storage compatibility smoke test passed.
- Overall rules status.
- Plain-English meaning of the result.
- Failed rule checks with suggested fixes.
- A copyable Codex fix prompt.

Because browser code cannot read Firebase Console's deployed rules text directly, the live proof is the smoke test: it attempts the same signed-in reads, writes, query patterns, and uploads the app needs.

The rules smoke test verifies signed-in allowed operations for authentication/profile save, public discovery reads, ShoutOut records, guest list records, Mingl/chat participant queries, AI diagnostics/discovery/search collections, template variants, notification preferences, and Storage media paths. It does not impersonate another user, so it cannot prove cross-user denial rules from the browser.

For v28.70, Firestore rules must include `FLOQR FIRESTORE RULES VERSION: v28.70-duplicate-alias-rules` and the `clubLocationAliases/{aliasId}` rule. That alias collection lets Master Admin merge duplicate club records without deleting historical data.

Plain meaning for common results:

- `Package firestore.rules note = Pass` means the uploaded package file contains the expected rules-version note.
- `Live deployed rules compatibility = Failed` means Firebase Console's currently deployed rules denied one or more live app operations.
- `Overall rules status = Failed` means the app should not be considered rules-ready until the live smoke test passes.
- The usual fix is to publish `firestore.rules` and/or `storage.rules` in Firebase Console, rerun `Run Rules Smoke Test`, then use `Export Diagnostics TXT` if anything still fails.
- A Mingl participant query compatibility result can show `Soft Fail` if Firebase denies the optional `participants array-contains currentUser.uid` query but deterministic participant document reads pass. This is an optional compatibility check, not a blocking Mingl failure.
- Do not loosen Firestore rules broadly to make the optional Mingl participant query pass. Keep deterministic Mingl participant reads as the supported safe path; never allow all signed-in users to list `minglConnections`.
- Historical failed `aiDiagnosticsReports` remain in the TXT export for reference, but only the current package's rules smoke test is counted as the live rules status.

If the rules smoke test fails on `template-backgrounds/...` or `shoutouts/...` with `storage/unauthorized`, publish `storage.rules` in Firebase Console > Storage > Rules. The package rules allow signed-in users to upload/read/delete their own ShoutOut media, profile media, and template background paths. Upload/create/update still checks owner, size, and content type; delete checks owner because Firebase Storage delete requests do not include `request.resource`.

If onboarding shows `Missing or insufficient permissions` while saving the profile, publish `firestore.rules` in Firebase Console > Firestore Database > Rules. The package rule must include:

```js
match /users/{userId} {
  allow create: if isSelf(userId);
  allow read: if signedIn();
  allow update: if isSelf(userId);
  allow delete: if false;
}
```

Then open Master Admin > Diagnostics > Run Rules Smoke Test and confirm `Firestore: users/{uid} profile save path` shows `Pass`.

Existing profile data safety:

- If FLOQR cannot read `users/{uid}`, the user stays on the landing screen and sees a rules message. The app does not open the create-profile form.
- If a profile already exists, onboarding save uses merge and preserves existing populated fields when the form field is blank.
- Existing `createdAt` values are not replaced.
- For an already registered user such as `bans.don@gmail.com`, publish the Firestore rules first, then sign in again. Do not delete or recreate their user document.

`Market Language Plan` means: tell FLOQR where to search, what language to search in, which cities matter, and what to look for.

Simple format:

```text
Country or market | language(s) | cities | what to search for
```

Example:

```text
Spain | Spanish, Catalan | Barcelona, Madrid, Ibiza | Latin nights, rooftop bars, beach clubs, resale tickets
United Arab Emirates | Arabic, English | Dubai | rooftop lounges, Arabic music DJs, comedy shows, tickets
```

Rollback plan:

1. Set all FLOQR AI flags in `shared-data.js` to false.
2. Remove the new AI script tags from `index.html`, `patron-portal.html`, and `master-admin.html` if needed, including `ai-diagnostics-service.js`.
3. Keep existing ShoutOut, Mingl, Bata scaffolding, guest list routing, local search, and display files unchanged.
4. Revert Firestore/Storage rule additions only if the new collections are not being used.

Test plan:

- Load the app with all AI flags false.
- Search clubs/events with local fallback queries such as `hiphop clubs in Barcelona`, `DJs playing Afro Beats tonight`, and `comedy shows`.
- Open Mingl and search public profiles only.
- Save AI Notification Preferences in Settings.
- Create a private ShoutOut template variant and confirm it appears only under My ShoutOut Templates.
- Create a public variant and confirm it appears in Community Templates and Public Sharing.
- Upload a photo and preview media filters.
- Deploy `aiEnhanceShoutOutMedia` with `GEMINI_API_KEY`, then refresh Master Admin > Diagnostics and confirm `ShoutOut: Media AI panel` changes from Soft Fail to Pass.
- Upload a photo, choose an enhancement, click `Use Enhanced`, submit, and confirm Firestore saves `enhancedMediaUrl`, `enhancedMediaStoragePath`, `aiEnhancementProvider: "gemini"`, and `selectedMediaVersion: "enhanced"`.
- Confirm Firebase Storage contains the original image under `shoutouts/{uid}/{reference}/original/` and the Gemini image under `shoutouts/{uid}/{reference}/enhanced/`.
- Try a video longer than 7 seconds and confirm the user is warned, the first 7 seconds are selected, trim metadata is saved, and the display loops only that first 7-second window.
- Submit a text-only ShoutOut and a media ShoutOut.
- Approve a ShoutOut from club admin and confirm selected media/background render on display.
- Review the discovery queue under Master Admin > AI Crawling, approve a queue item, soft delete a listing, and restore it.
- On Master Admin > AI Crawling, enter `search for all clubs playing hip hop and EDM in Paris, Marseille, Monaco, St. Tropez, France`, click `Build Search Plan`, and confirm eight search jobs are shown.
- Click `Create Crawl Review Records` and confirm the created review cards show name, description, address, phone, website/source, ticket link, city/country, categories, genres, missing required datapoints, and source-search links.
- Paste an Eventbrite source URL and copied page details into Source Detail Extraction, click `Extract Source Details`, and confirm title/date/time/address/source fields are parsed into the preview.
- Paste `https://www.ticketmaster.com/search?q=comedy+shows` into Source Detail Extraction and confirm FLOQR labels it as a search-results page, explains that one specific event/detail page is required, and blocks saving it as an approvable record.
- Confirm Source Detail Extraction and each new crawl review card show both `Raw crawled/input data` and `Parsed data used by FLOQR`.
- Click `Save Extracted Review Record` and confirm the new record appears in the discovery queue.
- Try approving a crawl review record with missing address/phone and confirm approval is blocked with a clear missing-datapoint message.
- Open Master Admin > Diagnostics and confirm the feature matrix renders with Pass/Soft Fail/Failed/TBI counts.
- Click Run Package Install Diagnostics and confirm v28.44 through v28.79 package marker checks run, including Gemini media editing backend, frontend, diagnostics, rules markers, diagnostics signal-cleanup markers, optional participant query compatibility markers, ShoutOut template/media layout markers, and package hygiene markers.
- Click Run Rules Smoke Test and confirm temporary Firestore docs, participant queries, Storage images, and Storage video placeholders are created/read/cleaned up.
- Confirm the Firebase Rules Smoke Test status panel shows the expected rules version and overall rules status.
- Click Export Diagnostics TXT and confirm a `floqr-diagnostics-*.txt` file downloads with failure reasons and a `COPY/PASTE FIX PROMPT` section.
- Confirm the Firebase Rules Smoke Test panel shows plain-English meaning, suggested fixes, and a Copy Fix Prompt button.
- Confirm `Firestore: users/{uid} profile save path` passes before testing new-user onboarding.
- Open Master Admin > AI Crawling, save crawler schedule criteria, create crawl review records, and confirm new `aiCrawlRuns` and pending `aiDiscoveryQueue` records appear.
- Confirm AI Crawling analytics show raw collected record counts, consolidated clubs/events, address conflicts, top cities/countries, top genres/tags, sources, star ratings, and market gaps.
- Generate AI Crawler Profile Import JSON, save import drafts, copy a Club Admin import link, and confirm the Club Admin public profile editor pre-fills missing fields without auto-saving.
- Save a patron public profile with preferred/original language mode, then save again with English version mode and confirm the preview switches bio source.

- Fix package. `-f` means this release corrects upload/deployment behavior from the previous package.
- Adds root-level copies of the Firestore rebrand migration page and script so the migration can be uploaded without creating a `migrations` folder manually.
- Fixes the root fallback migration page so it loads `styles.css`, `firebase-config.js`, and `shared-data.js` from the correct root path.
- Keeps old README and rollback history compressed inside the package instead of leaving dozens of rollback files loose at the upload root.
- Historical README and rollback files are stored in `readme-rollback-history-through-v28.42-f.zip` inside this package.
- Keeps the original `migrations/` folder path for deployments that support folder upload.
- Adds a Master Admin `Patron Diagnostics` tab.
- Adds a patron datapoint diagnostic summary for city, state/region/province, country, age, food, music, hobbies, travel, events, beverages, and meeting preferences.
- Adds a Master Admin overlap report showing patron pairs with 2 or more common datapoints.
- Adds an all-patron datapoint table for troubleshooting Mingl matching and profile completeness.
- Fixes the Mingl `Location` datapoint so it displays city, state/region/province, and country.
- Updates Mingl contextual matching and profile summaries to include state/region/province fields.
- Centers the FLOQR parent logo at the top of ShoutOut/Mingl product landing pages and left-aligns the feature logo below it.
- Fixes product landing page branding so FLOQR remains visible as the parent platform and ShoutOut/Mingl remain visible as feature logos.
- ShoutOut landing now shows both the FLOQR logo and the ShoutOut logo instead of replacing FLOQR.
- Mingl landing uses the same parent/feature logo stack for visual consistency.
- Restores Google and Microsoft authentication to the known-good popup-first flow, with redirect used only as a popup-blocked fallback.
- Adds `images/shoutout-logo.svg` and uses it as the ShoutOut feature logo.
- Tightens the ShoutOut landing layout so the logo, heading, copy, and action buttons follow a clean left-to-right/down page flow and do not overflow the screen.
- Keeps the `migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html` migration page in the full package and adds a root fallback at `firestore-rebrand-jadz-to-floqr-v28.31-f.html`.
- Adds a Patron Portal ShoutOut diagnostic tool for modified ShoutOuts that appear stuck or in limbo.
- Adds a `Resubmit for Approval` action after modifying a pending ShoutOut.
- Enlarges and left-aligns the Mingl landing logo, reduces the vertical gap before the landing copy, and uses the blue Mingl logo for male patron profiles.
- Updates Mingl datapoint buttons so opening one datapoint closes the previous one, and clicking outside closes all open datapoints.
- Renames Club Admin `Employees / CSR` to `Employee/Workers`.
- Expands the Employee/Workers page with worker/affiliate summary, role groups, pending worker requests, CSR designation, and promotion/outreach tool placeholders.
- Adds `role-profiles.html` as a landing/scaffold page for Club Admin, Promotion Company, Promoter, DJ, Waiter/Waitress/Bottle Girl, and CSR profile logic.
- Fixes `Modify ShoutOut` from Patron Portal > My ShoutOuts by adding an inline editor for pending ShoutOuts.
- Existing ShoutOut modification links with `ref` or `id` now auto-open the pending ShoutOut editor.
- Simplifies Mingl as a social playground landing page with the patron's main profile picture at the top.
- Adds match cards that show public patron profile photos, shared-match chips, contextual search signals, and `Let's Mingl` request actions.
- Adds profile datapoint dropdown buttons for major public profile fields: gender, music, events, travel, hobbies, food, beverages, meeting interests, and location.
- Adds a local contextual Mingl matching engine that recognizes synonyms such as girls/female, fast cars/cars/coupe, and Latina/Latin events.
- Adds Club Admin employee / CSR designation tools.
- Club admins can search approved Waiter / Waitress / Bottle Girl workers and designate them as Customer Service Representatives for a location.
- Adds `clubEmployeeDesignations` records for CSR assignments.
- Replaces the patron message composer email field with an internal recipient search field.
- Patrons can send internal support messages to Club Admins or designated CSRs.
- Approved role members can still use internal direct messaging according to the existing role policy.
- Message documents now store selected recipient UID/email/name/type and location context when available.
- Mingl 3 data-point profile matching now uses contextual/fuzzy text matching rather than exact text equality only.
- Updates the welcome/sign-in page description to mention worldwide entertainment booking, live ShoutOuts, and Mingl.
- Removes the redundant welcome/sign-in status text at the bottom of the welcome card.
- Keeps the welcome/sign-in FLOQR logo rendering fix from v28.31-f.
- Fixes the Mingl landing page so it shows only the Mingl logo, enlarged to replace the duplicate `MINGL` text.
- Updates the Mingl landing copy to: `Find friends or people with similar interest to Mingl with.`
- Filters Mingl discovery to public profiles only.
- Requires at least 3 matching profile data points before a public patron appears in Mingl discovery.
- Requires a profile photo for Mingl discovery and uses gallery media or the account profile photo as the card image.
- Adds profile data fields for food choices and favorite beverage choices, with sample defaults for testing.
- Keeps the v28.31-f browser-based Firestore migration tool for existing `clubLocations` documents.
- Migration path remains `migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html`.
- The migration scans `clubLocations` and replaces `Jadz AdCo`, `Jadz Ad Co`, `JADZ ADCO`, and `JADZ AD CO` with `FLOQR`.
- The migration previews changes first, downloads a rollback JSON backup, then applies updates.
- The migration page also supports rollback from the downloaded backup JSON.
- Updates Firestore rules package with a `clubEmployeeDesignations` collection block.
- Rebrands the company/platform layer to `FLOQR`.
- Adds FLOQR logo assets under `images/`; the welcome/sign-in page uses `images/floqr-color.png`.
- Adds an independent ShoutOut landing page before the ShoutOut venue search.
- Adds `Mingl` as the social/chat product button on Screen 2 after `Throw a ShoutOut`.
- Adds an independent Mingl landing page with Mingl logo, contextual patron search, Mingl requests, Mingl Back acceptance, and Mingl Chat.
- Renames visible `Chats` surfaces to `Mingl` / `Mingl Chat` where patrons see the feature.
- Adds optional `Gender` profile data so Mingl can select gender-aware Mingl logo assets where that profile value exists.
- Preserved technical URLs, Firebase authorized-domain guidance, internal function names, existing email domains, and GitHub Pages URLs so authentication and deployment do not break.
- Preserved v28.27-f Storage Rules behavior, including signed-in-only profile media reads.
- Includes a preview-only coupe/car ShoutOut direction in `previews/`; this is not yet wired into the live template picker.
- Bumped active cache-busting query strings to `v=28.43-f`.

Firebase / Firestore / Storage impact:

- Firebase config: no changes.
- Firestore rules: consolidated rules are included as `firestore.rules`; v28.43-f keeps the v28.34-nf `clubEmployeeDesignations` block. Pre-v28.34 rules are preserved as `firestore-rules-before-v28-34-nf.txt` for rollback.
- Firestore indexes: none added.
- Storage rules: preserves the consolidated signed-in profile media `storage.rules` from v28.27-f.
- Database migration: optional but included from v28.31-f. Run the migration tool only if existing Firestore `clubLocations` documents still contain old company branding.

Install / upload steps:

1. Extract `shoutoutwepp,vers-28.43-f-full-package.zip`.
2. Upload the extracted web files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.43-f FLOQR migration root fallback package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.43-f
```

Firestore migration steps:

1. Upload the package first.
2. Open:

```text
https://jadzadco.github.io/shoutout-demo/migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html?v=28.43-f
```

If the `migrations` folder was not uploaded or the folder URL returns 404, use the root fallback:

```text
https://jadzadco.github.io/shoutout-demo/firestore-rebrand-jadz-to-floqr-v28.31-f.html?v=28.43-f
```

3. Sign in with an approved admin email.
4. Click `Preview Changes`.
5. Click `Download Rollback Backup` and keep the JSON file.
6. Click `Apply Migration`.
7. Re-open the app and confirm Firestore-backed locations now show `FLOQR`.

Manual test checklist:

1. Open the welcome/sign-in page and confirm the FLOQR logo appears at a readable size.
2. Confirm the welcome copy says: `Search and book entertainment and nightlife events worldwide or send a live ShoutOut to one of our ShoutOut displays or Mingl with new people, friends, and family.`
3. Open Patron Portal and confirm the title/header uses FLOQR wording.
4. Open Club Admin and Master Admin pages and confirm visible app branding uses FLOQR.
5. Search for a club/location and confirm display brand strings use `FLOQR` instead of `LEGACY BRAND`.
6. On Screen 2, confirm `Throw a ShoutOut` opens the ShoutOut landing page and `Start ShoutOut` continues to location search.
7. On Screen 2, confirm `Mingl` opens the Mingl landing page.
8. Confirm the Mingl landing page shows only the logo, not duplicate `MINGL` text.
9. Confirm the Mingl landing page copy says `Find friends or people with similar interest to Mingl with.`
10. Search Mingl by city, music, travel, hobbies, food choices, beverage choices, or username.
11. Confirm only public profiles with a profile/account photo and at least 3 matching profile data points appear.
12. With two test patron accounts, send a Mingl request from one account, Mingl Back from the other account, then confirm Mingl Chat opens and sends messages.
13. Open Patron Portal > My ShoutOuts and confirm `Modify ShoutOut` opens the inline editor for a pending ShoutOut.
14. Save a ShoutOut edit and confirm the pending ShoutOut list updates.
15. Search Mingl with contextual text such as `girls interested in fast cars and Latina events`.
16. Confirm Mingl shows the patron's main picture, match photos, shared-match chips, and datapoint dropdown buttons.
17. Confirm `Let's Mingl` sends a Friend or Mingl Request, and `Open Mingl Chat` appears only when both patrons Mingl back.
18. Open Club Admin > Employee/Workers, search approved workers/affiliates, confirm role summaries and pending worker requests render, and designate a hospitality worker as CSR.
19. Open Patron Portal > Messages and confirm Recipient Search lists Club Admin and CSR recipients, not a free-form email field.
20. Send a patron support message to a Club Admin or CSR and confirm it appears as an internal message.
21. Submit a test ShoutOut and confirm System Message behavior still works.
22. Test profile media upload and confirm Storage Rules behavior still works.
23. Open the migration page, preview `clubLocations`, download backup, and apply only if old branding appears.
24. Open `role-profiles.html?v=28.43-f` and confirm the role/profile landing scaffold loads.
25. Open Master Admin > Patron Diagnostics and confirm the patron datapoint table and 2+ common datapoint report render.
26. Confirm rollback file `ROLLBACK-V28-40-nf.md` is kept with the package.

Rollback summary:

- Code rollback: revert the GitHub commit or upload the previous known-good package, such as `shoutoutwepp,vers-28.39-f-full-package.zip`, `shoutoutwepp,vers-28.38-f-full-package.zip`, or stable `shoutoutwepp,vers-28.22-s-full-package.zip`.
- Firestore rules rollback: remove the `clubEmployeeDesignations` block or replace live Firestore rules with `firestore-rules-before-v28-34-nf.txt`.
- Storage rules rollback: no new Storage Rules change beyond v28.27-f.
- Database rollback: use the backup JSON downloaded from the v28.31-f migration page and click `Apply Rollback JSON`.
- New worker/CSR test data rollback: delete only test documents from `clubEmployeeDesignations` and remove test `designatedCSRLocations` values from test users.
- Helper script: `rollback-v28-40-nf.ps1`.
---

# FLOQR ShoutOut v24 Admin Analytics + Master Admin Package

## Deployment

Upload/replace **all files** in this ZIP at the GitHub repository root.

Then test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

Club admin example:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=josephine-atlanta-ga
```

Master admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html
```

## v24 Major Updates

### 1. Club Admin Portal Expanded

The existing `admin.html` is now a club/location-specific command center.

Club admins can see only the selected location from the URL:

```text
admin.html?location=josephine-atlanta-ga
```

New club admin sections:

- Dashboard
- ShoutOut Queue
- Analytics
- Advertising
- Account Reconciliation
- Reports

### 2. Account Reconciliation Page Added

The club admin now includes a prototype reconciliation page showing:

- Estimated ShoutOut gross
- FLOQR platform fee estimate
- Venue ShoutOut share estimate
- Estimated local ad share
- Pending payout
- Reconciliation status

This is currently a prototype and should later be connected to Stripe, Square, PayPal, or another payment ledger.

### 3. Club Owner Analytics Reports Added

New report cards include:

- Venue Summary
- Audience Analytics
- Music & Demand Intelligence
- Event / Reservation Funnel
- Ad Performance
- Recommended Sponsor Categories
- Exportable Reports placeholders

### 4. New Master Admin Portal Added

New files:

```text
master-admin.html
master-admin-app.js
```

Master admins can view:

- All locations
- All users
- All pending ShoutOuts
- All queues across locations
- Network reports
- Advertiser reports
- Network reconciliation
- Ticketing partner integration notes

### 5. Admin Separation

Club admin:

```text
admin.html?location=<locationId>
```

Sees only that selected location's queue and reports.

Master admin:

```text
master-admin.html
```

Sees the full FLOQR network.

### 6. Master Admin Email List Added

`shared-data.js` now includes:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];
```

Club admins continue using:

```javascript
window.SHOUTOUT_ADMIN_EMAILS
```

## Ticketing / Affiliate Integration Notes

### Ticketmaster

Ticketmaster has a public Discovery API that can be used for event discovery, event details, venue data, artist data, images, and outbound ticket links.

Ticketmaster also has an affiliate/distribution partner ecosystem. After approval, eligible publishers may receive an onboarding guide, Impact publisher ID, API key or content tools, and access to reporting/payment tracking through Impact.

Ticketmaster's Partner API is different from the Discovery API. It is restricted to companies with official distribution relationships and can support reserve, purchase, and ticket/event retrieval workflows.

### Eventbrite

Eventbrite has a public platform/API for event management workflows, including data access, event creation, attendee/order workflows, and checkout customization. This may be easier for early event organizer integrations.

### Recommended FLOQR Integration Path

Phase 1:

```text
Use FLOQR-owned Firestore events
```

Phase 2:

```text
Add Ticketmaster Discovery API for event discovery and outbound ticket links
```

Phase 3:

```text
Apply for Ticketmaster affiliate/distribution access
```

Phase 4:

```text
Add Eventbrite API for promoter-created events and ticket workflows
```

Phase 5:

```text
Build FLOQR-owned reservation, VIP table, guest list, and ticket checkout for higher-margin venue transactions
```

## Recommended Firestore Rules Additions

Your current v23 rules should still work. For future admin separation, create these collections later:

```text
adminRoles
venueAdmins
transactions
reconciliation
adImpressions
adClicks
campaigns
ticketClicks
reservationRequests
guestListRequests
```

For now, v24 uses existing collections:

```text
users
clubLocations
events
templates
shoutouts
liveContent
```

## Current Major Features Preserved

- Patron sign-in/sign-up
- User profile completion
- Embedded splash ad images
- Main category screen
- Events / Clubs / Beach Clubs / Lounges / Lounge-Clubs / ShoutOut
- 10-second sponsored splash ads
- Multi-location venue model
- ShoutOut creation
- Admin approval workflow
- Location-specific display pages
- Xibo-compatible display page
- Firestore seeding utility

## Notes

This is still a front-end prototype. The analytics reports use available Firestore collections and estimated placeholder calculations where payment/ad event data is not yet tracked.

The next production step is to add real tracking events for:

- Category clicks
- Event clicks
- Ticket clicks
- Reservation requests
- Guest list requests
- Ad impressions
- Ad clicks
- ShoutOut payment status
- Payout records


---

# v25 Master Admin Security Update

## Summary

This package hardens the Master Admin portal.

Master Admin now requires:

1. The user email must be explicitly listed in:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

2. The user email domain must be one of:

```javascript
jadzadco.com
jadzholdings.com
```

3. The user must use an email-based identity. Phone-only OTP is blocked for Master Admin.

4. The user must sign in using:

```javascript
google.com
microsoft.com
```

Facebook, phone-only, anonymous, and other weaker providers are blocked for Master Admin.

5. The user email must be verified by the provider.

6. MFA must be enforced upstream by Microsoft Entra ID or Google Workspace for the allowed FLOQR corporate domains.

## Important MFA Note

Firebase client JavaScript can detect Firebase-native MFA enrollment, but Microsoft Entra ID or Google Workspace MFA is usually enforced at the identity provider before Firebase receives the login. This package enforces corporate domain, verified email, allowed provider, and explicit allow-list. Keep MFA enforced in Microsoft Entra ID / Google Workspace.

## Master Admin URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Practical Recommendation

Use Microsoft authentication for Master Admin and enforce MFA with Microsoft Entra Conditional Access.

Do not allow phone OTP, Facebook login, personal Gmail, personal Outlook, fake emails, or unverified identities for Master Admin access.


---

# v25.1 Admin Login, Queue, and Text Fixes

## Changes

1. Updated patron landing text:

`Search and book entertainment and nightlife events or send a live ShoutOut to one of our ShoutOut displays.`

2. Added visible Account Status and Sign out card to Master Admin after login.

3. Changed admin and master-admin authentication from popup sign-in to redirect sign-in to reduce Microsoft `auth/popup-closed-by-user` issues.

4. Kept `bans.don@gmail.com` as a temporary Master Admin exception while corporate-domain admin accounts are finalized.

5. Fixed Zebbies Garden DC / club admin queue error by removing the Firestore composite-index requirement. The app now queries by `clubLocationId` and `status`, then sorts by `submittedAt` in the browser.

## Test URLs

Patron:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

Zebbies Garden DC Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production Note

For production scale, create the Firestore composite index and restore server-side ordering. For the current prototype, client-side sorting avoids deployment friction.


---

# v25.2 Microsoft Admin Authentication Diagnostics

## Summary

This package improves Microsoft authentication handling for the Club Admin and Master Admin portals.

## Changes

1. Microsoft admin sign-in continues to use `signInWithRedirect()` instead of popup.
2. Microsoft provider now includes:
   - `tenant: "common"`
   - `prompt: "select_account"`
   - scopes: `openid`, `profile`, `email`
3. Added clearer admin error messages for:
   - `auth/popup-closed-by-user`
   - `auth/operation-not-allowed`
   - `auth/unauthorized-domain`
   - `auth/account-exists-with-different-credential`
   - invalid OAuth client configuration
4. Added Microsoft sign-in notes to:
   - `admin.html`
   - `master-admin.html`
5. Cache-busting updated to `v=28.8`.

## Critical Firebase / Microsoft Console Checklist

If Microsoft sign-in still fails, verify these items:

### Firebase Console

Go to:

```text
Firebase Console > Authentication > Sign-in method > Microsoft
```

Confirm:

- Microsoft provider is enabled.
- Client ID is correct.
- Client Secret is correct.
- Callback / redirect URI shown by Firebase is copied.

### Microsoft Azure App Registration

Go to:

```text
Azure Portal > App registrations > Your app > Authentication
```

Add the Firebase callback URI exactly as shown in Firebase. It usually looks like:

```text
https://<your-firebase-project-id>.firebaseapp.com/__/auth/handler
```

Also confirm:

- Supported account type allows the accounts you are testing.
- If testing personal Microsoft accounts, use "common" / personal + organizational support.
- If testing only company accounts, use the correct tenant setup.
- The client secret has not expired.

### Firebase Authorized Domains

Go to:

```text
Firebase Console > Authentication > Settings > Authorized domains
```

Confirm:

```text
jadzadco.github.io
shoutoutdemo-5b402.firebaseapp.com
shoutoutdemo-5b402.web.app
```

or your exact Firebase hosting domains are listed.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```


---

# v25.3 Admin Authentication Unification

## Why this update exists

The patron page Google authentication was working, but the admin page began showing Microsoft popup errors and Google stopped working after redirect-only changes.

## What changed

1. Club Admin and Master Admin now use the same primary authentication behavior as the patron portal:
   - `signInWithPopup()` first
   - automatic `signInWithRedirect()` fallback only if popup is blocked, closed, or cancelled

2. This fixes the regression where admin Google stopped working while patron Google still worked.

3. Microsoft sign-in keeps the Microsoft provider settings:
   - `tenant: "common"`
   - `prompt: "select_account"`
   - scopes: `openid`, `profile`, `email`

4. Master Admin security remains:
   - Google or Microsoft only
   - phone-only blocked
   - Facebook blocked
   - approved email list required
   - corporate domain requirement remains
   - `bans.don@gmail.com` remains temporarily allowed for testing

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Troubleshooting

If Microsoft still shows `auth/popup-blocked`, manually allow popups for:

```text
jadzadco.github.io
```

The app should then retry with redirect fallback automatically.


---

# v25.4 Admin Redirect-Only Authentication Fix

## Why this update exists

The admin pages continued to show:

```text
auth/popup-closed-by-user
```

That means the admin page was still opening a popup, or the browser was treating the provider flow as a popup-based session.

## What changed

1. Club Admin authentication is now redirect-only:
   - Google uses `signInWithRedirect()`
   - Microsoft uses `signInWithRedirect()`
   - Facebook uses `signInWithRedirect()` for club admin only

2. Master Admin authentication is now redirect-only:
   - Google uses `signInWithRedirect()`
   - Microsoft uses `signInWithRedirect()`
   - Facebook remains unavailable for Master Admin

3. Popup-based admin login is removed from admin pages.

4. Patron login is unchanged.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important

After uploading, do a hard refresh or open the URL in an incognito/private window so the browser does not use cached `admin-app.js`.


---

# v25.5 Master Admin Email Allow-List Only

## Why this update exists

The Master Admin page was working with Google, but the corporate-domain restriction added unnecessary complexity during the prototype phase.

## What changed

1. Domain enforcement is now disabled by default:

```javascript
window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS = false;
```

2. Master Admin access is still protected by:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

Only explicitly listed emails can access Master Admin.

3. Master Admin still requires an approved provider:

```javascript
google.com
microsoft.com
```

4. Phone-only login and Facebook login remain blocked for Master Admin.

5. `bans.don@gmail.com` continues to work as a Master Admin as long as it remains listed in `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Current Recommended Development Policy

Use explicit email allow-list only:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];
```

## Production Recommendation

Later, replace JavaScript-based admin authorization with a Firestore `adminRoles` collection or Firebase custom claims.

Recommended future model:

```text
adminRoles/{uid}
  role: "masterAdmin"
  email: "admin@jadzadco.com"
  allowedLocations: ["*"]
  mfaRequired: true
```

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```


---

# v25.6 Admin Popup Authentication Alignment

## Why this update exists

Google authentication works on the patron page using a popup. The admin pages were changed to redirect during troubleshooting, but you requested Microsoft/admin authentication to behave identically to Google.

## What changed

1. Club Admin Google uses:

```javascript
auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
```

2. Club Admin Microsoft uses:

```javascript
auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"))
```

3. Master Admin Google uses popup sign-in.

4. Master Admin Microsoft uses popup sign-in.

5. Redirect-only admin authentication was removed.

6. Patron login remains unchanged.

7. Master Admin domain enforcement remains disabled for development.

8. Master Admin remains protected by explicit email allow-list:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

## Microsoft Provider Settings

The Microsoft provider now uses a simpler popup-friendly configuration:

```javascript
const p = new firebase.auth.OAuthProvider("microsoft.com");
p.setCustomParameters({ prompt: "select_account" });
p.addScope("openid");
p.addScope("profile");
p.addScope("email");
```

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important Browser Note

Because popup sign-in is now used again, make sure popups are allowed for:

```text
jadzadco.github.io
```

If Microsoft still fails while Google works, the issue is likely Microsoft provider-specific, not the page flow.


---

# v25.7 Master Admin Load Fix

## Why this update exists

The Master Admin page was stuck on:

```text
Loading master admin app...
```

This usually means `master-admin-app.js` failed before completing initialization.

## What changed

1. Rebuilt `master-admin-app.js` cleanly to remove broken remnants from prior domain enforcement edits.
2. Domain enforcement is disabled during development.
3. Master Admin access is controlled by `SHOUTOUT_MASTER_ADMIN_EMAILS`.
4. Google/Microsoft provider checks remain active.
5. Phone-only and Facebook Master Admin access remain blocked.
6. `bans.don@gmail.com` works as Master Admin if listed in `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production Note

Later, move Master Admin roles to Firestore `adminRoles` or Firebase custom claims.


---

# v25.8 Microsoft Redirect Fallback / Popup-Closed Fix

## Why this update exists

Microsoft authentication continued to produce:

```text
auth/popup-closed-by-user
```

even after browser popups were allowed.

This usually means the provider flow is still being interrupted or the Microsoft OAuth popup is being closed before Firebase receives the final credential.

## What changed

1. Google sign-in still uses popup behavior.
2. Microsoft sign-in now uses full-page redirect behavior on both:
   - Club Admin
   - Master Admin
3. `auth.getRedirectResult()` was added back to process the returning Microsoft login result.
4. Master Admin domain enforcement remains disabled during development.
5. Master Admin is still protected by `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Why Microsoft is different from Google

Google popup works in your patron page. Microsoft OAuth can behave differently in Chrome because of account picker behavior, cross-site cookie policies, tenant/account-type prompts, and provider redirect handling.

Using redirect for Microsoft avoids popup closure entirely.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important

After upload, test in an incognito/private window or hard refresh with Ctrl+F5.


---

# v25.9 Admin Auth Matched to Patron Auth

## Why this update exists

Microsoft redirect completed MFA but returned to the app without an authenticated Firebase user. Firebase documents that redirect sign-in can fail on browsers that block third-party storage when the app is served from a different domain than the Firebase Auth helper domain.

## What changed

1. Club Admin Google/Microsoft/Facebook now use popup sign-in, matching the patron page.
2. Master Admin Google/Microsoft now use popup sign-in, matching the patron page.
3. Microsoft provider config now matches the patron page:
   - `new firebase.auth.OAuthProvider("microsoft.com")`
   - `p.setCustomParameters({prompt:"select_account"})`
   - no extra tenant/scopes
4. Redirect handling was removed from admin/master admin.
5. Added `auth-debug.html` and `auth-debug.js` to test Firebase provider sign-in without admin role checks.

## Diagnostic URL

Use this first if Microsoft still fails:

```text
https://jadzadco.github.io/shoutout-demo/auth-debug.html?v=28.8
```

If Microsoft fails on `auth-debug.html`, the issue is provider/browser/Firebase configuration, not the admin role logic.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production recommendation

For Microsoft redirect sign-in on GitHub Pages, Firebase recommends one of the redirect best-practice options, such as using Firebase Hosting/custom auth domain or proxying the auth helper path, because redirect sign-in relies on a Firebase Auth helper iframe that can be affected by third-party storage restrictions.


---

# v26 Guest List + Promoter Referral System

## Major Additions

### Guest List Intake

New files:

```text
guest-list.html
guest-list-app.js
```

Supports:

- Club/location selection
- Event/day selection
- Required promoter/promoting group selection
- Guest name, phone, email, party size, notes
- Firestore submission to `guestListRequests`

Example:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

### Promoter Admin Panel

New files:

```text
promoter-admin.html
promoter-admin-app.js
```

Reports include:

- Patron app signup referrals
- Guest list referrals
- Total referred guests
- Estimated promoter credit
- Referrals by club
- Recent guest list requests

Supported reporting periods:

- Daily
- Weekly
- Biweekly
- Monthly
- 6 months
- 1 year
- 2 years
- 5 years

Example:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

### Club Admin Updates

Club Admin now includes:

```text
Guest Lists / Promoters
```

Club admins can view guest list and promoter data linked to their club/location.

### Master Admin Updates

Master Admin now includes:

```text
Promoters
```

Master admins can view network-level promoter and guest list data.

### Promoter Registry

`shared-data.js` now includes:

```javascript
window.SHOUTOUT_PROMOTERS
window.SHOUTOUT_PROMOTER_ADMINS
```

### Patron Signup Referral Tracking

If a patron arrives with:

```text
?promoter=<promoterId>
```

the app can store:

```text
referredByPromoterId
```

on profile completion.

## Firestore Rules Needed

Add:

```javascript
match /guestListRequests/{id} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null;
}
```

## Test URLs

Guest List - Zebbies DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Guest List - Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

Club Admin - Zebbies DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Access Intent

- Promoter admin sees assigned promoter data.
- Club admin sees guest-list/promoter data linked to that club.
- Master admin sees network-wide data.

## Future Production Recommendation

Move access control into:

```text
adminRoles
promoters
promoterAdmins
promoterPayouts
guestListCheckIns
```

or Firebase custom claims.


---

# v28 Legal Guest Lists + Protected Translation Terms

## New in v28

1. Guest list primary guest now uses:
   - First Name
   - Last Name
   - Full Name

2. The form includes a required legal-name confirmation:

```text
I confirm the First Name and Last Name for me and my invitees exactly match the government-issued photo IDs that will be presented at venue entry.
```

3. Additional invitees are now supported.

Patrons can:
- Add invitees manually
- Add accepted app friends later from the `friendships` collection

4. Guest list records now store:

```text
primaryGuest
additionalGuests
firstName
lastName
fullName
totalGuestCount
legalNameConfirmed
```

5. Translation policy added.

Protected terms must never be translated:

```text
ShoutOut
FLOQR
FLOQR Holdings
Superstar
Big Baller
Baller
Diva
Money Spender
Bruv
```

Examples:

```text
French: Envoyer un ShoutOut
German: Einen ShoutOut senden
Italian: Invia un ShoutOut
Spanish: Enviar un ShoutOut
```

6. New reference page:

```text
translation-policy.html
```

## Firestore Rules Needed

Add:

```javascript
match /guestListRequests/{id} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null;
}

match /friendships/{id} {
  allow read, write: if request.auth != null;
}

match /friendRequests/{id} {
  allow read, write: if request.auth != null;
}
```

## Test URLs

Guest List — Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Guest List — Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

Club Admin — Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

Translation Policy:

```text
https://jadzadco.github.io/shoutout-demo/translation-policy.html?v=28.8
```

# Comprehensive Testing Plan

## A. Upload / Cache Test

1. Upload all package files to GitHub Pages.
2. Open each page with `?v=28.8`.
3. Hard refresh with Ctrl+Shift+R.
4. Confirm no page is stuck on `Loading...`.

## B. Guest List Intake Test

1. Open:

```text
guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

2. Sign in with Google.
3. Confirm First Name and Last Name auto-fill from profile or Google display name.
4. Select Event/Day.
5. Select Promoter / Promoting Group.
6. Add one manual invitee.
7. Confirm Party Size updates from 1 to 2.
8. Try submitting without legal-name confirmation; submission should fail.
9. Check legal-name confirmation.
10. Submit.
11. Confirm receipt shows:
   - Reference
   - Club
   - Event / Day
   - Promoter
   - Primary Guest
   - Additional Invitees
   - Party Size
   - Pending status

## C. Firestore Guest List Record Test

In Firebase Console, check:

```text
guestListRequests
```

Confirm record includes:

```text
primaryGuest.firstName
primaryGuest.lastName
primaryGuest.fullName
additionalGuests[]
totalGuestCount
legalNameConfirmed: true
promoterId
clubLocationId
submittedByUid
```

## D. Club Admin Guest List / Promoter Test

1. Open:

```text
admin.html?location=zebbies-garden-washington-dc&v=28.8
```

2. Sign in with approved admin Google account.
3. Open `Guest Lists / Promoters` tab.
4. Confirm guest list totals appear for Zebbies only.
5. Confirm promoter performance appears.
6. Confirm Shôko or Christie records do not appear on Zebbies admin.

## E. Promoter Admin Test

1. Open:

```text
promoter-admin.html?v=28.8
```

2. Sign in with an email in `SHOUTOUT_PROMOTER_ADMINS`.
3. Change report periods:
   - Daily
   - Weekly
   - Biweekly
   - Monthly
   - 6 months
   - 1 year
   - 2 years
   - 5 years
4. Confirm metrics update:
   - Patron Signup Referrals
   - Guest List Referrals
   - Total Guest Count
   - Estimated Promoter Credit

## F. Master Admin Promoter Test

1. Open:

```text
master-admin.html?v=28.8
```

2. Sign in with master admin Google account.
3. Open `Promoters` tab.
4. Confirm network-wide promoter totals appear.

## G. Translation / Protected Terms Test

1. Open:

```text
translation-policy.html?v=28.8
```

2. Confirm examples show:

```text
Envoyer un ShoutOut
Einen ShoutOut senden
Invia un ShoutOut
Enviar un ShoutOut
```

3. Use browser auto-translate to French, German, or Italian.
4. Confirm `ShoutOut` remains visible as `ShoutOut`.

## H. Regression Test

Confirm these still work:

- Patron login
- Patron profile completion
- ShoutOut submission
- Club admin ShoutOut queue
- Approve and push live
- Display URL per location
- Master admin dashboard

## Known Limitation

Friend request approval, inbox, real-time chat, and true end-to-end encrypted chat are not fully implemented in v28. v28 prepares guest-list invitee data structures and friend-based invitee selection for the future `friendships` collection.


---

# v28 Guest List Routing Fix

## What changed

1. The patron portal now routes **Join Guest List** actions to:

```text
guest-list.html
```

instead of the default ShoutOut flow.

2. Guest list links preserve the selected location:

```text
guest-list.html?location=<clubLocationId>
```

3. Promoter referral links are preserved when present:

```text
guest-list.html?location=<clubLocationId>&promoter=<promoterId>
```

## Patron Access URL

Patrons access their portal here:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

## Guest List Direct URLs

Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Christie Cannes:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=christie-cannes-france&v=28.8
```

## Test

1. Open patron portal.
2. Sign in.
3. Choose Clubs.
4. Select a venue.
5. Click **Join Guest List**.
6. Confirm that the app opens `guest-list.html` and not the ShoutOut editor.


---

# v28 Patron Profile Menu + Editable Patron Portal

## Changes

1. Patron status/profile menu now includes:

```text
My Profile
Member Level
Messages (new/total)
Chats (new/total)
```

2. New page:

```text
patron-portal.html
```

3. Patrons can edit:

```text
First Name
Last Name
Display Name
Phone Number
City
Country
Preferred Language
Instagram Handle
X Handle
```

4. Patron portal shows:

```text
My ShoutOuts
My Guest Lists
Messages
Chats
Privacy / GDPR
```

5. Messages and chats show counts such as:

```text
Messages (5/36)
Chats (2/14)
```

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
```


---

# v28 Patron Portal + Profile Menu Correction

## Correction

This package supersedes the prior v27.2 naming.

The requested patron-profile-menu and editable-patron-portal changes are now packaged as **v28**.

## Included v28 features

- Patron status menu includes:
  - My Profile
  - Member Level
  - Messages `(new/total)`
  - Chats `(new/total)`

- Patron portal page:
  - `patron-portal.html`

- Editable patron profile:
  - First Name
  - Last Name
  - Display Name
  - Phone Number
  - City
  - Country
  - Preferred Language
  - Instagram Handle
  - X Handle

- Patron activity sections:
  - My ShoutOuts
  - My Guest Lists
  - Messages
  - Chats
  - Privacy / GDPR

## v28 Test URLs

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
```

Patron home:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```


# v28.4 Fix

Fixes patron expanded menu and guest-list routing. Upload all files, replace existing files, commit, then test `?v=28.8`.

Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

# v28.4 Inbox, Chat Status, ShoutOut Confirmation, and Club Service Isolation

## Includes
- Club-specific service catalog using `SHOUTOUT_LOCATION_SERVICES`
- Internal inbox notifications for ShoutOut submission/approval/rejection
- Global authenticated message/chat/notification status bar
- Simple patron message composer in Patron Portal
- ShoutOut audit collection foundation

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.4 inbox chat and service isolation`
5. Wait 1–3 minutes.
6. Test in Incognito or hard refresh.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8

## Firestore Rule Additions
```javascript
match /inboxNotifications/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /shoutoutAudit/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /chatMessages/{id} {
  allow create, read, update, delete: if request.auth != null;
}
```


# v28.4 ShoutOut Templates, Photo Upload, AI Suggestions, History, and Role Requests

## Includes
- More standard ShoutOut templates: Classic Black & White, Summer Vibes, Car Meet, Champagne, Beach, Graduation, Wedding, Sports, Luxury Gold, Corporate.
- Native phone photo upload for ShoutOuts using Firebase Storage.
- AI-style ShoutOut suggestion button.
- Past ShoutOut reuse button.
- ShoutOut audit write on submission.
- ShoutOut recommendation/history foundation.
- Role request page for Club Admin, DJ, and Promoter access.
- DJ/Promoter profile foundation for future public profiles.

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.4 storage AI templates and role requests`.
5. Configure Firebase Storage using the guide in ChatGPT response.
6. Add Firestore and Storage rules.
7. Test in Incognito with `?v=28.8`.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.8

## Future Feature Requests Noted
- DJ public profiles with work samples.
- DJ playlist and merch sales.
- Promoter public marketing profiles.
- Club master admin approval of club service providers.
- Full AI crawler for clubs/events, routed into an admin approval queue.

# v28.5 Media, Video, Templates, and Role Request Release

## New
- Image upload from phone
- Video upload from phone
- Xibo HTML video rendering using autoplay muted loop playsinline
- Classic Black & White template
- Ferrari F8 VIP template
- Rolls-Royce Cullinan VIP template
- Summer Vibes, Champagne Gold, Neon Party templates
- Visible PHOTO/VIDEO placeholders
- ShoutOut recommendation demo section
- Role request page for Club Admin / DJ / Promoter

## Firebase Storage Rules

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /shoutouts/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 30 * 1024 * 1024
        && (
          request.resource.contentType.matches('image/.*') ||
          request.resource.contentType.matches('video/.*')
        );
    }
  }
}
```

## Firestore Additions

```javascript
match /roleRequests/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /djProfiles/{id} {
  allow read: if true;
  allow create, update, delete: if request.auth != null;
}
match /promoterProfiles/{id} {
  allow read: if true;
  allow create, update, delete: if request.auth != null;
}
match /shoutoutRecommendations/{id} {
  allow create, read, update, delete: if request.auth != null;
}
```

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.5 media video templates`.
5. Wait 1–3 minutes.
6. Test in Incognito.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.8
https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=28.8

# v28.6 Media Preview Fix

## Fixes
- Single upload input only: photo OR video.
- Larger displayed media preview.
- Text overlay added to photo/video preview.
- AI recommendation selection now populates the text field and refreshes preview.
- Preview updates when text fields change.

## Install
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test with:
   https://jadzadco.github.io/shoutout-demo/?v=28.8


---

# v28.7 ShoutOut Link on All Club Views

## Fix

Every club/location options screen now forces a visible:

```text
Throw a ShoutOut
```

button, even if the service catalog is missing it.

## Install

1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```


# v28.8 Hard Fix — ShoutOut Button on Club Options

Fixes missing `Throw a ShoutOut` button on the Club Options screen.

## Install
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test:
   https://jadzadco.github.io/shoutout-demo/?v=28.8

## Verify
Open:
https://jadzadco.github.io/shoutout-demo/patron-app.js?v=28.8

Search for:
v28.8 hardcoded club option ShoutOut insertion

---

# v28.9 Codex Release — Clean Club Options + Contextual Search

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-9-codex-contextual-search-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Club Options now includes a real `Throw a ShoutOut` button in `index.html`.
2. Removed the v28.7/v28.8 timer-based ShoutOut button injection patches from `patron-app.js`.
3. Added contextual/fuzzy patron search in `patron-app.js`.
4. Search now supports natural variations such as:
   - `hiphop clubs in Barcelona`
   - `hip hop clubs in Barcelona, Spain`
   - `hip-hop clubs in Barcelona Spain`
   - `Hip Hope clubs Barcelona Spain`
5. HTML cache-busting query strings were bumped from `v=28.8` to `v=28.9`.

## Files Changed In This Release

```text
index.html
patron-app.js
README.md
*.html cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.9.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

Existing Firebase services still used:

```text
Firebase Auth
Firestore
Firebase Storage
GitHub Pages hosting
```

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with a clear message:

```text
Upload v28.9 contextual search full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with a cache-busting URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Important: do not upload the parent folder itself. Upload the files inside the package so `index.html`, `patron-app.js`, `firebase-config.js`, and the other app files remain at the repository root.

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Barcelona ShoutOut search flow:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Guest list direct page:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.9
```

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.9
```

Role request:

```text
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.9
```

Display page:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&v=28.9
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Select `Clubs`.
4. Confirm Club Options shows `Throw a ShoutOut`.
5. Click `Throw a ShoutOut`.
6. Confirm the ShoutOut location picker opens.
7. Search:

```text
hiphop
hiphop clubs in Barcelona
hip hop clubs in Barcelona, Spain
hip-hop clubs in Barcelona Spain
Hip Hope clubs Barcelona Spain
```

8. Confirm Barcelona Hip Hop-capable venues appear, including Shoko Barcelona / Shoko Barcelona Beach Club where available.
9. Pick a location.
10. Confirm the template page opens.
11. Go back and test `Join Guest List`.
12. Confirm Guest List does not route to ShoutOut templates.
13. Submit a test ShoutOut only if you want to create real Firestore/Storage records.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. In GitHub, open the commit that uploaded v28.9.
2. Use GitHub's revert option, or manually upload the previous known-good package.
3. Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8-rollback-test
```

Manual rollback:

1. Keep the prior package ZIP before uploading a new release.
2. If v28.9 has problems, upload the prior package contents back to the repo root.
3. Commit with:

```text
Rollback from v28.9 to previous package
```

### Firestore / Storage Rollback

This v28.9 release does not require Firestore or Storage config changes.

For future releases that change Firestore data, rules, indexes, or Storage rules:

1. Export or document the current rules before changing them.
2. Record every new collection, document field, index, and Storage path in this README.
3. Include a forward migration and rollback migration.
4. If seed data changes, keep the old seed package or a JSON export.
5. For destructive data changes, do not run them from the live app; use a reviewed admin script and keep a backup/export first.

Recommended future rollback artifacts per release:

```text
release ZIP
README.md with changed files
Firestore rules before/after
Storage rules before/after
Firestore indexes before/after
Seed/migration notes
Known-good test URL
Rollback test URL
```

## Known Limits

The contextual search is a lightweight client-side matcher. It normalizes punctuation, spacing, accents, and common genre aliases, and allows small typos. It is not yet a server-side semantic search engine.

Future upgrade path:

```text
Firestore indexed search fields
Algolia / Typesense / Meilisearch
AI-assisted search query parsing
User preference ranking
Location-aware ranking
```

---

# v28.10 Codex Release — Search Display Cleanup

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-10-contextual-search-ui-cleanup-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Removed the visible dropdown filters from the Search / Choose Location page:
   - Country
   - State / Region / Province
   - City
   - Music genre
2. Kept the single contextual search box as the main search interface.
3. Updated the search page helper copy:

```text
Search naturally by city, country, venue, genre, artist, event day, or activity date.
```

4. Updated the search placeholder:

```text
Try hiphop clubs in Barcelona, Afro House in Miami, or Friday events in DC...
```

5. Bumped HTML/JS cache-busting query strings to `v=28.10`.

## Files Changed In This Release

```text
index.html
patron-app.js
README.md
ROLLBACK-V28-10.md
*.html / *.js cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.10.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with a clear message:

```text
Upload v28.10 contextual search UI cleanup full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10
```

Important: do not upload the parent folder itself. Upload the files inside the package so `index.html`, `patron-app.js`, `firebase-config.js`, and the other app files remain at the repository root.

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10
```

Guest list direct page:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.10
```

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.10
```

Role request:

```text
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.10
```

Display page:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&v=28.10
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Click `Throw a ShoutOut`.
4. Confirm the search page shows only one search input and no Country / State / City / Music Genre dropdown row.
5. Search:

```text
hiphop in dc
hiphop clubs in Barcelona
hip hop clubs in Barcelona, Spain
hip-hop clubs in Barcelona Spain
Hip Hope clubs Barcelona Spain
```

6. Confirm matching venues appear.
7. Pick a location.
8. Confirm the template page opens.
9. Go back and test `Join Guest List`.
10. Confirm Guest List does not route to ShoutOut templates.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. In GitHub, revert the commit that uploaded v28.10.
2. Or upload the previous known-good package, such as v28.9.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9-rollback-test
```

Manual rollback:

1. Upload the prior package contents back to the repo root.
2. Commit with:

```text
Rollback from v28.10 to previous package
```

### Firestore / Storage Rollback

This v28.10 release does not require Firestore or Storage config changes.

No database rollback is needed unless live test submissions were created manually during testing. If test ShoutOuts or guest list requests were submitted, delete only those specific test records from Firestore and any matching test media under `shoutouts/{uid}/...` in Firebase Storage.

---

# v28.11 Codex Release — Template Preview Cleanup

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-11-template-preview-cleanup-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Traditional Black & White now uses a tighter red/black marquee-board direction.
2. Removed extra brand text from display preview output.
3. Removed the display footer line from preview output.
4. Added clear labels for templates that do or do not use media.
5. Added image/video placeholder templates:
   - Happy Birthday with image/video placeholder
   - Happy Anniversary with image/video placeholder
   - Happy Engagement with image/video placeholder
   - Fiance Celebration with image/video placeholder
6. Added 50/50 split layout for media templates: media on one side, ShoutOut text on the other.
7. Added a car-themed Luxury Car Celebration template direction.
8. Simplified template selection with a search box.
9. Set Traditional Black & White as the default template.
10. Bumped cache-busting query strings to `v=28.11`.

## Files Changed In This Release

```text
index.html
shared-data.js
patron-app.js
display.html
display-app.js
display.css
styles.css
README.md
ROLLBACK-V28-11.md
rollback-v28-11.ps1
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.11.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

This release changes frontend display/template behavior only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with:

```text
Upload v28.11 template preview cleanup full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11
```

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11
```

Display preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=blackwhite&main=HAPPY%20BIRTHDAY&sub=STACY&v=28.11
```

Birthday media template preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=birthdayMedia&main=HAPPY%20BIRTHDAY&sub=CELEBRATE%20BIG&v=28.11
```

Car template preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=car&main=LUXURY%20RIDE%20CREW&sub=PULL%20UP%20CLEAN&v=28.11
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Search and select a location.
4. Confirm the template selection screen has a template search box.
5. Confirm Traditional Black & White is selected by default.
6. Confirm media templates are labeled as image/video placeholder templates.
7. Continue to editor.
8. Confirm the display preview no longer shows club name / FLOQR header text.
9. Confirm the display preview no longer shows the footer line.
10. Test Traditional Black & White.
11. Test one image/video placeholder template.
12. Test Luxury Car Celebration.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.11.
2. Or upload the previous known-good package, such as v28.10.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10-rollback-test
```

Manual rollback:

1. Upload the prior package contents back to the repo root.
2. Commit with:

```text
Rollback from v28.11 to previous package
```

Helper script:

```powershell
.\rollback-v28-11.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

### Firestore / Storage Rollback

This v28.11 release does not require Firestore or Storage config changes.

No database rollback is needed unless live test submissions were created manually during testing. If test ShoutOuts, guest list requests, or media uploads were created, delete only those test records/media.

---

# v28.12 Codex Release — Avatar Dropdown Link Color Fix

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-12-avatar-dropdown-link-color-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Fixed avatar/user dropdown links so they remain white in all browser link states.
2. Added explicit CSS coverage for:
   - normal links
   - unvisited links
   - visited links
   - hover
   - active
   - focus
3. Applied the rule to both `.user-menu` and `.user-dropdown`.
4. Preserved the dropdown link layout with block display, readable spacing, and hover opacity.
5. Bumped cache-busting query strings to `v=28.12`.

## Files Changed In This Release

```text
styles.css
README.md
ROLLBACK-V28-12.md
rollback-v28-12.ps1
*.html / *.js cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.12.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

This release changes frontend CSS only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with:

```text
Upload v28.12 avatar dropdown link color full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in.
3. Open the avatar/user dropdown.
4. Confirm `My Profile`, `Messages (0/0)`, and `Chats (0/0)` are white.
5. Click one of the links.
6. Go back to the app.
7. Open the dropdown again.
8. Confirm the clicked/visited link is still white, not blue or purple.
9. Hard refresh or open incognito and repeat.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.12.
2. Or upload the previous known-good package, such as v28.11.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11-rollback-test
```

Helper script:

```powershell
.\rollback-v28-12.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

### Firestore / Storage Rollback

This v28.12 release does not require Firestore or Storage config changes.

No database rollback is needed.

---

# FLOQR ShoutOut v28.13 Navigation + Patron Role Request Fix

## Package

```text
jadz-shoutout-v28-13-navigation-role-request-full-package.zip
```

## What Changed

- Added a global Back button to the patron app workflow after sign-in.
- Added Back navigation to `patron-portal.html` and `role-request.html`.
- Removed the Club Admin / DJ / Promoter request link from the public search/ShoutOut page.
- Kept the access request link only inside the patron portal profile summary.
- Updated the role request script to match the current form IDs and submit the selected role request.
- Preserved the v28.12 avatar dropdown white-link fix.
- Bumped active cache-busting links and scripts to `v=28.13`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

The role request form continues to use existing request/profile collections. No schema migration is required.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.13 navigation role request full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Confirm the Back button appears after leaving the login screen.
3. Move through category, search, template, editor, and confirmation screens.
4. Confirm Back returns to the previous workflow screen.
5. Confirm the main search/ShoutOut page does not show `Request Club Admin / DJ / Promoter Access`.
6. Open `patron-portal.html?v=28.13`.
7. Confirm the profile summary still shows `Request Club Admin / DJ / Promoter Access`.
8. Open the role request page from the patron portal.
9. Confirm DJ, Promoter, and Club Admin choices are available.
10. Open the avatar dropdown and confirm My Profile, Messages, and Chats remain white, including visited links.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.13.
2. Or upload the previous known-good package, such as v28.12.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12-rollback-test
```

Helper script:

```powershell
.\rollback-v28-13.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.13.

---

# FLOQR ShoutOut v28.14 Classic Black & White Board Text Layout

## Package

```text
jadz-shoutout-v28-14-classic-black-white-board-layout-full-package.zip
```

## What Changed

- Updated the Classic Black & White ShoutOut renderer to behave like a three-row physical cut-out letter board.
- Kept the current red/black outer sign background and white center board.
- Forces Classic Black & White text to render only inside the white board area.
- Auto-breaks birthday-style text such as `Happy Birthday D` into:

```text
HAPPY
BIRTHDAY
D
```

- Uses bold black uppercase block letters.
- Adds subtle depth/shadow behind the letters to mimic physical plastic cut-out letters.
- Adds faint horizontal guide rails/grooves behind the text rows.
- Keeps editor preview and final display consistent because both use `display.html` and `display-app.js`.
- Bumped active cache-busting links and scripts to `v=28.14`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend template rendering update only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.14 classic black white board layout full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Choose a location and select the Traditional Black & White template.
3. Enter `Happy Birthday D` as the main message.
4. Confirm preview row 1 is `HAPPY`.
5. Confirm preview row 2 is `BIRTHDAY`.
6. Confirm preview row 3 is `D`.
7. Confirm all letters remain inside the white center board.
8. Confirm faint horizontal guide rails/grooves appear behind each row.
9. Confirm letters are bold black uppercase with subtle physical depth/shadow.
10. Submit or preview the final display URL and confirm it matches the editor preview.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.14.
2. Or upload the previous known-good package, such as v28.13.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13-rollback-test
```

Helper script:

```powershell
.\rollback-v28-14.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.14.

---

# FLOQR ShoutOut v28.15 Classic Board Preview Alignment Fix

## Package

```text
jadz-shoutout-v28-15-classic-board-preview-alignment-full-package.zip
```

## What Changed

- Fixed the Classic Black & White preview so text no longer floats into the red/black background.
- Moved the three-row text grid lower and tighter inside the white center board.
- Reduced row font sizing for iframe/mobile previews so large words stay inside the board.
- Forced the normal subtitle element to stay hidden for the Classic Black & White template.
- Renders the main and sub message through the same three board rows.
- Example: `DB in da House` plus `Holla @the_don_4ld` now becomes:

```text
DB IN DA
HOUSE
HOLLA
```

- Preserves the birthday-specific split:

```text
HAPPY
BIRTHDAY
D
```

- Bumped active cache-busting links and scripts to `v=28.15`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend display rendering update only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.15 classic board preview alignment full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Choose Traditional Black & White.
3. Enter `DB in da House` as the main message.
4. Enter `Holla @the_don_4ld` as the sub message.
5. Confirm the preview text stays inside the white board.
6. Confirm the sub message does not appear as a separate floating line.
7. Test `Happy Birthday D` and confirm the rows are `HAPPY`, `BIRTHDAY`, and `D`.
8. Confirm final display URL matches the editor preview.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.15.
2. Or upload the previous known-good package, such as v28.14.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14-rollback-test
```

Helper script:

```powershell
.\rollback-v28-15.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.15.

---

# FLOQR ShoutOut v28.16 Media Upload Display Pipeline Fix

## Package

```text
jadz-shoutout-v28-16-media-upload-display-pipeline-full-package.zip
```

## What Changed

- Fixed patron media submissions so the visible Photo/Video uploader is awaited before the Firestore ShoutOut document is created.
- Saves these fields on submitted ShoutOut documents when media exists:

```text
mediaUrl
mediaType
mediaFileName
mediaStoragePath
mediaUploadedAt
```

- Admin approval now copies those media fields into `liveContent/{clubLocationId}`.
- Display rendering now uses `mediaType` first:
  - `image` renders an `<img>`.
  - `video` renders `<video autoplay muted loop playsinline>`.
- The `IMAGE / VIDEO` placeholder appears only when no `mediaUrl` exists.
- Admin preview links now include `mediaType`.
- Existing text-only ShoutOuts continue to work.
- Fixed an approval notification bug where approval also created rejected audit/notification entries.
- Bumped active cache-busting links and scripts to `v=28.16`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No migration is required. New media metadata fields are added only to new submissions with uploaded media.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.16 media upload display pipeline full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16
```

## Manual Test Checklist

1. Submit a ShoutOut with an image.
2. Confirm `shoutouts/{id}` contains `mediaUrl` and `mediaType: image`.
3. Approve it as admin.
4. Confirm `liveContent/{clubLocationId}` contains the same media fields.
5. Open `display.html?location=zebbies-garden-washington-dc&v=28.16`.
6. Confirm the uploaded image appears instead of `IMAGE / VIDEO`.
7. Repeat with an MP4 video.
8. Confirm the video autoplays muted and loops.
9. Submit a text-only media template ShoutOut.
10. Confirm the placeholder appears only when no media was uploaded.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.16.
2. Or upload the previous known-good package, such as v28.15.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15-rollback-test
```

Helper script:

```powershell
.\rollback-v28-16.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

Database rollback is normally not needed. If a specific media ShoutOut must be removed, delete or update only that `liveContent/{clubLocationId}` document or the related pending `shoutouts/{id}` document manually.

---

# FLOQR ShoutOut v28.24-f Navigation + Messages Fix Package

## Package

```text
shoutoutwepp,vers-28.24-f-full-package.zip
```

## What Changed

- Removed the duplicated generic `← Back` button.
- Standardized workflow back buttons as page-specific `← Back to ...` controls.
- Added clearer workflow labels such as `Screen 3B — Club / Search` and `Screen 4 — Club / Select ShoutOut Template`.
- Removed the bottom Messages / Chats / Notifications bar.
- Merged notifications into Messages counts and the Messages tab.
- Consolidated the previous v28.16 media upload/display pipeline fix and the Classic Black & White board size refinement into one `28.24-f` fix release.
- Adopted release suffix convention: `-f` for fixes and `-nf` for new features.
- Enlarged the Classic Black & White white center board.
- Moved the white board upward to reduce excess red/black header space.
- Enlarged and strengthened the three cut-out letter rows.
- Preserved the three-row board behavior and birthday split.
- Preserved the v28.16 media upload/display pipeline fix.
- Bumped active cache-busting links and scripts to `v=28.24-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend display CSS refinement only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.24-f navigation messages fix package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.24-f
```

## Manual Test Checklist

1. Open a Classic Black & White display preview.
2. Confirm the white center board is larger than v28.16.
3. Confirm the text is larger and bolder.
4. Confirm text remains fully inside the white board.
5. Confirm the red/black header space above the board is reduced.
6. Confirm image/video templates still render uploaded media.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.24-f.
2. Or upload the previous known-good package, such as v28.16.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16-rollback-test
```

Helper script:

```powershell
.\rollback-v28-24-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.24-f.
