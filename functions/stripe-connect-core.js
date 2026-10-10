"use strict";

const crypto = require("crypto");

function bounded(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function normalizeConnectEntityType(value = "") {
  const type = bounded(value, 30).toLowerCase();
  if (type === "club") return "club";
  if (["member", "patron", "user"].includes(type)) return "member";
  return "";
}

function connectBindingId(entityType, entityId) {
  const type = normalizeConnectEntityType(entityType);
  const id = bounded(entityId, 200);
  if (!type || !id) throw new Error("A valid FLOQR Connect entity is required.");
  const digest = crypto.createHash("sha256").update(`${type}:${id}`).digest("hex").slice(0, 40);
  return `connect_${digest}`;
}

function recipientCapability(account = {}) {
  return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers || null;
}

function connectStatus(account = null) {
  if (!account?.id) {
    return {
      connected:false,
      transfersReady:false,
      capabilityStatus:"not-started",
      requirementsDue:0,
      livemode:false
    };
  }
  if (account.closed === true) {
    return {
      connected:true,
      transfersReady:false,
      capabilityStatus:"closed",
      requirementsDue:0,
      livemode:account.livemode === true
    };
  }
  const capability = recipientCapability(account);
  const capabilityStatus = bounded(capability?.status || "pending", 40).toLowerCase();
  const requirements = Array.isArray(account.requirements?.entries) ? account.requirements.entries : [];
  return {
    connected:true,
    transfersReady:capabilityStatus === "active",
    capabilityStatus,
    requirementsDue:requirements.filter(item => item?.awaiting_action_from === "user").length,
    livemode:account.livemode === true
  };
}

function buildRecipientAccountParams({bindingId, entityType, entityId, displayName, contactEmail} = {}) {
  const type = normalizeConnectEntityType(entityType);
  const id = bounded(entityId, 200);
  const binding = bounded(bindingId, 80);
  if (!type || !id || !binding) throw new Error("Connect account metadata is incomplete.");
  const params = {
    configuration:{
      recipient:{
        capabilities:{
          stripe_balance:{
            stripe_transfers:{requested:true}
          }
        }
      }
    },
    dashboard:"express",
    defaults:{
      currency:"usd",
      locales:["en-US"],
      profile:{
        business_url:"https://jadzadco.github.io/shoutout-demo/",
        doing_business_as:bounded(displayName || "FLOQR seller", 120),
        product_description:"Nightlife services, ShoutOuts, and marketplace goods sold through FLOQR."
      },
      responsibilities:{
        fees_collector:"application",
        losses_collector:"application"
      }
    },
    display_name:bounded(displayName || "FLOQR seller", 120),
    include:["configuration.recipient", "defaults", "identity", "requirements"],
    metadata:{
      floqr_binding_id:binding,
      floqr_entity_type:type,
      floqr_entity_id:id
    }
  };
  const email = bounded(contactEmail, 200).toLowerCase();
  if (email) params.contact_email = email;
  return params;
}

function buildAccountLinkParams({accountId, capabilityStatus, refreshUrl, returnUrl} = {}) {
  const account = bounded(accountId, 160);
  if (!account || !refreshUrl) throw new Error("Connect onboarding link data is incomplete.");
  const type = capabilityStatus === "active" ? "account_update" : "account_onboarding";
  const flow = {
    configurations:["recipient"],
    collection_options:{fields:"eventually_due", future_requirements:"include"},
    refresh_url:refreshUrl
  };
  if (returnUrl) flow.return_url = returnUrl;
  return {account, use_case:{type, [type]:flow}};
}

module.exports = {
  buildAccountLinkParams,
  buildRecipientAccountParams,
  connectBindingId,
  connectStatus,
  normalizeConnectEntityType,
  recipientCapability
};
