const featureGateFns = require("./feature-gate-functions");
const displaySecurityFns = require("./display-security-functions");
const sos2faFns = require("./sos2fa-functions");
const twilioDebuggerFns = require("./twilio-debugger-webhook");
const mailLogFns = require("./mail-log-functions");

module.exports = {
  ...require("./ai-discovery-functions"),
  ...require("./commerce-functions"),
  ...require("./messaging-functions"),
  ...require("./marketing-campaign-functions"),
  ...require("./scheduling-functions"),
  ...require("./venue-ingest-functions"),
  ...require("./suprstr-functions"),
  onShoutoutComplianceWrite: require("./shoutout-compliance-functions").onShoutoutComplianceWrite,
  purgeExpiredShoutoutMedia: require("./shoutout-compliance-functions").purgeExpiredShoutoutMedia,
  anonymizeExpiredComplianceLogs: require("./shoutout-compliance-functions").anonymizeExpiredComplianceLogs,
  backfillShoutoutComplianceLogs: require("./shoutout-compliance-functions").backfillShoutoutComplianceLogs,
  getShoutoutComplianceRetention: require("./shoutout-compliance-functions").getShoutoutComplianceRetention,
  stampShoutoutActorContext: require("./shoutout-compliance-functions").stampShoutoutActorContext,
  getFloqrClientIp: require("./shoutout-compliance-functions").getFloqrClientIp,
  setPatronFeatureGates: featureGateFns.setPatronFeatureGates,
  setEntityAppEnabled: featureGateFns.setEntityAppEnabled,
  setVenueFeatureGates: featureGateFns.setVenueFeatureGates,
  offboardEntity: featureGateFns.offboardEntity,
  checkDisplayAccess: displaySecurityFns.checkDisplayAccess,
  reportDisplayLoadError: displaySecurityFns.reportDisplayLoadError,
  setVenueDisplayIps: displaySecurityFns.setVenueDisplayIps,
  getVenueDisplayTokens: displaySecurityFns.getVenueDisplayTokens,
  provisionVenueDisplayTokens: displaySecurityFns.provisionVenueDisplayTokens,
  rotateVenueDisplayToken: displaySecurityFns.rotateVenueDisplayToken,
  listDisplayAccessLogs: displaySecurityFns.listDisplayAccessLogs,
  purgeLogRetention: displaySecurityFns.purgeLogRetention,
  requestSos2faCode: sos2faFns.requestSos2faCode,
  verifySos2faCode: sos2faFns.verifySos2faCode,
  logEntityManagementActivity: sos2faFns.logEntityManagementActivity,
  assignVenueEmployee: sos2faFns.assignVenueEmployee,
  removeVenueEmployee: sos2faFns.removeVenueEmployee,
  twilioDebuggerWebhook: twilioDebuggerFns.twilioDebuggerWebhook,
  sendgridMailEvents: mailLogFns.sendgridMailEvents
};
