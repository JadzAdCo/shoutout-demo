const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const FS = require(path.join(root, "floqr-featured-staff.js"));

const PHOTO_A = "https://firebasestorage.googleapis.com/v0/b/x/o/profileMedia%2Fu1%2Fimages%2Fa.jpg?alt=media&token=1";
const PHOTO_B = "https://firebasestorage.googleapis.com/v0/b/x/o/profileMedia%2Fu1%2Fimages%2Fb.jpg?alt=media&token=2";
const roster = [
  {uid: "u1", displayName: "Priya Shah", photoURL: PHOTO_A, profileMediaSlots: [{type: "image", url: PHOTO_A}, {type: "image", url: PHOTO_B}, {type: "video", url: "https://x/v.mp4"}], instagram: "@priya"},
  {uid: "u2", displayName: "Luis Ortega", profileMediaSlots: []}
];
const rolesOf = profile => ({u1: ["Waitress"], u2: ["Club Admin", "Waiter"]})[profile.uid] || [];

test("photo options are the staff member's own https images only, de-duplicated, no videos", () => {
  assert.deepEqual(FS.photoOptions(roster[0]), [PHOTO_A, PHOTO_B]);
  assert.deepEqual(FS.photoOptions({photoURL: "javascript:alert(1)", avatarUrl: "http://plain"}), []);
});

test("rows list featured people first (checked) then the rest of the roster (unchecked)", () => {
  const featured = [{name: "Marcus Hale", role: "Club Admin", photoUrl: "https://img/m.jpg", publicProfileType: "clubAdmin"}, {name: "priya shah", role: "VIP Waitress"}];
  const rows = FS.buildRows({roster, featured, rolesOf});
  assert.deepEqual(rows.map(r => [r.name, r.checked]), [["Marcus Hale", true], ["priya shah", true], ["Luis Ortega", false]]);
  assert.equal(rows[1].uid, "u1", "featured name matched to roster uid");
  assert.deepEqual(rows[1].photos, [PHOTO_A, PHOTO_B]);
  assert.equal(rows[2].role, "Waiter", "primary role skips Club Admin");
  assert.equal(rows[2].photoUrl, "");
});

test("draft overrides tick, role and photo; uploads join the photo list", () => {
  const rows = FS.buildRows({roster, featured: [], rolesOf});
  const upload = "https://firebasestorage.googleapis.com/v0/b/x/o/clubMedia%2Fc1%2FfeaturedStaff%2Fp.jpg?alt=media&token=3";
  const draft = new Map([["uid:u2", {checked: true, role: "Bottle Service", photoUrl: upload, photoStoragePath: "clubMedia/c1/featuredStaff/p.jpg", uploaded: [upload]}]]);
  const out = FS.applyDraft(rows, draft);
  const luis = out.find(r => r.uid === "u2");
  assert.equal(luis.checked, true);
  assert.deepEqual(luis.photos, [upload]);
  const saved = FS.toFeatured(out);
  assert.deepEqual(saved, [{name: "Luis Ortega", role: "Bottle Service", photoUrl: upload, uid: "u2", photoStoragePath: "clubMedia/c1/featuredStaff/p.jpg"}]);
});

test("saving keeps the original entry shape and extra fields; unticking removes the person", () => {
  const featured = [{name: "Andre Wells", role: "Busboy", photoUrl: "https://img/a.jpg", bio: "Floor runner", publicProfileType: "busBoy"}, {name: "Gone", role: "Waiter"}];
  const rows = FS.buildRows({roster: [], featured, rolesOf});
  const out = FS.applyDraft(rows, new Map([["name:gone", {checked: false}]]));
  assert.deepEqual(FS.toFeatured(out), [{name: "Andre Wells", role: "Busboy", photoUrl: "https://img/a.jpg", bio: "Floor runner", publicProfileType: "busBoy"}]);
});

test("Club Admin uses the checkbox picker, not a URL text box, for featured staff", () => {
  const html = read("admin.html");
  assert.doesNotMatch(html, /id="clubProfileFeaturedStaff"/);
  assert.match(html, /id="featuredStaffPicker"/);
  assert.match(html, /data-floqr-help-id="help-featured-staff"/);
  assert.ok(html.indexOf("floqr-featured-staff.js") < html.indexOf("admin-app.js"));
  const app = read("admin-app.js");
  assert.match(app, /featuredStaff:window\.FLOQRFeaturedStaff\.toFeatured\(featuredStaffRows\(\)\)/);
  assert.match(app, /accept="image\/jpeg,image\/png,image\/webp,image\/gif" data-fs-upload/);
  assert.match(app, /clubMedia\/\$\{locationId\}\/featuredStaff\//);
  assert.doesNotMatch(app, /clubProfileFeaturedStaff/);
});

test("club profile page still renders featuredStaff unchanged", () => {
  const app = read("club-profile-app.js");
  assert.match(app, /personArray\(club\.featuredStaff \|\| club\.featuredServiceStaff, "Service Team"\)/);
});
