# Production firmware experiment matrix

The base `esp32_quinled_dig2go_tubes` environment remains the deployed byte and behavior control. The experiment environments are additive compile-time variants:

| Environment | HELLO | HTTP OTA purple | Spatial |
|---|---:|---:|---:|
| `esp32_quinled_dig2go_tubes` | no | no | no |
| `esp32_quinled_dig2go_tubes_hello` | yes | no | no |
| `esp32_quinled_dig2go_tubes_purple_ota` | no | yes | no |
| `esp32_quinled_dig2go_tubes_spatial` | no | no | yes |
| `esp32_quinled_dig2go_tubes_combined` | yes | yes | yes |

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

There are no wire changes: `NodeMessage` remains 84 bytes, version 2, with a 64-byte payload, and no capability packet exists. With spatial off, control-to-spatial, spatial-to-control, and relay traffic retains existing packet bytes and command semantics. Older/non-spatial firmware ignores the local WLED configuration because it is never transmitted.

Hardware remains untested. Physical orientation, perceived HELLO timing, pre-ack visibility, flash-write stability, reboot timing, mixed-fleet radio behavior, current draw, and multi-device spatial appearance require device validation.
