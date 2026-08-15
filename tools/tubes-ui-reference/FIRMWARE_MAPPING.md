# Firmware → reference mapping

Source: `usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp` at branch snapshot `f17869d4`.

| Firmware draw/data | Reference component | Notes |
|---|---|---|
| `drawHome()` title and four `button()` regions | Home tiles | Geometry preserved conceptually; web tiles have larger semantic labels.
| `drawConductorTelemetry()` `patternName`, `bpm`, `beat`, `deviceId`, `priority` | CURRENT DEVICE card | S3 Remote ID FD2 / Priority 200 is the realistic fixture.
| `isMaster` / `isFollowing` | Follower ↔ Master segmented control | Independent role switch; never conflated with peer count.
| `drawConductorPreview()` `status.preview[]` | Always-running virtual strip | Preview is visual-only and must remain live without clear-then-draw blink.
| `peerCount`, `tubesS3ReadPeer()` | NETWORKED DEVICES compact rows | External count and peer rows are explicitly separate from current device.
| `drawSurveyorTelemetry()` sort rule | Surveyor table order | Known RSSI desc, then ID; stale/unknown values remain visible as appropriate.
| `nodeId`, `uplinkId`, `latestRssi`, `lastSeenMs` | Remote ID, Priority, Following, signal, age | Fixture peer: 847 / -- / 000 / −28 dBm / 4s; peer priority is unknown.
| scanner `status.deviceId` / `priority` | Separate scanner identity card | Not a row in its own survey list.
| `radioReady`, packet counts, sync timestamps | status line (`SYNCED`, stale, offline) | Data-dependent; fixture uses synced state.

## Unsupported or deliberately absent
- **Distance/proximity:** no source field; never infer from RSSI.
- **Smoothed RSSI:** only latest RSSI is present in this source; UI labels it signal, not smoothed.
- **Peer device number:** if not reported, render `--` (never substitute tube ID).
- **Pattern variables/palette:** not part of the cited draw API; omitted rather than fabricated.
- **Touch calibration/gesture state:** interaction wiring is outside this visual harness.
