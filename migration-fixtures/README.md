# WLEDTubes migration fixtures

This directory pins firmware inputs and behavior fixtures used to test migrations into the current Tubes base. It is not a public firmware catalog.

## Firmware fixtures

- Stock WLED 0.14.4, 0.15.4, and 16.0.1 are official generic classic-ESP32 release assets from `wled/WLED`.
- Tubes v13 is a reconstructed Dig2Go build from source commit `69f1bd8b` using the earliest recoverable Dig2Go Tubes build configuration at `9e7d3c70`.
- Tubes v14 is the canonical Dig2Go OTA artifact already pinned by Easy Flash.

The stock binaries are **source fixtures only**. Their generic ESP32 identity cannot authorize unattended installation onto a Dig2Go. The v13 build is also source-only because its original local build override and historical binary were not committed; its hash proves this reconstruction, not every deployed v13 unit.

## Required migration order

```text
inspect exact hardware and installed lineage
→ back up configuration and persistent Tubes role state
→ install the exact Tubes hardware artifact when required
→ reboot and verify firmware identity, hardware target, and health
→ apply the runtime configuration/profile supported by that firmware
→ read back and verify effective configuration
```

Never apply a WLED 16/current-schema configuration before an older stock-WLED or Tubes v13 device has booted and verified the destination Tubes base.

## V13 reconstruction

Use a detached worktree at `69f1bd8b`, then copy the files from `build-config/tubes-v13/` into its root. Apply `dependency-repairs.patch`, run the historical `npm ci` and `npm run build`, then build in an isolated PlatformIO core:

```bash
PLATFORMIO_CORE_DIR=.pio-core pio run -e esp32_quinled_dig2go_tubes
```

The dependency repairs compensate for modern package resolution:

1. pin `ESPAsyncWebServer` to its actual `v2.2.1` Git tag;
2. remove the duplicate old `arduinoFFT` dependency from the DigUno base while retaining the Tubes-pinned FFT commit.

## Legacy overrides

`runtime-profiles.json` preserves effective Golden, Christmas, Ruby, Mauve, and Master behavior as software-profile inputs. HomeLight remains a distinct hardware target because it changes hardware-family and network/power ownership—not merely art direction.
