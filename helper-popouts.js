/* helper-popouts.js — legacy p.sub.small conversion; ALWAYS delegates to FLOQRHelpAttach */
(function(){
  "use strict";

  function shouldConvert(node) {
    if (!node || node.dataset.helpPopoutConverted === "1") return false;
    if (node.closest(".help-popout")) return false;
    if (node.id) return false;
    if (node.classList.contains("status") || node.id?.toLowerCase().includes("status")) return false;
    if (node.dataset.keepVisible === "true") return false;
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

  function bindDismissBehavior() {
    document.addEventListener("click", event => {
      const openHelp = event.target.closest?.("details.help-popout, details.mingl-action-details");
      if (!openHelp) {
        closeOtherPopouts(null);
        return;
      }
      if (event.target.closest("summary")) {
        setTimeout(() => closeOtherPopouts(openHelp.open ? openHelp : null), 0);
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeOtherPopouts(null);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRHelpAttach?.ensureCss?.();
    window.FLOQRHelpAttach?.mountAll?.(document);
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
