export interface UserProfile {
  userId: string;
  username: string;
  avatar: string; // URL, data URI, or preset identifier
  createdAt: number;
  updatedAt: number;
}

export type AppView = 'splash' | 'setup' | 'dashboard';
export type DashboardTab = 'overview' | 'peers' | 'chat' | 'groups';

export type TransportChannel = 'LAN' | 'Wi-Fi Direct' | 'Bluetooth';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface PeerDevice {
  deviceId: string;
  username: string;
  avatar: string;
  connectionType: TransportChannel;
  lastSeen: number;
  status: 'connected' | 'discovered' | 'disconnected';
  rssi?: number; // dBm signal or strength %
  latencyMs?: number;
  isSimulated?: boolean;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  status: MessageStatus;
  channel: TransportChannel;
}

export interface GroupMember {
  userId: string;
  username: string;
  avatar: string;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface GroupChat {
  groupId: string;
  groupName: string;
  description?: string;
  avatarColor: string;
  adminId: string;
  adminName: string;
  members: GroupMember[];
  createdAt: number;
}

export interface GroupMessage {
  messageId: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: number;
  channel: TransportChannel;
}

export type NetworkPacketType = 
  | 'DISCOVERY_BEACON'
  | 'PEER_HELLO'
  | 'CHAT_MESSAGE'
  | 'TYPING_STATUS'
  | 'MSG_ACK'
  | 'MSG_READ'
  | 'GROUP_CREATE'
  | 'GROUP_MESSAGE'
  | 'GROUP_MEMBER_LEAVE'
  | 'GROUP_DELETE';

export interface NetworkPacket {
  id: string;
  type: NetworkPacketType;
  sender: {
    userId: string;
    username: string;
    avatar: string;
    connectionType: TransportChannel;
  };
  recipientId?: string; // target user or empty for broadcast
  payload: any;
  timestamp: number;
}



