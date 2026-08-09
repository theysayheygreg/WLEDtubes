#pragma once

#include <stdint.h>

namespace TubesExperiment {

constexpr uint32_t HELLO_DURATION_MS = 500;
constexpr uint32_t HELLO_STABLE_DWELL_MS = 500;
constexpr uint32_t HELLO_ALONE_REARM_MS = 1000;
constexpr uint32_t HELLO_COOLDOWN_MS = 1500;
constexpr uint32_t LATENCY_ARTISTIC_MINIMUM_MS = 250;
constexpr uint32_t LATENCY_EVENT_MS = 320;
constexpr uint32_t LATENCY_REPEAT_MS = 2600;
constexpr uint8_t BPM_DRIFT_ARTISTIC_OFFSET = 2;

enum class SpatialMode : uint8_t { Off, Latency, BpmDrift };
enum class OverlayKind : uint8_t { None, Spatial, Hello, OtaAcknowledgement };

constexpr SpatialMode parseSpatialMode(int value) {
  return value == 1 ? SpatialMode::Latency : value == 2 ? SpatialMode::BpmDrift : SpatialMode::Off;
}

class ExperimentOverlay {
 public:
  constexpr OverlayKind priority(bool otaActive, bool helloActive, SpatialMode spatialMode) const {
    return otaActive ? OverlayKind::OtaAcknowledgement
      : helloActive ? OverlayKind::Hello
      : spatialMode != SpatialMode::Off ? OverlayKind::Spatial
      : OverlayKind::None;
  }
};

#ifdef TUBES_ENABLE_HELLO_VFX
class HelloOverlay {
 public:
  bool update(uint32_t now, bool grouped) {
    if (grouped != candidateGrouped) {
      candidateGrouped = grouped;
      candidateSince = now;
    }
    if (grouped != stableGrouped && now - candidateSince >= HELLO_STABLE_DWELL_MS) {
      stableGrouped = grouped;
      if (!grouped) aloneSince = now;
      else if (armed && now - lastTrigger >= HELLO_COOLDOWN_MS) {
        armed = false;
        lastTrigger = now;
        started = now;
        return true;
      }
    }
    if (!stableGrouped && !grouped && now - aloneSince >= HELLO_ALONE_REARM_MS) armed = true;
    return false;
  }

  uint16_t litPixels(uint32_t now, uint16_t length) const {
    const uint32_t elapsed = now - started;
    if (!length || elapsed >= HELLO_DURATION_MS) return 0;
    return static_cast<uint16_t>(1U + (elapsed * length) / HELLO_DURATION_MS);
  }

 private:
  bool candidateGrouped = false;
  bool stableGrouped = false;
  bool armed = true;
  uint32_t candidateSince = 0;
  uint32_t aloneSince = 0;
  uint32_t lastTrigger = static_cast<uint32_t>(0U - HELLO_COOLDOWN_MS);
  uint32_t started = 0;
};
#endif

inline bool latencyEventOn(uint32_t synchronizedMs, uint32_t minimumMs = LATENCY_ARTISTIC_MINIMUM_MS) {
  const uint32_t floorMs = minimumMs < LATENCY_ARTISTIC_MINIMUM_MS ? LATENCY_ARTISTIC_MINIMUM_MS : minimumMs;
  const uint32_t phaseMs = synchronizedMs % LATENCY_REPEAT_MS;
  return phaseMs >= floorMs && phaseMs - floorMs < LATENCY_EVENT_MS;
}

constexpr uint32_t synchronizedMillis(uint32_t beatFrame, uint32_t bpm256) {
  return bpm256 ? static_cast<uint32_t>((static_cast<uint64_t>(beatFrame) * 60000U) / bpm256) : 0;
}

constexpr uint32_t localBpm256(uint32_t bpm256, bool following, uint8_t offsetBpm = BPM_DRIFT_ARTISTIC_OFFSET) {
  return bpm256 && following ? bpm256 + (static_cast<uint32_t>(offsetBpm) << 8) : bpm256;
}

constexpr uint8_t bpmDriftPhase(uint32_t bpm256, uint32_t beatFrame, bool following) {
  return bpm256 ? static_cast<uint8_t>((static_cast<uint64_t>(beatFrame) * localBpm256(bpm256, following)) / bpm256) : 0;
}

} // namespace TubesExperiment
