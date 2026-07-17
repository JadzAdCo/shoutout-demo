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
  assert.match(source, /clearUnpaidFloqrCheckouts/);
  assert.match(source, /purgeFloqrTestPayments/);
});
