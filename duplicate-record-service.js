/* FLOQR Master Admin duplicate record diagnostics and safe club merge tools v28.72 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let db = null;
  let auth = null;
  let duplicateGroups = [];
  let lastDuplicateReadError = "";
  let duplicateScanMeta = {
    dataSource:"Not scanned yet",
    scannedAt:"",
    readCount:0,
    activeCount:0,
    staticAliasCount:0
  };

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
      lastDuplicateReadError = "";
      return snap.docs.map(doc => ({id:doc.id, _collection:name, _dataSource:`Live Firestore: ${name}`, ...doc.data()}));
    } catch (error) {
      lastDuplicateReadError = formatError(error);
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

  function statusBadge(status = "Soft Fail") {
    return `<span class="status-pill">${esc(status)}</span>`;
  }

  function formatError(error) {
    const code = error?.code ? `${error.code}: ` : "";
    return `${code}${error?.message || error || "Unknown Firebase error"}`;
  }

  function setStatus(message = "") {
    const el = byId("duplicateRecordStatus");
    if (el) el.textContent = message;
  }

  function manualPairIds() {
    const primaryId = byId("duplicatePrimaryId")?.value.trim().toLowerCase() || "";
    const duplicateText = byId("duplicateAliasId")?.value.trim().toLowerCase() || "";
    const duplicateIds = duplicateText.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
    return {primaryId, duplicateIds};
  }

  function overallStatus(rows = []) {
    if (rows.some(row => row.status === "Failed")) return "Failed";
    if (rows.some(row => row.status === "Soft Fail")) return "Soft Fail";
    return "Pass";
  }

  function renderMergeDiagnosticReport(rows = [], context = {}) {
    const wrap = byId("duplicateMergeDiagnosticReport");
    if (!wrap) return;
    const status = overallStatus(rows);
    wrap.innerHTML = `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>Duplicate Merge Diagnostic</strong>
        ${statusBadge(status)}
      </div>
      ${simpleRows([
        ["Primary club id", context.primaryId || "-"],
        ["Duplicate club id(s)", (context.duplicateIds || []).join(", ") || "-"],
        ["Checked at", new Date().toLocaleString()],
        ["Meaning", status === "Pass" ? "Merge is verified." : status === "Soft Fail" ? "Merge mostly works, but one non-blocking item needs review." : "Merge did not complete or Firebase rules blocked a required step."]
      ])}
      <div class="report-table">
        ${rows.map(row => `<div><span>${esc(row.label)}</span><strong>${esc(row.status)} - ${esc(row.evidence)}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  function addDiagnostic(rows, label, status, evidence) {
    rows.push({label, status, evidence});
  }

  function staticAliasTarget(id = "") {
    const row = (window.SHOUTOUT_CLUB_LOCATIONS || {})[String(id || "").toLowerCase()] || {};
    return String(row.canonicalLocationId || row.aliasOf || row.mergedInto || "").toLowerCase();
  }

  async function referenceCountsForDuplicate(duplicateId) {
    const fields = ["locationId", "clubLocationId", "location"];
    const collections = ["events", "shoutouts", "guestListRequests"];
    const matches = [];
    const blocked = [];
    for (const collection of collections) {
      for (const field of fields) {
        try {
          const snap = await db.collection(collection).where(field, "==", duplicateId).limit(20).get();
          if (!snap.empty) matches.push(`${collection}.${field}: ${snap.size}`);
        } catch (error) {
          blocked.push(`${collection}.${field}: ${formatError(error)}`);
        }
      }
    }
    return {matches, blocked};
  }

  async function runDuplicateMergeDiagnostic(primaryIdArg = "", duplicateIdsArg = []) {
    if (!db) return;
    const manual = manualPairIds();
    const primaryId = String(primaryIdArg || manual.primaryId || "").trim().toLowerCase();
    const duplicateIds = (Array.isArray(duplicateIdsArg) && duplicateIdsArg.length ? duplicateIdsArg : manual.duplicateIds)
      .map(id => String(id || "").trim().toLowerCase())
      .filter(Boolean)
      .filter(id => id !== primaryId);
    if (!primaryId || !duplicateIds.length) {
      setStatus("Enter a primary club id and duplicate club id, then run the merge diagnostic.");
      renderMergeDiagnosticReport([{
        label:"Diagnostic input",
        status:"Failed",
        evidence:"Missing primary or duplicate club id."
      }], {primaryId, duplicateIds});
      return "Failed";
    }

    setStatus("Running duplicate merge diagnostic...");
    const rows = [];
    let primary = null;
    try {
      const primarySnap = await db.collection("clubLocations").doc(primaryId).get();
      if (!primarySnap.exists) {
        addDiagnostic(rows, `Primary club ${primaryId}`, "Failed", "Primary clubLocation document was not found.");
      } else {
        primary = {id:primarySnap.id, ...primarySnap.data()};
        const active = primary.active !== false && !["merged", "deleted"].includes(String(primary.status || "active").toLowerCase());
        addDiagnostic(rows, `Primary club ${primaryId}`, active ? "Pass" : "Failed", active ? "Primary exists and is still active." : `Primary exists but status/active flag is not active (${primary.status || "no status"}).`);
      }
    } catch (error) {
      addDiagnostic(rows, `Primary club ${primaryId}`, "Failed", `Could not read primary club: ${formatError(error)}`);
    }

    for (const duplicateId of duplicateIds) {
      let duplicate = null;
      let duplicateMerged = false;
      try {
        const duplicateSnap = await db.collection("clubLocations").doc(duplicateId).get();
        if (!duplicateSnap.exists) {
          addDiagnostic(rows, `Duplicate club ${duplicateId}`, "Failed", "Duplicate clubLocation document was not found.");
        } else {
          duplicate = {id:duplicateSnap.id, ...duplicateSnap.data()};
          const canonical = String(duplicate.canonicalLocationId || duplicate.aliasOf || duplicate.mergedInto || "").toLowerCase();
          const status = String(duplicate.status || "").toLowerCase();
          duplicateMerged = canonical === primaryId && (status === "merged" || duplicate.active === false);
          addDiagnostic(rows, `Duplicate club ${duplicateId}`, duplicateMerged ? "Pass" : "Failed", duplicateMerged ? "Duplicate is marked merged/inactive and points to the primary club." : `Duplicate does not yet point cleanly to ${primaryId}. status=${duplicate.status || "-"}, active=${duplicate.active}, canonical=${canonical || "-"}.`);
        }
      } catch (error) {
        addDiagnostic(rows, `Duplicate club ${duplicateId}`, "Failed", `Could not read duplicate club: ${formatError(error)}`);
      }

      try {
        const aliasSnap = await db.collection("clubLocationAliases").doc(duplicateId).get();
        if (!aliasSnap.exists) {
          addDiagnostic(rows, `Alias document ${duplicateId}`, duplicateMerged ? "Soft Fail" : "Failed", duplicateMerged ? "Alias document was not found, but the duplicate club doc now points to the primary. Publish firestore.rules v28.70+ to enable alias-document reads/writes for old links." : "clubLocationAliases document was not found. If merge just failed, publish v28.70+ firestore.rules and retry.");
        } else {
          const alias = aliasSnap.data() || {};
          const canonical = String(alias.canonicalLocationId || "").toLowerCase();
          addDiagnostic(rows, `Alias document ${duplicateId}`, canonical === primaryId ? "Pass" : "Failed", canonical === primaryId ? "Alias document points old links to the primary club." : `Alias points to ${canonical || "-"} instead of ${primaryId}.`);
        }
      } catch (error) {
        addDiagnostic(rows, `Alias document ${duplicateId}`, duplicateMerged ? "Soft Fail" : "Failed", duplicateMerged ? `Alias document read is blocked (${formatError(error)}), but the duplicate club doc points to the primary. Publish firestore.rules v28.70+ to unlock alias-document diagnostics and old-link alias reads.` : `Could not read alias document: ${formatError(error)}`);
      }

      if (primary) {
        const aliasIds = Array.isArray(primary.aliasLocationIds) ? primary.aliasLocationIds.map(x => String(x).toLowerCase()) : [];
        const mergedIds = Array.isArray(primary.mergedDuplicateIds) ? primary.mergedDuplicateIds.map(x => String(x).toLowerCase()) : [];
        const primaryHasAlias = aliasIds.includes(duplicateId) || mergedIds.includes(duplicateId);
        addDiagnostic(rows, `Primary alias list for ${duplicateId}`, primaryHasAlias ? "Pass" : "Soft Fail", primaryHasAlias ? "Primary includes this duplicate in alias/merged lists." : "Primary does not list this duplicate yet. Old links can still work if the alias document passed.");
      }

      const staticTarget = staticAliasTarget(duplicateId);
      addDiagnostic(rows, `Static fallback alias ${duplicateId}`, staticTarget === primaryId ? "Pass" : "Soft Fail", staticTarget === primaryId ? "Static fallback data resolves this duplicate to the primary club." : "Static fallback does not include this alias. Firestore alias can still handle live records.");

      const refs = await referenceCountsForDuplicate(duplicateId);
      if (refs.blocked.length) {
        addDiagnostic(rows, `Reference query permissions for ${duplicateId}`, "Soft Fail", `Some reference checks were blocked: ${refs.blocked.join("; ")}`);
      }
      addDiagnostic(rows, `Leftover references to ${duplicateId}`, refs.matches.length ? "Soft Fail" : "Pass", refs.matches.length ? `Some records still reference duplicate id: ${refs.matches.join("; ")}.` : "No leftover Firestore references found in events, shoutouts, or guestListRequests.");
    }

    const status = overallStatus(rows);
    renderMergeDiagnosticReport(rows, {primaryId, duplicateIds});
    setStatus(status === "Pass" ? "Merge diagnostic passed." : status === "Soft Fail" ? "Merge diagnostic completed with non-blocking items to review." : "Merge diagnostic failed. Review the report below.");
    try {
      await db.collection("aiDiagnosticsReports").add({
        type:"duplicateMergeDiagnostic",
        packageVersion:"v28.72-alias-resilient-merge",
        status,
        primaryId,
        duplicateIds,
        results:rows,
        createdAt:nowField(),
        createdByUid:auth.currentUser?.uid || "",
        createdByEmail:auth.currentUser?.email || ""
      });
    } catch (error) {
      console.warn("Could not save duplicate merge diagnostic report:", error?.message || error);
    }
    return status;
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
    const query = byId("duplicateRecordSearch")?.value.trim() || "";
    if (byId("duplicateRecordSummary")) {
      byId("duplicateRecordSummary").innerHTML = simpleRows([
        ["Data source", duplicateScanMeta.dataSource],
        ["Last scan", duplicateScanMeta.scannedAt || "-"],
        ["Firestore club records read", duplicateScanMeta.readCount.toLocaleString()],
        ["Active Firestore records scanned", duplicateScanMeta.activeCount.toLocaleString()],
        ["Static fallback aliases known", duplicateScanMeta.staticAliasCount.toLocaleString()],
        ["Duplicate groups found", groups.length.toLocaleString()],
        ["Visible after search", filtered.length.toLocaleString()],
        ["Current search filter", query || "None"],
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
            <span class="sub small">${esc(record.id)} | ${esc(record.type || "club")} | ${esc(record.city || "")}, ${esc(record.country || "")} | status: ${esc(record.status || "active")} | source: ${esc(record._dataSource || "Live Firestore")}</span>
          </label>`).join("")}
        </div>
        ${simpleRows(group.records.map(record => [
          titleOf(record),
          `${record.id} | ${record.address || record.locationLabel || "-"} | ${record.officialWebsite || record.website || "-"}`
        ]))}
        <div class="queue-actions">
          <button type="button" data-duplicate-action="merge">Merge Other Records Into Selected Primary</button>
          <button type="button" data-duplicate-action="diagnose">Run Merge Diagnostic</button>
        </div>
      </div>`;
    }).join("") : "<p class='sub'>No duplicate club groups matched. Use Manual primary/duplicate IDs if you already know the pair.</p>";
    wrap.querySelectorAll("[data-duplicate-action]").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-duplicate-group]");
        const group = duplicateGroups[Number(card.dataset.duplicateGroup)];
        const primaryId = card.querySelector("input[type='radio']:checked")?.value || group.suggestedPrimaryId;
        if (button.dataset.duplicateAction === "diagnose") {
          const duplicateIds = group.records.filter(item => item.id !== primaryId).map(item => item.id);
          runDuplicateMergeDiagnostic(primaryId, duplicateIds);
          return;
        }
        mergeDuplicateGroup(group, primaryId);
      });
    });
  }

  async function refreshDuplicateDiagnostics() {
    if (!db) return;
    setStatus("Scanning clubLocations for duplicate records...");
    const rows = await getCollectionSafe("clubLocations", 1200);
    duplicateScanMeta = {
      dataSource:lastDuplicateReadError ? `Live Firestore read failed: ${lastDuplicateReadError}` : "Live Firestore: clubLocations. This duplicate list is not hardcoded.",
      scannedAt:new Date().toLocaleString(),
      readCount:rows.length,
      activeCount:rows.filter(activeForDuplicateScan).length,
      staticAliasCount:Object.values(window.SHOUTOUT_CLUB_LOCATIONS || {}).filter(row => row?.canonicalLocationId || row?.aliasOf || row?.mergedInto).length
    };
    duplicateGroups = groupDuplicates(rows);
    renderDuplicateGroups();
    if (lastDuplicateReadError) {
      setStatus(`Could not scan live Firestore duplicate records: ${lastDuplicateReadError}`);
    } else {
      setStatus(duplicateGroups.length ? `Live Firestore scan complete. Found ${duplicateGroups.length} possible duplicate group(s).` : "Live Firestore scan complete. No duplicate club groups found.");
    }
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
    try {
      const coreBatch = db.batch();
      coreBatch.set(db.collection("clubLocations").doc(primary.id), mergePayloadForPrimary(primary, duplicates), {merge:true});
      duplicates.forEach(duplicate => {
        const aliasNames = unique([duplicate.locationName, duplicate.brandName, duplicate.id]);
        coreBatch.set(db.collection("clubLocations").doc(duplicate.id), {
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
      });
      await coreBatch.commit();

      const optionalNotes = [];
      try {
        const aliasBatch = db.batch();
        duplicates.forEach(duplicate => {
          const aliasNames = unique([duplicate.locationName, duplicate.brandName, duplicate.id]);
          aliasBatch.set(db.collection("clubLocationAliases").doc(duplicate.id), {
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
        await aliasBatch.commit();
        optionalNotes.push("alias documents written");
      } catch (aliasError) {
        console.warn("Alias document write skipped after core merge:", aliasError?.message || aliasError);
        optionalNotes.push(`alias document write blocked: ${formatError(aliasError)}`);
      }

      try {
        const indexBatch = db.batch();
        indexBatch.set(db.collection("aiIndex").doc(`clubLocation_${primary.id}`), {
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
          indexBatch.set(db.collection("aiIndex").doc(`clubLocation_${duplicate.id}`), {
            status:"merged",
            visibility:"public",
            aliasOf:primary.id,
            canonicalLocationId:primary.id,
            updatedAt:nowField()
          }, {merge:true});
        });
        await indexBatch.commit();
        optionalNotes.push("AI index updated");
      } catch (indexError) {
        console.warn("AI index update skipped after core merge:", indexError?.message || indexError);
        optionalNotes.push(`AI index update blocked: ${formatError(indexError)}`);
      }

      let referencesUpdated = 0;
      for (const duplicate of duplicates) {
        referencesUpdated += await updateReferencesForAlias(duplicate, primary);
      }
      setStatus(`Core merge complete. ${duplicates.length} duplicate record(s) were marked merged; ${referencesUpdated} related record reference(s) were updated. ${optionalNotes.join("; ")}. Running verification...`);
      await runDuplicateMergeDiagnostic(primary.id, duplicates.map(item => item.id));
      await refreshDuplicateDiagnostics();
      if (window.FLOQRAIDiscovery?.loadListingDeleteTool) window.FLOQRAIDiscovery.loadListingDeleteTool();
    } catch (error) {
      setStatus(`Merge failed: ${formatError(error)}. Publish firestore.rules v28.70+ if permissions are missing, then retry or run the merge diagnostic below.`);
      renderMergeDiagnosticReport([{
        label:"Merge write",
        status:"Failed",
        evidence:formatError(error)
      }], {primaryId:primary.id, duplicateIds:duplicates.map(item => item.id)});
      try {
        await runDuplicateMergeDiagnostic(primary.id, duplicates.map(item => item.id));
      } catch (diagnosticError) {
        console.warn("Post-failure duplicate diagnostic failed:", diagnosticError?.message || diagnosticError);
      }
    }
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
    byId("duplicateRecordSearch")?.addEventListener("input", () => {
      renderDuplicateGroups();
      const query = byId("duplicateRecordSearch")?.value.trim() || "";
      const visible = filterGroups(duplicateGroups).length;
      setStatus(query ? `Search filter applied to last live scan: "${query}" (${visible} visible group(s)).` : `Search cleared. Showing ${visible} duplicate group(s) from the last live scan.`);
    });
    byId("mergeManualDuplicateBtn")?.addEventListener("click", mergeManualPair);
    byId("runDuplicateMergeDiagnosticBtn")?.addEventListener("click", () => runDuplicateMergeDiagnostic());
    await refreshDuplicateDiagnostics();
  }

  window.FLOQRDuplicateRecords = {
    mount,
    refreshDuplicateDiagnostics,
    runDuplicateMergeDiagnostic,
    mergeDuplicateGroup,
    mergeManualPair,
    baseInstitutionName,
    duplicateScore
  };
})();
