/* helper-popouts.js — legacy p.sub.small conversion; ALWAYS delegates to FLOQRHelpAttach */
(function(){
  "use strict";

  function shouldConvert(node) {
    if (!node || node.dataset.helpPopoutConverted === "1") return false;
    if (node.closest(".help-popout")) return false;
    if (node.id) return false;
    if (node.classList.contains("status") || node.id?.toLowerCase().includes("status")) return false;
    if (node.dataset.keepVisible === "true") return false;
    if (node.closest("[data-floqr-auth-chrome], [data-floqr-session-portal-link]")) return false;
    return node.matches("p.sub.small, p.helper-text, .helper-text");
  }

  function convert(node) {
    if (!shouldConvert(node)) return;
    const attach = window.FLOQRHelpAttach;
    if (!attach?.attachBesideHeading) {
      node.dataset.helpPopoutConverted = "1";
      return;
    }
    const bodyHtml = node.innerHTML;
    const title = (node.closest(".card, section, header, .admin-panel-section, .topbar")?.querySelector("h1,h2,h3,.eyebrow")?.textContent || "Help")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\?$/g, "")
      .trim();
    const result = attach.attachBesideHeading(node, {
      title: title ? `About ${title}` : "Help",
      bodyHtml,
      source: "help-popout-converted"
    });
    node.dataset.helpPopoutConverted = "1";
    if (result) node.remove();
    else node.dataset.keepVisible = "true";
  }

  function convertAll(root = document) {
    root.querySelectorAll?.("p.sub.small, p.helper-text, .helper-text").forEach(convert);
  }

  function closeOtherPopouts(active = null) {
    document.querySelectorAll("details.help-popout[open], details.mingl-action-details[open]").forEach(details => {
      if (details !== active) details.open = false;
    });
  }

  /** Keep help verbiage fully inside the viewport (PC + mobile). */
  function fitHelpPopoutInViewport(details) {
    if (!details || !details.open) return;
    const body = details.querySelector(".help-popout-body, div:not(summary)");
    if (!body) return;
    const pad = 12;
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    // Reset measured transforms / forced coords before measuring.
    body.style.left = "";
    body.style.right = "";
    body.style.top = "";
    body.style.bottom = "";
    body.style.maxWidth = "";
    body.style.transform = "";
    details.removeAttribute("data-help-align");

    const preferEnd = details.classList.contains("botdee-help-popout")
      || getComputedStyle(details).getPropertyValue("--help-anchor").trim() === "end";
    if (preferEnd) details.setAttribute("data-help-align", "end");
    else details.setAttribute("data-help-align", "start");

    // Cap width to remaining viewport room from the ? anchor.
    const anchor = details.getBoundingClientRect();
    const roomStart = Math.max(160, Math.floor(anchor.left - pad));
    const roomEnd = Math.max(160, Math.floor(vw - anchor.right - pad));
    const roomBoth = Math.max(160, vw - pad * 2);
    const preferWidth = Math.min(320, roomBoth);
    body.style.maxWidth = `${preferWidth}px`;
    body.style.width = `min(320px, ${preferWidth}px)`;

    // Force a layout pass, then flip if still clipped.
    let rect = body.getBoundingClientRect();
    if (rect.right > vw - pad && roomStart >= Math.min(preferWidth, roomEnd)) {
      details.setAttribute("data-help-align", "end");
      body.style.left = "auto";
      body.style.right = "0";
      rect = body.getBoundingClientRect();
    } else if (rect.left < pad && roomEnd >= Math.min(preferWidth, roomStart)) {
      details.setAttribute("data-help-align", "start");
      body.style.left = "0";
      body.style.right = "auto";
      rect = body.getBoundingClientRect();
    }

    // Final nudge if still slightly over either edge (narrow phones).
    rect = body.getBoundingClientRect();
    let shiftX = 0;
    if (rect.right > vw - pad) shiftX = (vw - pad) - rect.right;
    if (rect.left + shiftX < pad) shiftX = pad - rect.left;
    if (shiftX) body.style.transform = `translateX(${Math.round(shiftX)}px)`;

    // Vertical: if body would go below the fold, pull it up a bit.
    rect = body.getBoundingClientRect();
    if (rect.bottom > vh - pad) {
      const up = Math.min(rect.height - 40, rect.bottom - (vh - pad));
      if (up > 0) {
        const prev = body.style.transform || "";
        body.style.transform = `${prev} translateY(${Math.round(-up)}px)`.trim();
      }
    }
  }

  function bindDismissBehavior() {
    document.addEventListener("click", event => {
      const openHelp = event.target.closest?.("details.help-popout, details.mingl-action-details");
      if (!openHelp) {
        closeOtherPopouts(null);
        return;
      }
      if (event.target.closest("summary")) {
        setTimeout(() => {
          closeOtherPopouts(openHelp.open ? openHelp : null);
          if (openHelp.open && openHelp.classList.contains("help-popout")) {
            fitHelpPopoutInViewport(openHelp);
          }
        }, 0);
      }
    });
    document.addEventListener("toggle", event => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (!details.classList.contains("help-popout")) return;
      if (details.open) {
        closeOtherPopouts(details);
        requestAnimationFrame(() => fitHelpPopoutInViewport(details));
      }
    }, true);
    window.addEventListener("resize", () => {
      document.querySelectorAll("details.help-popout[open]").forEach(fitHelpPopoutInViewport);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeOtherPopouts(null);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRHelpAttach?.ensureCss?.();
    window.FLOQRHelpAttach?.mountAll?.(document);
    window.FLOQRHelpAttach?.glueOrphanPopouts?.(document);
    convertAll(document);
    window.FLOQRHelpRepository?.registerDomHelpPopouts?.(document);
    bindDismissBehavior();
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (shouldConvert(node)) convert(node);
          convertAll(node);
          window.FLOQRHelpAttach?.mountAll?.(node);
          window.FLOQRHelpAttach?.glueOrphanPopouts?.(node);
          if (node.matches?.("details.help-popout, .floqai-help-popout, [data-floqai-help-entry]") || node.querySelector?.("details.help-popout, .floqai-help-popout")) {
            window.FLOQRHelpRepository?.registerDomHelpPopouts?.(node);
          }
        });
      });
    });
    observer.observe(document.body, {childList:true, subtree:true});
  });

  window.FLOQRHelperPopouts = {convertAll};
})();
