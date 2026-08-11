# S3 Tubes Field OS

The Waveshare S3 runs a Tubes-first field instrument, not a general-purpose app
launcher. The Tubes scheduler, mesh, clock, and update admission stay active
under every screen. Screen navigation never pauses the installation.

## Workspaces

- **Conductor:** preview the virtual Tube and control pattern, palette, tempo,
  transitions, blackout, and master authority through existing Tubes semantics.
- **Surveyor:** show recently heard peers and bounded RSSI history while Greg
  walks the installation. Measurements are observations, not fabricated
  distance or coordinates.
- **Anchor:** originate the existing mobile-conductor route sidecar as shell
  zero when explicitly enabled. The first anchor is proximity-based; it does
  not claim physical location or ranging.
- **Updater:** inventory approved application-only firmware artifacts, match an
  artifact's exact hardware target to one receiver, serve one image, and wait
  for reboot and health proof before handing off the baton.

These are runtime workspaces and capabilities in one S3 hardware image. They
are not separate firmware variants or new wire-level Tubes roles.

## Firmware library

The S3 carrier and the artifact target are different identities. An S3 may
carry a Dig2Go image, but admission compares the image target contract to the
receiver. It never compares the S3's hardware identity to the receiver.

The microSD card is the primary expandable firmware vault. Internal flash
retains two S3 OTA slots and a small data partition for manifests, receipts,
and an optional curated emergency image cache. The inactive S3 OTA slot is
never used as storage for another board's firmware.

Every library entry must identify a destination application image, exact
hardware and partition contract, byte length, and SHA-256. Unknown targets,
source-only migration fixtures, incomplete metadata, oversize images, and hash
mismatches fail before any receiver erase or write.

## Update sequence

```text
select approved artifact
-> inspect one receiver
-> compare artifact target to receiver target
-> lock one sender, target, and hash
-> serve application bytes to the receiver's inactive OTA slot
-> verify the complete image
-> reboot and prove firmware identity, configuration, mesh rejoin, and health
-> release or transfer the baton
```

The updater does not write bootloaders, partition tables, NVS, or merged
recovery images over the ordinary peer path. Cross-target and ambiguous writes
fail closed.

## Delivery order

1. Tubes-first Home and Conductor controls.
2. Fixed-size peer/RSSI telemetry and the Surveyor screen.
3. Explicit proximity-anchor controls and live shell view.
4. Read-only microSD firmware inventory with manifest/hash verification.
5. One-target update session integrated from the canonical `p2p-update` work.

No physical flash or device-network operation occurs without Greg's explicit
approval and the one-time factory preservation gate.
