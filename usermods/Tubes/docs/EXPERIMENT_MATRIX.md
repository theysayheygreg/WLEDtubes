# Production firmware experiment matrix

The base `esp32_quinled_dig2go_tubes` environment remains the deployed byte and behavior control. The experiment environments are additive compile-time variants:

| Environment | HELLO | HTTP OTA purple | Spatial aware | Mobile conductor |
|---|---:|---:|---:|---:|
| `esp32_quinled_dig2go_tubes` | no | no | no | no |
| `esp32_quinled_dig2go_tubes_hello` | yes | no | no | no |
| `esp32_quinled_dig2go_tubes_purple_ota` | no | yes | no | no |
| `esp32_quinled_dig2go_tubes_spatial` | no | no | yes | no |
| `esp32_quinled_dig2go_tubes_mobile_conductor` | no | no | yes | yes |
| `esp32_quinled_dig2go_tubes_combined` | yes | yes | yes | no |

The historical deployed control remains independently pinned at `1ea4912e` outside this modified checkout.

Experiment rendering is allocation-free and has explicit priority: HTTP OTA acknowledgement, HELLO, selected spatial mode, then the unchanged base. The base environment contains no experiment flags or active overlay work.

## HELLO

HELLO is a 500 ms logical bottom-to-top rainbow. It observes only this node's stable `uplinkId` transition from zero to nonzero. A transition must remain stable for 500 ms; repeated observations are deduplicated, triggers have a 1500 ms cooldown, and the effect rearms only after the node has been stably alone for 1000 ms. This is a local grouping impression, not a flock acknowledgment.

The deployed 84-byte message contains no global membership event or reply correlation. Exact flock-wide call/response cannot be implemented without a versioned, backward-compatible protocol extension. No field or command has been added or repurposed here.

WLED bus and segment reversal remain the only owner of physical orientation. Experiment rendering writes logical segment order and does not add another reversal layer.

## Purple HTTP OTA

Tubes uses WLED's generic `Usermod::onUpdateBegin(bool)` lifecycle; WLED core contains no Tubes hook or feature conditional. With the HTTP OTA flag enabled, the begin callback shows exactly two 80 ms whole-strand purple pulses, separated by 80 ms dark intervals, before Tubes marks itself OTA-suspended. It calls `strip.show()` directly and yields while waiting. Tubes loop, mesh, controller, patterns, pull updater, and overlay work remain stopped during `Update.write()`.

The purple pulse acknowledges only that HTTP OTA is beginning. It is not upload progress, success, candidate health, rollback protection, or proof that the candidate booted. Successful `Update.end(true)` retains WLED's immediate reboot semantics: usermods are not resumed and no success pulse is shown. A success indication is intentionally absent until a persistent candidate plus post-boot health contract exists. Terminal failures immediately restore the strip, usermods, and watchdog through WLED's idempotent failure finalizer; `onUpdateBegin(false)` clears Tubes suspension and the purple overlay.

## Spatial experiments

Spatial builds expose a local-only Tubes usermod setting with `off`, `latency`, and `bpm-drift`. It persists in WLED usermod configuration, defaults to `off`, and unknown values fail closed to `off`. The selection never uses `TubeState.pattern_id`, WLED effect IDs, radio command IDs, or packet fields. There is no overlay while off, so ordinary fleet patterns remain visibly unchanged by default.

Latency mode derives phase from the synchronized `BeatController` frame and BPM, not device boot time. Its named artistic minimum is 250 ms. The event is on for exactly 320 ms within a 2600 ms cycle and the remaining interval is exactly dark. It does not claim to measure observed network latency.

BPM drift reads synchronized `BeatController` BPM/frame and derives a local phase without mutating either. Root versus follower is determined only by `isFollowing()`; relay `isLeading()` bookkeeping cannot alter the local visual role. Followers use an honestly named artistic 2 BPM offset. Zero BPM produces no spatial draw.

`NodeMessage` remains exactly 84 bytes, version 2, with a 64-byte payload. Its command, pattern, palette, and role meanings are unchanged. Spatial-aware builds additionally recognize a packed 24-byte versioned mobile-route sidecar. Legacy builds reject that sidecar by length before casting and never become spatial relays. Unknown or invalid sidecars fail passive.

## Mobile conductor

Only `TUBES_ENABLE_MOBILE_CONDUCTOR` originates root route advertisements, and its build also uses the existing `MasterRole` clock authority. `TUBES_ENABLE_SPATIAL_PATTERNS` nodes rank and relay selected fresh routes using receiver-observed RSSI, cumulative bounded route cost, sequence/session identity, hysteresis, and dwell. The sidecar carries route and shell data only; ordinary v2 `STATE` and `BEATS` handling in the 84-byte `NodeMessage` remains the sole synchronization authority.

When a route is valid, latency mode delays each shell by 80 ms from the selected hop and BPM-drift mode offsets phase by the selected hop. Without a conductor route, the prior synchronized latency and root/follower BPM-drift rendering remains. Route loss expires to unknown shell and that fallback; it does not alter base rendering or the beat.

Prototype route advertisements are 500 ms, stale after 3000 ms, require 1500 ms candidate dwell and 8 cost units of hysteresis, and cap hop at 15 and cumulative cost at 4095. RSSI is clamped to -100..-30 dBm before integer ranking. These values and coefficients are concise starting points, not RF-calibrated measurements. There are no fabricated coordinates or global BFS topology.

Hardware and RF behavior remain untested. Physical orientation, perceived HELLO and shell timing, pre-ack visibility, flash-write stability, reboot timing, mixed-fleet radio behavior, RSSI calibration, current draw, and multi-device spatial appearance require device validation.
