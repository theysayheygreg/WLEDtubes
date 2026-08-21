#include <cassert>
#include <vector>
#include "../usermods/WaveshareS3CompileCanary/s3_touch_state_machine.h"

int main() {
  S3TouchStateMachine sm;
  assert(sm.sample(0, true, 100, 100) == S3TouchEvent::Press);
  assert(sm.sample(10, false, -1, -1) == S3TouchEvent::None);
  assert(sm.sample(20, true, 100, 100) == S3TouchEvent::Hold); // noisy lift does not rearm
  assert(sm.sample(30, false, -1, -1) == S3TouchEvent::None);
  assert(sm.sample(90, false, -1, -1) == S3TouchEvent::Release);
  assert(sm.sample(100, true, 100, 100) == S3TouchEvent::Press);
  assert(sm.sample(110, false, -1, -1) == S3TouchEvent::None);
  assert(sm.sample(170, false, -1, -1) == S3TouchEvent::Release);
  S3TouchStateMachine invalid;
  assert(invalid.sample(0, false, 500, 500) == S3TouchEvent::None);
  return 0;
}
