/* helper-popouts.js v28.91-helper-popouts-mingl-requests */
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

  function labelFor(node) {
    const container = node.closest(".card, section, header, .admin-panel-section, .topbar") || node.parentElement;
    const heading = container?.querySelector("h1,h2,h3,.eyebrow");
    const clean = (heading?.textContent || "Help").replace(/\s+/g, " ").trim();
    return clean ? `About ${clean}` : "Help";
  }

  function convert(node) {
    if (!shouldConvert(node)) return;
    const details = document.createElement("details");
    details.className = "help-popout inline-help-popout";
    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", labelFor(node));
    summary.textContent = "?";
    const body = document.createElement("div");
    body.innerHTML = node.innerHTML;
    details.append(summary, body);
    node.dataset.helpPopoutConverted = "1";
    node.replaceWith(details);
  }

  function convertAll(root = document) {
    root.querySelectorAll?.("p.sub.small, p.helper-text, .helper-text").forEach(convert);
  }

  document.addEventListener("DOMContentLoaded", () => {
    convertAll(document);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (shouldConvert(node)) convert(node);
          convertAll(node);
        });
      });
    });
    observer.observe(document.body, {childList:true, subtree:true});
  });

  window.FLOQRHelperPopouts = {convertAll};
})();
