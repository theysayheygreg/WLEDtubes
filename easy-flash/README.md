# WLEDTubes Easy Flash

Easy Flash is the laptop-local installation and recovery surface for WLEDTubes hardware firmware.

Current branch scope:

- canonical QuinLED Dig2Go Tubes v14 hardware firmware;
- verified complete USB and application-only HTTP OTA artifacts;
- Chrome/Edge Web Serial flashing with chip-family, image-integrity, partition, and flash-mode checks;
- WLED physical/output configuration planning;
- a deferred Tubes software-profile layer that will consume Steve's canonical runtime packet contracts when they land.

The product boundary is deliberate:

```text
hardware firmware changes rarely
art configuration changes continuously
```

Pattern, Hello, Purple, spatial, Mobile Conductor, and Waveshare S3 experimental firmware remain in their dedicated worktrees and are not bundled here.

No physical write occurs merely by loading the page or preparing an operation receipt. The operator must select a USB port and explicitly approve a write. Safari can download artifacts but cannot use Web Serial; use desktop Chrome or Edge for laptop flashing.

The attached strip cannot be auto-detected. Strip voltage, type, color order, pixel count, wiring, and current ceiling remain human-confirmed inputs.
