/* FLOQR datapoint-gated tabs. Show or hide a tab (and its panel) from Firebase datapoints. */
(function (global) {
  "use strict";

  const truthy = new Set([true, 1, "1", "true", "yes", "on"]);
  const falsy = new Set([false, 0, "0", "false", "no", "off", "", null, undefined]);

  function isTruthy(value) {
    if (truthy.has(value)) return true;
    if (falsy.has(value)) return false;
    if (typeof value === "string") return truthy.has(value.trim().toLowerCase());
    return Boolean(value);
  }

  function getPath(source, path) {
    if (!path) return undefined;
    return String(path).split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), source);
  }

  function clauseOk(datapoints, clause) {
    if (!clause || typeof clause !== "object") return false;
    if (typeof clause.test === "function") return !!clause.test(datapoints);
    const raw = Object.prototype.hasOwnProperty.call(clause, "datapoint")
      ? getPath(datapoints, clause.datapoint)
      : clause.value;
    if (Object.prototype.hasOwnProperty.call(clause, "equals")) {
      if (typeof clause.equals === "boolean") return isTruthy(raw) === clause.equals;
      return String(raw) === String(clause.equals);
    }
    if (Object.prototype.hasOwnProperty.call(clause, "in")) {
      const list = Array.isArray(clause.in) ? clause.in : [];
      return list.map(String).includes(String(raw));
    }
    return isTruthy(raw);
  }

  function evaluate(datapoints, when) {
    if (typeof when === "function") return !!when(datapoints);
    if (Array.isArray(when)) return when.every(clause => clauseOk(datapoints, clause));
    if (when && typeof when === "object") return clauseOk(datapoints, when);
    return isTruthy(when);
  }

  function resolveEl(target) {
    if (!target) return null;
    if (typeof target === "string") return document.querySelector(target) || document.getElementById(target.replace(/^#/, ""));
    return target;
  }

  function apply({tab, panel, visible, reason} = {}) {
    const show = !!visible;
    const tabEl = resolveEl(tab);
    const panelEl = resolveEl(panel);
    if (tabEl) {
      tabEl.classList.toggle("hidden", !show);
      tabEl.classList.toggle("floqr-tab-hidden", !show);
      tabEl.hidden = !show;
      tabEl.setAttribute("aria-hidden", show ? "false" : "true");
      if (reason) tabEl.dataset.floqrTabReason = reason;
      if (!show && tabEl.classList.contains("active")) tabEl.classList.remove("active");
    }
    if (panelEl) {
      panelEl.classList.toggle("hidden", !show);
      if (!show) panelEl.classList.remove("active");
    }
    return show;
  }

  function bind(rules = [], datapoints = {}) {
    return (Array.isArray(rules) ? rules : []).map(rule => {
      const visible = evaluate(datapoints, rule.when);
      apply({
        tab: rule.tab,
        panel: rule.panel,
        visible,
        reason: rule.reason || (visible ? "visible" : "hidden")
      });
      return {...rule, visible};
    });
  }

  /** Work Calendar: service member AND affiliated to a club with staffSchedulingPaid=1. */
  function workCalendarVisible(datapoints = {}) {
    return evaluate(datapoints, [
      {datapoint: "serviceMember", equals: true},
      {datapoint: "affiliatedPaidScheduling", equals: true}
    ]);
  }

  function fromAffiliation({
    user = {},
    designations = [],
    clubsById = {},
    uid = ""
  } = {}) {
    const workerUid = String(uid || user.uid || "");
    const serviceMember = isTruthy(user.IsServiceMember)
      || isTruthy(user.IsserviceMember)
      || isTruthy(user.serviceMember)
      || (Array.isArray(user.approvedRoles) && user.approvedRoles.length > 0)
      || (Array.isArray(user.roles) && user.roles.some(role => !["patron", "masterAdmin"].includes(String(role))));
    const memberType = String(user.memberType || user.memberLevel || "Patron").trim() || "Patron";
    const hasPatronFlag = user.IsPatron !== undefined && user.IsPatron !== null && String(user.IsPatron).trim() !== "";
    const isPatron = hasPatronFlag
      ? isTruthy(user.IsPatron)
      : (!serviceMember && /^patron$/i.test(memberType));
    const servicesTabVisible = serviceMember && !isPatron;
    const mine = (Array.isArray(designations) ? designations : []).filter(row => {
      if (!workerUid) return false;
      if (String(row.workerUid || row.uid || "") !== workerUid) return false;
      return String(row.status || "").toLowerCase() !== "rejected";
    });
    const paidClubIds = mine
      .map(row => String(row.clubLocationId || ""))
      .filter(id => isTruthy(clubsById[id]?.staffSchedulingPaid));
    const roleBlob = [
      user.memberType,
      user.memberLevel,
      user.role,
      ...(Array.isArray(user.roles) ? user.roles : []),
      ...(Array.isArray(user.approvedRoles) ? user.approvedRoles : [])
    ].map(value => String(value || "")).join(" ").toLowerCase();
    const clubAdminLocationIds = [...new Set([
      ...(Array.isArray(user.clubAdminLocationIds) ? user.clubAdminLocationIds : []),
      ...mine
        .filter(row => /club\s*admin/i.test(`${row.roleElectionType || ""} ${(row.workerRoles || []).join(" ")}`))
        .map(row => row.clubLocationId)
    ].map(id => String(id || "")).filter(Boolean))];
    const isClubAdmin = roleBlob.includes("club admin")
      || roleBlob.includes("clubadmin")
      || clubAdminLocationIds.length > 0;
    return {
      serviceMember,
      isPatron,
      isServiceMember: serviceMember,
      memberType,
      servicesTabVisible,
      isClubAdmin,
      clubAdminLocationIds,
      affiliated: mine.length > 0,
      affiliatedPaidScheduling: paidClubIds.length > 0,
      affiliatedClubIds: mine.map(row => row.clubLocationId).filter(Boolean),
      affiliatedPaidSchedulingClubIds: paidClubIds,
      workCalendarEligible: serviceMember && paidClubIds.length > 0 ? 1 : 0
    };
  }

  global.FLOQRTabGates = {
    isTruthy,
    getPath,
    evaluate,
    apply,
    bind,
    workCalendarVisible,
    fromAffiliation
  };
})(window);
