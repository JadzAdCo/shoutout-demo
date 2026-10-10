/* FLOQR Scheduling "Assign to" picker — people a shift can be sent to, shown as name + role.
   Pure helpers; scheduling-portal.js wires Firestore, getPeopleDirectory and the DOM.
   The option value is the person's uid (unchanged createScheduleShift contract); labels never show it. */
(function (root) {
  "use strict";

  function text(value, max = 160) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function firstRole(row) {
    const roles = Array.isArray(row.workerRoles) ? row.workerRoles.filter(Boolean) : [];
    return text(row.roleElectionType || roles[0] || row.role);
  }

  /** clubEmployeeDesignations rows → team members of this club / promoting company. Rejected rows are skipped. */
  function rosterFromDesignations(rows = [], {ownerType = "", ownerId = ""} = {}) {
    const wanted = lower(ownerId);
    const out = [];
    (rows || []).forEach(row => {
      if (!row || lower(row.status) === "rejected") return;
      const uid = text(row.workerUid || row.uid, 128);
      if (!uid) return;
      if (ownerType === "club" && wanted && lower(row.clubLocationId) !== wanted) return;
      if (ownerType === "promoterCompany" && wanted && lower(row.promoterCompany) !== wanted) return;
      out.push({uid, name: text(row.workerName), email: text(row.workerEmail), phone: "", role: firstRole(row), team: true});
    });
    return out;
  }

  /** getPeopleDirectory row → person. Club-mode rows for people tied to the club carry a phone key. */
  function directoryPerson(row = {}) {
    const roles = Array.isArray(row.approvedRoles) ? row.approvedRoles.filter(Boolean) : [];
    const name = text(row.displayName || row.publicName || row.fullName || row.username);
    return {
      uid: text(row.uid || row.id, 128),
      name: name === "Member" ? "" : name,
      email: text(row.email),
      phone: text(row.phone),
      role: text(roles[0] || row.approvedRole),
      team: Object.prototype.hasOwnProperty.call(row, "phone")
    };
  }

  function mergePerson(into, person) {
    if (!into) return {...person};
    const out = {...into};
    ["name", "email", "phone", "role"].forEach(key => {
      if (!out[key] && person[key]) out[key] = person[key];
    });
    out.team = !!(into.team || person.team);
    out.self = !!(into.self || person.self);
    return out;
  }

  /**
   * Builds the picker list: you first, then the team, then everyone else, each A→Z.
   * labels: {you, member, team} — localized words supplied by the page.
   */
  function assigneeOptions({self = null, roster = [], directory = [], labels = {}} = {}) {
    const byUid = new Map();
    const add = person => {
      if (!person || !person.uid) return;
      byUid.set(person.uid, mergePerson(byUid.get(person.uid), person));
    };
    (roster || []).forEach(add);
    (directory || []).map(directoryPerson).forEach(add);
    if (self && self.uid) add({...self, self: true});
    const youWord = labels.you || "you";
    const memberWord = labels.member || "Member";
    const teamWord = labels.team || "Team";
    return [...byUid.values()]
      .map(person => {
        const name = person.name && person.name !== person.uid ? person.name : (person.email || memberWord);
        const role = person.role || (person.team ? teamWord : memberWord);
        const head = `${name}${person.self ? ` (${youWord})` : ""}`;
        return {
          value: person.uid,
          label: role === name ? head : `${head} · ${role}`,
          name,
          role,
          email: person.email || "",
          phone: person.phone || "",
          team: !!person.team,
          self: !!person.self
        };
      })
      .sort((a, b) => (Number(b.self) - Number(a.self))
        || (Number(b.team) - Number(a.team))
        || a.name.localeCompare(b.name));
  }

  /** Search by name, role or email — never by uid. */
  function filterPeople(options = [], query = "") {
    const q = lower(query);
    if (!q) return options.slice();
    return options.filter(option => lower(option.label).includes(q) || lower(option.email).includes(q));
  }

  const api = {rosterFromDesignations, directoryPerson, assigneeOptions, filterPeople};
  root.FLOQRScheduleAssignees = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
