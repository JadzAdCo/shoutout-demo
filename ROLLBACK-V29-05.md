# FLOQR Rollback - v29.05

This rollback returns FLOQR to the previous v29.04 full package.

1. Upload `ShoutOut-wepApp.v29.04.zip` to the GitHub Pages repository root.
2. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.04`.
3. Redeploy the v29.04 Firestore and Storage rules if exact diagnostic marker alignment is required.
4. Redeploy the previous Functions bundle if the v29.05 email OTP, entity assignment, or dynamic crawler functions must be removed.
5. Rerun Package Install Diagnostics and Rules Smoke Test.

Rollback does not delete users, clubs, assignments, templates, crawler schedules/runs, OTP audit challenges, or reordered profile media. v29.04 ignores the new optional fields. Disable or delete the v29.05 callable/scheduled functions separately if their backend behavior must stop immediately.
