# Feature evidence (code on default branch, not live flags)

Evidence kind: `doc` + `commit` of current tree. Deployment/availability for non-ShoutOut products is **not verified**.

| Product | Feature key | Code present | Packaged flags | Patron Search tile |
|---|---|---|---|---|
| ShoutOut | shoutOut | yes | Enabled 1, Test 0 (live) | yes |
| BOT DEE | botDee | yes (`botdee.html`, executeBotSession) | Enabled 1, Test 1 | yes (beta grant / Master Admin) |
| Mingl | mingl | yes (chat, gist, Search tile hidden) | Enabled 0, Test 1 | hidden while Off |
| VIP reserV | vipReservations | yes (`vip.html`) | Enabled 0, Test 1 | hidden while Off |
| floqCast | floqCast | yes (`floqcast-search.html`, display2) | Enabled 0, Test 1 | hidden while Off |
| Si-nema | sinema | yes (`sinema.html`) | Enabled 0, Test 1 | hidden while Off |
| Si-tube | — | **no** | — | — |
| FLOQR platform | — | Search / profile / notifications | n/a | n/a |

Try-feature links must call `FLOQRFeatureServices.linkState` / `canAccess`. Never advertise Mingl as usable while Off.
