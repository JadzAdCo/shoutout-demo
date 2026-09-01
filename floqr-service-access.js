/* Shared service-member role specialties and role-type mapping (portal + role-request). */
(function (root) {
  "use strict";

  const SERVICE_SPECIALTY_OPTIONS = [
    "Club Admin",
    "Waitress",
    "Bottle Girl",
    "Waiter",
    "Bus Boy",
    "Security",
    "Venue Manager",
    "Bartender / Barman",
    "Videographer",
    "Camera Operator",
    "Photographer",
    "Customer Service Representative",
    "Independent Promoter",
    "Promotion Company Member",
    "Resident DJ",
    "Visiting DJ"
  ];

  const QUERY_TYPE_TO_SPECIALTY = {
    clubadmin: "Club Admin",
    dj: "Resident DJ",
    promoter: "Independent Promoter",
    hospitality: "Waitress",
    bartender: "Bartender / Barman",
    mediacreator: "Videographer",
    busboyorsecurity: "Bus Boy",
    venuemanager: "Venue Manager"
  };

  function normalizeKey(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function roleTypeForSpecialty(specialty = "") {
    const s = normalizeKey(specialty);
    if (s === "club admin") return "clubAdmin";
    if (s.includes("dj")) return "dj";
    if (s.includes("promoter")) return "promoter";
    if (s === "waitress" || s === "bottle girl" || s === "waiter") return "hospitality";
    if (s === "bus boy" || s === "security") return "busboyOrSecurity";
    if (s === "venue manager") return "venueManager";
    if (s.includes("bartender") || s.includes("barman")) return "bartender";
    if (s === "videographer" || s === "camera operator" || s === "photographer") return "mediaCreator";
    if (s === "customer service representative") return "hospitality";
    return "hospitality";
  }

  function publicProfileTypeForSpecialty(specialty = "") {
    const roleType = roleTypeForSpecialty(specialty);
    if (roleType === "hospitality" || roleType === "bartender") return "hospitality";
    if (roleType === "busboyOrSecurity" || roleType === "venueManager" || roleType === "dj" || roleType === "promoter") return roleType;
    if (roleType === "mediaCreator") return "mediaCreator";
    if (roleType === "clubAdmin") return "clubAdmin";
    return "patron";
  }

  function displayWorkerName(user = {}, profile = {}) {
    return String(
      profile.displayName ||
      profile.fullName ||
      user.displayName ||
      profile.email ||
      user.email ||
      "FLOQR member"
    ).trim();
  }

  function fillSpecialtySelect(selectEl, selected = "") {
    if (!selectEl) return;
    const want = String(selected || "").trim();
    selectEl.innerHTML = SERVICE_SPECIALTY_OPTIONS.map(option => {
      const sel = option === want ? " selected" : "";
      return `<option value="${option.replace(/"/g, "&quot;")}"${sel}>${option}</option>`;
    }).join("");
  }

  function specialtyFromQueryType(type = "") {
    return QUERY_TYPE_TO_SPECIALTY[normalizeKey(type)] || "";
  }

  root.FLOQRServiceAccess = {
    SERVICE_SPECIALTY_OPTIONS,
    QUERY_TYPE_TO_SPECIALTY,
    roleTypeForSpecialty,
    publicProfileTypeForSpecialty,
    displayWorkerName,
    fillSpecialtySelect,
    specialtyFromQueryType
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.FLOQRServiceAccess;
})(typeof window !== "undefined" ? window : globalThis);
