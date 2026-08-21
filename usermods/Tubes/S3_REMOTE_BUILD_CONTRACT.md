# Waveshare S3 Remote build contract

## Purpose

This is the small, repeatable build and acceptance contract for the Waveshare
ESP32-S3-Touch-AMOLED-2.16 Tubes Remote. It prevents target, partition, feature,
and write-procedure regressions without creating a large test harness.

**Non-goals:** this document does not authorize a device flash, define a new
wire protocol, replace the existing Tubes tests, or claim that PMU/IMU behavior
is available when hardware or source support is absent.

## Authority and exact build

- Build from SteveEisner `origin/main` lineage. This contract was added on
  candidate base `fbeff278f39e872ff1252e0899a371cd0f1aeaab`; verify the intended
  commit and clean diff before use. Do not build an incidental worktree.
- Run from the repository root:

```sh
npm ci
npm run build
pio run -e waveshare_s3_tubes_remote
```

- The exact PlatformIO environment is
  `platformio_tubes.ini:[env:waveshare_s3_tubes_remote]`.
- Expected artifact: `.pio/build/waveshare_s3_tubes_remote/firmware.bin`.
- Record size and hash:

```sh
stat -f '%z bytes  %N' .pio/build/waveshare_s3_tubes_remote/firmware.bin
shasum -a 256 .pio/build/waveshare_s3_tubes_remote/firmware.bin
```

The image must be no larger than the OTA application slot `0x600000`
(6,291,456 bytes). The partition source is
`tools/WLED_ESP32S3_WAVESHARE_16MB.csv`: `ota_0` starts at `0x10000` and
`ota_1` at `0x610000`; NVS is `0x9000`/`0x5000` and must be preserved.

## Mandatory compiled pieces

Confirm the environment still contains all of the following before accepting a
build:

- Real S3 target: `extends = env:esp32s3dev_16MB_opi`,
  `WLED_RELEASE_NAME="WAVESHARE_S3_TUBES_REMOTE"`,
  `TUBES_HARDWARE_FAMILY=TubeHardwareWaveshareS3`, and
  `TUBES_FIRMWARE_VARIANT=TubeVariantStandard`.
- Exact 16 MiB geometry: `board_build.partitions =
  tools/WLED_ESP32S3_WAVESHARE_16MB.csv` and the slot layout above.
- Tubes Field OS/user mods: `custom_usermods = Tubes WaveshareS3CompileCanary`,
  `TUBES_S3_FIELD_OS`, `TUBES_READ_ONLY_FIELD_SHELL`,
  `TUBES_ENABLE_SPATIAL_PATTERNS`, and `TUBES_ENABLE_MOBILE_CONDUCTOR`.
- Null-output contract: `TUBES_NULL_OUTPUT`, `PIXEL_COUNTS=60`. The Tubes
  scheduler renders a logical 60-pixel frame to the virtual framebuffer; it
  must not allocate or transmit a physical LED bus. See
  `usermods/Tubes/docs/S3_CONDUCTOR_CONTRACT.md`, `Tubes.h`, and
  `virtual_strip.h`.
- Radio/Tubes dependencies: retain the inherited Tubes flags and the pinned
  dependencies in `platformio_tubes.ini` (Arduino_GFX,
  `SensorLib`, `XPowersLib`). Do not accidentally inherit
  `WLED_DISABLE_ESPNOW` from the generic no-mic template: the S3 environment
  explicitly removes the Tubes no-mic unflags as needed and is required to
  remain a real Tubes mesh node.
- Canary retention: keep both linker roots
  `-Wl,-u,waveshareS3PeripheralCompileCanary` and
  `-Wl,-u,wss3DumpScreenState`; otherwise the peripheral/screen-dump compile
  proof can disappear at link time.

### Source-grounded peripheral table

These are the only board claims this contract makes. They are constants in
`usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp`.

| Function | Exact source constant(s) |
|---|---|
| CO5300 AMOLED, 480x480 | `DISPLAY_CS=12`, `DISPLAY_SCLK=38`, `DISPLAY_SDIO0..3=4,5,6,7`, `DISPLAY_RESET=39`, `DISPLAY_WIDTH/HEIGHT=480` |
| CST9220 touch | `PERIPHERAL_SDA=15`, `PERIPHERAL_SCL=14`, `TOUCH_IRQ=11`, `TOUCH_RESET=40` |
| PMU/IMU | `XPowersPMU pmu; SensorQMI8658 imu;` are compiled by the canary; no runtime PMU/IMU acceptance is claimed unless the attached board and source path prove initialization |

Do not add guessed backlight, alternate panel, touch, PMU, or IMU pins. The
current canary's claimed pin set is allocated through `PinManager`; a conflict
must disable the screen, not be worked around by reassignment.

## Write rule (when separately authorized)

For an already provisioned, known Waveshare S3, application-only writing means
**this exact artifact at `0x10000`**. Use esptool flash mode `keep`; never force
`qio` or `qout`. Preserve bootloader, partition table, NVS, OTA metadata, and
recovery. A merged/first-install image is allowed only with exact, reviewed
bootloader and partition provenance; do not manufacture offsets from memory.

Unknown board identity, unknown partition geometry, missing artifact hash, or a
mismatch fails closed. This document itself does not authorize flashing.

## Minimal acceptance (one known-good board)

Record pass/fail; stop on any failure.

- [ ] Boots repeatedly and remains stable: no panic, watchdog reset, or brownout.
- [ ] AMOLED initializes and renders the 480x480 Home screen.
- [ ] Touch navigates Home → Next → Previous; a held touch produces one
      coalesced action, not repeated accidental transitions.
- [ ] The local 60-pixel virtual strip/framebuffer changes while following;
      no physical LED output is required or implied.
- [ ] Incoming sync may inform diagnostics but never overwrites the local strip.
      Home, Previous, and Next always change local state; Follower/Master only
      controls whether that local state is broadcast. Verify ESP-NOW channel
      and the intended peer.
- [ ] Reboot preserves the expected role/settings; no unexpected authority
      escalation occurs (Anchor defaults off per `usermods/Tubes/docs/S3_FIELD_OS.md`).
- [ ] PMU/IMU: mark **not exercised / unavailable** unless the board and
      corresponding source initialization are actually observed. Never infer
      health from a compile alone.

## Recovery stop gates

- Known-good full-backup SHA-256:
  `7fb40f38bea5ec7ee1021e54e01bc0e5ed81afd0de789d0879106af6ad125367`.
- Quarantined corrupted image SHA-256:
  `2ab89832b55ab4f2fea0576e79732f0b1f8b6f915e84d611b5c1e1fb83a4931d`.
- Its embedded mismatch begins:
  `5b274797...`.

Never use or promote the quarantined image. Unknown identity or an
unreconciled hash fails closed; restore only from the known-good backup or an
independently verified artifact.

## Definition of Done and receipt

- [ ] Intended SteveEisner source lineage and clean, isolated diff recorded.
- [ ] Required environment/partition/features and source pin table reviewed.
- [ ] `npm ci`, `npm run build`, and exact PlatformIO build completed.
- [ ] Artifact path, byte size (≤ 6291456), and SHA-256 recorded.
- [ ] Minimal acceptance and any unavailable PMU/IMU checks recorded.
- [ ] No device contact, flash, push, or PR occurred without explicit approval.

```text
Repo/commit:
Environment: waveshare_s3_tubes_remote
Artifact: .pio/build/waveshare_s3_tubes_remote/firmware.bin
Bytes (<= 6291456):
SHA-256:
Partition CSV: tools/WLED_ESP32S3_WAVESHARE_16MB.csv
Build checks (npm ci / npm run build / pio): PASS | FAIL
Acceptance: PASS | FAIL | NOT RUN
PMU/IMU: exercised | unavailable | not run
Flash: NOT PERFORMED | application-only at 0x10000 (authorized)
Notes/caveats:
```
