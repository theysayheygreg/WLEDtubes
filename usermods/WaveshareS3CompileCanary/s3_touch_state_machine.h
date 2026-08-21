#pragma once
#include <stdint.h>

enum class S3TouchEvent : uint8_t { None, Press, Hold, Release };

// CST9220 can briefly report no contacts while a finger remains down. Keep the
// press latched until a complete release window, so a noisy lift cannot rearm.
class S3TouchStateMachine {
  static constexpr uint32_t RELEASE_WINDOW_MS = 60;
  bool pressed_ = false;
  bool releasePending_ = false;
  uint32_t releaseStartedMs_ = 0;
public:
  S3TouchEvent sample(uint32_t nowMs, bool down, int16_t, int16_t) {
    if (down) {
      releasePending_ = false;
      if (!pressed_) { pressed_ = true; return S3TouchEvent::Press; }
      return S3TouchEvent::Hold;
    }
    if (!pressed_) return S3TouchEvent::None;
    if (!releasePending_) { releasePending_ = true; releaseStartedMs_ = nowMs; return S3TouchEvent::None; }
    if (static_cast<uint32_t>(nowMs - releaseStartedMs_) < RELEASE_WINDOW_MS) return S3TouchEvent::None;
    pressed_ = false;
    releasePending_ = false;
    return S3TouchEvent::Release;
  }
  bool pressed() const { return pressed_; }
};
