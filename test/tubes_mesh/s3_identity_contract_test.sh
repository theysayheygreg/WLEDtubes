#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
node="$root/usermods/Tubes/node.h"
status="$root/usermods/Tubes/s3_field_api.h"
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
grep -q 'stableHardwareNodeId' "$node" || fail 'stable hardware identity helper missing'
grep -q 'getDeviceId' "$node" || fail 'identity is not tied to the established MAC-derived device ID'
grep -q 'id = stableHardwareNodeId' "$node" || fail 'default reset does not use stable identity'
grep -q 'status.deviceId = controller.node.header.id' "$root/usermods/Tubes/Tubes.h" || fail 'diagnostic source is not canonical node header id'
grep -q 'uplinkId' "$status" || fail 'uplink identity field missing'
grep -q 'configured Remote ID' "$root/usermods/Tubes/S3_REMOTE_BUILD_CONTRACT.md" || fail 'contract does not distinguish configured Remote ID'
printf 'PASS: S3 local identity source contract\n'
