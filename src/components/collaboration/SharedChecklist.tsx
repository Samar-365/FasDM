import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  PeerDevice,
  ChecklistItem,
  ChecklistAction,
  ChecklistPriority,
} from '../../types';
import { networkService } from '../../services/network';
import { dbEngine } from '../../services/db';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  AlertCircle,
  Clock,
  User,
  Filter,
  Search,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
  Edit2,
  Check,
  X,
  Flame,
  ListTodo
} from 'lucide-react';

interface SharedChecklistProps {
  profile: UserProfile;
  sessionId: string;
  sessionType: 'peer' | 'group' | 'scratch';
  onChecklistCountChange?: (count: { total: number; completed: number }) => void;
}

const PRIORITY_CONFIG: Record<ChecklistPriority, { label: string; bg: string; text: string; border: string; icon: string }> = {
  urgent: {
    label: 'Urgent',
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    border: 'border-rose-500/40',
    icon: '🔥',
  },
  high: {
    label: 'High',
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    icon: '⚡',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    border: 'border-cyan-500/40',
    icon: '🔹',
  },
  low: {
    label: 'Low',
    bg: 'bg-slate-700/40',
    text: 'text-slate-400',
    border: 'border-slate-700',
    icon: '▫️',
  },
};

export const SharedChecklist: React.FC<SharedChecklistProps> = ({
  profile,
  sessionId,
  sessionType,
  onChecklistCountChange,
}) => {
  // Items State
  const [items, setItems] = useState<ChecklistItem[]>([]);

  // Input & Form State
  const [newTitle, setNewTitle] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<ChecklistPriority>('medium');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('unassigned');

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Available Peers for Assignee list
  const [availablePeers, setAvailablePeers] = useState<PeerDevice[]>([]);

  // Subscribe to discovered peers
  useEffect(() => {
    const unsubPeers = networkService.subscribePeers((peers) => {
      setAvailablePeers(peers.filter((p) => p.deviceId !== profile.userId));
    });
    return () => unsubPeers();
  }, [profile.userId]);

  const onChecklistCountChangeRef = useRef(onChecklistCountChange);
  useEffect(() => {
    onChecklistCountChangeRef.current = onChecklistCountChange;
  }, [onChecklistCountChange]);

  // Load saved checklist items from IndexedDB
  useEffect(() => {
    let isMounted = true;
    dbEngine.getChecklistItems(sessionId).then((saved) => {
      if (isMounted && saved && saved.length > 0) {
        setItems(saved);
      }
    }).catch(console.warn);
    return () => { isMounted = false; };
  }, [sessionId]);

  // Notify parent on count changes and persist to IndexedDB
  useEffect(() => {
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    onChecklistCountChangeRef.current?.({ total, completed });
    
    // Save items to IndexedDB
    items.forEach((item) => {
      dbEngine.saveChecklistItem(item).catch(console.warn);
    });
  }, [items]);

  // Subscribe to P2P Mesh Collaboration Packets
  useEffect(() => {
    const unsub = networkService.subscribeCollabChecklist((action: ChecklistAction) => {
      if (action.sessionId !== sessionId && sessionId !== 'local_scratchpad' && action.sessionId !== 'local_scratchpad') {
        return;
      }

      setItems((prev) => {
        switch (action.type) {
          case 'item_add':
            if (!action.item || prev.some((i) => i.itemId === action.item!.itemId)) return prev;
            return [action.item, ...prev];

          case 'item_toggle':
            if (!action.itemId) return prev;
            return prev.map((i) => {
              if (i.itemId === action.itemId) {
                const nextCompleted = !i.completed;
                return {
                  ...i,
                  completed: nextCompleted,
                  completedBy: nextCompleted ? action.authorId : undefined,
                  completedByName: nextCompleted ? action.authorName : undefined,
                  updatedAt: Date.now(),
                };
              }
              return i;
            });

          case 'item_update':
            if (!action.itemId || !action.updates) return prev;
            return prev.map((i) =>
              i.itemId === action.itemId
                ? { ...i, ...action.updates, updatedAt: Date.now() }
                : i
            );

          case 'item_delete':
            if (!action.itemId) return prev;
            return prev.filter((i) => i.itemId !== action.itemId);

          case 'checklist_clear_completed':
            return prev.filter((i) => !i.completed);

          default:
            return prev;
        }
      });
    });

    return () => unsub();
  }, [sessionId, profile.userId]);

  // Add Item Action
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    let assigneeName: string | undefined = undefined;
    if (selectedAssignee === profile.userId) {
      assigneeName = profile.username;
    } else if (selectedAssignee !== 'unassigned') {
      const peer = availablePeers.find((p) => p.deviceId === selectedAssignee);
      assigneeName = peer?.username;
    }

    const newItem: ChecklistItem = {
      itemId: `chk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      title: trimmed,
      completed: false,
      priority: selectedPriority,
      createdBy: profile.userId,
      createdByName: profile.username,
      assignedTo: selectedAssignee !== 'unassigned' ? selectedAssignee : undefined,
      assignedToName: assigneeName,
      orderIndex: items.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Optimistic local state update
    setItems((prev) => [newItem, ...prev]);
    setNewTitle('');

    // Broadcast to P2P mesh
    networkService.sendCollabChecklistAction({
      actionId: crypto.randomUUID(),
      type: 'item_add',
      sessionId,
      item: newItem,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Toggle Item Completion
  const handleToggleItem = (item: ChecklistItem) => {
    const nextCompleted = !item.completed;

    setItems((prev) =>
      prev.map((i) =>
        i.itemId === item.itemId
          ? {
              ...i,
              completed: nextCompleted,
              completedBy: nextCompleted ? profile.userId : undefined,
              completedByName: nextCompleted ? profile.username : undefined,
              updatedAt: Date.now(),
            }
          : i
      )
    );

    networkService.sendCollabChecklistAction({
      actionId: crypto.randomUUID(),
      type: 'item_toggle',
      sessionId,
      itemId: item.itemId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Delete Item Action
  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));

    networkService.sendCollabChecklistAction({
      actionId: crypto.randomUUID(),
      type: 'item_delete',
      sessionId,
      itemId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Clear Completed Action
  const handleClearCompleted = () => {
    const hasCompleted = items.some((i) => i.completed);
    if (!hasCompleted) return;

    setItems((prev) => prev.filter((i) => !i.completed));

    networkService.sendCollabChecklistAction({
      actionId: crypto.randomUUID(),
      type: 'checklist_clear_completed',
      sessionId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Inline Edit Save
  const handleSaveEdit = (itemId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingItemId(null);
      return;
    }

    setItems((prev) =>
      prev.map((i) => (i.itemId === itemId ? { ...i, title: trimmed, updatedAt: Date.now() } : i))
    );
    setEditingItemId(null);

    networkService.sendCollabChecklistAction({
      actionId: crypto.randomUUID(),
      type: 'item_update',
      sessionId,
      itemId,
      updates: { title: trimmed },
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  // Filter & Search computation
  const filteredItems = items.filter((item) => {
    // Status filter
    if (statusFilter === 'pending' && item.completed) return false;
    if (statusFilter === 'completed' && !item.completed) return false;

    // Priority filter
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchAuthor = item.createdByName.toLowerCase().includes(q);
      const matchAssignee = item.assignedToName?.toLowerCase().includes(q);
      if (!matchTitle && !matchAuthor && !matchAssignee) return false;
    }

    return true;
  });

  // Calculate Progress Percentages
  const totalTasks = items.length;
  const completedTasks = items.filter((i) => i.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const urgentCount = items.filter((i) => i.priority === 'urgent' && !i.completed).length;

  return (
    <div className="w-full flex flex-col gap-4 font-sans max-w-5xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. PROGRESS ANALYTICS & STATS HEADER */}
      {/* ========================================================================= */}
      <div className="glass-panel p-4 sm:p-5 bg-slate-900/90 border border-emerald-500/20 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <CheckSquare size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Shared Mesh Checklist
                {urgentCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-mono font-bold animate-pulse flex items-center gap-1">
                    <Flame size={12} /> {urgentCount} Urgent
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Multi-peer synchronized task matrix with optimistic updates over offline P2P transport.
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="w-full md:w-72 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Progress:</span>
            <span className="font-bold text-emerald-400">
              {completedTasks} / {totalTasks} done ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TASK CREATOR BAR */}
      {/* ========================================================================= */}
      <form
        onSubmit={handleAddItem}
        className="glass-panel p-3 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center gap-2.5"
      >
        <div className="flex-1 w-full relative">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new collaborative task or objective... (Press Enter)"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Priority Selector */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as ChecklistPriority)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="urgent">🔥 Urgent Priority</option>
            <option value="high">⚡ High Priority</option>
            <option value="medium">🔹 Medium Priority</option>
            <option value="low">▫️ Low Priority</option>
          </select>

          {/* Assignee Selector */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[140px] truncate"
          >
            <option value="unassigned">Unassigned</option>
            <option value={profile.userId}>@{profile.username} (You)</option>
            {availablePeers.map((peer) => (
              <option key={peer.deviceId} value={peer.deviceId}>
                @{peer.username}
              </option>
            ))}
          </select>

          {/* Add Button */}
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.3)] transition"
          >
            <Plus size={16} />
            <span>Add Task</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 3. FILTER, SEARCH & CLEAR COMPLETED BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'pending'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({items.filter((i) => !i.completed).length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed ({completedTasks})
          </button>
        </div>

        {/* Search & Clear Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-36 sm:w-44"
            />
          </div>

          {completedTasks > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition"
              title="Remove all completed tasks"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear Done</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TASK ITEMS LIST */}
      {/* ========================================================================= */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="glass-panel p-12 text-center space-y-3 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400 mx-auto">
              <ListTodo size={24} />
            </div>
            <h4 className="text-sm font-bold text-white">No tasks matching current filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {items.length === 0
                ? 'Your collaborative task list is empty. Add a task above to start tracking with peers!'
                : 'Try adjusting your status or search filters to view your tasks.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const pConfig = PRIORITY_CONFIG[item.priority];
            const isEditing = editingItemId === item.itemId;

            return (
              <div
                key={item.itemId}
                className={`glass-panel p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 group ${
                  item.completed
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-65'
                    : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                }`}
              >
                {/* Left: Checkbox & Content */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Custom Cyberpunk Checkbox */}
                  <button
                    onClick={() => handleToggleItem(item)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                      item.completed
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : 'bg-slate-950 border-slate-700 hover:border-emerald-400 text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Title or Edit Input */}
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(item.itemId);
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                          autoFocus
                          className="w-full px-2.5 py-1 rounded bg-slate-950 border border-emerald-500 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(item.itemId)}
                          className="p-1 rounded bg-emerald-600 text-white text-xs"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white text-xs"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p
                        onClick={() => handleToggleItem(item)}
                        className={`text-xs font-semibold cursor-pointer select-none transition ${
                          item.completed
                            ? 'line-through text-slate-400'
                            : 'text-white hover:text-emerald-300'
                        }`}
                      >
                        {item.title}
                      </p>
                    )}

                    {/* Metadata Badges: Priority, Author, Assignee, Completed By */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                      {/* Priority Badge */}
                      <span className={`px-2 py-0.5 rounded-full border ${pConfig.bg} ${pConfig.text} ${pConfig.border} flex items-center gap-1`}>
                        <span>{pConfig.icon}</span>
                        <span>{pConfig.label}</span>
                      </span>

                      {/* Author */}
                      <span className="text-slate-400">
                        by <span className="text-slate-300 font-medium">@{item.createdByName}</span>
                      </span>

                      {/* Assignee */}
                      {item.assignedToName && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <User size={10} /> @{item.assignedToName}
                        </span>
                      )}

                      {/* Completed Confirmation */}
                      {item.completed && item.completedByName && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Completed by @{item.completedByName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Item Actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition shrink-0">
                  {!item.completed && (
                    <button
                      onClick={() => {
                        setEditingItemId(item.itemId);
                        setEditingText(item.title);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                      title="Edit Task Title"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteItem(item.itemId)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition"
                    title="Delete Task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
