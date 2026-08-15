import {
  CollabRoomState,
  CollabStateRequestPayload,
  CollabStateResponsePayload,
  DrawingStroke,
  ChecklistItem,
  StickyNote,
  UserProfile,
} from '../types';
import { networkService } from './network';

export class CollaborationSyncService {
  // Action deduplication cache to prevent echo loops across tabs and mesh hops
  private processedActionIds: Set<string> = new Set();
  private maxActionCacheSize = 1000;

  // Offline action queue for when peers disconnect
  private offlineActionQueue: Map<string, any[]> = new Map();

  /**
   * Checks if an action packet has already been processed by this node
   */
  isActionDuplicate(actionId: string): boolean {
    if (!actionId) return false;
    if (this.processedActionIds.has(actionId)) {
      return true;
    }
    this.recordAction(actionId);
    return false;
  }

  /**
   * Records an actionId in the LRU deduplication cache
   */
  recordAction(actionId: string) {
    if (this.processedActionIds.size >= this.maxActionCacheSize) {
      // Remove oldest entry
      const firstEntry = this.processedActionIds.values().next().value;
      if (firstEntry) this.processedActionIds.delete(firstEntry);
    }
    this.processedActionIds.add(actionId);
  }

  /**
   * Broadcasts a state hydration request when entering a collaboration session
   */
  requestRoomState(sessionId: string, user: UserProfile, targetPeerId?: string) {
    const payload: CollabStateRequestPayload = {
      sessionId,
      requesterId: user.userId,
      requesterName: user.username,
      timestamp: Date.now(),
    };

    networkService.sendCollabStateRequest(payload, targetPeerId);
  }

  /**
   * Responds to an incoming state request with current local state snapshot
   */
  respondToStateRequest(
    request: CollabStateRequestPayload,
    user: UserProfile,
    currentState: CollabRoomState
  ) {
    // Only respond if we have state for the requested session
    if (currentState.sessionId !== request.sessionId && request.sessionId !== 'local_scratchpad') {
      return;
    }

    const payload: CollabStateResponsePayload = {
      sessionId: request.sessionId,
      state: currentState,
      responderId: user.userId,
      responderName: user.username,
      timestamp: Date.now(),
    };

    networkService.sendCollabStateResponse(payload, request.requesterId);
  }

  /**
   * Conflict-Free State Merging using Last-Write-Wins (LWW) & Additive Unions
   */
  mergeRoomState(local: CollabRoomState, remote: CollabRoomState): CollabRoomState {
    return {
      sessionId: local.sessionId,
      whiteboardStrokes: this.mergeWhiteboardStrokes(local.whiteboardStrokes, remote.whiteboardStrokes),
      checklistItems: this.mergeChecklistItems(local.checklistItems, remote.checklistItems),
      stickyNotes: this.mergeStickyNotes(local.stickyNotes, remote.stickyNotes),
      lastModified: Math.max(local.lastModified || 0, remote.lastModified || 0, Date.now()),
    };
  }

  /**
   * Merges Whiteboard Strokes:
   * - Deduplicates strokes by strokeId
   * - Preserves deterministic chronological order
   */
  mergeWhiteboardStrokes(
    localStrokes: DrawingStroke[] = [],
    remoteStrokes: DrawingStroke[] = []
  ): DrawingStroke[] {
    const strokeMap = new Map<string, DrawingStroke>();

    localStrokes.forEach((s) => strokeMap.set(s.strokeId, s));
    remoteStrokes.forEach((s) => {
      if (!strokeMap.has(s.strokeId)) {
        strokeMap.set(s.strokeId, s);
      }
    });

    return Array.from(strokeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Merges Checklist Items:
   * - Matches by itemId
   * - Last-Write-Wins (LWW) deterministic conflict resolution based on updatedAt
   */
  mergeChecklistItems(
    localItems: ChecklistItem[] = [],
    remoteItems: ChecklistItem[] = []
  ): ChecklistItem[] {
    const itemMap = new Map<string, ChecklistItem>();

    localItems.forEach((item) => itemMap.set(item.itemId, item));

    remoteItems.forEach((remoteItem) => {
      const localItem = itemMap.get(remoteItem.itemId);
      if (!localItem) {
        itemMap.set(remoteItem.itemId, remoteItem);
      } else {
        // Resolve conflict using newest timestamp
        if ((remoteItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
          itemMap.set(remoteItem.itemId, remoteItem);
        }
      }
    });

    return Array.from(itemMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  /**
   * Merges Sticky Notes:
   * - Matches by noteId
   * - Last-Write-Wins (LWW) on content, position, and pin status based on updatedAt
   */
  mergeStickyNotes(
    localNotes: StickyNote[] = [],
    remoteNotes: StickyNote[] = []
  ): StickyNote[] {
    const noteMap = new Map<string, StickyNote>();

    localNotes.forEach((note) => noteMap.set(note.noteId, note));

    remoteNotes.forEach((remoteNote) => {
      const localNote = noteMap.get(remoteNote.noteId);
      if (!localNote) {
        noteMap.set(remoteNote.noteId, remoteNote);
      } else {
        // Resolve conflict using newest timestamp
        if ((remoteNote.updatedAt || 0) > (localNote.updatedAt || 0)) {
          noteMap.set(remoteNote.noteId, remoteNote);
        }
      }
    });

    return Array.from(noteMap.values());
  }

  /**
   * Enqueues an action for offline retry
   */
  enqueueOfflineAction(sessionId: string, action: any) {
    if (!this.offlineActionQueue.has(sessionId)) {
      this.offlineActionQueue.set(sessionId, []);
    }
    this.offlineActionQueue.get(sessionId)!.push(action);
  }

  /**
   * Clears and returns queued offline actions for a session
   */
  flushOfflineActions(sessionId: string): any[] {
    const queued = this.offlineActionQueue.get(sessionId) || [];
    this.offlineActionQueue.delete(sessionId);
    return queued;
  }
}

export const collabSyncService = new CollaborationSyncService();
