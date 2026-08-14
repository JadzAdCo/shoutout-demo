const featureGateFns = require("./feature-gate-functions");
const displaySecurityFns = require("./display-security-functions");
const sos2faFns = require("./sos2fa-functions");
const twilioDebuggerFns = require("./twilio-debugger-webhook");

module.exports = {
  ...require("./ai-discovery-functions"),
  ...require("./commerce-functions"),
  ...require("./messaging-functions"),
  ...require("./marketing-campaign-functions"),
  ...require("./scheduling-functions"),
  ...require("./venue-ingest-functions"),
  ...require("./demo-seed-functions"),
  ...require("./suprstr-functions"),
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
  getSos2faMethods: sos2faFns.getSos2faMethods,
  requestSos2faCode: sos2faFns.requestSos2faCode,
  verifySos2faCode: sos2faFns.verifySos2faCode,
  startSos2faTotpEnrollment: sos2faFns.startSos2faTotpEnrollment,
  confirmSos2faTotpEnrollment: sos2faFns.confirmSos2faTotpEnrollment,
  verifySos2faTotp: sos2faFns.verifySos2faTotp,
  disableSos2faTotp: sos2faFns.disableSos2faTotp,
  logEntityManagementActivity: sos2faFns.logEntityManagementActivity,
  assignVenueEmployee: sos2faFns.assignVenueEmployee,
  removeVenueEmployee: sos2faFns.removeVenueEmployee,
  twilioDebuggerWebhook: twilioDebuggerFns.twilioDebuggerWebhook
};
