/* guest-list-app.js v29.07 - published campaigns, themes, and Supporting Team */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const setText=(id,v)=>{const e=byId(id); if(e)e.textContent=v;};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const qs=n=>new URL(location.href).searchParams.get(n)||"";
if(!window.firebaseConfig){setText("guestStatus","firebase-config.js missing window.firebaseConfig.");return;}
firebase.initializeApp(window.firebaseConfig);
const auth=firebase.auth(), db=firebase.firestore();
const locations=window.SHOUTOUT_CLUB_LOCATIONS||{}, promoters=window.SHOUTOUT_PROMOTERS||{};
let campaigns=[];
function bind(id,fn){byId(id)?.addEventListener("click",fn);}
async function loginGoogle(){try{setText("guestStatus","Opening Google sign-in...");await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){setText("guestStatus",`${e.code||"error"}: ${e.message}`);}}
async function logout(){await auth.signOut();location.href="./?v=29.09.8&start=search";}
function renderSelects(){
 const rl=qs("location"), rp=qs("promoter");
 byId("guestLocation").innerHTML=`<option value="">Select club/location</option>`+Object.entries(locations).map(([id,l])=>`<option value="${esc(id)}">${esc(l.locationName||l.name||id)}</option>`).join("");
 if(rl&&locations[rl])byId("guestLocation").value=rl;
 byId("guestPromoter").innerHTML=`<option value="">Select promoter/promoting group</option>`+Object.entries(promoters).filter(([id,p])=>p.active!==false).map(([id,p])=>`<option value="${esc(id)}">${esc(p.promoterGroup||p.name||id)}</option>`).join("");
 if(rp&&promoters[rp])byId("guestPromoter").value=rp;
 loadCampaigns(byId("guestLocation").value || rl);
}
function renderCampaignHero(campaign){const hero=byId("guestCampaignHero");if(!campaign){hero?.classList.add("hidden");document.body.dataset.guestTheme="midnight";return;}document.body.dataset.guestTheme=campaign.theme||"midnight";byId("guestCampaignHeroTitle").textContent=campaign.campaignName||"Guest List";byId("guestCampaignHeroDescription").textContent=campaign.description||[campaign.eventType,campaign.eventDate].filter(Boolean).join(" - ");const image=byId("guestCampaignHeroImage");if(campaign.mainImageUrl){image.src=campaign.mainImageUrl;image.classList.remove("hidden");}else{image.removeAttribute("src");image.classList.add("hidden");}byId("guestCampaignSupportingTeam").innerHTML=(campaign.supportingTeam||[]).map(name=>`<span>${esc(name)}</span>`).join("");hero.classList.remove("hidden");}
async function loadCampaigns(locationId){const select=byId("guestEventOrDay");if(!select)return;campaigns=[];select.innerHTML='<option value="">Select campaign/event</option>';if(!locationId){renderCampaignHero(null);return;}try{const snap=await db.collection("guestListCampaigns").where("clubLocationId","==",locationId).limit(50).get();campaigns=snap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(row=>row.active!==false&&String(row.status||"enabled")!=="archived"&&String(row.status||"enabled")!=="disabled");campaigns.forEach(row=>select.append(new Option([row.campaignName,row.eventDate,row.eventType].filter(Boolean).join(" - "),row.id)));["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Future Event"].forEach(day=>select.append(new Option(day,`day:${day}`)));const requested=qs("campaign");if(requested&&campaigns.some(row=>row.id===requested))select.value=requested;renderCampaignHero(campaigns.find(row=>row.id===select.value)||null);}catch(e){setText("guestStatus",`Guest list campaigns could not load: ${e.message}`);}}
async function loadProfile(u){try{const s=await db.collection("users").doc(u.uid).get();const p=s.exists?s.data():{};byId("guestFirstName").value=p.firstName||"";byId("guestLastName").value=p.lastName||"";byId("guestPhone").value=p.phone||u.phoneNumber||"";byId("guestEmail").value=p.email||u.email||"";if((!p.firstName||!p.lastName)&&u.displayName){const parts=u.displayName.trim().split(/\s+/);byId("guestFirstName").value=p.firstName||parts[0]||"";byId("guestLastName").value=p.lastName||parts.slice(1).join(" ")||"";}}catch(e){}}
function addGuestRow(){const w=document.createElement("div");w.className="profile-grid additional-guest-row";w.innerHTML=`<label>Guest First Name<input class="extraFirstName"/></label><label>Guest Last Name<input class="extraLastName"/></label><button type="button" class="ghost removeGuestBtn">Remove</button>`;w.querySelector(".removeGuestBtn").onclick=()=>w.remove();byId("additionalGuests").appendChild(w);}
function extras(){return Array.from(document.querySelectorAll(".additional-guest-row")).map(r=>{const f=r.querySelector(".extraFirstName").value.trim(),l=r.querySelector(".extraLastName").value.trim();return{firstName:f,lastName:l,fullName:`${f} ${l}`.trim()};}).filter(g=>g.firstName||g.lastName);}
async function submitGuestList(){
 try{
 const u=auth.currentUser;if(!u)return setText("guestStatus","Please sign in first.");
 const locationId=byId("guestLocation").value,eventSelection=byId("guestEventOrDay").value,campaign=campaigns.find(row=>row.id===eventSelection),eventOrDay=campaign?(campaign.campaignName||campaign.eventDate||campaign.id):eventSelection.replace(/^day:/,""),promoterId=byId("guestPromoter").value,firstName=byId("guestFirstName").value.trim(),lastName=byId("guestLastName").value.trim(),partySize=Number(byId("guestPartySize").value||1);
 if(!locationId)return setText("guestStatus","Please select a club/location.");
 if(!eventOrDay)return setText("guestStatus","Please select an event or day.");
 if(!promoterId)return setText("guestStatus","Promoter / promoting group is required.");
 if(!firstName||!lastName)return setText("guestStatus","Legal first name and legal last name are required.");
 if(!byId("legalNameConfirmed").checked)return setText("guestStatus","Please confirm your legal name matches your government-issued ID.");
 const loc=locations[locationId]||{},prom=promoters[promoterId]||{},additionalGuests=extras();
 const doc={type:"guestList",status:"pending",clubLocationId:locationId,locationName:loc.locationName||loc.name||locationId,campaignId:campaign?.id||"",campaignName:campaign?.campaignName||"",eventType:campaign?.eventType||"",eventDate:campaign?.eventDate||"",theme:campaign?.theme||"",supportingTeam:campaign?.supportingTeam||[],eventOrDay,promoterId,promoterName:prom.promoterGroup||prom.name||promoterId,firstName,lastName,fullName:`${firstName} ${lastName}`.trim(),legalNameConfirmed:true,guestPhone:byId("guestPhone").value.trim(),guestEmail:byId("guestEmail").value.trim()||u.email||"",partySize,additionalGuests,notes:byId("guestNotes").value.trim(),submittedByUid:u.uid,submittedByEmail:u.email||"",submittedAt:firebase.firestore.FieldValue.serverTimestamp()};
 const ref=await db.collection("guestListRequests").add(doc);
 await db.collection("users").doc(u.uid).set({firstName,lastName,fullName:doc.fullName,phone:doc.guestPhone,email:doc.guestEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
 byId("guestFormCard").classList.add("hidden");byId("guestReceipt").classList.remove("hidden");
 byId("guestReceiptBody").innerHTML=`<div class="report-table"><div><span>Reference</span><strong>${esc(ref.id)}</strong></div><div><span>Club</span><strong>${esc(doc.locationName)}</strong></div><div><span>Name</span><strong>${esc(doc.fullName)}</strong></div><div><span>Additional Guests</span><strong>${additionalGuests.length}</strong></div><div><span>Promoter</span><strong>${esc(doc.promoterName)}</strong></div><div><span>Status</span><strong>Pending</strong></div></div>`;
 setText("guestStatus","Guest list request submitted.");
 }catch(e){console.error(e);setText("guestStatus",`${e.code||"error"}: ${e.message}`);}
}
document.addEventListener("DOMContentLoaded",()=>{renderSelects();bind("guestGoogleLoginBtn",loginGoogle);bind("submitGuestListBtn",submitGuestList);bind("addGuestBtn",addGuestRow);byId("guestLocation")?.addEventListener("change",event=>loadCampaigns(event.currentTarget.value));byId("guestEventOrDay")?.addEventListener("change",event=>renderCampaignHero(campaigns.find(row=>row.id===event.currentTarget.value)||null));auth.onAuthStateChanged(u=>{if(!u){byId("guestLogin").classList.remove("hidden");byId("guestFormCard").classList.add("hidden");setText("guestStatus","Please sign in to continue.");return;}byId("guestLogin").classList.add("hidden");byId("guestFormCard").classList.remove("hidden");setText("guestStatus","");loadProfile(u);});});
})();
