import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  StickyNote,
  StickyNoteAction,
  StickyNoteColor,
  CollabPresence
} from '../../types';
import { networkService } from '../../services/network';
import { dbEngine } from '../../services/db';
import {
  StickyNote as StickyIcon,
  Plus,
  Trash2,
  Copy,
  Pin,
  Palette,
  Move,
  LayoutGrid,
  Search,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  Edit3
} from 'lucide-react';

interface SharedStickyNotesProps {
  profile: UserProfile;
  sessionId: string;
  sessionType: 'peer' | 'group' | 'scratch';
  onNotesCountChange?: (count: number) => void;
}

const COLOR_CONFIG: Record<
  StickyNoteColor,
  {
    name: string;
    hex: string;
    cardBg: string;
    headerBg: string;
    borderColor: string;
    textColor: string;
    accentColor: string;
    boxShadow: string;
  }
> = {
  yellow: {
    name: 'Yellow',
    hex: '#fbbf24',
    cardBg: '#2e2008',
    headerBg: '#45300a',
    borderColor: '#78500c',
    textColor: '#fef08a',
    accentColor: '#fde047',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  cyan: {
    name: 'Cyan',
    hex: '#06b6d4',
    cardBg: '#082f49',
    headerBg: '#0e4668',
    borderColor: '#155e75',
    textColor: '#cffafe',
    accentColor: '#67e8f9',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  emerald: {
    name: 'Green',
    hex: '#10b981',
    cardBg: '#063923',
    headerBg: '#0a4f32',
    borderColor: '#065f46',
    textColor: '#d1fae5',
    accentColor: '#6ee7b7',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  rose: {
    name: 'Rose',
    hex: '#f43f5e',
    cardBg: '#3f0c18',
    headerBg: '#581122',
    borderColor: '#881337',
    textColor: '#ffe4e6',
    accentColor: '#fda4af',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  purple: {
    name: 'Purple',
    hex: '#a855f7',
    cardBg: '#2e104a',
    headerBg: '#411768',
    borderColor: '#581c87',
    textColor: '#f3e8ff',
    accentColor: '#d8b4fe',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  slate: {
    name: 'Slate',
    hex: '#94a3b8',
    cardBg: '#1e293b',
    headerBg: '#334155',
    borderColor: '#475569',
    textColor: '#f8fafc',
    accentColor: '#cbd5e1',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  amber: {
    name: 'Amber',
    hex: '#f97316',
    cardBg: '#3c1806',
    headerBg: '#552309',
    borderColor: '#7c2d12',
    textColor: '#ffedd5',
    accentColor: '#fdba74',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
};

export const SharedStickyNotes: React.FC<SharedStickyNotesProps> = ({
  profile,
  sessionId,
  sessionType,
  onNotesCountChange,
}) => {
  // Notes List State
  const [notes, setNotes] = useState<StickyNote[]>([]);

  // Creation & Filter State
  const [selectedAddColor, setSelectedAddColor] = useState<StickyNoteColor>('yellow');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string>('all');

  // Active Dragging State
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  // Remote editing indicator Map<noteId, { username: string, avatar: string, timestamp: number }>
  const [editingUsers, setEditingUsers] = useState<Map<string, { username: string; avatar: string; timestamp: number }>>(new Map());

  const onNotesCountChangeRef = useRef(onNotesCountChange);
  useEffect(() => {
    onNotesCountChangeRef.current = onNotesCountChange;
  }, [onNotesCountChange]);

  // Load saved notes from IndexedDB
  useEffect(() => {
    let isMounted = true;
    dbEngine.getStickyNotes(sessionId).then((saved) => {
      if (isMounted && saved && saved.length > 0) {
        setNotes(saved);
      }
    }).catch(console.warn);
    return () => { isMounted = false; };
  }, [sessionId]);

  // Notify parent on count change and persist to IndexedDB
  useEffect(() => {
    onNotesCountChangeRef.current?.(notes.length);
    notes.forEach((note) => {
      dbEngine.saveStickyNote(note).catch(console.warn);
    });
  }, [notes]);

  // Subscribe to P2P Mesh Collaboration Packets
  useEffect(() => {
    const unsubSticky = networkService.subscribeCollabSticky((action: StickyNoteAction) => {
      if (action.sessionId !== sessionId && sessionId !== 'local_scratchpad' && action.sessionId !== 'local_scratchpad') {
        return;
      }

      setNotes((prev) => {
        switch (action.type) {
          case 'note_add':
            if (!action.note || prev.some((n) => n.noteId === action.note!.noteId)) return prev;
            return [...prev, action.note];

          case 'note_update':
            if (!action.noteId || !action.updates) return prev;
            return prev.map((n) =>
              n.noteId === action.noteId
                ? {
                  ...n,
                  ...action.updates,
                  lastEditedBy: action.authorId,
                  lastEditedByName: action.authorName,
                  updatedAt: Date.now(),
                }
                : n
            );

          case 'note_move':
            if (!action.noteId || !action.position) return prev;
            return prev.map((n) =>
              n.noteId === action.noteId ? { ...n, position: action.position!, updatedAt: Date.now() } : n
            );

          case 'note_recolor':
            if (!action.noteId || !action.updates?.color) return prev;
            return prev.map((n) =>
              n.noteId === action.noteId ? { ...n, color: action.updates!.color!, updatedAt: Date.now() } : n
            );

          case 'note_pin':
            if (!action.noteId) return prev;
            return prev.map((n) =>
              n.noteId === action.noteId
                ? { ...n, isPinned: !n.isPinned, zIndex: !n.isPinned ? 999 : n.zIndex, updatedAt: Date.now() }
                : n
            );

          case 'note_delete':
            if (!action.noteId) return prev;
            return prev.filter((n) => n.noteId !== action.noteId);

          case 'board_clear':
            return [];

          default:
            return prev;
        }
      });
    });

    // Remote Presence Heartbeats to detect who is typing in which note
    const unsubPresence = networkService.subscribeCollabPresence((presence: CollabPresence) => {
      if (presence.userId === profile.userId) return;
      if (presence.sessionId !== sessionId && sessionId !== 'local_scratchpad') return;

      if (presence.isEditingNoteId) {
        setEditingUsers((prev) => {
          const next = new Map(prev);
          next.set(presence.isEditingNoteId!, {
            username: presence.username,
            avatar: presence.avatar,
            timestamp: Date.now(),
          });
          return next;
        });
      }
    });

    // Stale editing presence cleaner
    const presenceTimer = setInterval(() => {
      const now = Date.now();
      setEditingUsers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [noteId, data] of next.entries()) {
          if (now - data.timestamp > 3500) {
            next.delete(noteId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      unsubSticky();
      unsubPresence();
      clearInterval(presenceTimer);
    };
  }, [sessionId, profile.userId]);

  // Create New Sticky Note (with specific color or position)
  const handleAddNote = (colorOverride?: StickyNoteColor, posOverride?: { x: number; y: number }) => {
    const finalColor = colorOverride || selectedAddColor;
    const offsetX = posOverride ? Math.max(10, Math.min(posOverride.x, 800)) : Math.max(30, Math.min(600, 40 + (notes.length % 5) * 60 + Math.random() * 40));
    const offsetY = posOverride ? Math.max(10, Math.min(posOverride.y, 450)) : Math.max(30, Math.min(360, 40 + Math.floor(notes.length / 5) * 50 + Math.random() * 30));

    const newNote: StickyNote = {
      noteId: `note_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      content: '',
      color: finalColor,
      position: { x: offsetX, y: offsetY },
      zIndex: notes.length + 10,
      isPinned: false,
      authorId: profile.userId,
      authorName: profile.username,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setNotes((prev) => [...prev, newNote]);

    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_add',
      sessionId,
      note: newNote,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Double-click on board creates a note right at the click coordinates
  const handleBoardDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't trigger if clicked inside a note card
    if (target.closest('.sticky-card') || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
      return;
    }

    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const clickX = e.clientX - boardRect.left;
    const clickY = e.clientY - boardRect.top;

    handleAddNote(selectedAddColor, { x: clickX - 20, y: clickY - 20 });
  };

  // Duplicate Note
  const handleDuplicateNote = (note: StickyNote) => {
    const dupNote: StickyNote = {
      ...note,
      noteId: `note_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      position: { x: note.position.x + 25, y: note.position.y + 25 },
      zIndex: notes.length + 10,
      authorId: profile.userId,
      authorName: profile.username,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setNotes((prev) => [...prev, dupNote]);

    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_add',
      sessionId,
      note: dupNote,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Update Note Content
  const handleContentChange = (noteId: string, text: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.noteId === noteId
          ? {
            ...n,
            content: text,
            lastEditedBy: profile.userId,
            lastEditedByName: profile.username,
            updatedAt: Date.now(),
          }
          : n
      )
    );

    // Broadcast content update
    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_update',
      sessionId,
      noteId,
      updates: { content: text },
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });

    // Broadcast editing presence
    networkService.sendCollabPresence({
      userId: profile.userId,
      username: profile.username,
      avatar: profile.avatar,
      sessionId,
      activeTab: 'notes',
      isEditingNoteId: noteId,
      lastActive: Date.now(),
    });
  };

  // Recolor Note
  const handleRecolorNote = (noteId: string, color: StickyNoteColor) => {
    setNotes((prev) =>
      prev.map((n) => (n.noteId === noteId ? { ...n, color, updatedAt: Date.now() } : n))
    );

    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_recolor',
      sessionId,
      noteId,
      updates: { color },
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Pin Note
  const handleTogglePin = (note: StickyNote) => {
    const nextPin = !note.isPinned;
    setNotes((prev) =>
      prev.map((n) =>
        n.noteId === note.noteId ? { ...n, isPinned: nextPin, zIndex: nextPin ? 999 : 10 } : n
      )
    );

    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_pin',
      sessionId,
      noteId: note.noteId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Delete Note
  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.noteId !== noteId));

    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'note_delete',
      sessionId,
      noteId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Clear Entire Board Grid
  const handleClearBoard = () => {
    const notesToDelete = [...notes];
    setNotes([]);

    // Delete all notes from IndexedDB
    notesToDelete.forEach((n) => {
      dbEngine.deleteStickyNote(n.noteId).catch(console.warn);
    });

    // Broadcast clear action
    networkService.sendCollabStickyAction({
      actionId: crypto.randomUUID(),
      type: 'board_clear',
      sessionId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Auto-arrange Grid Layout
  const handleAutoArrangeGrid = () => {
    const cardWidth = 240;
    const cardHeight = 230;
    const gap = 20;
    const padding = 25;
    const maxCols = 3;

    const arranged = notes.map((note, index) => {
      const col = index % maxCols;
      const row = Math.floor(index / maxCols);
      return {
        ...note,
        position: {
          x: padding + col * (cardWidth + gap),
          y: padding + row * (cardHeight + gap),
        },
        updatedAt: Date.now(),
      };
    });

    setNotes(arranged);

    // Broadcast moves
    arranged.forEach((n) => {
      networkService.sendCollabStickyAction({
        actionId: crypto.randomUUID(),
        type: 'note_move',
        sessionId,
        noteId: n.noteId,
        position: n.position,
        authorId: profile.userId,
        authorName: profile.username,
        timestamp: Date.now(),
      });
    });
  };

  // Drag-and-Drop Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent, note: StickyNote) => {
    // Only trigger drag on header or move handle
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.tagName === 'SELECT') {
      return;
    }

    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();

    setDraggingNoteId(note.noteId);
    dragOffsetRef.current = {
      offsetX: e.clientX - boardRect.left - note.position.x,
      offsetY: e.clientY - boardRect.top - note.position.y,
    };

    // Bring clicked note to front
    setNotes((prev) =>
      prev.map((n) => (n.noteId === note.noteId ? { ...n, zIndex: 100 } : { ...n, zIndex: Math.min(n.zIndex, 50) }))
    );

    target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingNoteId) return;
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();

    const newX = Math.max(10, Math.min(boardRect.width - 250, e.clientX - boardRect.left - dragOffsetRef.current.offsetX));
    const newY = Math.max(10, Math.min(boardRect.height - 230, e.clientY - boardRect.top - dragOffsetRef.current.offsetY));

    setNotes((prev) =>
      prev.map((n) => (n.noteId === draggingNoteId ? { ...n, position: { x: newX, y: newY } } : n))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingNoteId) return;

    const movingNote = notes.find((n) => n.noteId === draggingNoteId);
    if (movingNote) {
      networkService.sendCollabStickyAction({
        actionId: crypto.randomUUID(),
        type: 'note_move',
        sessionId,
        noteId: movingNote.noteId,
        position: movingNote.position,
        authorId: profile.userId,
        authorName: profile.username,
        timestamp: Date.now(),
      });
    }

    setDraggingNoteId(null);
  };

  // Filtered Notes computation
  const filteredNotes = notes.filter((n) => {
    if (colorFilter !== 'all' && n.color !== colorFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = n.content.toLowerCase().includes(q);
      const matchAuthor = n.authorName.toLowerCase().includes(q);
      if (!matchText && !matchAuthor) return false;
    }
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-4 font-sans max-w-6xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. TOP STICKY NOTES CONTROL & CREATION BAR */}
      {/* ========================================================================= */}
      <div className="glass-panel p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Quick Add by Color Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-300 font-bold flex items-center gap-1">
              <StickyIcon size={14} className="text-purple-400" /> New Note:
            </span>

            {/* Direct 1-Click Color Creation Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
              {(Object.keys(COLOR_CONFIG) as StickyNoteColor[]).map((cKey) => {
                const c = COLOR_CONFIG[cKey];
                const isSelected = selectedAddColor === cKey;
                return (
                  <button
                    key={cKey}
                    onClick={() => {
                      setSelectedAddColor(cKey);
                      handleAddNote(cKey);
                    }}
                    className={`group px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all transform active:scale-95 border ${isSelected
                        ? 'text-white border-slate-500 bg-slate-800 shadow-sm'
                        : 'text-slate-300 border-transparent hover:text-white hover:bg-slate-800'
                      }`}
                    style={{
                      background: isSelected ? c.headerBg : undefined,
                    }}
                    title={`Click to create a ${c.name} note`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border border-black/30"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-[11px] font-mono">{c.name.split(' ')[1] || c.name}</span>
                    <Plus size={11} className="opacity-70 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleAddNote(selectedAddColor)}
              className="btn bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Plus size={15} />
              <span>+ Add Note</span>
            </button>
          </div>

          {/* Right: Grid Align, Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Color Filter */}
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Colors ({notes.length})</option>
              {(Object.keys(COLOR_CONFIG) as StickyNoteColor[]).map((cKey) => (
                <option key={cKey} value={cKey}>
                  {COLOR_CONFIG[cKey].name} ({notes.filter((n) => n.color === cKey).length})
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="pl-7 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 w-28 sm:w-36"
              />
            </div>

            {/* Auto Arrange Grid Button */}
            {notes.length > 1 && (
              <button
                onClick={handleAutoArrangeGrid}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition shadow"
                title="Organize notes into a clean matrix grid"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Grid Align</span>
              </button>
            )}

            {/* Clear Entire Board Grid Button */}
            {notes.length > 0 && (
              <button
                onClick={handleClearBoard}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 text-xs font-medium flex items-center gap-1.5 transition shadow"
                title="Remove all sticky notes from the grid"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear Grid</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FREEFORM 2D WORKSPACE BOARD */}
      {/* ========================================================================= */}
      <div
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleBoardDoubleClick}
        className="w-full min-h-[620px] h-[660px] bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-xl select-none cursor-crosshair"
        style={{
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.12) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      >
        {filteredNotes.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 space-y-3 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow">
              <StickyIcon size={28} />
            </div>
            <h4 className="text-sm font-bold text-white">No Sticky Notes On Board</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Click any color button above or <strong className="text-purple-400">double-click anywhere on the canvas</strong> to place a note!
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const config = COLOR_CONFIG[note.color] || COLOR_CONFIG.yellow;
            const editorInfo = editingUsers.get(note.noteId);
            const isBeingEditedByPeer = Boolean(editorInfo);

            return (
              <div
                key={note.noteId}
                className={`sticky-card absolute top-0 left-0 w-60 sm:w-64 rounded-2xl border backdrop-blur-md flex flex-col transition-shadow duration-150 ${draggingNoteId === note.noteId ? 'ring-2 ring-white opacity-95 cursor-grabbing scale-[1.02]' : ''
                  }`}
                style={{
                  transform: `translate(${note.position.x}px, ${note.position.y}px)`,
                  zIndex: note.isPinned ? 999 : note.zIndex,
                  background: config.cardBg,
                  borderColor: config.borderColor,
                  boxShadow: config.boxShadow,
                  color: config.textColor,
                }}
              >
                {/* Note Card Header: Drag Handle & Quick Actions */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, note)}
                  className="px-3 py-2 rounded-t-2xl border-b flex items-center justify-between cursor-grab active:cursor-grabbing"
                  style={{
                    backgroundColor: config.headerBg,
                    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Move size={12} className="opacity-70 shrink-0" />
                    <span className="text-[11px] font-mono font-bold truncate text-white">
                      @{note.authorName}
                    </span>
                    {note.isPinned && (
                      <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[9px] font-mono text-cyan-300 border border-cyan-400/40 flex items-center gap-0.5">
                        <Pin size={8} className="fill-cyan-300" /> PINNED
                      </span>
                    )}
                  </div>

                  {/* Header Actions: Recolor, Pin, Duplicate, Delete */}
                  <div className="flex items-center gap-1">
                    {/* Color Swatch Menu */}
                    <div className="relative group/color">
                      <button
                        className="p-1 rounded text-white/80 hover:text-white hover:bg-black/30 transition"
                        title="Recolor note"
                      >
                        <Palette size={12} />
                      </button>
                      <div className="absolute right-0 top-6 hidden group-hover/color:flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50">
                        {(Object.keys(COLOR_CONFIG) as StickyNoteColor[]).map((cKey) => (
                          <button
                            key={cKey}
                            onClick={() => handleRecolorNote(note.noteId, cKey)}
                            className="w-4 h-4 rounded-full border border-white/40 hover:scale-125 transition shadow"
                            style={{ backgroundColor: COLOR_CONFIG[cKey].hex }}
                            title={COLOR_CONFIG[cKey].name}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-1 rounded transition ${note.isPinned ? 'text-cyan-300 bg-black/40' : 'text-white/80 hover:text-white hover:bg-black/30'
                        }`}
                      title={note.isPinned ? 'Unpin Note' : 'Pin Note to Top'}
                    >
                      <Pin size={12} />
                    </button>

                    <button
                      onClick={() => handleDuplicateNote(note)}
                      className="p-1 rounded text-white/80 hover:text-white hover:bg-black/30 transition"
                      title="Duplicate Note"
                    >
                      <Copy size={12} />
                    </button>

                    <button
                      onClick={() => handleDeleteNote(note.noteId)}
                      className="p-1 rounded text-rose-300 hover:text-rose-100 hover:bg-rose-950/80 transition"
                      title="Delete Note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Note Card Body: Editable Textarea */}
                <div className="p-3 flex-1 flex flex-col">
                  {isBeingEditedByPeer && (
                    <div className="mb-1 px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-[10px] font-mono text-blue-300 flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      @{editorInfo?.username} is typing...
                    </div>
                  )}

                  <textarea
                    value={note.content}
                    onChange={(e) => handleContentChange(note.noteId, e.target.value)}
                    placeholder="Type idea, note, or quick reminder here..."
                    className="w-full min-h-[110px] bg-transparent border-none outline-none resize-none text-xs font-sans placeholder-white/40 leading-relaxed font-medium"
                    style={{ color: config.textColor }}
                  />

                  {/* Note Footer Info */}
                  <div
                    className="pt-2 mt-auto border-t flex items-center justify-between text-[10px] font-mono opacity-70"
                    style={{ borderTopColor: 'rgba(255, 255, 255, 0.08)' }}
                  >
                    <span className="truncate max-w-[130px]">
                      {note.lastEditedByName ? `@${note.lastEditedByName}` : `@${note.authorName}`}
                    </span>
                    <span>
                      {new Date(note.updatedAt || note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live Board Status Footer */}
        <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{notes.length} STICKY NOTES ON 2D BOARD</span>
        </div>
      </div>
    </div>
  );
};
