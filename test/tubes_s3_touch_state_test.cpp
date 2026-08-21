#include <cassert>
#include <vector>
#include "../usermods/WaveshareS3CompileCanary/s3_touch_state_machine.h"

static bool pollDue(uint32_t now, uint32_t last, bool started) {
  return !started || now - last >= 8; // wrap-safe 8 ms / 125 Hz bound
}

int main() {
  S3TouchStateMachine sm;
  assert(sm.sample(0, 1, 100, 100) == S3TouchEvent::Press);
  assert(sm.sample(10, 1, 100, 100) == S3TouchEvent::Hold);
  assert(sm.sample(20, 1, 101, 101) == S3TouchEvent::Hold); // movement never fires again
  assert(sm.sample(30, 0, 100, 100) == S3TouchEvent::Release); // stale last point, zero count is release
  assert(sm.sample(31, 1, 100, 100) == S3TouchEvent::Press);
  assert(sm.sample(32, 0, 100, 100) == S3TouchEvent::Release);
  S3TouchStateMachine invalid;
  assert(invalid.sample(0, 0, 500, 500) == S3TouchEvent::None);
  assert(pollDue(0, 0, false));
  assert(!pollDue(7, 0, true));
  assert(pollDue(8, 0, true));
  assert(pollDue(3, UINT32_MAX - 6, true)); // millis() wrap
  assert(S3TouchStateMachine{}.sample(8, 0, 100, 100) == S3TouchEvent::None);
  return 0;
}
