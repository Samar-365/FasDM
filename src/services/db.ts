import {
  UserProfile,
  PeerDevice,
  ChatMessage,
  GroupChat,
  GroupMessage,
  SharedFile,
  DrawingStroke,
  ChecklistItem,
  StickyNote,
  CollabRoomState,
} from '../types';

const DB_NAME = 'FasDMMeshDB';
const DB_VERSION = 4;

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

        // Groups Store
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'groupId' });
        }

        // Group Messages Store
        if (!db.objectStoreNames.contains('group_messages')) {
          const gMsgStore = db.createObjectStore('group_messages', { keyPath: 'messageId' });
          gMsgStore.createIndex('groupId', 'groupId', { unique: false });
          gMsgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Files Store (Module 7)
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'fileId' });
          fileStore.createIndex('senderId', 'senderId', { unique: false });
          fileStore.createIndex('receiverId', 'receiverId', { unique: false });
          fileStore.createIndex('groupId', 'groupId', { unique: false });
          fileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Module 10: Collaboration Whiteboard Store
        if (!db.objectStoreNames.contains('collab_whiteboard')) {
          db.createObjectStore('collab_whiteboard', { keyPath: 'sessionId' });
        }

        // Module 10: Collaboration Checklist Store
        if (!db.objectStoreNames.contains('collab_checklists')) {
          const chkStore = db.createObjectStore('collab_checklists', { keyPath: 'itemId' });
          chkStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        // Module 10: Collaboration Sticky Notes Store
        if (!db.objectStoreNames.contains('collab_notes')) {
          const noteStore = db.createObjectStore('collab_notes', { keyPath: 'noteId' });
          noteStore.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked by open tabs. Please reload.');
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          this.dbPromise = null;
        };
        resolve(db);
      };
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

  async deletePeer(deviceId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('peers', 'readwrite');
      const store = tx.objectStore('peers');
      const request = store.delete(deviceId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
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

  async getUnreadSenders(myId: string): Promise<string[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const request = store.getAll();
      request.onsuccess = () => {
        const allMsgs = (request.result as ChatMessage[]) || [];
        const unreadMsgs = allMsgs.filter((m) => m.receiverId === myId && m.status !== 'read');
        const senders = Array.from(new Set(unreadMsgs.map((m) => m.senderId)));
        resolve(senders);
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

  // --- Group Operations ---
  async saveGroup(group: GroupChat): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('groups', 'readwrite');
      const store = tx.objectStore('groups');
      const request = store.put(group);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getGroups(): Promise<GroupChat[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('groups', 'readonly');
      const store = tx.objectStore('groups');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as GroupChat[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getGroup(groupId: string): Promise<GroupChat | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('groups', 'readonly');
      const store = tx.objectStore('groups');
      const request = store.get(groupId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['groups', 'group_messages'], 'readwrite');
      const groupStore = tx.objectStore('groups');
      groupStore.delete(groupId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Group Message Operations ---
  async saveGroupMessage(message: GroupMessage): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('group_messages', 'readwrite');
      const store = tx.objectStore('group_messages');
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getGroupMessages(groupId: string): Promise<GroupMessage[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('group_messages', 'readonly');
      const store = tx.objectStore('group_messages');
      const request = store.getAll();
      request.onsuccess = () => {
        const allMsgs = (request.result as GroupMessage[]) || [];
        const filtered = allMsgs.filter((m) => m.groupId === groupId);
        filtered.sort((a, b) => a.timestamp - b.timestamp);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- File Store Operations (Module 7) ---
  async saveFile(file: SharedFile): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(fileId: string): Promise<SharedFile | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const request = store.get(fileId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getFilesForPeer(myId: string, peerId: string): Promise<SharedFile[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const allFiles = (request.result as SharedFile[]) || [];
        const filtered = allFiles.filter(
          (f) =>
            (f.senderId === myId && f.receiverId === peerId) ||
            (f.senderId === peerId && f.receiverId === myId)
        );
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getFilesForGroup(groupId: string): Promise<SharedFile[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const allFiles = (request.result as SharedFile[]) || [];
        const filtered = allFiles.filter((f) => f.groupId === groupId);
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFiles(): Promise<SharedFile[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const allFiles = (request.result as SharedFile[]) || [];
        allFiles.sort((a, b) => b.timestamp - a.timestamp);
        resolve(allFiles);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      const request = store.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // MODULE 10: COLLABORATION STORE OPERATIONS
  // ==========================================

  // --- Whiteboard Persistence ---
  async saveWhiteboardStrokes(sessionId: string, strokes: DrawingStroke[]): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_whiteboard')) return;
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_whiteboard', 'readwrite');
          const store = tx.objectStore('collab_whiteboard');
          const request = store.put({ sessionId, strokes, lastUpdated: Date.now() });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch {
          resolve();
        }
      });
    } catch {
      return;
    }
  }

  async getWhiteboardStrokes(sessionId: string): Promise<DrawingStroke[]> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_whiteboard')) return [];
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_whiteboard', 'readonly');
          const store = tx.objectStore('collab_whiteboard');
          const request = store.get(sessionId);
          request.onsuccess = () => {
            const record = request.result;
            resolve(record?.strokes || []);
          };
          request.onerror = () => reject(request.error);
        } catch {
          resolve([]);
        }
      });
    } catch {
      return [];
    }
  }

  // --- Checklist Persistence ---
  async saveChecklistItem(item: ChecklistItem): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_checklists')) return;
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_checklists', 'readwrite');
          const store = tx.objectStore('collab_checklists');
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch {
          resolve();
        }
      });
    } catch {
      return;
    }
  }

  async getChecklistItems(sessionId: string): Promise<ChecklistItem[]> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_checklists')) return [];
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_checklists', 'readonly');
          const store = tx.objectStore('collab_checklists');
          const index = store.index('sessionId');
          const request = index.getAll(sessionId);
          request.onsuccess = () => {
            const items = (request.result as ChecklistItem[]) || [];
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            resolve(items);
          };
          request.onerror = () => reject(request.error);
        } catch {
          resolve([]);
        }
      });
    } catch {
      return [];
    }
  }

  async deleteChecklistItem(itemId: string): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_checklists')) return;
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_checklists', 'readwrite');
          const store = tx.objectStore('collab_checklists');
          const request = store.delete(itemId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch {
          resolve();
        }
      });
    } catch {
      return;
    }
  }

  // --- Sticky Notes Persistence ---
  async saveStickyNote(note: StickyNote): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_notes')) return;
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_notes', 'readwrite');
          const store = tx.objectStore('collab_notes');
          const request = store.put(note);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch {
          resolve();
        }
      });
    } catch {
      return;
    }
  }

  async getStickyNotes(sessionId: string): Promise<StickyNote[]> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_notes')) return [];
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_notes', 'readonly');
          const store = tx.objectStore('collab_notes');
          const index = store.index('sessionId');
          const request = index.getAll(sessionId);
          request.onsuccess = () => {
            const notes = (request.result as StickyNote[]) || [];
            resolve(notes);
          };
          request.onerror = () => reject(request.error);
        } catch {
          resolve([]);
        }
      });
    } catch {
      return [];
    }
  }

  async deleteStickyNote(noteId: string): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db.objectStoreNames.contains('collab_notes')) return;
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('collab_notes', 'readwrite');
          const store = tx.objectStore('collab_notes');
          const request = store.delete(noteId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch {
          resolve();
        }
      });
    } catch {
      return;
    }
  }

  // --- Full Room State Snapshot Persistence ---
  async saveCollabRoomState(state: CollabRoomState): Promise<void> {
    try {
      await this.saveWhiteboardStrokes(state.sessionId, state.whiteboardStrokes);
      for (const item of state.checklistItems) {
        await this.saveChecklistItem(item);
      }
      for (const note of state.stickyNotes) {
        await this.saveStickyNote(note);
      }
    } catch {}
  }

  async getCollabRoomState(sessionId: string): Promise<CollabRoomState> {
    try {
      const whiteboardStrokes = await this.getWhiteboardStrokes(sessionId);
      const checklistItems = await this.getChecklistItems(sessionId);
      const stickyNotes = await this.getStickyNotes(sessionId);
      return {
        sessionId,
        whiteboardStrokes,
        checklistItems,
        stickyNotes,
        lastModified: Date.now(),
      };
    } catch {
      return {
        sessionId,
        whiteboardStrokes: [],
        checklistItems: [],
        stickyNotes: [],
        lastModified: Date.now(),
      };
    }
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

