# Production firmware experiment matrix

The base `esp32_quinled_dig2go_tubes` environment remains the deployed byte and behavior control. The experiment environments are additive compile-time variants:

| Environment | HELLO | HTTP OTA purple | Spatial |
|---|---:|---:|---:|
| `esp32_quinled_dig2go_tubes` | no | no | no |
| `esp32_quinled_dig2go_tubes_hello` | yes | no | no |
| `esp32_quinled_dig2go_tubes_purple_ota` | no | yes | no |
| `esp32_quinled_dig2go_tubes_spatial` | no | no | yes |
| `esp32_quinled_dig2go_tubes_combined` | yes | yes | yes |

All experiment rendering uses fixed state and writes directly to the current strip. The normal beat and pattern scheduler continues to advance underneath each clip. There is no framebuffer copy, queue, heap allocation, or restart used to reveal the base frame.

## HELLO

HELLO is a 500 ms logical bottom-to-top rainbow. It observes only this node's stable `uplinkId` transition from zero to nonzero. A transition must remain stable for 500 ms; repeated observations are deduplicated, triggers have a 1500 ms cooldown, and the effect rearms only after the node has been stably alone for 1000 ms. This is a local grouping impression, not a flock acknowledgment.

The deployed 84-byte message contains no global membership event or reply correlation. Exact flock-wide call/response cannot be implemented without a versioned, backward-compatible protocol extension. No field or command has been added or repurposed here.

Logical pixel zero is the default product bottom. WLED's existing bus `rev` geometry maps logical writes to reversed physical wiring; the renderer does not reverse those pixels a second time. There is no richer authoritative product-orientation field in the current Tubes configuration, so this default is centralized in `logicalPixel()`.

## Purple HTTP OTA

This variant hooks only the HTTP upload lifecycle in `wled00/ota_update.cpp`; it does not hook the Tubes `AutoUpdater` pull path. Before `strip.suspend()`, it requests two 200 ms purple pulses separated by 200 ms dark intervals. The wait is bounded to one second and the main scheduler performs all LED writes. No LED service is attempted during `Update.write()`.

After a successful `Update.end(true)`, WLED resumes the strip and usermods, performs two 500 ms purple pulses separated by 500 ms dark intervals, then permits reboot. An update error clears the transient and reveals the current base. The colors mean only "HTTP OTA lifecycle entered" and "Update.end(true) succeeded." They do not represent upload progress, cryptographic verification, candidate health, rollback protection, or successful boot of the candidate.

## Spatial experiments

The local-only selectors `240` (latency floor) and `241` (BPM drift) are deliberately outside the deployed pattern registry. They are never stored in `TubeState.pattern_id` or sent in `NodeMessage`, so deployed IDs `0–23` and WLED-backed IDs `24` and above remain unchanged. Selection is an explicit compile-only/local controller path.

Latency floor uses `max(configured minimum, 250 ms, observed latency when actually available)`. Production currently has no measured latency, so it honestly uses the floor. Its event lasts 320 ms and repeats every 2600 ms; the remainder is exactly dark.

BPM drift reads the synchronized `BeatController` BPM/frame and derives a local phase with a configured offset constrained to 2 or 4 BPM. It never mutates the controller BPM or frame. The only available shell information is local: leader/root is shell 0 and a directly following node is shell 1. The packet has no global graph, BFS shell, coordinates, or measured latency, so none are inferred. There is no microphone or audio dependency.

Hardware validation remains required for physical orientation, perceived grouping timing, flash-write stability, success-pulse visibility, reboot timing, mixed-fleet behavior, current draw, and multi-device spatial appearance.
