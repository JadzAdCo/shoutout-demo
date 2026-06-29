/* FLOQR Master Admin duplicate record diagnostics and safe club merge tools v28.70 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let db = null;
  let auth = null;
  let duplicateGroups = [];

  function nowField() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function arrayUnion(...values) {
    const clean = values.flat().map(value => String(value || "").trim()).filter(Boolean);
    return clean.length ? firebase.firestore.FieldValue.arrayUnion(...clean) : null;
  }

  function normalized(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function unique(values = []) {
    const seen = new Set();
    const out = [];
    values.flat().filter(Boolean).forEach(value => {
      const text = String(value || "").trim();
      const key = normalized(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(text);
    });
    return out;
  }

  function titleOf(row = {}) {
    return row.locationName || row.brandName || row.name || row.id || "";
  }

  function baseInstitutionName(row = {}) {
    let text = normalized(titleOf(row));
    [row.city, row.country, row.region, row.stateRegion].filter(Boolean).forEach(part => {
      const key = normalized(part);
      if (key && key.length > 3) text = text.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
    });
    text = text
      .replace(/\b(beach club|night club|nightclub|club|lounge club|lounge|rooftop bar|rooftop lounge|bar|restaurant|venue|events?|tickets?)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || normalized(row.brandName || row.locationName || row.id);
  }

  function locationKey(row = {}) {
    return [normalized(row.city), normalized(row.country)].filter(Boolean).join("|");
  }

  function activeForDuplicateScan(row = {}) {
    const status = normalized(row.status || "active");
    return status !== "deleted" && status !== "merged" && row.active !== false && !row.aliasOf && !row.mergedInto;
  }

  async function getCollectionSafe(name, limit = 1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(doc => ({id:doc.id, _collection:name, ...doc.data()}));
    } catch (error) {
      console.warn(`Could not read ${name}:`, error?.message || error);
      return [];
    }
  }

  function duplicateScore(a = {}, b = {}) {
    let score = 0;
    const reasons = [];
    const sameCityCountry = locationKey(a) && locationKey(a) === locationKey(b);
    const baseA = baseInstitutionName(a);
    const baseB = baseInstitutionName(b);
    const titleA = normalized(titleOf(a));
    const titleB = normalized(titleOf(b));
    const brandA = normalized(a.brandName);
    const brandB = normalized(b.brandName);
    if (sameCityCountry) {
      score += 25;
      reasons.push("same city/country");
    }
    if (baseA && baseA === baseB) {
      score += 45;
      reasons.push("same institution name after removing descriptors");
    } else if (baseA && baseB && (baseA.includes(baseB) || baseB.includes(baseA) || titleA.includes(baseB) || titleB.includes(baseA))) {
      score += 30;
      reasons.push("one club name contains the other");
    }
    if (brandA && brandA === brandB) {
      score += 15;
      reasons.push("same brand");
    }
    if (normalized(a.officialWebsite || a.website) && normalized(a.officialWebsite || a.website) === normalized(b.officialWebsite || b.website)) {
      score += 20;
      reasons.push("same website");
    }
    if (normalized(a.address) && normalized(a.address) === normalized(b.address)) {
      score += 20;
      reasons.push("same address");
    }
    return {score, reasons: unique(reasons)};
  }

  function groupDuplicates(rows = []) {
    const active = rows.filter(activeForDuplicateScan);
    const groups = [];
    const used = new Set();
    active.forEach((row, index) => {
      if (used.has(row.id)) return;
      const matches = [row];
      const reasons = new Set();
      let maxScore = 0;
      for (let i = index + 1; i < active.length; i += 1) {
        const other = active[i];
        const result = duplicateScore(row, other);
        if (result.score >= 65) {
          matches.push(other);
          used.add(other.id);
          maxScore = Math.max(maxScore, result.score);
          result.reasons.forEach(reason => reasons.add(reason));
        }
      }
      if (matches.length > 1) {
        used.add(row.id);
        groups.push({
          id:`dup-${groups.length + 1}`,
          records:matches,
          score:maxScore || 65,
          reasons:Array.from(reasons),
          suggestedPrimaryId:suggestPrimary(matches).id
        });
      }
    });
    return groups;
  }

  function suggestPrimary(records = []) {
    return records.slice().sort((a, b) => {
      const aScore = (a.officialWebsite || a.website ? 3 : 0) + (a.address ? 2 : 0) + (a.telephone || a.phone ? 2 : 0) + (a.active !== false ? 1 : 0) + (normalized(a.type).includes("beach") ? 0 : 1);
      const bScore = (b.officialWebsite || b.website ? 3 : 0) + (b.address ? 2 : 0) + (b.telephone || b.phone ? 2 : 0) + (b.active !== false ? 1 : 0) + (normalized(b.type).includes("beach") ? 0 : 1);
      if (aScore !== bScore) return bScore - aScore;
      return String(a.id).localeCompare(String(b.id));
    })[0] || records[0];
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([key, value]) => `<div><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`;
  }

  function setStatus(message = "") {
    const el = byId("duplicateRecordStatus");
    if (el) el.textContent = message;
  }

  function recordSearchText(row = {}) {
    return [row.id, row.locationName, row.brandName, row.type, row.city, row.country, row.address, row.officialWebsite || row.website, row.status, ...(row.aliasNames || []), ...(row.aliasLocationIds || [])].filter(Boolean).join(" ");
  }

  function filterGroups(groups = []) {
    const query = normalized(byId("duplicateRecordSearch")?.value || "");
    if (!query) return groups;
    return groups.filter(group => normalized(group.records.map(recordSearchText).join(" ")).includes(query));
  }

  function renderDuplicateGroups(groups = duplicateGroups) {
    const wrap = byId("duplicateRecordResults");
    if (!wrap) return;
    const filtered = filterGroups(groups);
    if (byId("duplicateRecordSummary")) {
      byId("duplicateRecordSummary").innerHTML = simpleRows([
        ["Duplicate groups found", groups.length.toLocaleString()],
        ["Visible after search", filtered.length.toLocaleString()],
        ["Merge behavior", "Primary stays active; duplicates become aliases/merged records"],
        ["Alias collection", "clubLocationAliases"]
      ]);
    }
    wrap.innerHTML = filtered.length ? filtered.map((group, groupIndex) => {
      const originalIndex = duplicateGroups.indexOf(group);
      return `<div class="queue-item duplicate-group" data-duplicate-group="${originalIndex}">
        <div class="message-envelope-head">
          <strong>Possible duplicate club group</strong>
          <span class="status-pill">${esc(group.score)}% match</span>
        </div>
        <p class="sub small">Reasons: ${esc(group.reasons.join(", ") || "name/city similarity")}</p>
        <div class="profile-grid">
          ${group.records.map(record => `<label class="wide-field">
            <input type="radio" name="duplicate-primary-${groupIndex}" value="${esc(record.id)}" ${record.id === group.suggestedPrimaryId ? "checked" : ""}/>
            <strong>${esc(titleOf(record))}</strong>
            <span class="sub small">${esc(record.id)} | ${esc(record.type || "club")} | ${esc(record.city || "")}, ${esc(record.country || "")} | status: ${esc(record.status || "active")}</span>
          </label>`).join("")}
        </div>
        ${simpleRows(group.records.map(record => [
          titleOf(record),
          `${record.id} | ${record.address || record.locationLabel || "-"} | ${record.officialWebsite || record.website || "-"}`
        ]))}
        <div class="queue-actions">
          <button type="button" data-duplicate-action="merge">Merge Other Records Into Selected Primary</button>
        </div>
      </div>`;
    }).join("") : "<p class='sub'>No duplicate club groups matched. Use Manual primary/duplicate IDs if you already know the pair.</p>";
    wrap.querySelectorAll("[data-duplicate-action='merge']").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-duplicate-group]");
        const group = duplicateGroups[Number(card.dataset.duplicateGroup)];
        const primaryId = card.querySelector("input[type='radio']:checked")?.value || group.suggestedPrimaryId;
        mergeDuplicateGroup(group, primaryId);
      });
    });
  }

  async function refreshDuplicateDiagnostics() {
    if (!db) return;
    setStatus("Scanning clubLocations for duplicate records...");
    const rows = await getCollectionSafe("clubLocations", 1200);
    duplicateGroups = groupDuplicates(rows);
    renderDuplicateGroups();
    setStatus(duplicateGroups.length ? `Found ${duplicateGroups.length} possible duplicate group(s).` : "No duplicate club groups found.");
  }

  function mergePayloadForPrimary(primary = {}, duplicates = []) {
    const duplicateIds = duplicates.map(item => item.id);
    const duplicateNames = unique(duplicates.flatMap(item => [item.locationName, item.brandName, item.id]));
    const keywords = unique([
      primary.publicSearchKeywords || [],
      primary.aliasNames || [],
      duplicateNames,
      duplicateIds,
      duplicates.flatMap(item => [item.type, item.city, item.country, item.categories, item.genres])
    ]);
    const payload = {
      status:"active",
      active:true,
      canonicalLocationId:primary.id,
      duplicateMergePrimary:true,
      duplicateMergeUpdatedAt:nowField(),
      duplicateMergeUpdatedByUid:auth.currentUser?.uid || "",
      duplicateMergeUpdatedByEmail:auth.currentUser?.email || "",
      updatedAt:nowField()
    };
    const aliasIds = arrayUnion(duplicateIds);
    const aliases = arrayUnion(duplicateNames);
    const merged = arrayUnion(duplicateIds);
    const search = arrayUnion(keywords);
    if (aliasIds) payload.aliasLocationIds = aliasIds;
    if (aliases) payload.aliasNames = aliases;
    if (merged) payload.mergedDuplicateIds = merged;
    if (search) payload.publicSearchKeywords = search;
    return payload;
  }

  async function updateReferencesForAlias(duplicate, primary) {
    const fields = ["locationId", "clubLocationId", "location"];
    const collections = ["events", "shoutouts", "guestListRequests"];
    let updated = 0;
    for (const collection of collections) {
      for (const field of fields) {
        try {
          const snap = await db.collection(collection).where(field, "==", duplicate.id).limit(200).get();
          if (snap.empty) continue;
          const batch = db.batch();
          snap.docs.forEach(doc => {
            const payload = {
              [field]:primary.id,
              canonicalLocationId:primary.id,
              previousLocationIds:firebase.firestore.FieldValue.arrayUnion(duplicate.id),
              updatedAt:nowField()
            };
            if (collection === "events") {
              payload.locationName = primary.locationName || primary.brandName || primary.id;
            }
            if (collection === "shoutouts" || collection === "guestListRequests") {
              payload.clubLocationId = primary.id;
              payload.location = primary.id;
              payload.club = primary.id;
              payload.locationName = primary.locationName || primary.brandName || primary.id;
              payload.clubName = primary.locationName || primary.brandName || primary.id;
            }
            batch.set(doc.ref, payload, {merge:true});
            updated += 1;
          });
          await batch.commit();
        } catch (error) {
          console.warn(`Reference update skipped for ${collection}.${field}:`, error?.message || error);
        }
      }
    }
    return updated;
  }

  async function mergeDuplicateGroup(group, primaryId) {
    if (!group || !primaryId || !db) return;
    const primary = group.records.find(item => item.id === primaryId);
    const duplicates = group.records.filter(item => item.id !== primaryId);
    if (!primary || !duplicates.length) {
      setStatus("Choose a primary record and at least one duplicate.");
      return;
    }
    const confirmed = confirm(`Merge ${duplicates.map(titleOf).join(", ")} into ${titleOf(primary)}? Duplicate records become aliases and are hidden from normal search.`);
    if (!confirmed) return;
    setStatus("Merging duplicate club records...");
    const batch = db.batch();
    batch.set(db.collection("clubLocations").doc(primary.id), mergePayloadForPrimary(primary, duplicates), {merge:true});
    duplicates.forEach(duplicate => {
      const aliasNames = unique([duplicate.locationName, duplicate.brandName, duplicate.id]);
      batch.set(db.collection("clubLocations").doc(duplicate.id), {
        status:"merged",
        active:false,
        aliasOf:primary.id,
        canonicalLocationId:primary.id,
        mergedInto:primary.id,
        aliasNames,
        mergeReason:"Duplicate club location merged by Master Admin.",
        mergedAt:nowField(),
        mergedByUid:auth.currentUser?.uid || "",
        mergedByEmail:auth.currentUser?.email || "",
        updatedAt:nowField()
      }, {merge:true});
      batch.set(db.collection("clubLocationAliases").doc(duplicate.id), {
        aliasId:duplicate.id,
        aliasName:duplicate.locationName || duplicate.brandName || duplicate.id,
        aliasNames,
        canonicalLocationId:primary.id,
        canonicalName:primary.locationName || primary.brandName || primary.id,
        collection:"clubLocations",
        status:"active",
        city:primary.city || duplicate.city || "",
        country:primary.country || duplicate.country || "",
        createdAt:nowField(),
        updatedAt:nowField(),
        createdByUid:auth.currentUser?.uid || "",
        createdByEmail:auth.currentUser?.email || ""
      }, {merge:true});
    });
    try {
      batch.set(db.collection("aiIndex").doc(`clubLocation_${primary.id}`), {
        sourceType:"clubLocation",
        sourceId:primary.id,
        title:primary.locationName || primary.brandName || primary.id,
        keywords:arrayUnion([primary.locationName, primary.brandName, primary.id, duplicates.flatMap(item => [item.id, item.locationName, item.brandName, item.type])]) || [],
        aliasLocationIds:arrayUnion(duplicates.map(item => item.id)) || [],
        aliasNames:arrayUnion(duplicates.flatMap(item => [item.locationName, item.brandName])) || [],
        visibility:"public",
        updatedAt:nowField(),
        indexedAt:nowField()
      }, {merge:true});
      duplicates.forEach(duplicate => {
        batch.set(db.collection("aiIndex").doc(`clubLocation_${duplicate.id}`), {
          status:"merged",
          visibility:"public",
          aliasOf:primary.id,
          canonicalLocationId:primary.id,
          updatedAt:nowField()
        }, {merge:true});
      });
    } catch (error) {
      console.warn("AI index duplicate merge update skipped:", error?.message || error);
    }
    await batch.commit();
    let referencesUpdated = 0;
    for (const duplicate of duplicates) {
      referencesUpdated += await updateReferencesForAlias(duplicate, primary);
    }
    setStatus(`Merge complete. ${duplicates.length} duplicate record(s) became aliases; ${referencesUpdated} related record reference(s) were updated.`);
    await refreshDuplicateDiagnostics();
    if (window.FLOQRAIDiscovery?.loadListingDeleteTool) window.FLOQRAIDiscovery.loadListingDeleteTool();
  }

  async function mergeManualPair() {
    const primaryId = byId("duplicatePrimaryId")?.value.trim();
    const aliasId = byId("duplicateAliasId")?.value.trim();
    if (!primaryId || !aliasId || primaryId === aliasId) {
      setStatus("Enter a primary club id and a different duplicate club id.");
      return;
    }
    const [primarySnap, aliasSnap] = await Promise.all([
      db.collection("clubLocations").doc(primaryId).get(),
      db.collection("clubLocations").doc(aliasId).get()
    ]);
    if (!primarySnap.exists || !aliasSnap.exists) {
      setStatus("Manual merge failed: one or both clubLocation records were not found in Firestore.");
      return;
    }
    await mergeDuplicateGroup({
      records:[
        {id:primarySnap.id, _collection:"clubLocations", ...primarySnap.data()},
        {id:aliasSnap.id, _collection:"clubLocations", ...aliasSnap.data()}
      ],
      suggestedPrimaryId:primaryId,
      score:100,
      reasons:["manual Master Admin pair"]
    }, primaryId);
  }

  async function mount(options = {}) {
    db = options.db || db;
    auth = options.auth || auth;
    if (!db || !auth || !byId("duplicateRecords")) return;
    byId("refreshDuplicateRecordsBtn")?.addEventListener("click", refreshDuplicateDiagnostics);
    byId("duplicateRecordSearch")?.addEventListener("input", () => renderDuplicateGroups());
    byId("mergeManualDuplicateBtn")?.addEventListener("click", mergeManualPair);
    await refreshDuplicateDiagnostics();
  }

  window.FLOQRDuplicateRecords = {
    mount,
    refreshDuplicateDiagnostics,
    mergeDuplicateGroup,
    mergeManualPair,
    baseInstitutionName,
    duplicateScore
  };
})();
