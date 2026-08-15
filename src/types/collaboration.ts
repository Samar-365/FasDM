export type CollabToolTab = 'whiteboard' | 'checklist' | 'notes';

// ==========================================
// 1. WHITEBOARD DATA MODELS & ACTIONS
// ==========================================
export type WhiteboardTool = 'pen' | 'brush' | 'highlighter' | 'eraser';

export interface Point {
  x: number; // Normalized coordinate [0.0 - 1.0]
  y: number; // Normalized coordinate [0.0 - 1.0]
}

export interface DrawingStroke {
  strokeId: string;
  sessionId: string; // Target 1-to-1 peerId or groupId
  authorId: string;
  authorName: string;
  tool: WhiteboardTool;
  color: string;
  brushSize: number;
  points: Point[];
  timestamp: number;
}

export type WhiteboardActionType = 'stroke_add' | 'stroke_undo' | 'stroke_redo' | 'canvas_clear';

export interface WhiteboardAction {
  actionId: string;
  type: WhiteboardActionType;
  sessionId: string;
  stroke?: DrawingStroke;
  strokeId?: string;
  authorId: string;
  authorName: string;
  timestamp: number;
}

// ==========================================
// 2. CHECKLIST DATA MODELS & ACTIONS
// ==========================================
export type ChecklistPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface ChecklistItem {
  itemId: string;
  sessionId: string; // Target 1-to-1 peerId or groupId
  title: string;
  completed: boolean;
  priority: ChecklistPriority;
  createdBy: string;
  createdByName: string;
  completedBy?: string;
  completedByName?: string;
  assignedTo?: string;
  assignedToName?: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type ChecklistActionType =
  | 'item_add'
  | 'item_toggle'
  | 'item_update'
  | 'item_delete'
  | 'item_reorder'
  | 'checklist_clear_completed'
  | 'checklist_clear_all';

export interface ChecklistAction {
  actionId: string;
  type: ChecklistActionType;
  sessionId: string;
  item?: ChecklistItem;
  itemId?: string;
  updates?: Partial<ChecklistItem>;
  reorderedIds?: string[];
  authorId: string;
  authorName: string;
  timestamp: number;
}

// ==========================================
// 3. STICKY NOTES DATA MODELS & ACTIONS
// ==========================================
export type StickyNoteColor = 'yellow' | 'cyan' | 'emerald' | 'rose' | 'purple' | 'slate' | 'amber';

export interface StickyNote {
  noteId: string;
  sessionId: string; // Target 1-to-1 peerId or groupId
  content: string;
  color: StickyNoteColor;
  position: { x: number; y: number }; // Relative coordinates within board
  zIndex: number;
  isPinned?: boolean;
  authorId: string;
  authorName: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
  createdAt: number;
  updatedAt: number;
}

export type StickyNoteActionType =
  | 'note_add'
  | 'note_update'
  | 'note_move'
  | 'note_recolor'
  | 'note_pin'
  | 'note_delete';

export interface StickyNoteAction {
  actionId: string;
  type: StickyNoteActionType;
  sessionId: string;
  note?: StickyNote;
  noteId?: string;
  updates?: Partial<StickyNote>;
  position?: { x: number; y: number };
  authorId: string;
  authorName: string;
  timestamp: number;
}

// ==========================================
// 4. PRESENCE & REAL-TIME CURSOR
// ==========================================
export interface CollabPresence {
  userId: string;
  username: string;
  avatar: string;
  sessionId: string;
  activeTab: CollabToolTab;
  cursorPosition?: { x: number; y: number }; // Normalized [0.0 - 1.0]
  isEditingNoteId?: string;
  lastActive: number;
}

// ==========================================
// 5. FULL ROOM STATE HYDRATION & RECONCILIATION
// ==========================================
export interface CollabRoomState {
  sessionId: string;
  whiteboardStrokes: DrawingStroke[];
  checklistItems: ChecklistItem[];
  stickyNotes: StickyNote[];
  lastModified: number;
}

export interface CollabStateRequestPayload {
  sessionId: string;
  requesterId: string;
  requesterName: string;
  timestamp: number;
}

export interface CollabStateResponsePayload {
  sessionId: string;
  state: CollabRoomState;
  responderId: string;
  responderName: string;
  timestamp: number;
}
