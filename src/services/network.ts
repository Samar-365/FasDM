import {
  UserProfile,
  PeerDevice,
  ChatMessage,
  NetworkPacket,
  TransportChannel,
  MessageStatus,
} from '../types';
import { dbEngine } from './db';

const CHANNEL_NAME = 'FasDM_Mesh_P2P_Transport';

type PeerListener = (peers: PeerDevice[]) => void;
type MessageListener = (message: ChatMessage) => void;
type TypingListener = (peerId: string, isTyping: boolean) => void;
type AckListener = (messageId: string, status: MessageStatus) => void;

export class P2PNetworkService {
  private broadcastChannel: BroadcastChannel | null = null;
  private currentUser: UserProfile | null = null;
  private discoveredPeers: Map<string, PeerDevice> = new Map();
  private beaconInterval: number | null = null;
  private activeChannel: TransportChannel = 'LAN';

  private peerListeners: Set<PeerListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private typingListeners: Set<TypingListener> = new Set();
  private ackListeners: Set<AckListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      this.broadcastChannel.onmessage = this.handleIncomingPacket.bind(this);
    }
  }

  /**
   * Initializes the P2P network service with the user's profile identity
   */
  async start(user: UserProfile) {
    this.currentUser = user;
    
    // Load previously saved peers from IndexedDB
    try {
      const savedPeers = await dbEngine.getAllPeers();
      savedPeers.forEach((p) => {
        // Mark as discovered initially until beacon seen
        this.discoveredPeers.set(p.deviceId, { ...p, status: 'discovered' });
      });
      this.notifyPeerListeners();
    } catch (err) {
      console.warn('Failed to load saved peers from DB:', err);
    }

    // Start periodic beaconing
    this.sendDiscoveryBeacon();
    if (this.beaconInterval) clearInterval(this.beaconInterval);
    this.beaconInterval = window.setInterval(() => {
      this.sendDiscoveryBeacon();
    }, 3000);
  }

  /**
   * Stops beaconing and closes channel
   */
  stop() {
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }
  }

  /**
   * Clears saved peer list and IndexedDB peers store
   */
  async clearAllPeers() {
    this.discoveredPeers.clear();
    const db = await dbEngine.clearAllData();
    if (this.currentUser) {
      await dbEngine.saveProfile(this.currentUser);
    }
    this.notifyPeerListeners();
  }

  /**
   * Updates preferred active channel priority (LAN -> Wi-Fi Direct -> Bluetooth)
   */
  setTransportChannel(channel: TransportChannel) {
    this.activeChannel = channel;
    this.sendDiscoveryBeacon();
  }

  getTransportChannel(): TransportChannel {
    return this.activeChannel;
  }

  /**
   * Event Listener Subscriptions
   */
  subscribePeers(listener: PeerListener) {
    this.peerListeners.add(listener);
    listener(Array.from(this.discoveredPeers.values()));
    return () => this.peerListeners.delete(listener);
  }

  subscribeMessages(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  subscribeTyping(listener: TypingListener) {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  subscribeAck(listener: AckListener) {
    this.ackListeners.add(listener);
    return () => this.ackListeners.delete(listener);
  }

  private notifyPeerListeners() {
    const list = Array.from(this.discoveredPeers.values());
    this.peerListeners.forEach((fn) => fn(list));
  }

  /**
   * Sends discovery beacon packet across P2P transport
   */
  sendDiscoveryBeacon() {
    if (!this.currentUser || !this.broadcastChannel) return;

    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'DISCOVERY_BEACON',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      payload: {
        lastSeen: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.broadcastChannel.postMessage(packet);
  }

  /**
   * Sends PEER_HELLO greeting response directly to discovered node
   */
  sendPeerHello(recipientUserId: string) {
    if (!this.currentUser || !this.broadcastChannel) return;

    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'PEER_HELLO',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId: recipientUserId,
      payload: {
        lastSeen: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.broadcastChannel.postMessage(packet);
  }

  /**
   * Processes incoming network packet
   */
  private async handleIncomingPacket(event: MessageEvent<NetworkPacket>) {
    const packet = event.data;
    if (!packet || !packet.sender || !this.currentUser) return;

    // Ignore self-packets
    if (packet.sender.userId === this.currentUser.userId) return;

    switch (packet.type) {
      case 'DISCOVERY_BEACON':
        await this.handlePeerBeacon(packet);
        // Instantly reply with PEER_HELLO so the sender discovers us immediately without waiting for cron interval
        this.sendPeerHello(packet.sender.userId);
        break;

      case 'PEER_HELLO':
        await this.handlePeerBeacon(packet);
        break;

      case 'CHAT_MESSAGE':
        await this.handleIncomingChatMessage(packet);
        break;

      case 'TYPING_STATUS':
        if (!packet.recipientId || packet.recipientId === this.currentUser.userId) {
          this.typingListeners.forEach((fn) =>
            fn(packet.sender.userId, Boolean(packet.payload?.isTyping))
          );
        }
        break;

      case 'MSG_ACK':
      case 'MSG_READ':
        if (packet.recipientId === this.currentUser.userId) {
          const { messageId, status } = packet.payload;
          await dbEngine.updateMessageStatus(messageId, status);
          this.ackListeners.forEach((fn) => fn(messageId, status));
        }
        break;

      default:
        break;
    }
  }

  /**
   * Registers/updates peer discovery
   */
  private async handlePeerBeacon(packet: NetworkPacket) {
    if (this.currentUser && packet.sender.userId === this.currentUser.userId) return;
    const { userId, username, avatar, connectionType } = packet.sender;
    const existing = this.discoveredPeers.get(userId);

    const peerObj: PeerDevice = {
      deviceId: userId,
      username,
      avatar,
      connectionType: connectionType || 'LAN',
      lastSeen: Date.now(),
      status: 'connected',
      rssi: existing?.rssi || Math.floor(Math.random() * 25) - 65, // -65 dBm average
      latencyMs: existing?.latencyMs || Math.floor(Math.random() * 20) + 5,
    };

    this.discoveredPeers.set(userId, peerObj);
    await dbEngine.savePeer(peerObj);
    this.notifyPeerListeners();
  }

  /**
   * Sends direct text message to recipient peer
   */
  async sendMessage(
    recipientPeer: PeerDevice,
    content: string,
    channel: TransportChannel = this.activeChannel
  ): Promise<ChatMessage> {
    if (!this.currentUser) throw new Error('Identity not initialized');

    const messageId = crypto.randomUUID();

    const message: ChatMessage = {
      messageId,
      senderId: this.currentUser.userId,
      receiverId: recipientPeer.deviceId,
      content,
      timestamp: Date.now(),
      status: 'sent',
      channel,
    };

    // Save to local IndexedDB
    await dbEngine.saveMessage(message);

    // Broadcast across P2P transport
    if (this.broadcastChannel) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'CHAT_MESSAGE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: channel,
        },
        recipientId: recipientPeer.deviceId,
        payload: {
          messageId,
          content,
          channel,
        },
        timestamp: Date.now(),
      };

      this.broadcastChannel.postMessage(packet);
    }

    // Handle simulated peer auto-responses
    if (recipientPeer.isSimulated) {
      this.triggerSimulatedPeerReply(recipientPeer, content);
    }

    return message;
  }

  /**
   * Handles incoming chat message from P2P packet
   */
  private async handleIncomingChatMessage(packet: NetworkPacket) {
    if (!this.currentUser) return;
    if (packet.recipientId !== this.currentUser.userId) return;

    const { messageId, content, channel } = packet.payload;

    const incomingMsg: ChatMessage = {
      messageId,
      senderId: packet.sender.userId,
      receiverId: this.currentUser.userId,
      content: content || '',
      timestamp: packet.timestamp || Date.now(),
      status: 'delivered',
      channel: channel || packet.sender.connectionType || 'LAN',
    };

    // Save message locally
    await dbEngine.saveMessage(incomingMsg);

    // Send Delivery Acknowledgement back to sender (FR-8)
    this.sendAck(packet.sender.userId, messageId, 'delivered');

    // Notify UI message listeners
    this.messageListeners.forEach((fn) => fn(incomingMsg));
  }

  /**
   * Sends Typing Status notification (FR-9)
   */
  sendTypingStatus(recipientPeerId: string, isTyping: boolean) {
    if (!this.currentUser || !this.broadcastChannel) return;

    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'TYPING_STATUS',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId: recipientPeerId,
      payload: { isTyping },
      timestamp: Date.now(),
    };

    this.broadcastChannel.postMessage(packet);
  }

  /**
   * Sends Message Acknowledgement status ('delivered' | 'read') (FR-8)
   */
  sendAck(recipientUserId: string, messageId: string, status: MessageStatus) {
    if (!this.currentUser || !this.broadcastChannel) return;

    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: status === 'read' ? 'MSG_READ' : 'MSG_ACK',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId: recipientUserId,
      payload: { messageId, status },
      timestamp: Date.now(),
    };

    this.broadcastChannel.postMessage(packet);
  }

  /**
   * Adds or generates a simulated local peer for testing multi-device P2P discovery
   */
  async createSimulatedPeer(name: string, connectionType: TransportChannel): Promise<PeerDevice> {
    const simulatedId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const simulatedPeer: PeerDevice = {
      deviceId: simulatedId,
      username: name,
      avatar: ['#0284c7', '#7c3aed', '#059669', '#d97706', '#e11d48'][Math.floor(Math.random() * 5)],
      connectionType,
      lastSeen: Date.now(),
      status: 'connected',
      rssi: -45 - Math.floor(Math.random() * 30),
      latencyMs: connectionType === 'LAN' ? 8 : connectionType === 'Wi-Fi Direct' ? 14 : 45,
      isSimulated: true,
    };

    this.discoveredPeers.set(simulatedId, simulatedPeer);
    await dbEngine.savePeer(simulatedPeer);
    this.notifyPeerListeners();

    return simulatedPeer;
  }

  /**
   * Triggers automated reply workflow for simulated peers with typing indicators and read receipts
   */
  private triggerSimulatedPeerReply(peer: PeerDevice, userMsgText: string) {
    // 1. Send 'delivered' status update
    setTimeout(() => {
      this.ackListeners.forEach((fn) => fn(peer.deviceId, 'delivered'));
    }, 600);

    // 2. Start typing indicator
    setTimeout(() => {
      this.typingListeners.forEach((fn) => fn(peer.deviceId, true));
    }, 1200);

    // 3. Stop typing and send reply
    setTimeout(async () => {
      this.typingListeners.forEach((fn) => fn(peer.deviceId, false));

      const responses = [
        `Received via local ${peer.connectionType} channel!`,
        `FasDM Mesh active. Zero internet routing required! 🚀`,
        `Direct P2P payload confirmed on ${peer.connectionType}.`,
        `Got it! "${userMsgText}" received in ${peer.latencyMs || 12}ms.`,
      ];

      const replyText = responses[Math.floor(Math.random() * responses.length)];
      const replyMsgId = crypto.randomUUID();

      const replyMessage: ChatMessage = {
        messageId: replyMsgId,
        senderId: peer.deviceId,
        receiverId: this.currentUser?.userId || '',
        content: replyText,
        timestamp: Date.now(),
        status: 'delivered',
        channel: peer.connectionType,
      };

      await dbEngine.saveMessage(replyMessage);
      this.messageListeners.forEach((fn) => fn(replyMessage));
    }, 3200);
  }
}

export const networkService = new P2PNetworkService();

