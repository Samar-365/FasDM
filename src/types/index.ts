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

export interface SharedFile {
  fileId: string;
  fileName: string;
  fileSize: number; // Bytes
  fileType: string; // Mime type
  fileData: string; // Base64 or Blob Data URL
  senderId: string;
  senderName: string;
  receiverId?: string; // target user for 1-to-1
  groupId?: string; // target group
  timestamp: number;
  channel: TransportChannel;
  escalatedToWifiDirect?: boolean;
}

export interface VoiceNote {
  voiceId: string;
  senderId: string;
  senderName: string;
  audioData: string;       // Base64 Data URL (audio/webm or audio/ogg)
  durationMs: number;      // Duration in milliseconds
  mimeType: string;        // e.g. 'audio/webm;codecs=opus' or 'audio/ogg;codecs=opus'
  fileSize: number;        // Size in bytes
  timestamp: number;
  channel: TransportChannel;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  status: MessageStatus;
  channel: TransportChannel;
  fileAttachment?: SharedFile;
  voiceNote?: VoiceNote;
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
  fileAttachment?: SharedFile;
  voiceNote?: VoiceNote;
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
  | 'GROUP_DELETE'
  | 'FILE_TRANSFER'
  | 'FILE_ACK'
  | 'VOICE_NOTE'
  | 'VOICE_ACK';

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



