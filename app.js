/*
  Jadz AdCo ShoutOut - app.js
  Rollback v12 - Popup Authentication Version

  Purpose:
  - Restores Firebase popup-based sign-in for Google, Microsoft, and Facebook.
  - Keeps Firestore clubs/templates, admin approval, display page, and phone OTP logic.
  - This rollback avoids the newer redirect-auth changes.
*/

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAILS = ["bans.don@gmail.com","don.b@jadzholdings.com"];
const FALLBACK_CLUB = {name:"Jadz Demo",locationLabel:"Shared master demo",brand:"JADZ Ad Co",defaultMain:"Downoaded the SHOUT OUT APP",defaultSub:"",dj:"Jadz AdCo",schedule:{},templates:["neon","birthday","vip"]};
const FALLBACK_TEMPLATES = {
 neon:{id:"neon",name:"Neon ShoutOut",scope:"Shared",className:"neon"},
 birthday:{id:"birthday",name:"Birthday Glow",scope:"Shared",className:"neon"},
 vip:{id:"vip",name:"VIP Table",scope:"Shared",className:"gold"},
 bottle:{id:"bottle",name:"Bottle Service",scope:"Club",className:"fire"},
 gold:{id:"gold",name:"Gold Celebration",scope:"Shared",className:"gold"},
 ice:{id:"ice",name:"Ice Blue",scope:"Club",className:"ice"},
 fire:{id:"fire",name:"Fire Night",scope:"Club",className:"fire"},
 latin:{id:"latin",name:"Latin Night",scope:"Club",className:"gold"},
 hiphop:{id:"hiphop",name:"Hip Hop Night",scope:"Club",className:"fire"}
};

let currentUser=null, selectedClubId=null, selectedTemplate="neon", confirmationResult=null;
let pendingDirectClub="";
let CLUBS={}, TEMPLATES={...FALLBACK_TEMPLATES};

function qs(n,f=""){return new URL(location.href).searchParams.get(n)||f}
function clubId(){return (selectedClubId||qs("club","jadz")).toLowerCase()}
function getClub(id=clubId()){return CLUBS[id]||FALLBACK_CLUB}
function getTemplate(id=selectedTemplate){return TEMPLATES[id]||FALLBACK_TEMPLATES.neon}
function safeEmail(){return (currentUser?.email||currentUser?.phoneNumber||"unknown").toLowerCase()}
function isAdmin(){return !!currentUser && ADMIN_EMAILS.map(e=>e.toLowerCase()).includes(safeEmail())}
function displayUrl(payload,id=clubId()){const u=new URL("./display.html",location.href);u.searchParams.set("club",id);if(payload){u.searchParams.set("main",payload.mainText||"");u.searchParams.set("sub",payload.subText||"");u.searchParams.set("template",payload.template||"neon");u.searchParams.set("media",payload.mediaUrl||"")}return u.href}
function showPage(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(id)?.classList.add("active")}
async function loadTemplates(){TEMPLATES={...FALLBACK_TEMPLATES};const snap=await getDocs(collection(db,"templates"));snap.forEach(d=>TEMPLATES[d.id]={id:d.id,...d.data()})}
async function loadClubs(){CLUBS={};const q=query(collection(db,"clubs"),where("active","==",true),orderBy("name","asc"));const snap=await getDocs(q);snap.forEach(d=>CLUBS[d.id]={id:d.id,...d.data()})}
async function loadClubById(id){if(CLUBS[id])return CLUBS[id];const snap=await getDoc(doc(db,"clubs",id));if(snap.exists()){CLUBS[id]={id:snap.id,...snap.data()};return CLUBS[id]}return FALLBACK_CLUB}

function updateLoginUI(user){
 const s=document.getElementById("signedInAs");
 if(s)s.textContent=user?`Signed in as ${user.displayName||user.email||user.phoneNumber}`:"Not signed in";
 const actions=document.getElementById("signedInActions");
 const login=document.getElementById("loginActions");
 if(actions&&login){
   if(user){actions.classList.remove("hidden");login.classList.add("hidden");}
   else{actions.classList.add("hidden");login.classList.remove("hidden");}
 }
}
function setupAuthWatcher(after){onAuthStateChanged(auth,u=>{currentUser=u;updateLoginUI(u);if(u&&after)after(u)})}
async function loginGoogle(){
  try {
    await signInWithPopup(auth,new GoogleAuthProvider());
  } catch(e) {
    const el=document.getElementById("authStatus");
    if(el) el.textContent=e.message;
    console.error("Google sign-in error:", e);
  }
}
async function loginFacebook(){
  try {
    await signInWithPopup(auth,new FacebookAuthProvider());
  } catch(e) {
    const el=document.getElementById("authStatus");
    if(el) el.textContent=e.message;
    console.error("Facebook sign-in error:", e);
  }
}
async function loginMicrosoft(){
  try {
    const p=new OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    await signInWithPopup(auth,p);
  } catch(e) {
    const el=document.getElementById("authStatus");
    if(el) el.textContent=e.message;
    console.error("Microsoft sign-in error:", e);
  }
});await signInWithPopup(auth,p)}
async function logout(){await signOut(auth);location.reload()}
function setupPhoneAuth(){if(!document.getElementById("recaptcha-container")||window.recaptchaVerifier)return;window.recaptchaVerifier=new RecaptchaVerifier(auth,"recaptcha-container",{size:"normal"})}
async function sendPhoneCode(){try{setupPhoneAuth();const phone=document.getElementById("phoneNumber").value.trim();if(!phone.startsWith("+")){authStatus.textContent="Use international format, for example +12025550123.";return}confirmationResult=await signInWithPhoneNumber(auth,phone,window.recaptchaVerifier);authStatus.textContent="Code sent. Enter it below.";phoneCodeBlock.classList.remove("hidden")}catch(e){authStatus.textContent=e.message}}
async function verifyPhoneCode(){try{await confirmationResult.confirm(document.getElementById("phoneCode").value.trim());authStatus.textContent="Phone verified."}catch(e){authStatus.textContent=e.message}}

async function initClientPortal() {
  pendingDirectClub = qs("club", "");

  setupAuthWatcher(async () => {
    await loadTemplates();
    await loadClubs();

    if (pendingDirectClub) {
      const club = await loadClubById(pendingDirectClub);
      selectedClubId = pendingDirectClub;

      showClubSelection();

      if (qrForwardNotice) {
        qrForwardNotice.classList.remove("hidden");
        qrForwardNotice.textContent = `QR code detected. Routing to ${club.name}.`;
      }

      setTimeout(() => selectClub(pendingDirectClub), 600);
    } else {
      showClubSelection();
    }
  });
}
async function prepareAfterLogin(autoAdvance=true){
 await loadTemplates(); await loadClubs();
 if(autoAdvance){
   if(pendingDirectClub){
     const club=await loadClubById(pendingDirectClub);
     selectedClubId=pendingDirectClub;
     showClubSelection();
     if(qrForwardNotice){
       qrForwardNotice.classList.remove("hidden");
       qrForwardNotice.textContent=`QR code detected. Routing to ${club.name}.`;
     }
     setTimeout(()=>selectClub(pendingDirectClub),600);
   } else {
     showClubSelection();
   }
 }
}
async function continueAfterLogin(){ await prepareAfterLogin(true); }
function unique(a){return [...new Set(a.filter(Boolean))].sort()}
function populateFilters(){const cf=countryFilter,lf=cityFilter,df=dayFilter,gf=genreFilter;if(!cf)return;cf.innerHTML='<option value="">All countries</option>';lf.innerHTML='<option value="">All locations</option>';df.innerHTML='<option value="">Any day</option>';gf.innerHTML='<option value="">All genres</option>';unique(Object.values(CLUBS).map(c=>c.country)).forEach(x=>cf.append(new Option(x,x)));unique(Object.values(CLUBS).map(c=>c.locationLabel)).forEach(x=>lf.append(new Option(x,x)));unique(Object.values(CLUBS).flatMap(c=>Object.keys(c.schedule||{}))).forEach(x=>df.append(new Option(x,x)));unique(Object.values(CLUBS).flatMap(c=>Object.values(c.schedule||{}))).forEach(x=>gf.append(new Option(x,x)))}
function bindFilters(){["clubSearch","countryFilter","cityFilter","dayFilter","genreFilter"].forEach(id=>{const e=document.getElementById(id);if(e&&!e.dataset.bound){e.addEventListener("input",renderClubGrid);e.addEventListener("change",renderClubGrid);e.dataset.bound="1"}})}
function showClubSelection(){showPage("clubPage");populateFilters();bindFilters();renderClubGrid()}
function renderClubGrid(){const grid=document.getElementById("clubGrid");if(!grid)return;const search=(clubSearch?.value||"").toLowerCase(),country=countryFilter?.value||"",loc=cityFilter?.value||"",day=dayFilter?.value||"",genre=genreFilter?.value||"";const matches=Object.entries(CLUBS).filter(([id,c])=>{const sched=Object.entries(c.schedule||{}).map(([d,g])=>`${d} ${g}`).join(" ");const hay=`${c.name} ${c.country} ${c.region} ${c.city} ${c.locationLabel} ${c.dj} ${sched}`.toLowerCase();return(!search||hay.includes(search))&&(!country||c.country===country)&&(!loc||c.locationLabel===loc)&&(!day||Object.keys(c.schedule||{}).includes(day))&&(!genre||Object.values(c.schedule||{}).includes(genre))});grid.innerHTML=matches.length?"":"<div class='empty'>No matching clubs found.</div>";matches.forEach(([id,c])=>{const card=document.createElement("div");card.className="club-option";card.innerHTML=`<div><div class="club-option-head"><div><h3>${esc(c.name)}</h3><p>${esc(c.locationLabel)}</p></div><strong>${esc(c.country)}</strong></div><p class="dj">Resident: ${esc(c.dj||"")}</p><div class="badge-row">${Object.entries(c.schedule||{}).map(([d,g])=>`<span>${esc(d)} · ${esc(g)}</span>`).join("")}</div></div><button class="primary">Select Club</button>`;card.querySelector("button").onclick=()=>selectClub(id);grid.appendChild(card)})}
async function selectClub(id){selectedClubId=id;const c=await loadClubById(id);selectedClubTitle.textContent=c.name;selectedClubMeta.textContent=`${c.locationLabel} • ${c.dj||""}`;selectedTemplate=(c.templates&&c.templates[0])||"neon";renderTemplates();updateTemplateSummary();showPage("templateSelectPage")}
function showTemplateSelection(){renderTemplates();updateTemplateSummary();showPage("templateSelectPage")}
function renderTemplates(){const grid=document.getElementById("templateGrid");if(!grid)return;grid.innerHTML="";(getClub().templates||["neon"]).forEach(tid=>{const t=getTemplate(tid);const d=document.createElement("div");d.className=`template ${t.className||"neon"} ${t.id===selectedTemplate?"selected":""}`;d.innerHTML=`<div class="name">${esc(t.name)}</div><div class="tag">${esc(t.scope||"Shared")} template</div>`;d.onclick=()=>{selectedTemplate=t.id;renderTemplates();updateTemplateSummary()};grid.appendChild(d)})}
function updateTemplateSummary(){const t=getTemplate();if(selectedTemplateSummary)selectedTemplateSummary.innerHTML=`<h3>${esc(t.name)}</h3><p>${esc(t.scope||"Shared")} template selected.</p>`}
function goToEditor(){const c=getClub();const t=getTemplate();editorClubTitle.textContent=c.name;editorTemplateMeta.textContent=`${c.locationLabel} • Template: ${t.name}`;updatePreview();showPage("editorPage")}
function updatePreview(){const main=mainText?.value.trim()||"SHOUTOUT!",sub=subText?.value.trim()||"",media=mediaUrl?.value.trim()||"";if(previewFrame)previewFrame.src=displayUrl({mainText:main,subText:sub,mediaUrl:media,template:selectedTemplate},clubId())}
async function submitShoutout(){try{if(!currentUser){submitStatus.textContent="Sign in first.";return}if(!selectedClubId){submitStatus.textContent="Select a club first.";return}const c=getClub(),t=getTemplate();const payload={club:clubId(),clubName:c.name,country:c.country,city:c.city,locationLabel:c.locationLabel,template:selectedTemplate,templateName:t.name,mainText:mainText.value.trim()||"SHOUTOUT!",subText:subText.value.trim()||"",mediaUrl:mediaUrl.value.trim(),status:"pending",submittedBy:safeEmail(),submittedAt:serverTimestamp(),referenceNumber:`SO-${Date.now().toString().slice(-7)}`};await addDoc(collection(db,"shoutouts"),payload);confirmRef.textContent=payload.referenceNumber;confirmClub.textContent=c.name;confirmTemplate.textContent=t.name;showPage("confirmationPage")}catch(e){submitStatus.textContent=e.message}}
function startAnother(){mainText.value="HAPPY BIRTHDAY MAYA!";subText.value="VIP Table 4 sends love";mediaUrl.value="";showTemplateSelection()}

// Admin/display/seed support from prior version
async function initAdminPortal(){selectedClubId=qs("club","jadz");await loadTemplates();await loadClubById(selectedClubId);document.getElementById("clubName").textContent=getClub().name;setupAuthWatcher(()=>{if(isAdmin()){adminLogin.classList.add("hidden");adminPanel.classList.remove("hidden");renderAdminQueue()}else if(adminStatus)adminStatus.textContent=`Signed in as ${safeEmail()}, but this email is not listed in ADMIN_EMAILS in app.js.`})}
function renderAdminQueue(){displayLink.href=`./display.html?club=${clubId()}`;liveFrame.src=`./display.html?club=${clubId()}`;const q=query(collection(db,"shoutouts"),where("club","==",clubId()),where("status","==","pending"),orderBy("submittedAt","desc"));onSnapshot(q,snap=>{queueList.innerHTML="";if(snap.empty){queueList.innerHTML="<p class='sub'>No pending shoutouts yet.</p>";return}snap.forEach(ds=>{const item=ds.data(),div=document.createElement("div");div.className="queue-item";div.innerHTML=`<strong>${esc(item.mainText)}</strong><p>${esc(item.subText||"")}</p><small>Club: ${esc(item.clubName||item.club)} • Template: ${esc(item.templateName||item.template||"neon")} • Ref: ${esc(item.referenceNumber||"")} • Submitted by: ${esc(item.submittedBy||"unknown")}</small><div class="queue-actions"><button class="approve">Approve & Push Live</button><button class="reject">Reject</button><a class="buttonlike" target="_blank" href="${displayUrl(item)}">Preview</a></div>`;div.querySelector(".approve").onclick=()=>approveItem(ds.id,item);div.querySelector(".reject").onclick=()=>rejectItem(ds.id);queueList.appendChild(div)})},e=>{queueList.innerHTML=`<p class="status">${esc(e.message)}</p>`})}
async function approveItem(id,item){await setDoc(doc(db,"liveContent",clubId()),{club:clubId(),clubName:item.clubName||getClub().name,template:item.template||"neon",templateName:item.templateName||"",mainText:item.mainText||"SHOUTOUT!",subText:item.subText||"",mediaUrl:item.mediaUrl||"",status:"approved",submittedBy:item.submittedBy||"unknown",approvedBy:safeEmail(),referenceNumber:item.referenceNumber||"",approvedAt:serverTimestamp()});await deleteDoc(doc(db,"shoutouts",id))}
async function rejectItem(id){await deleteDoc(doc(db,"shoutouts",id))}
async function initDisplayPage(){selectedClubId=qs("club","jadz");await loadTemplates();await loadClubById(selectedClubId);const c=getClub();displayBrand.textContent=c.brand;function render(p){displayCanvas.classList.remove("gold","ice","fire");const t=getTemplate(p.template);if(t.className&&t.className!=="neon")displayCanvas.classList.add(t.className);displayMain.textContent=p.mainText||c.defaultMain;displaySub.textContent=p.subText||"";if(p.mediaUrl){mediaSlot.classList.remove("hidden");const isVideo=/\.(mp4|webm|ogg)(\?|$)/i.test(p.mediaUrl);mediaSlot.innerHTML=isVideo?`<video src="${escAttr(p.mediaUrl)}" autoplay muted loop playsinline></video>`:`<img src="${escAttr(p.mediaUrl)}" alt="ShoutOut media">`}else{mediaSlot.classList.add("hidden");mediaSlot.innerHTML=""}}if(qs("main","")){render({mainText:qs("main"),subText:qs("sub"),template:qs("template","neon"),mediaUrl:qs("media","")});return}onSnapshot(doc(db,"liveContent",clubId()),s=>render(s.exists()?s.data():{mainText:c.defaultMain,subText:c.defaultSub,template:"neon",mediaUrl:""}),e=>render({mainText:"DISPLAY ERROR",subText:e.message,template:"fire"}))}
function initSeedPage(){setupAuthWatcher(()=>{})}
const SEED_TEMPLATES=FALLBACK_TEMPLATES;
const SEED_CLUBS={
"zebbies-garden":{name:"Zebbies Garden",country:"United States",region:"District of Columbia",city:"Washington",locationLabel:"Washington, District of Columbia, United States",brand:"ZEBBIES GARDEN x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ZEBBIES",defaultSub:"",dj:"DJ Nova",schedule:{Monday:"Hip Hop",Wednesday:"EDM",Friday:"Afro Beats",Saturday:"International"},templates:["birthday","vip","bottle","neon"],active:true},
"st-yves":{name:"St. Yves",country:"United States",region:"District of Columbia",city:"Washington",locationLabel:"Washington, District of Columbia, United States",brand:"ST. YVES x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ST. YVES",defaultSub:"",dj:"DJ Saint",schedule:{Thursday:"EDM",Friday:"Hip Hop",Saturday:"International"},templates:["vip","gold","birthday","neon"],active:true},
"abigail":{name:"Abigail",country:"Spain",region:"Catalonia",city:"Barcelona",locationLabel:"Barcelona, Spain",brand:"ABIGAIL x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ABIGAIL",defaultSub:"",dj:"DJ Luna",schedule:{Tuesday:"Latin",Thursday:"Cuban",Saturday:"EDM",Sunday:"International"},templates:["latin","birthday","vip","ice"],active:true},
"heist":{name:"Heist",country:"United States",region:"Georgia",city:"Atlanta",locationLabel:"Atlanta, Georgia, United States",brand:"HEIST x JADZ ADCO",defaultMain:"USE SHOUT OUT @ HEIST",defaultSub:"",dj:"DJ Cipher",schedule:{Monday:"Hip Hop",Friday:"Afro Beats",Saturday:"Hip Hop"},templates:["hiphop","birthday","bottle","fire"],active:true},
"decades":{name:"Decades",country:"United States",region:"California",city:"Los Angeles",locationLabel:"Los Angeles, California, United States",brand:"DECADES x JADZ ADCO",defaultMain:"USE SHOUT OUT @ DECADES",defaultSub:"",dj:"DJ Era",schedule:{Wednesday:"EDM",Friday:"Latin",Saturday:"International"},templates:["neon","vip","gold","birthday"],active:true},
"zebbies-dallas":{name:"Zebbies Garden",country:"United States",region:"Texas",city:"Dallas",locationLabel:"Dallas, Texas, United States",brand:"ZEBBIES DALLAS x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ZEBBIES DALLAS",defaultSub:"",dj:"DJ Metro",schedule:{Thursday:"Hip Hop",Friday:"Latin",Saturday:"EDM"},templates:["birthday","vip","bottle","fire"],active:true},
"abigail-austin":{name:"Abigail",country:"United States",region:"Texas",city:"Austin",locationLabel:"Austin, Texas, United States",brand:"ABIGAIL AUSTIN x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ABIGAIL AUSTIN",defaultSub:"",dj:"DJ Sol",schedule:{Tuesday:"Latin",Friday:"International",Saturday:"EDM"},templates:["latin","neon","vip","ice"],active:true},
"heist-houston":{name:"Heist",country:"United States",region:"Texas",city:"Houston",locationLabel:"Houston, Texas, United States",brand:"HEIST HOUSTON x JADZ ADCO",defaultMain:"USE SHOUT OUT @ HEIST HOUSTON",defaultSub:"",dj:"DJ H-Town",schedule:{Monday:"Afro Beats",Friday:"Hip Hop",Saturday:"International"},templates:["hiphop","bottle","birthday","gold"],active:true},
"decades-nyc":{name:"Decades",country:"United States",region:"New York",city:"New York",locationLabel:"New York, New York, United States",brand:"DECADES NYC x JADZ ADCO",defaultMain:"USE SHOUT OUT @ DECADES NYC",defaultSub:"",dj:"DJ Skyline",schedule:{Wednesday:"EDM",Friday:"Hip Hop",Saturday:"International"},templates:["neon","birthday","vip","ice"],active:true},
"st-yves-cannes":{name:"St. Yves",country:"France",region:"Cote D’Azur",city:"Cannes",locationLabel:"Cannes, Cote D’Azur, France",brand:"ST. YVES CANNES x JADZ ADCO",defaultMain:"USE SHOUT OUT @ ST. YVES CANNES",defaultSub:"",dj:"DJ Riviera",schedule:{Thursday:"International",Friday:"EDM",Saturday:"Latin"},templates:["gold","vip","neon","birthday"],active:true}};
async function seedDatabase(){try{if(!isAdmin()){seedStatus.textContent="Sign in with an admin email first.";return}seedStatus.textContent="Seeding database...";for(const [id,t] of Object.entries(SEED_TEMPLATES))await setDoc(doc(db,"templates",id),t,{merge:true});for(const [id,c] of Object.entries(SEED_CLUBS))await setDoc(doc(db,"clubs",id),c,{merge:true});seedStatus.textContent="Done. Clubs and templates created/updated in Firestore."}catch(e){seedStatus.textContent=e.message}}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escAttr(v){return esc(v).replace(/`/g,"&#096;")}
Object.assign(window, {
  initClientPortal,
  initAdminPortal,
  initDisplayPage,
  initSeedPage,
  seedDatabase,
  loginGoogle,
  loginFacebook,
  loginMicrosoft,
  logout,
  sendPhoneCode,
  verifyPhoneCode,
  submitShoutout,
  showClubSelection,
  showTemplateSelection,
  goToEditor,
  startAnother,
  continueAfterLogin
});