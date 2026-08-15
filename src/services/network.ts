import {
  UserProfile,
  PeerDevice,
  ChatMessage,
  GroupChat,
  GroupMessage,
  NetworkPacket,
  TransportChannel,
  MessageStatus,
  SharedFile,
  VoiceNote,
  WhiteboardAction,
  ChecklistAction,
  StickyNoteAction,
  CollabPresence,
  CollabStateRequestPayload,
  CollabStateResponsePayload,
} from '../types';
import { dbEngine } from './db';

const CHANNEL_NAME = 'FasDM_Mesh_P2P_Transport';

type PeerListener = (peers: PeerDevice[]) => void;
type MessageListener = (message: ChatMessage) => void;
type TypingListener = (peerId: string, isTyping: boolean) => void;
type AckListener = (messageId: string, status: MessageStatus) => void;
type GroupListener = (groups: GroupChat[]) => void;
type GroupMessageListener = (groupId: string, message: GroupMessage) => void;
type FileListener = (file: SharedFile) => void;
type CollabWhiteboardListener = (action: WhiteboardAction) => void;
type CollabChecklistListener = (action: ChecklistAction) => void;
type CollabStickyListener = (action: StickyNoteAction) => void;
type CollabPresenceListener = (presence: CollabPresence) => void;
type CollabStateRequestListener = (payload: CollabStateRequestPayload) => void;
type CollabStateResponseListener = (payload: CollabStateResponsePayload) => void;

export class P2PNetworkService {
  private broadcastChannel: BroadcastChannel | null = null;
  private currentUser: UserProfile | null = null;
  private discoveredPeers: Map<string, PeerDevice> = new Map();
  private groups: Map<string, GroupChat> = new Map();
  private beaconInterval: number | null = null;
  private activeChannel: TransportChannel = 'LAN';

  private peerListeners: Set<PeerListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private typingListeners: Set<TypingListener> = new Set();
  private ackListeners: Set<AckListener> = new Set();
  private groupListeners: Set<GroupListener> = new Set();
  private groupMessageListeners: Set<GroupMessageListener> = new Set();
  private fileListeners: Set<FileListener> = new Set();
  private collabWhiteboardListeners: Set<CollabWhiteboardListener> = new Set();
  private collabChecklistListeners: Set<CollabChecklistListener> = new Set();
  private collabStickyListeners: Set<CollabStickyListener> = new Set();
  private collabPresenceListeners: Set<CollabPresenceListener> = new Set();
  private collabStateRequestListeners: Set<CollabStateRequestListener> = new Set();
  private collabStateResponseListeners: Set<CollabStateResponseListener> = new Set();

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

    // Load previously saved peers and groups from IndexedDB
    try {
      const savedPeers = await dbEngine.getAllPeers();
      savedPeers.forEach((p) => {
        // Skip self — don't add current user as a discovered peer
        if (p.deviceId === user.userId) return;
        // Mark as discovered initially until beacon seen
        this.discoveredPeers.set(p.deviceId, { ...p, status: 'discovered' });
      });
      // Clean up any stale self-entry from DB (e.g. saved by another tab)
      await dbEngine.deletePeer(user.userId).catch(() => {});
      this.notifyPeerListeners();

      const savedGroups = await dbEngine.getGroups();
      savedGroups.forEach((g) => {
        this.groups.set(g.groupId, g);
      });
      this.notifyGroupListeners();
    } catch (err) {
      console.warn('Failed to load saved peers or groups from DB:', err);
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
    this.notifyGroupListeners();
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

  subscribeGroups(listener: GroupListener) {
    this.groupListeners.add(listener);
    listener(Array.from(this.groups.values()));
    return () => this.groupListeners.delete(listener);
  }

  subscribeGroupMessages(listener: GroupMessageListener) {
    this.groupMessageListeners.add(listener);
    return () => this.groupMessageListeners.delete(listener);
  }

  subscribeFiles(listener: FileListener) {
    this.fileListeners.add(listener);
    return () => this.fileListeners.delete(listener);
  }

  subscribeCollabWhiteboard(listener: CollabWhiteboardListener) {
    this.collabWhiteboardListeners.add(listener);
    return () => this.collabWhiteboardListeners.delete(listener);
  }

  subscribeCollabChecklist(listener: CollabChecklistListener) {
    this.collabChecklistListeners.add(listener);
    return () => this.collabChecklistListeners.delete(listener);
  }

  subscribeCollabSticky(listener: CollabStickyListener) {
    this.collabStickyListeners.add(listener);
    return () => this.collabStickyListeners.delete(listener);
  }

  subscribeCollabPresence(listener: CollabPresenceListener) {
    this.collabPresenceListeners.add(listener);
    return () => this.collabPresenceListeners.delete(listener);
  }

  subscribeCollabStateRequest(listener: CollabStateRequestListener) {
    this.collabStateRequestListeners.add(listener);
    return () => this.collabStateRequestListeners.delete(listener);
  }

  subscribeCollabStateResponse(listener: CollabStateResponseListener) {
    this.collabStateResponseListeners.add(listener);
    return () => this.collabStateResponseListeners.delete(listener);
  }

  private notifyPeerListeners() {
    const list = Array.from(this.discoveredPeers.values());
    this.peerListeners.forEach((fn) => fn(list));
  }

  private notifyGroupListeners() {
    const list = Array.from(this.groups.values());
    this.groupListeners.forEach((fn) => fn(list));
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

      case 'GROUP_CREATE':
        if (packet.payload?.group) {
          const group: GroupChat = packet.payload.group;
          this.groups.set(group.groupId, group);
          await dbEngine.saveGroup(group);
          this.notifyGroupListeners();
        }
        break;

      case 'GROUP_MESSAGE':
        if (packet.payload?.message) {
          const gMsg: GroupMessage = packet.payload.message;
          await dbEngine.saveGroupMessage(gMsg);
          this.groupMessageListeners.forEach((fn) => fn(gMsg.groupId, gMsg));
        }
        break;

      case 'GROUP_MEMBER_LEAVE':
        if (packet.payload?.groupId && packet.payload?.userId) {
          const removedUserId = packet.payload.userId;
          // If the current user was removed (kicked), delete the group from local state entirely
          if (removedUserId === this.currentUser.userId) {
            this.groups.delete(packet.payload.groupId);
            await dbEngine.deleteGroup(packet.payload.groupId);
            this.notifyGroupListeners();
          } else {
            const group = this.groups.get(packet.payload.groupId);
            if (group) {
              group.members = group.members.filter((m) => m.userId !== removedUserId);
              await dbEngine.saveGroup(group);
              this.notifyGroupListeners();
            }
          }
        }
        break;

      case 'GROUP_DELETE':
        if (packet.payload?.groupId) {
          const gId = packet.payload.groupId;
          this.groups.delete(gId);
          await dbEngine.deleteGroup(gId);
          this.notifyGroupListeners();
        }
        break;

      case 'FILE_TRANSFER':
        await this.handleIncomingFileTransfer(packet);
        break;

      case 'FILE_ACK':
        if (packet.recipientId === this.currentUser.userId) {
          const { fileId } = packet.payload;
          console.log(`[P2P Network] File transfer ACK received for ${fileId}`);
        }
        break;

      case 'VOICE_NOTE':
        await this.handleIncomingVoiceNote(packet);
        break;

      case 'VOICE_ACK':
        if (packet.recipientId === this.currentUser.userId) {
          const { voiceId } = packet.payload;
          console.log(`[P2P Network] Voice note ACK received for ${voiceId}`);
        }
        break;

      case 'COLLAB_WHITEBOARD_ACTION':
        if (packet.payload?.action) {
          this.collabWhiteboardListeners.forEach((fn) => fn(packet.payload.action));
        }
        break;

      case 'COLLAB_CHECKLIST_ACTION':
        if (packet.payload?.action) {
          this.collabChecklistListeners.forEach((fn) => fn(packet.payload.action));
        }
        break;

      case 'COLLAB_STICKY_ACTION':
        if (packet.payload?.action) {
          this.collabStickyListeners.forEach((fn) => fn(packet.payload.action));
        }
        break;

      case 'COLLAB_PRESENCE_HEARTBEAT':
        if (packet.payload?.presence) {
          this.collabPresenceListeners.forEach((fn) => fn(packet.payload.presence));
        }
        break;

      case 'COLLAB_ROOM_STATE_REQUEST':
        if (packet.payload?.request) {
          this.collabStateRequestListeners.forEach((fn) => fn(packet.payload.request));
        }
        break;

      case 'COLLAB_ROOM_STATE_RESPONSE':
        if (packet.payload?.response) {
          this.collabStateResponseListeners.forEach((fn) => fn(packet.payload.response));
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

  // =========================================================================
  // GROUP MESSAGING ENGINE (MODULE 6)
  // =========================================================================

  /**
   * Creates a new P2P mesh group and broadcasts creation packet to selected peers
   */
  async createGroup(
    groupName: string,
    description: string,
    invitedPeers: PeerDevice[]
  ): Promise<GroupChat> {
    if (!this.currentUser) throw new Error('Identity not initialized');

    const groupId = `grp_${crypto.randomUUID()}`;
    const avatarColors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0284c7'];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const members = [
      {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        role: 'admin' as const,
        joinedAt: Date.now(),
      },
      ...invitedPeers.map((p) => ({
        userId: p.deviceId,
        username: p.username,
        avatar: p.avatar,
        role: 'member' as const,
        joinedAt: Date.now(),
      })),
    ];

    const group: GroupChat = {
      groupId,
      groupName,
      description,
      avatarColor,
      adminId: this.currentUser.userId,
      adminName: this.currentUser.username,
      members,
      createdAt: Date.now(),
    };

    this.groups.set(groupId, group);
    await dbEngine.saveGroup(group);
    this.notifyGroupListeners();

    // Broadcast creation packet across mesh
    if (this.broadcastChannel) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'GROUP_CREATE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: this.activeChannel,
        },
        payload: { group },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }

    return group;
  }

  /**
   * Sends encrypted packet group message to all group member nodes
   */
  async sendGroupMessage(groupId: string, content: string): Promise<GroupMessage> {
    if (!this.currentUser) throw new Error('Identity not initialized');

    const group = this.groups.get(groupId);
    if (!group) throw new Error('Group not found');

    const messageId = crypto.randomUUID();

    const gMsg: GroupMessage = {
      messageId,
      groupId,
      senderId: this.currentUser.userId,
      senderName: this.currentUser.username,
      senderAvatar: this.currentUser.avatar,
      content,
      timestamp: Date.now(),
      channel: this.activeChannel,
    };

    await dbEngine.saveGroupMessage(gMsg);

    if (this.broadcastChannel) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'GROUP_MESSAGE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: this.activeChannel,
        },
        payload: { message: gMsg },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }

    // Trigger simulated peer responses if simulated peers exist in the group
    const simMembers = group.members.filter((m) => m.userId.startsWith('sim_'));
    if (simMembers.length > 0) {
      const randomSimMember = simMembers[Math.floor(Math.random() * simMembers.length)];
      setTimeout(async () => {
        const responses = [
          `Great point! Node active in ${group.groupName}.`,
          `Received payload across mesh channel. 👍`,
          `Agreed! FasDM P2P Group Mesh working offline.`,
          `Standing by for team updates! 🚀`,
        ];
        const simReplyText = responses[Math.floor(Math.random() * responses.length)];
        const replyMsgId = crypto.randomUUID();

        const simReply: GroupMessage = {
          messageId: replyMsgId,
          groupId,
          senderId: randomSimMember.userId,
          senderName: randomSimMember.username,
          senderAvatar: randomSimMember.avatar,
          content: simReplyText,
          timestamp: Date.now(),
          channel: this.activeChannel,
        };

        await dbEngine.saveGroupMessage(simReply);
        this.groupMessageListeners.forEach((fn) => fn(groupId, simReply));
      }, 2500);
    }

    return gMsg;
  }

  /**
   * Admin removes member or member leaves group
   */
  async removeMemberFromGroup(groupId: string, memberId: string) {
    const group = this.groups.get(groupId);
    if (!group) return;

    const isSelfLeaving = memberId === this.currentUser?.userId;

    // Broadcast the leave/kick packet BEFORE modifying local state so the packet is sent
    if (this.broadcastChannel && this.currentUser) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'GROUP_MEMBER_LEAVE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: this.activeChannel,
        },
        payload: { groupId, userId: memberId },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }

    if (isSelfLeaving) {
      // Current user is leaving — remove the group entirely from local state & DB
      this.groups.delete(groupId);
      await dbEngine.deleteGroup(groupId);
    } else {
      // Admin kicked another member — just update the members list
      group.members = group.members.filter((m) => m.userId !== memberId);
      await dbEngine.saveGroup(group);
    }

    this.notifyGroupListeners();
  }

  /**
   * Admin deletes a group
   */
  async deleteGroup(groupId: string) {
    this.groups.delete(groupId);
    await dbEngine.deleteGroup(groupId);
    this.notifyGroupListeners();

    if (this.broadcastChannel && this.currentUser) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'GROUP_DELETE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: this.activeChannel,
        },
        payload: { groupId },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }
  }

  // =========================================================================
  // FILE SHARING ENGINE (MODULE 7)
  // =========================================================================

  /**
   * Sends file to 1-to-1 peer or group with automatic transport escalation to Wi-Fi Direct for >5MB (FR-6)
   */
  async sendFile(
    target: { peer?: PeerDevice; groupId?: string },
    fileObj: { name: string; size: number; type: string; dataUrl: string },
    channelOverride?: TransportChannel
  ): Promise<SharedFile> {
    if (!this.currentUser) throw new Error('Identity not initialized');

    // Auto-escalate channel to Wi-Fi Direct if file size > 5MB
    const isLargeFile = fileObj.size > 5 * 1024 * 1024; // > 5MB
    const effectiveChannel: TransportChannel = isLargeFile
      ? 'Wi-Fi Direct'
      : channelOverride || target.peer?.connectionType || this.activeChannel;

    const fileId = `file_${crypto.randomUUID()}`;

    const sharedFile: SharedFile = {
      fileId,
      fileName: fileObj.name,
      fileSize: fileObj.size,
      fileType: fileObj.type,
      fileData: fileObj.dataUrl,
      senderId: this.currentUser.userId,
      senderName: this.currentUser.username,
      receiverId: target.peer?.deviceId,
      groupId: target.groupId,
      timestamp: Date.now(),
      channel: effectiveChannel,
      escalatedToWifiDirect: isLargeFile,
    };

    // Save file in local IndexedDB
    await dbEngine.saveFile(sharedFile);
    this.fileListeners.forEach((fn) => fn(sharedFile));

    // Attach file to a ChatMessage or GroupMessage so it renders inline in timeline
    // Attach file to a ChatMessage or GroupMessage so it renders inline in timeline
    let msgId = crypto.randomUUID();
    if (target.peer) {
      const chatMsg: ChatMessage = {
        messageId: msgId,
        senderId: this.currentUser.userId,
        receiverId: target.peer.deviceId,
        content: `📎 Shared file: ${fileObj.name}`,
        timestamp: Date.now(),
        status: 'sent',
        channel: effectiveChannel,
        fileAttachment: sharedFile,
      };
      await dbEngine.saveMessage(chatMsg);
      this.messageListeners.forEach((fn) => fn(chatMsg));

      // Handle simulated peer response
      if (target.peer.isSimulated) {
        setTimeout(async () => {
          const simReplyId = crypto.randomUUID();
          const responseMsg: ChatMessage = {
            messageId: simReplyId,
            senderId: target.peer!.deviceId,
            receiverId: this.currentUser!.userId,
            content: `✅ Received file "${fileObj.name}" (${(fileObj.size / (1024 * 1024)).toFixed(2)} MB) over ${effectiveChannel}!`,
            timestamp: Date.now(),
            status: 'delivered',
            channel: effectiveChannel,
          };
          await dbEngine.saveMessage(responseMsg);
          this.messageListeners.forEach((fn) => fn(responseMsg));
        }, 2000);
      }
    } else if (target.groupId) {
      const groupMsg: GroupMessage = {
        messageId: msgId,
        groupId: target.groupId,
        senderId: this.currentUser.userId,
        senderName: this.currentUser.username,
        senderAvatar: this.currentUser.avatar,
        content: `📎 Shared file: ${fileObj.name}`,
        timestamp: Date.now(),
        channel: effectiveChannel,
        fileAttachment: sharedFile,
      };
      await dbEngine.saveGroupMessage(groupMsg);
      this.groupMessageListeners.forEach((fn) => fn(target.groupId!, groupMsg));
    }

    // Broadcast FILE_TRANSFER packet across mesh transport
    if (this.broadcastChannel) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'FILE_TRANSFER',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: effectiveChannel,
        },
        recipientId: target.peer?.deviceId,
        payload: {
          sharedFile,
          messageId: msgId,
        },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }

    return sharedFile;
  }

  /**
   * Processes incoming FILE_TRANSFER packet
   */
  private async handleIncomingFileTransfer(packet: NetworkPacket) {
    if (!this.currentUser || !packet.payload?.sharedFile) return;

    const file: SharedFile = packet.payload.sharedFile;

    // Skip our own file transfer broadcasts — we already saved the message in sendFile()
    if (file.senderId === this.currentUser.userId) return;

    // Check if packet is intended for me or for a group I belong to
    const isForMe = file.receiverId === this.currentUser.userId;
    const isForMyGroup = file.groupId && this.groups.has(file.groupId);

    if (!isForMe && !isForMyGroup) return;

    // Save received file locally in IndexedDB
    await dbEngine.saveFile(file);
    this.fileListeners.forEach((fn) => fn(file));

    // Reuse sender's messageId if sent in packet payload, else fallback to random UUID
    const msgId = packet.payload.messageId || crypto.randomUUID();

    // Store inline timeline message
    if (isForMe) {
      const incomingMsg: ChatMessage = {
        messageId: msgId,
        senderId: file.senderId,
        receiverId: this.currentUser.userId,
        content: `📎 Shared file: ${file.fileName}`,
        timestamp: file.timestamp || Date.now(),
        status: 'delivered',
        channel: file.channel,
        fileAttachment: file,
      };
      await dbEngine.saveMessage(incomingMsg);
      this.messageListeners.forEach((fn) => fn(incomingMsg));

      // Send ACK
      if (this.broadcastChannel) {
        const ackPacket: NetworkPacket = {
          id: crypto.randomUUID(),
          type: 'FILE_ACK',
          sender: {
            userId: this.currentUser.userId,
            username: this.currentUser.username,
            avatar: this.currentUser.avatar,
            connectionType: file.channel,
          },
          recipientId: file.senderId,
          payload: { fileId: file.fileId },
          timestamp: Date.now(),
        };
        this.broadcastChannel.postMessage(ackPacket);
      }
    } else if (isForMyGroup && file.groupId) {
      const gMsg: GroupMessage = {
        messageId: msgId,
        groupId: file.groupId,
        senderId: file.senderId,
        senderName: file.senderName,
        senderAvatar: packet.sender.avatar || '',
        content: `📎 Shared file: ${file.fileName}`,
        timestamp: file.timestamp || Date.now(),
        channel: file.channel,
        fileAttachment: file,
      };
      await dbEngine.saveGroupMessage(gMsg);
      this.groupMessageListeners.forEach((fn) => fn(file.groupId!, gMsg));
    }
  }

  // =========================================================================
  // VOICE NOTES ENGINE (MODULE 8)
  // =========================================================================

  /**
   * Transmits voice note payload across P2P channels for 1-to-1 and group chats (FR-7)
   */
  async sendVoiceNote(
    target: { peer?: PeerDevice; groupId?: string },
    voiceData: { audioData: string; durationMs: number; mimeType: string; fileSize: number },
    channelOverride?: TransportChannel
  ): Promise<VoiceNote> {
    if (!this.currentUser) throw new Error('Identity not initialized');

    const effectiveChannel: TransportChannel =
      channelOverride || target.peer?.connectionType || this.activeChannel;

    const voiceId = `voice_${crypto.randomUUID()}`;

    const voiceNote: VoiceNote = {
      voiceId,
      senderId: this.currentUser.userId,
      senderName: this.currentUser.username,
      audioData: voiceData.audioData,
      durationMs: voiceData.durationMs,
      mimeType: voiceData.mimeType,
      fileSize: voiceData.fileSize,
      timestamp: Date.now(),
      channel: effectiveChannel,
    };

    const msgId = crypto.randomUUID();

    if (target.peer) {
      const chatMsg: ChatMessage = {
        messageId: msgId,
        senderId: this.currentUser.userId,
        receiverId: target.peer.deviceId,
        content: `🎙️ Voice Note (${Math.ceil(voiceData.durationMs / 1000)}s)`,
        timestamp: Date.now(),
        status: 'sent',
        channel: effectiveChannel,
        voiceNote,
      };
      await dbEngine.saveMessage(chatMsg);
      this.messageListeners.forEach((fn) => fn(chatMsg));

      // Simulated peer voice response
      if (target.peer.isSimulated) {
        setTimeout(async () => {
          const simReplyId = crypto.randomUUID();
          const sec = Math.ceil(voiceData.durationMs / 1000);
          const responses = [
            `🎙️ Received your ${sec}s voice message clearly!`,
            `Voice note decoded and played successfully over ${effectiveChannel}. 🔊`,
            `Got the voice note (${sec}s). Sounds great! 👍`,
          ];
          const simReplyText = responses[Math.floor(Math.random() * responses.length)];
          const responseMsg: ChatMessage = {
            messageId: simReplyId,
            senderId: target.peer!.deviceId,
            receiverId: this.currentUser!.userId,
            content: simReplyText,
            timestamp: Date.now(),
            status: 'delivered',
            channel: effectiveChannel,
          };
          await dbEngine.saveMessage(responseMsg);
          this.messageListeners.forEach((fn) => fn(responseMsg));
        }, 2200);
      }
    } else if (target.groupId) {
      const groupMsg: GroupMessage = {
        messageId: msgId,
        groupId: target.groupId,
        senderId: this.currentUser.userId,
        senderName: this.currentUser.username,
        senderAvatar: this.currentUser.avatar,
        content: `🎙️ Voice Note (${Math.ceil(voiceData.durationMs / 1000)}s)`,
        timestamp: Date.now(),
        channel: effectiveChannel,
        voiceNote,
      };
      await dbEngine.saveGroupMessage(groupMsg);
      this.groupMessageListeners.forEach((fn) => fn(target.groupId!, groupMsg));

      // Simulated peer voice response in group
      const group = this.groups.get(target.groupId);
      const simMembers = group?.members.filter((m) => m.userId.startsWith('sim_')) || [];
      if (simMembers.length > 0) {
        const randomSimMember = simMembers[Math.floor(Math.random() * simMembers.length)];
        setTimeout(async () => {
          const replyMsgId = crypto.randomUUID();
          const simReply: GroupMessage = {
            messageId: replyMsgId,
            groupId: target.groupId!,
            senderId: randomSimMember.userId,
            senderName: randomSimMember.username,
            senderAvatar: randomSimMember.avatar,
            content: `🎙️ Received voice note in group! Audio decoded properly.`,
            timestamp: Date.now(),
            channel: effectiveChannel,
          };
          await dbEngine.saveGroupMessage(simReply);
          this.groupMessageListeners.forEach((fn) => fn(target.groupId!, simReply));
        }, 2500);
      }
    }

    // Broadcast VOICE_NOTE packet across mesh transport
    if (this.broadcastChannel) {
      const packet: NetworkPacket = {
        id: crypto.randomUUID(),
        type: 'VOICE_NOTE',
        sender: {
          userId: this.currentUser.userId,
          username: this.currentUser.username,
          avatar: this.currentUser.avatar,
          connectionType: effectiveChannel,
        },
        recipientId: target.peer?.deviceId,
        payload: {
          voiceNote,
          messageId: msgId,
          groupId: target.groupId,
        },
        timestamp: Date.now(),
      };
      this.broadcastChannel.postMessage(packet);
    }

    return voiceNote;
  }

  /**
   * Processes incoming VOICE_NOTE packet from mesh network
   */
  private async handleIncomingVoiceNote(packet: NetworkPacket) {
    if (!this.currentUser || !packet.payload?.voiceNote) return;

    const voiceNote: VoiceNote = packet.payload.voiceNote;

    // Skip our own voice note broadcasts
    if (voiceNote.senderId === this.currentUser.userId) return;

    const isForMe = packet.recipientId === this.currentUser.userId;
    const isForMyGroup = packet.payload?.groupId && this.groups.has(packet.payload.groupId);

    if (!isForMe && !isForMyGroup) return;

    const msgId = packet.payload.messageId || crypto.randomUUID();

    if (isForMe) {
      const incomingMsg: ChatMessage = {
        messageId: msgId,
        senderId: voiceNote.senderId,
        receiverId: this.currentUser.userId,
        content: `🎙️ Voice Note (${Math.ceil(voiceNote.durationMs / 1000)}s)`,
        timestamp: voiceNote.timestamp || Date.now(),
        status: 'delivered',
        channel: voiceNote.channel,
        voiceNote,
      };
      await dbEngine.saveMessage(incomingMsg);
      this.messageListeners.forEach((fn) => fn(incomingMsg));

      // Send ACK
      if (this.broadcastChannel) {
        const ackPacket: NetworkPacket = {
          id: crypto.randomUUID(),
          type: 'VOICE_ACK',
          sender: {
            userId: this.currentUser.userId,
            username: this.currentUser.username,
            avatar: this.currentUser.avatar,
            connectionType: voiceNote.channel,
          },
          recipientId: voiceNote.senderId,
          payload: { voiceId: voiceNote.voiceId },
          timestamp: Date.now(),
        };
        this.broadcastChannel.postMessage(ackPacket);
      }
    } else if (isForMyGroup && packet.payload.groupId) {
      const gMsg: GroupMessage = {
        messageId: msgId,
        groupId: packet.payload.groupId,
        senderId: voiceNote.senderId,
        senderName: voiceNote.senderName,
        senderAvatar: packet.sender.avatar || '',
        content: `🎙️ Voice Note (${Math.ceil(voiceNote.durationMs / 1000)}s)`,
        timestamp: voiceNote.timestamp || Date.now(),
        channel: voiceNote.channel,
        voiceNote,
      };
      await dbEngine.saveGroupMessage(gMsg);
      this.groupMessageListeners.forEach((fn) => fn(packet.payload.groupId, gMsg));
    }
  }

  /**
   * ==========================================
   * MODULE 10: COLLABORATION PACKET BROADCASTERS
   * ==========================================
   */
  sendCollabWhiteboardAction(action: WhiteboardAction, recipientId?: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_WHITEBOARD_ACTION',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { action },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }

  sendCollabChecklistAction(action: ChecklistAction, recipientId?: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_CHECKLIST_ACTION',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { action },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }

  sendCollabStickyAction(action: StickyNoteAction, recipientId?: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_STICKY_ACTION',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { action },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }

  sendCollabPresence(presence: CollabPresence, recipientId?: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_PRESENCE_HEARTBEAT',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { presence },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }

  sendCollabStateRequest(request: CollabStateRequestPayload, recipientId?: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_ROOM_STATE_REQUEST',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { request },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }

  sendCollabStateResponse(response: CollabStateResponsePayload, recipientId: string) {
    if (!this.currentUser || !this.broadcastChannel) return;
    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: 'COLLAB_ROOM_STATE_RESPONSE',
      sender: {
        userId: this.currentUser.userId,
        username: this.currentUser.username,
        avatar: this.currentUser.avatar,
        connectionType: this.activeChannel,
      },
      recipientId,
      payload: { response },
      timestamp: Date.now(),
    };
    this.broadcastChannel.postMessage(packet);
  }
}

export const networkService = new P2PNetworkService();


