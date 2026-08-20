#pragma once

#include <Arduino.h>
#include "global_state.h"
#include "espnow_broadcast.h"
#include "peer_telemetry.h"
#if defined(TUBES_ENABLE_SPATIAL_PATTERNS) || defined(TUBES_ENABLE_MOBILE_CONDUCTOR)
#include "mobile_conductor_route.h"
#endif

// #define NODE_DEBUGGING
// #define RELAY_DEBUGGING
#define TESTING_NODE_ID 0

typedef struct {
    uint8_t status;
    char message[40];
} NodeInfo;


const char *command_name(CommandId command) {
    switch (command) {
        case COMMAND_STATE:
            return "UPDATE";
        case COMMAND_OPTIONS:
            return "OPTIONS";
        case COMMAND_ACTION:
            return "ACTION";
        case COMMAND_INFO:
            return "INFO";
        case COMMAND_BEATS:
            return "BEATS";
        default:
            return "?COMMAND?";
    }
}

class MessageReceiver {
  public:
    virtual bool onCommand(CommandId command, void *data) = 0;
    virtual bool onButton(uint8_t button_id) = 0;
};

class LightNode {
  public:
    static LightNode* instance;

    MessageReceiver *receiver;
    MeshNodeHeader header;
    PeerTelemetry peerTelemetry;

    // RX-callback → loop handoff: onEspNowObserver runs on the WiFi task, so it only
    // stages samples here; update() on the Tubes loop task is the sole observe() caller.
    // Single producer (RX) / single consumer (loop); a full ring drops the sample.
    struct PeerSample {
        uint16_t nodeId;
        uint16_t uplinkId;
        int8_t rssi;
    };
    static constexpr uint8_t PEER_SAMPLE_RING_SIZE = 16;
    PeerSample peerSampleRing[PEER_SAMPLE_RING_SIZE];
    volatile uint8_t peerSampleHead = 0;  // written by the RX callback only
    volatile uint8_t peerSampleTail = 0;  // written by the loop task only
    uint32_t receivedPacketCount = 0;
    uint32_t lastPacketMs = 0;
    uint32_t synchronizedPacketCount = 0;
    uint32_t lastSyncMs = 0;
    uint16_t lastSyncSourceId = 0;
    uint32_t transmittedPacketCount = 0;
    uint32_t lastTransmitMs = 0;

    typedef enum{
        NODE_STATUS_QUIET=0,
        NODE_STATUS_RECEIVING,
        NODE_STATUS_STARTED,
        NODE_STATUS_MAX,
    } NodeStatus;
    NodeStatus status = NODE_STATUS_QUIET;

    PGM_P status_code() const {
        switch (status) {
        case NODE_STATUS_QUIET:
            return PSTR(" (quiet)");
        case NODE_STATUS_RECEIVING:
            return PSTR(" (receiving)");
        case NODE_STATUS_STARTED:
            return PSTR(" (started)");
        default:
            return PSTR("??");
        }
    }

    char node_name[20];

    LightNode(MessageReceiver *r) : receiver(r) {
        instance = this;
    }

    void setWledNetworkOwnership(bool enabled) {
        wledOwnsNetwork = enabled;
    }

#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
    MobileRouteModel mobileRoute;
#endif
#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
    MobileConductorAuthority mobileConductorAuthority;
#endif

  protected:

    bool wledOwnsNetwork = false;

    const uint32_t STATUS_TIMEOUT_BASE =  3000;    // Base time to wait to send broadcasts
    const uint32_t UPLINK_TIMEOUT      = 20000;    // Time at which uplink is presumed lost
    const uint32_t REBROADCAST_TIME    = 30000;    // Time at which followers are presumed re-uplinked

    TubesTimer statusTimer;      // Use this timer to initialize and check wifi status
    TubesTimer uplinkTimer;      // When this timer ends, assume uplink is lost.
    TubesTimer rebroadcastTimer; // Until this timer ends, re-broadcast messages from uplink

    void onMeshChange() {
        sprintf(node_name,
            "Tube %03X:%03X",
            header.id,
            header.uplinkId
        );

        configureAP();
    }

    void configureAP() {
        // Home lights need the mesh, but their normal WLED network remains authoritative.
        if (wledOwnsNetwork)
            return;

#ifdef DEFAULT_WIFI
        strcpy(multiWiFi[0].clientSSID, DEFAULT_WIFI);
        strcpy(multiWiFi[0].clientPass, DEFAULT_WIFI_PASSWORD);
#else
        // Don't connect to any networks.
        strcpy(multiWiFi[0].clientSSID, "");
        strcpy(multiWiFi[0].clientPass, "");
#endif

        // By default, we don't want these visible.
        apBehavior = AP_BEHAVIOR_BUTTON_ONLY; // Must press button for 6 seconds to get AP
    }

    void onPeerPing(const MeshNodeHeader& node) {
        // When receiving a message, if the IDs match, it's a conflict
        // Reset to create a new ID.
        if (node.id == header.id) {
            Serial.println("Detected an ID conflict.");
            reset();
        }

        // If the message arrives from a higher ID, switch into follower mode
        if (node.id > header.uplinkId && node.id > header.id) {
#ifdef RELAY_DEBUGGING
          // When debugging relay, pretend not to see any nodes above 0x800
          if (node->id < 0x800)
#endif
            follow(&node);
        }

        // If the message arrived from our uplink, track that we're still linked.
        if (node.id == header.uplinkId) {
            uplinkTimer.start(UPLINK_TIMEOUT);
        }

        // If a message indicates that another node is following this one, or
        // should be (it's not following anything, but this node's ID is higher)
        // enter or continue re-broadcasting mode.
        if (shouldRenewRelayDuty(header, node)) {
            if (!isLeading()) {
                Serial.printf("     LEADING because %03X/%03X is following me\n", node.id, node.uplinkId);
            }
            rebroadcastTimer.start(REBROADCAST_TIME);
        }
    }

    void printMessage(const NodeMessage* message, signed int rssi) const {
        Serial.printf("%03X/%03X %s",
            message->header.id,
            message->header.uplinkId,
            command_name(message->command)
        );
        if (message->recipients == RECIPIENTS_ROOT)
            Serial.printf(":ROOT");
        if (rssi)
            Serial.printf(" %ddB ", rssi);
    }

    void onPeerData(const uint8_t* address, const NodeMessage* message, uint8_t len, signed int rssi, bool broadcast) {
        // Track that another node exists, updating this node's understanding of the mesh.
        onPeerPing(message->header);
        lastPacketMs = millis();
        if (receivedPacketCount != UINT32_MAX) receivedPacketCount++;

        MeshRoutePlan route = planMeshRoute(header, isFollowing(), isLeading(), *message);
        if (!route.accepted) {
#ifdef NODE_DEBUGGING
            Serial.print("  -- ignored ");
            printMessage(message, rssi);
            Serial.println();
#endif
            return;
        }

        // Apply only at the root on the upward trip, then at every follower on the declaration trip.
        if (route.applyLocally) {
            Serial.print("  >> ");
            printMessage(message, rssi);
            Serial.print(" ");

            // Only the chosen uplink's downward declaration is authoritative for clock time.
            if (route.synchronizeClock) {
                uint32_t new_timebase = message->timebase - millis() + 3; // Factor for network delay
                int32_t diff = new_timebase - strip.timebase;
                if (diff < -10 || diff > 10)
                    strip.timebase = new_timebase;
            }

            // Execute the command
            auto valid = receiver->onCommand(
                message->command,
                const_cast<uint8_t*>(message->data)
            );
            Serial.println();

            if (!valid)
                return;
            if (message->command == COMMAND_STATE || message->command == COMMAND_BEATS) {
                lastSyncMs = millis();
                lastSyncSourceId = message->header.id;
                if (synchronizedPacketCount != UINT32_MAX) synchronizedPacketCount++;
            }
        }

        // Preserve the accepted packet while advancing it one hop through the tree.
        if (route.relay) {
            NodeMessage msg = makeRelayedMessage(header, isFollowing(), *message);
#ifdef NODE_DEBUGGING
            Serial.println("rebroadcast");
#endif
            broadcastMessage(&msg, true);
        }
    }

    void broadcastMessage(NodeMessage *message, bool is_rebroadcast=false) {
        // Don't broadcast anything if this node isn't active.
        if (status != NODE_STATUS_STARTED) {
            if (status == NODE_STATUS_RECEIVING && statusTimer.ended()) {
                status = NODE_STATUS_STARTED;
                statusTimer.stop();
                Serial.printf("LightNode %s\n", status_code());
            } else {
                Serial.printf("broadcastMessage() - not started - %s\n", status_code());
                return;
            }
        }
        message->timebase = strip.timebase + millis();

#ifdef NODE_DEBUGGING
        Serial.print("  <<< ");
        printMessage(message, 0);
        Serial.println();
#endif

        auto success = espnowBroadcast.send((const uint8_t*)message, sizeof(*message));
        if (success) {
            lastTransmitMs = millis();
            if (transmittedPacketCount != UINT32_MAX) transmittedPacketCount++;
        }
#ifdef NODE_DEBUGGING
        if (!success) {
            Serial.println("espnowBroadcast.send() failed!");
        } else {
            Serial.println("successful broadcast");
        }
#endif

    }

  public:

    void sendCommand(CommandId command, void *data, uint8_t len) {
        // if (!ESP_NOW.isStarted()) {
        //     Serial.println("SendCommand ESP Not Started!");
        //     return;
        // }
        if (len > MESSAGE_DATA_SIZE) {
            Serial.printf("Message is too big: %d vs %d\n",
                len, MESSAGE_DATA_SIZE);
            return;
        }

        NodeMessage message;
        message.header = header;
        if (command == COMMAND_INFO) {
            message.recipients = RECIPIENTS_INFO;
        } else if (command == COMMAND_STATE) {
            message.recipients = RECIPIENTS_ALL;
        } else if (isFollowing()) {
            // Follower nodes must request that the root re-sends this message
            message.recipients = RECIPIENTS_ROOT;
        } else {
            message.recipients = RECIPIENTS_ALL;
        }
        message.command = command;
        memcpy(&message.data, data, len);
#ifdef NODE_DEBUGGING
        Serial.println("sendCommand");
#endif
        broadcastMessage(&message);
    }

    void setup() {
#ifdef NODE_DEBUGGING
        reset(TESTING_NODE_ID);
#else
        reset();
#endif


#ifdef NODE_DEBUGGING
        delay(2000);
#endif

        espnowBroadcast.registerFilter(onEspNowFilter);
        espnowBroadcast.registerObserver(onEspNowObserver);
        espnowBroadcast.registerCallback(onEspNowMessage);

        Serial.println("setup: ok");
    }

    void update() {

        //process any wifi events to turn on/off ESPNode
        updateESPNowState();

        // Drain RX-task peer samples; this loop task is the only observe() caller.
        while (peerSampleTail != peerSampleHead) {
            const PeerSample &sample = peerSampleRing[peerSampleTail];
            peerTelemetry.observe(sample.nodeId, sample.uplinkId, sample.rssi, millis());
            peerSampleTail = (peerSampleTail + 1) % PEER_SAMPLE_RING_SIZE;
        }

        // Check the last time we heard from the uplink node
        if (isFollowing() && uplinkTimer.ended()) {
            follow(NULL);
        }

#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
        mobileRoute.expire(millis());
        broadcastMobileRoute();
#endif
    }

#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
    bool hasMobileRoute() {
#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
        return mobileConductorAuthority.hasRoute(mobileRoute, millis());
#else
        return mobileRoute.valid(millis());
#endif
    }

    uint8_t mobileRouteShell() {
#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
        return mobileConductorAuthority.shell(mobileRoute, millis());
#else
        return mobileRoute.shell(millis());
#endif
    }
#endif

#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
    void setMobileConductorAuthority(bool enabled) {
        mobileConductorAuthority.setRoot(enabled);
    }
#endif

    void reset(MeshId id = 0) {
        if (id == 0) {
#if defined(LOLIN_WIFI_FIX) && (defined(ARDUINO_ARCH_ESP32C3) || defined(ARDUINO_ARCH_ESP32S2) || defined(ARDUINO_ARCH_ESP32S3))
            id = random(10, 255);  // Leave room at bottom and top of 12 bits
#else
            id = random(256, 4000);  // Leave room at bottom and top of 12 bits
#endif
        }
        header.id = id;
        follow(NULL);
    }

    void follow(const MeshNodeHeader* node) {
        if (node == NULL) {
            if (header.uplinkId != 0) {
                Serial.println("Uplink lost");
            }

            // Unfollow: following zero means you have no uplink
            header.uplinkId = 0;
            onMeshChange();
            return;
        }

        // Already following? ignore
        if (header.uplinkId == node->id)
            return;

        // Follow
        Serial.printf("Following %03X:%03X\n",
            node->id,
            node->uplinkId
        );
        header.uplinkId = node->id;
        onMeshChange();
    }

    bool isFollowing() const {
        return header.uplinkId != 0;
    }
    bool isLeading() const {
        // For now, leading mode is defined as being in re-broadcast mode for any reason.
        // Any node that thinks it has the highest ID is leading, but so are any nodes that
        // have seen another node that should be following the leader it is following.
        return !rebroadcastTimer.ended();
    }

protected:

#if defined(TUBES_ENABLE_SPATIAL_PATTERNS) || defined(TUBES_ENABLE_MOBILE_CONDUCTOR)
    uint32_t mobileRouteLastBroadcast = 0;
#endif
#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
    uint32_t mobileRouteSessionNonce = 0;
    uint32_t mobileRouteSequence = 0;
#endif

#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
    // AI: below section was generated by an AI
    // Sends only a locally selected, fresh route; legacy NodeMessage relay is separate.
    void broadcastMobileRoute() {
        const uint32_t now = millis();
        if (status != NODE_STATUS_STARTED || now - mobileRouteLastBroadcast < MOBILE_ROUTE_ADVERTISEMENT_MS) return;

        MobileRouteAdvertisement advertisement;
#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR
        if (mobileConductorAuthority.shouldOriginate()) {
            if (!mobileRouteSessionNonce) mobileRouteSessionNonce = esp_random();
            advertisement = makeMobileRouteAdvertisement(header.id, header.id, mobileRouteSessionNonce,
              ++mobileRouteSequence, 0, 0);
        } else {
            if (!mobileRoute.valid(now)) return;
            advertisement = makeMobileRouteAdvertisement(mobileRoute.conductorId(), header.id,
              mobileRoute.sessionNonce(), mobileRoute.sequence(), mobileRoute.shell(now), mobileRoute.cost());
        }
#else
        if (!mobileRoute.valid(now)) return;
        advertisement = makeMobileRouteAdvertisement(mobileRoute.conductorId(), header.id,
          mobileRoute.sessionNonce(), mobileRoute.sequence(), mobileRoute.shell(now), mobileRoute.cost());
#endif
        mobileRouteLastBroadcast = now;
        espnowBroadcast.send(reinterpret_cast<const uint8_t*>(&advertisement), sizeof(advertisement));
    }

    void onMobileRouteAdvertisement(const MobileRouteAdvertisement &advertisement, int8_t rssi) {
        if (advertisement.senderId == header.id || advertisement.conductorId == header.id) return;
        mobileRoute.observe(advertisement, rssi, millis());
    }
    // AI: end
#endif

    void updateESPNowState() {
        auto state = espnowBroadcast.getState();
        static auto prev = espnowBroadcast.STOPPED;
        switch(state) {
            case ESPNOWBroadcast::STOPPED:
                if (NODE_STATUS_QUIET != status) {
                    Serial.printf("updateESPNowState() - %d node_status:%s\n", state, status_code());
                    status = NODE_STATUS_QUIET;
                    rebroadcastTimer.stop();
                    Serial.printf("LightNode %s\n", status_code());
                }
                break;
            case ESPNOWBroadcast::STARTING: {}
                if ( state != prev ) {
                    Serial.printf("updateESPNowState() - %d node_status:%s\n", state, status_code());
                }
                break;
            case ESPNOWBroadcast::STARTED:
                if (NODE_STATUS_QUIET == status) {
                    Serial.printf("updateESPNowState() - %d node_status:%s\n", state, status_code());
                    status = NODE_STATUS_RECEIVING;
                    statusTimer.start(STATUS_TIMEOUT_BASE - header.id / 2);
                    Serial.printf("LightNode %s\n", status_code());
                }
                break;
            default:
                break;
        }
        prev = state;
    }

    typedef struct wizmote_message {
        uint8_t program;      // 0x91 for ON button, 0x81 for all others
        uint8_t seq[4];       // Incremetal sequence number 32 bit unsigned integer LSB first
        uint8_t byte5 = 32;   // Unknown
        uint8_t button;       // Identifies which button is being pressed
        uint8_t byte8 = 1;    // Unknown, but always 0x01
        uint8_t byte9 = 100;  // Unnkown, but always 0x64

        uint8_t byte10;  // Unknown, maybe checksum
        uint8_t byte11;  // Unknown, maybe checksum
        uint8_t byte12;  // Unknown, maybe checksum
        uint8_t byte13;  // Unknown, maybe checksum
    } wizmote_message;

    void onWizmote(const uint8_t* address, const wizmote_message* data, uint8_t len) {
        static uint32_t last_seq = 0;
        uint32_t cur_seq = data->seq[0] | (data->seq[1] << 8) | (data->seq[2] << 16) | (data->seq[3] << 24);
        if (cur_seq == last_seq)
            return;
        last_seq = cur_seq;

        receiver->onButton(data->button);
    }

    static void onEspNowMessage(const uint8_t *address, const uint8_t *msg, uint8_t len, int8_t rssi) {
        // basic length and field checking has been done in onEspNowFilter
        if (msg) {
#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
            if (len == sizeof(MobileRouteAdvertisement)) {
                MobileRouteAdvertisement advertisement;
                memcpy(&advertisement, msg, sizeof(advertisement));
                instance->onMobileRouteAdvertisement(advertisement, rssi);
                return;
            }
#endif
            if(len == sizeof(NodeMessage)) {
                instance->onPeerData(address, (const NodeMessage*)msg, len, rssi, true);
            } else if(len == sizeof(wizmote_message)) {
                instance->onWizmote(address, (const wizmote_message*)msg, len);
            } else {
#ifdef NODE_DEBUGGING
                Serial.printf("wrong size EspNowMessage received %d\n", len);
#endif
            }
        }
    }

    // Observe protocol-v2 state before routing/application admission can discard it.
    static void onEspNowObserver(const uint8_t *address, const uint8_t *msg, uint8_t len, int8_t rssi) {
        if (!instance || !msg || len != sizeof(NodeMessage)) return;
        const NodeMessage *message = reinterpret_cast<const NodeMessage *>(msg);
        if (message->header.version != CURRENT_NODE_VERSION || message->header.id == instance->header.id) return;
        // WiFi-task context: stage the sample; never touch the peer table here.
        const uint8_t head = instance->peerSampleHead;
        const uint8_t next = (head + 1) % PEER_SAMPLE_RING_SIZE;
        if (next == instance->peerSampleTail) return;  // ring full: drop the sample
        instance->peerSampleRing[head] = {message->header.id, message->header.uplinkId, rssi};
        instance->peerSampleHead = next;
    }

    static bool onEspNowFilter(const uint8_t *address, const uint8_t *msg, uint8_t len, int8_t rssi) {
#ifdef TUBES_ENABLE_SPATIAL_PATTERNS
        if (msg && len == sizeof(MobileRouteAdvertisement)) {
            MobileRouteAdvertisement advertisement;
            memcpy(&advertisement, msg, sizeof(advertisement));
            return isMobileRouteAdvertisement(advertisement);
        }
#endif
        if (len == sizeof(NodeMessage)) {
            return ((const NodeMessage*)msg)->header.version == instance->header.version;
        } else if (len == sizeof(wizmote_message)) {
            auto wizmote = (const wizmote_message*)msg;
            return !( wizmote->byte8 != 1 || wizmote->byte9 != 100 || wizmote->byte5 != 32);
        }
        return false;
    }
};

LightNode* LightNode::instance = nullptr;
