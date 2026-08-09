# Waveshare ESP32-S3-Touch-AMOLED-2.16 assumptions

This compile-only target assumes the board has 16 MB QIO flash at 80 MHz and 8 MB
OPI PSRAM (`qio_opi`), with native USB CDC enabled at boot. Peripheral pin assumptions:

- CO5300 AMOLED QSPI: CS 12, SCLK 38, SDIO0..3 4/5/6/7, reset 39
- Shared I2C: SDA 15, SCL 14
- CST92xx touch: IRQ 11, reset 40
- QMI8658 IMU and AXP2101-compatible PMU on the shared I2C bus

These are integration assumptions only. They require read-only confirmation against the
physical board and vendor schematic after hardware arrives. This slice does not initialize,
write to, or flash hardware.
