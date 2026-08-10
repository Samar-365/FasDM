import { UserProfile, CryptographicKeyPair, StorageQuotaInfo } from '../types';

const DB_NAME = 'FasDMMeshDB';
const DB_VERSION = 1;

export class LocalStorageEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Profile Store
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'userId' });
        }

        // Keys Store
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'keyFingerprint' });
        }

        // Peers Store
        if (!db.objectStoreNames.contains('peers')) {
          const peersStore = db.createObjectStore('peers', { keyPath: 'deviceId' });
          peersStore.createIndex('lastSeen', 'lastSeen', { unique: false });
        }

        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'messageId' });
          msgStore.createIndex('senderId', 'senderId', { unique: false });
          msgStore.createIndex('receiverId', 'receiverId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Profile Operations ---
  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profile', 'readwrite');
      const store = tx.objectStore('profile');
      const request = store.put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProfile(): Promise<UserProfile | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profile', 'readonly');
      const store = tx.objectStore('profile');
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as UserProfile[];
        resolve(results.length > 0 ? results[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Cryptographic Key Store Operations ---
  async saveKeyPair(keyPair: CryptographicKeyPair): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const request = store.put(keyPair);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getKeyPair(fingerprint: string): Promise<CryptographicKeyPair | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const store = tx.objectStore('keys');
      const request = store.get(fingerprint);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Peer Store Operations ---
  async savePeer(peer: PeerDevice): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('peers', 'readwrite');
      const store = tx.objectStore('peers');
      const request = store.put(peer);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPeers(): Promise<PeerDevice[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('peers', 'readonly');
      const store = tx.objectStore('peers');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as PeerDevice[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getPeer(deviceId: string): Promise<PeerDevice | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('peers', 'readonly');
      const store = tx.objectStore('peers');
      const request = store.get(deviceId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePeerStatus(deviceId: string, status: 'connected' | 'discovered' | 'disconnected'): Promise<void> {
    const peer = await this.getPeer(deviceId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = Date.now();
      await this.savePeer(peer);
    }
  }

  // --- Message Store Operations ---
  async saveMessage(message: ChatMessage): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessagesForPeer(myId: string, peerId: string): Promise<ChatMessage[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const request = store.getAll();
      request.onsuccess = () => {
        const allMsgs = (request.result as ChatMessage[]) || [];
        const filtered = allMsgs.filter(
          (m) =>
            (m.senderId === myId && m.receiverId === peerId) ||
            (m.senderId === peerId && m.receiverId === myId)
        );
        filtered.sort((a, b) => a.timestamp - b.timestamp);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(messageId);
      getReq.onsuccess = () => {
        const msg = getReq.result as ChatMessage;
        if (msg) {
          msg.status = status;
          store.put(msg);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async clearMessagesForPeer(myId: string, peerId: string): Promise<void> {
    const db = await this.initDB();
    const msgs = await this.getMessagesForPeer(myId, peerId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      msgs.forEach((m) => store.delete(m.messageId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }


  // --- Storage Quota Diagnostics ---
  async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 1;
        const percentageUsed = Math.min(100, Math.round((usageBytes / quotaBytes) * 100));

        return {
          usageBytes,
          quotaBytes,
          percentageUsed,
          isAvailable: true,
        };
      } catch (err) {
        console.warn('Storage estimate failed:', err);
      }
    }

    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentageUsed: 0,
      isAvailable: false,
    };
  }

  // --- Reset Database ---
  async clearAllData(): Promise<void> {
    const db = await this.initDB();
    const storeNames = Array.from(db.objectStoreNames);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      storeNames.forEach((name) => tx.objectStore(name).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbEngine = new LocalStorageEngine();
