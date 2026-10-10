"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAccountLinkParams,
  buildRecipientAccountParams,
  connectBindingId,
  connectStatus,
  normalizeConnectEntityType
} = require("./stripe-connect-core");

test("normalizes supported FLOQR Connect entity types", () => {
  assert.equal(normalizeConnectEntityType("club"), "club");
  assert.equal(normalizeConnectEntityType("patron"), "member");
  assert.equal(normalizeConnectEntityType("unknown"), "");
});

test("creates stable opaque binding IDs", () => {
  const first = connectBindingId("member", "user-123");
  assert.equal(first, connectBindingId("patron", "user-123"));
  assert.notEqual(first, connectBindingId("club", "user-123"));
  assert.match(first, /^connect_[a-f0-9]{40}$/);
});

test("builds a recipient-only Accounts v2 marketplace request", () => {
  const params = buildRecipientAccountParams({
    bindingId:"connect_123",
    entityType:"club",
    entityId:"zebbies",
    displayName:"Zebbies Garden",
    contactEmail:"owner@example.com"
  });
  assert.equal(params.dashboard, "express");
  assert.equal(params.defaults.responsibilities.fees_collector, "application");
  assert.equal(params.defaults.responsibilities.losses_collector, "application");
  assert.equal(params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested, true);
  assert.equal(params.configuration.merchant, undefined);
  assert.equal(params.contact_email, "owner@example.com");
});

test("reports transfer readiness from the v2 recipient capability", () => {
  const active = connectStatus({
    id:"acct_test",
    livemode:false,
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:"active", status_details:[]}}}}},
    requirements:{entries:[]}
  });
  assert.equal(active.connected, true);
  assert.equal(active.transfersReady, true);
  assert.equal(active.capabilityStatus, "active");

  const restricted = connectStatus({
    id:"acct_test",
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:"restricted"}}}}},
    requirements:{entries:[{awaiting_action_from:"user"}, {awaiting_action_from:"stripe"}]}
  });
  assert.equal(restricted.transfersReady, false);
  assert.equal(restricted.requirementsDue, 1);

  const closed = connectStatus({
    id:"acct_closed",
    closed:true,
    livemode:true,
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:"active"}}}}}
  });
  assert.equal(closed.transfersReady, false);
  assert.equal(closed.capabilityStatus, "closed");
});

test("uses onboarding until transfers are active, then account update", () => {
  const onboarding = buildAccountLinkParams({accountId:"acct_test", capabilityStatus:"pending", refreshUrl:"https://example.com/refresh", returnUrl:"https://example.com/return"});
  assert.equal(onboarding.use_case.type, "account_onboarding");
  assert.deepEqual(onboarding.use_case.account_onboarding.configurations, ["recipient"]);

  const update = buildAccountLinkParams({accountId:"acct_test", capabilityStatus:"active", refreshUrl:"https://example.com/refresh"});
  assert.equal(update.use_case.type, "account_update");
  assert.deepEqual(update.use_case.account_update.configurations, ["recipient"]);
});
