# WLEDTubes migration fixtures

This directory pins firmware inputs and behavior fixtures used to test migrations into the current Tubes base. It is not a public firmware catalog.

## Firmware fixtures

- Stock WLED 0.14.3, 0.15.4, and 16.0.1 are official non-Tubes Dig2Go
  release assets from `intermittech/QuinLED-Firmware`, built from the matching
  upstream `wled/WLED` release.
- Tubes v13 is a reconstructed Dig2Go build from source commit `69f1bd8b` using the earliest recoverable Dig2Go Tubes build configuration at `9e7d3c70`.
- Tubes v14 is the canonical Dig2Go OTA artifact already pinned by Easy Flash.
- V14 Golden, Christmas, Mauve, Master, and HomeLight are reconstructed from
  baseline `c6522ace` using their checked-in PlatformIO environments. They are
  source fixtures only and are never offered by Easy Flash as destinations.
- The checked-in v14 Ruby environment does not compile at `c6522ace` because
  `PatternController` is incomplete under `RUBY`. Its source coordinate and
  failure are pinned instead of fabricating an artifact.

The stock binaries are **source fixtures only** even though they carry exact
published Dig2Go build defaults. They model devices being migrated into Tubes;
they are not destination artifacts. The v13 build is also source-only because
its original local build override and historical binary were not committed;
its hash proves this reconstruction, not every deployed v13 unit.

Golden and Christmas carry distinct embedded release identities. Ruby, Mauve,
and Master inherit generic `DIG2GO_TUBES`; unattended identification therefore
requires MAC enrollment or trusted source provenance before replacing them.

## Required migration order

```text
inspect exact hardware and installed lineage
→ back up configuration and persistent Tubes role state
→ normalize only the explicit hardware output bus when required for safe boot
→ install the exact Tubes hardware artifact when required
→ reboot and verify firmware identity, hardware target, and health
→ apply the runtime configuration/profile supported by that firmware
→ read back and verify effective configuration
```

Never apply a WLED 16/current-schema runtime profile before an older stock-WLED
or Tubes v13 device has booted and verified the destination Tubes base. The
preflash bus normalization is a bounded hardware-safety transform, not general
configuration migration.

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
