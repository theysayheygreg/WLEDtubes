#pragma once

#include <stddef.h>
#include <stdint.h>

// This is the deployed raw-struct wire contract. Do not replace it with a codec.
#define CURRENT_NODE_VERSION 2
#define MESSAGE_DATA_SIZE 64

#pragma pack(push,4) // Preserve the packing shipped by Tubes nodes.
typedef enum {
  RECIPIENTS_ALL=0,
  RECIPIENTS_ROOT=1,
  RECIPIENTS_INFO=2,
} MessageRecipients;

typedef uint16_t MeshId;

typedef struct MeshNodeHeader {
  MeshId id = 0;
  MeshId uplinkId = 0;
  uint8_t version = CURRENT_NODE_VERSION;
} MeshNodeHeader;

typedef struct NodeMessage {
  MeshNodeHeader header;
  MessageRecipients recipients;
  uint32_t timebase;
  CommandId command;
  byte data[MESSAGE_DATA_SIZE] = {0};
} NodeMessage;
#pragma pack(pop)

static_assert(sizeof(MessageRecipients) == 4, "NodeMessage recipient width changed");
static_assert(sizeof(MeshId) == 2, "NodeMessage mesh ID width changed");
static_assert(sizeof(CommandId) == 1, "NodeMessage command width changed");
static_assert(sizeof(byte) == 1, "NodeMessage data element width changed");
static_assert(sizeof(MeshNodeHeader) == 6, "NodeMessage header width changed");
static_assert(offsetof(MeshNodeHeader, id) == 0, "NodeMessage header id offset changed");
static_assert(offsetof(MeshNodeHeader, uplinkId) == 2, "NodeMessage header uplink offset changed");
static_assert(offsetof(MeshNodeHeader, version) == 4, "NodeMessage header version offset changed");
static_assert(sizeof(NodeMessage) == 84, "The deployed Tubes wire message must remain 84 bytes");
static_assert(offsetof(NodeMessage, header) == 0, "NodeMessage header offset changed");
static_assert(offsetof(NodeMessage, recipients) == 8, "NodeMessage recipients offset changed");
static_assert(offsetof(NodeMessage, timebase) == 12, "NodeMessage timebase offset changed");
static_assert(offsetof(NodeMessage, command) == 16, "NodeMessage command offset changed");
static_assert(offsetof(NodeMessage, data) == 17, "NodeMessage data offset changed");
static_assert(sizeof(((NodeMessage*)0)->data) == MESSAGE_DATA_SIZE, "NodeMessage data width changed");

#if !defined(TUBES_ALLOW_UNSUPPORTED_ENDIAN_HOST_TEST) && defined(__BYTE_ORDER__) && defined(__ORDER_LITTLE_ENDIAN__)
static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "NodeMessage raw wire layout requires little-endian targets");
#endif
