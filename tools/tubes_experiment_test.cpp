#include <assert.h>
#include <stdint.h>
#include "usermods/Tubes/experiment.h"

int main() {
  using namespace TubesExperiment;
  assert(logicalPixel(0, 10, false) == 0);
  assert(logicalPixel(0, 10, true) == 9);
  assert(helloLitPixels(0, 100) == 1);
  assert(helloLitPixels(499, 100) == 100);
  assert(helloLitPixels(500, 100) == 0);

  HelloGate gate;
  assert(!gate.update(0, false));
  assert(!gate.update(100, true));
  assert(!gate.update(599, true));
  assert(gate.update(600, true));
  assert(!gate.update(700, true));
  assert(!gate.update(1200, false));
  assert(!gate.update(2200, false));
  assert(!gate.update(3200, false));
  assert(!gate.update(3201, true));
  assert(gate.update(3701, true));

  assert(latencyFloorMs(0, false, 0) == 250);
  assert(latencyFloorMs(100, true, 400) == 400);
  assert(latencyFloorMs(300, true, 200) == 300);
  assert(!latencyEventOn(249, 250));
  assert(latencyEventOn(250, 250));
  assert(latencyEventOn(569, 250));
  assert(!latencyEventOn(570, 250));
  assert(!latencyEventOn(2599, 250));
  assert(!latencyEventOn(2600, 250));
  assert(latencyEventOn(2850, 250));

  assert(localShell(false, false) == 0);
  assert(localShell(true, false) == 1);
  assert(localShell(true, true) == 0);
  assert(shellBpm256(120U << 8, 0, 2) == (120U << 8));
  assert(shellBpm256(120U << 8, 1, 2) == (122U << 8));
  assert(shellBpm256(120U << 8, 1, 4) == (124U << 8));
  assert(shellBpm256(120U << 8, 1, 3) == (122U << 8));

  PurpleOtaState ota;
  ota.begin(10);
  assert(ota.phaseAt(10) == PurplePhase::PrePulseOn);
  assert(ota.phaseAt(210) == PurplePhase::PrePulseOff);
  assert(ota.phaseAt(810) == PurplePhase::ReadyToSuspend);
  ota.succeeded(1000);
  assert(!ota.shouldReboot(1000));
  assert(ota.phaseAt(1000) == PurplePhase::SuccessPulseOn);
  assert(!ota.shouldReboot(2999));
  assert(ota.shouldReboot(3000));
  ota.failed();
  assert(ota.phaseAt(4000) == PurplePhase::Inactive);
}
