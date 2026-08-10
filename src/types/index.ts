export interface UserProfile {
  userId: string;
  username: string;
  avatar: string; // URL, data URI, or preset identifier
  publicKeyPEM: string;
  keyFingerprint: string;
  createdAt: number;
  updatedAt: number;
}

export interface CryptographicKeyPair {
  publicKeyPEM: string;
  privateKeyJWK: JsonWebKey;
  keyFingerprint: string;
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  percentageUsed: number;
  isAvailable: boolean;
}

export type AppView = 'splash' | 'setup' | 'dashboard';

export interface PeerDevice {
  deviceId: string;
  username: string;
  avatar: string;
  publicKey: string;
  fingerprint: string;
  connectionType: 'LAN' | 'Wi-Fi Direct' | 'Bluetooth';
  lastSeen: number;
  status: 'connected' | 'discovered' | 'disconnected';
}
