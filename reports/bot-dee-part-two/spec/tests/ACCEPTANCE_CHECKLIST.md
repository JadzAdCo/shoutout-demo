# BOT-DEE Part Two Acceptance Checklist

- [ ] Existing `executeBotSession` behavior inventoried and backward compatibility verified
- [ ] Firestore thread and workflow schema versioned; no unbounded single-document transcript
- [ ] Valid/invalid transitions unit-tested
- [ ] Concurrent execution transaction/revision conflicts tested
- [ ] Crash/restart and lease-expiry recovery tested
- [ ] External timeout/unknown outcome reconciled without duplicate side effects
- [ ] Approval payload binding, expiry and role revocation tested
- [ ] Cross-tenant and unauthorized admin access denied and audited
- [ ] PII/log redaction, retention and PCI zero-card policies verified
- [ ] Version endpoint reads deployment manifest, not LLM memory
- [ ] Master Admin can request current BOT-DEE version, release changes, capabilities and limitations
- [ ] Unauthorized user cannot retrieve internal release/operations data
- [ ] Missing manifest yields explicit 'cannot verify' response
- [ ] Planned/tested/deployed states accurately separated
- [ ] Cost/metrics/alerts and runbooks documented
- [ ] Staging demo and rollback plan approved
- [ ] No production deployment without explicit approval
