# Tubes OS 480×480 UI reference

Deterministic, phone-photo-free reference for the Waveshare S3 field remote. `index.html` is a self-contained three-screen prototype with two visual variants (`?variant=1` dark teal AMOLED, `?variant=2` rose night-rave). Every document and screenshot target is exactly 480×480 CSS pixels.

## Screens and truth boundaries
- **Home:** Conductor, Surveyor, Anchor, Updater launch targets; field snapshot is explicit.
- **Conductor:** CURRENT DEVICE is separate from NETWORKED DEVICES. Shows S3 FD2 / device #200, local pattern, virtual strip, follower/master switch, and immediate previous/next controls. Peer 847 is shown as following 000 at −28 dBm, 4s.
- **Surveyor:** scanner identity is separate from the signal-sorted table. Columns are Tube ID, device number, Following/uplink, signal, age. Unknown values remain `--`; no distance is fabricated.

## Variants
1. `?variant=1` — dark teal / blue AMOLED, recommended for strongest glanceability.
2. `?variant=2` — rose / violet night-rave palette; same information architecture for A/B comparison.
3. `?variant=3` — reserved extension point; keep geometry and field semantics stable.

## Render
The canonical render command uses Playwright when installed:

```sh
python3 render.py --variant 1 --out rendered/variant-1
python3 render.py --variant 2 --out rendered/variant-2
```

The script fails clearly if Chromium/Playwright is unavailable rather than emitting fake screenshots. Screenshots must be inspected for 480×480 dimensions and clipping before acceptance.

## Recommendation
Variant 1: the teal status color gives the fastest distinction between healthy sync, muted/unknown telemetry, and amber stale state while preserving the dark AMOLED field aesthetic.
