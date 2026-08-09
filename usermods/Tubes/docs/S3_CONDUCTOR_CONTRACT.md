# S3 Conductor M0 Compatibility Contract

The future S3 conductor is a **full logical Tubes node** with **no physical LED output**. It participates in election, timing, scheduling, state generation, and relay behavior as a conductor while rendering only to a virtual strip. M0 documents and freezes compatibility; it does not add an S3 build or implementation.

## Wire contract

- A deployed v2 `NodeMessage` is immutable: exactly 84 bytes, little-endian, including existing alignment and reserved bytes. Do not repack, extend, or reinterpret it.
- The additive mobile-route v1 sidecar is exactly 24 bytes. It remains a separate packet and is never embedded in or substituted for the 84-byte frame.
- `MasterRole = 200` remains the conductor role boundary and must not be repurposed.
- Pattern IDs `0..23` are native Tubes renderers. Pattern IDs `24+` are WLED-backed entries whose existing IDs and visual intent remain stable.
- Golden fixtures in `tools/fixtures/` pin selected canonical values byte-for-byte; production structs and constructors remain the codec.

## Behavioral contract

The conductor runs the existing Tubes scheduler against a virtual strip: shared BPM/beat and phrase clocks, current and next scheduled state, pattern and palette selection, fades, effect/transient overlays, node election/following, command routing, and conductor broadcasts retain their legacy semantics. A headless conductor may compute rendering state when required for identical scheduling, but must not claim or drive LED buses.

Current/next state is predictive continuity, not a queue to simplify or collapse. Fades, palettes, and transients retain their existing ordering and timing. Node and conductor behavior remains the existing mesh model: a conductor is a high-role node, not a separate protocol authority.

## Stack and fleet limits

The first implementation must use the **same WLED 16.0.1** and **Arduino-ESP32 2.0.18** stack as the fleet. Do not change framework versions as part of conductor work.

A mixed-firmware flock shares only behavior already represented by the immutable v2 frame and understood sidecars. New-only features require capability gating and graceful legacy fallback; old nodes cannot gain new renderers, scheduling semantics, or sidecar behavior merely by hearing a new conductor. Unknown commands or sidecars must remain safely ignorable.

## Hardware write gates

Every physical-output path needs an explicit **hardware write gate**. Headless mode must gate bus initialization, pin ownership, pixel transmission/show calls, current limiting based on physical LEDs, and output-specific teardown. Networking, scheduler state, virtual-strip computation, fades, palettes, and transients stay active behind no such gate. Tests must prove that enabling conductor semantics cannot reach a hardware write.
