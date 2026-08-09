# Tubes golden packet fixtures

The `.bin` files are the canonical captured byte sequences for the already-deployed
raw-struct protocols. They are compatibility evidence, not a new codec:

- `tubes-v2-state.bin` is an 84-byte `NodeMessage` state packet using the values
  constructed in `tools/tubes_node_message_wire_test.cpp`.
- `mobile-route-v1.bin` is a 24-byte route advertisement using the values
  constructed in `tools/tubes_mobile_conductor_test.cpp`.

Both deployed formats assume little-endian integer representation. The NodeMessage
host test skips explicitly with status 77 on a known non-little-endian compiler;
production compile-time assertions reject a known non-little-endian target.

`tubes_golden_packets.h` is the C++ representation consumed by those constructor
tests. When intentionally updating a canonical binary, regenerate the corresponding
initializer from that binary (for example, `xxd -i tools/fixtures/<name>.bin`) and
copy only those emitted bytes into the named fixed-size array. Then run:

```sh
node --test --test-name-pattern='binary fixtures exactly|production NodeMessage|mobile conductor route' tools/tubes-experiment-test.js
```

The first check parses the header arrays and proves byte-for-byte equality with both
binary files, including their declared lengths. Any packet-layout change must also
pass the production static offset/width assertions and requires an explicit deployed
protocol compatibility decision.
