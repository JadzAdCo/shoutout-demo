/* Ad invoice view: public by intake link (?t=) or signed-in owner / Master Admin (?n=).
   Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc */
(function () {
  "use strict";

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

  const params = new URLSearchParams(location.search);
  const token = params.get("t") || "";
  const number = params.get("n") || "";

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback) {
    const value = window.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function setStatus(message) {
    byId("adInvoiceStatus").textContent = message || "";
  }

  function money(cents, currency) {
    const value = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, {style: "currency", currency: String(currency || "usd").toUpperCase()}).format(value);
    } catch (_) {
      return `$${value.toFixed(2)}`;
    }
  }

  function render(inv) {
    byId("adInvoiceNumber").textContent = inv.invoiceNumber || "—";
    byId("adInvoiceItem").textContent = inv.title || "—";
    byId("adInvoiceTotal").textContent = money(inv.amountCents, inv.currency);
    byId("adInvoiceState").textContent = inv.statusLabel || inv.paymentStatus || "—";
    byId("adInvoiceIssued").textContent = inv.issuedAtIso ? new Date(inv.issuedAtIso).toLocaleString() : "—";
    byId("adInvoiceLines").textContent = (Array.isArray(inv.lines) ? inv.lines : []).join("\n");
    byId("adInvoiceCard").classList.remove("hidden");
    setStatus("");
  }

  async function fetchInvoice(data) {
    setStatus(t("adinvoice.loading", "Loading invoice…"));
    try {
      const fn = firebase.app().functions("us-central1").httpsCallable("getAdInvoice");
      render((await fn(data))?.data || {});
    } catch (error) {
      setStatus(String(error?.message || "").replace(/^.*?:\s(?=[A-Z])/, "") || t("adinvoice.notFound", "Invoice not found."));
    }
  }

  function start() {
    byId("adInvoicePrintBtn").addEventListener("click", () => window.print());
    if (token) {
      fetchInvoice({token});
      return;
    }
    if (!number) {
      setStatus(t("adinvoice.notFound", "Invoice not found."));
      return;
    }
    setStatus(t("adinvoice.signIn", "Restoring your session…"));
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        fetchInvoice({invoiceNumber: number});
      } else if (window.FLOQRSessionShell?.redirectToLogin) {
        window.FLOQRSessionShell.redirectToLogin();
      } else {
        setStatus(t("adinvoice.signInNeeded", "Sign in to FLOQR to view this invoice."));
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
