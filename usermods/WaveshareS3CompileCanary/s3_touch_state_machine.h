#pragma once
#include <stdint.h>

enum class S3TouchEvent : uint8_t { None, Press, Hold, Release };

// CST9220 getPoint() performs a fresh I2C transaction. Its return count is the
// contact-validity signal: coordinates may remain the last point on lift, while
// a zero count is the real release/re-arm boundary.
class S3TouchStateMachine {
  bool pressed_ = false;
public:
  S3TouchEvent sample(uint32_t, uint8_t pointCount, int16_t, int16_t) {
    if (pointCount > 0) {
      if (!pressed_) { pressed_ = true; return S3TouchEvent::Press; }
      return S3TouchEvent::Hold;
    }
    if (pressed_) { pressed_ = false; return S3TouchEvent::Release; }
    return S3TouchEvent::None;
  }
  bool pressed() const { return pressed_; }
};
