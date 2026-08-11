export interface UserProfile {
  userId: string;
  username: string;
  avatar: string; // URL, data URI, or preset identifier
  createdAt: number;
  updatedAt: number;
}

export type AppView = 'splash' | 'setup' | 'dashboard';
export type DashboardTab = 'overview' | 'peers' | 'chat';

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

export type NetworkPacketType = 
  | 'DISCOVERY_BEACON'
  | 'PEER_HELLO'
  | 'CHAT_MESSAGE'
  | 'TYPING_STATUS'
  | 'MSG_ACK'
  | 'MSG_READ';

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


