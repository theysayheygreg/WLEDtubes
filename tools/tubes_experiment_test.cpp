#include <assert.h>
#include <stdint.h>
#include "usermods/Tubes/experiment_overlay.h"

int main() {
  using namespace TubesExperiment;

#ifdef TUBES_ENABLE_HELLO_VFX
  HelloOverlay hello;
  assert(!hello.update(0, false));
  assert(!hello.update(100, true));
  assert(hello.update(600, true));
  assert(hello.litPixels(600, 100) == 1);
  assert(hello.litPixels(1099, 100) == 100);
  assert(hello.litPixels(1100, 100) == 0);
#endif

  ExperimentOverlay overlay;
  assert(overlay.priority(false, false, SpatialMode::Off) == OverlayKind::None);
  assert(overlay.priority(false, true, SpatialMode::Latency) == OverlayKind::Hello);
  assert(overlay.priority(true, true, SpatialMode::BpmDrift) == OverlayKind::OtaAcknowledgement);
  assert(parseSpatialMode(0) == SpatialMode::Off);
  assert(parseSpatialMode(1) == SpatialMode::Latency);
  assert(parseSpatialMode(2) == SpatialMode::BpmDrift);
  assert(parseSpatialMode(3) == SpatialMode::Off);
  assert(parseSpatialMode(255) == SpatialMode::Off);

  assert(!latencyEventOn(249, 250));
  assert(latencyEventOn(250, 250));
  assert(latencyEventOn(569, 250));
  assert(!latencyEventOn(570, 250));
  assert(!latencyEventOn(2599, 250));
  assert(latencyEventOn(2850, 250));

  assert(localBpm256(120U << 8, false, 2) == (120U << 8));
  assert(localBpm256(120U << 8, true, 2) == (122U << 8));
  assert(localBpm256(0, true, 2) == 0);
  const auto relayBpm = [](uint32_t bpm, bool following, bool) { return localBpm256(bpm, following); };
  assert(relayBpm(120U << 8, false, false) == relayBpm(120U << 8, false, true));
  assert(relayBpm(120U << 8, true, false) == relayBpm(120U << 8, true, true));
  assert(relayBpm(120U << 8, false, true) != relayBpm(120U << 8, true, true));
  assert(bpmDriftPhase(0, 0, false) == 0);
  assert(bpmDriftPhase(120U << 8, 0x4000, true) != bpmDriftPhase(120U << 8, 0x4000, false));
  assert(overlay.priority(false, false, SpatialMode::Off) == OverlayKind::None);
}
