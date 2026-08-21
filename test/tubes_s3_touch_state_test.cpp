#include <cassert>
#include <vector>
#include "../usermods/WaveshareS3CompileCanary/s3_touch_state_machine.h"

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
  return 0;
}
