"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const paymentServicePath = path.resolve(__dirname, "..", "payment-service.js");
const source = fs.readFileSync(paymentServicePath, "utf8");

test("payment callables use the compat App Functions client with the deployment region", async () => {
  let selectedRegion = "";
  let selectedCallable = "";
  let assignedUrl = "";
  const firebase = {
    app() {
      return {
        functions(region) {
          selectedRegion = region;
          return {
            httpsCallable(name) {
              selectedCallable = name;
              return async () => ({data:{checkoutUrl:"https://checkout.stripe.com/test-session"}});
            }
          };
        }
      };
    },
    auth() { return {currentUser:{uid:"patron-test"}}; }
  };
  const context = {
    URL,
    firebase,
    window:{
      firebase,
      location:{
        href:"https://jadzadco.github.io/shoutout-demo/?v=29.09.2",
        assign(url) { assignedUrl = url; }
      }
    }
  };

  vm.runInNewContext(source, context, {filename:paymentServicePath});
  await context.window.FLOQRPayments.startCheckout({orderType:"shoutout", payload:{clubLocationId:"zebbies-garden-washington-dc"}});

  assert.equal(selectedRegion, "us-central1");
  assert.equal(selectedCallable, "createFloqrCheckoutSession");
  assert.equal(assignedUrl, "https://checkout.stripe.com/test-session");
  assert.doesNotMatch(source, /firebase\.functions\s*\(/);
  assert.match(source, /firebase\.app\(\)/);
  assert.match(source, /app\.functions\("us-central1"\)/);
  assert.match(source, /getFloqrClubCheckoutReadiness/);
  assert.match(source, /cancelFloqrCheckoutOrder/);
  assert.match(source, /refundFloqrCheckoutOrder/);
  assert.match(source, /clearUnpaidFloqrCheckouts/);
  assert.match(source, /purgeFloqrTestPayments/);
});

test("lockCriticalButton greys out a checkout button and blocks a second lock", () => {
  const context = { window: {}, firebase: { app() { return { functions() { return { httpsCallable() { return async () => ({}); } }; } }; }, auth() { return {currentUser:{uid:"x"}}; } } };
  vm.runInNewContext(source, context, {filename:paymentServicePath});
  const btn = {
    textContent: "Continue to $20 FloqR Checkout",
    disabled: false,
    dataset: {},
    classList: {add(name) { this._ = this._ || new Set(); this._.add(name); }, remove(name) { this._?.delete(name); }, has(name) { return !!this._?.has(name); }},
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; }
  };
  const unlock = context.window.FLOQRPayments.lockCriticalButton(btn, {busyLabel: "Opening checkout…"});
  assert.equal(typeof unlock, "function");
  assert.equal(btn.disabled, true);
  assert.equal(btn.dataset.criticalBusy, "1");
  assert.equal(btn.textContent, "Opening checkout…");
  assert.equal(context.window.FLOQRPayments.lockCriticalButton(btn, {busyLabel: "Opening checkout…"}), null);
  unlock();
  assert.equal(btn.disabled, false);
  assert.equal(btn.dataset.criticalBusy, "");
  assert.equal(btn.textContent, "Continue to $20 FloqR Checkout");
});
