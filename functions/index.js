const featureGateFns = require("./feature-gate-functions");
const displaySecurityFns = require("./display-security-functions");
const sos2faFns = require("./sos2fa-functions");

module.exports = {
  ...require("./ai-discovery-functions"),
  ...require("./commerce-functions"),
  ...require("./messaging-functions"),
  ...require("./marketing-campaign-functions"),
  ...require("./scheduling-functions"),
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
  requestSos2faCode: sos2faFns.requestSos2faCode,
  verifySos2faCode: sos2faFns.verifySos2faCode,
  logEntityManagementActivity: sos2faFns.logEntityManagementActivity
};
