import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  PeerDevice,
  GroupChat,
  CollabToolTab,
  CollabPresence,
  DrawingStroke,
  ChecklistItem,
  StickyNote
} from '../types';
import { networkService } from '../services/network';
import { dbEngine } from '../services/db';
import {
  PenTool,
  CheckSquare,
  StickyNote as StickyIcon,
  Users,
  Download,
  Share2,
  Sparkles,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  Activity,
  CheckCircle2,
  Circle,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon
} from 'lucide-react';

interface CollaborationHubProps {
  profile: UserProfile;
  initialSessionId?: string;
  initialSessionType?: 'peer' | 'group' | 'scratch';
  initialTab?: CollabToolTab;
  onOpenChatWithPeer?: (peer: PeerDevice) => void;
}

export const CollaborationHub: React.FC<CollaborationHubProps> = ({
  profile,
  initialSessionId,
  initialSessionType = 'scratch',
  initialTab = 'whiteboard',
  onOpenChatWithPeer
}) => {
  // Navigation & Session State
  const [activeTab, setActiveTab] = useState<CollabToolTab>(initialTab);
  const [sessionType, setSessionType] = useState<'peer' | 'group' | 'scratch'>(initialSessionType);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId || 'local_scratchpad'
  );

  // Available Peers & Groups for Session Switching
  const [availablePeers, setAvailablePeers] = useState<PeerDevice[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupChat[]>([]);
  const [showSessionSelector, setShowSessionSelector] = useState(false);

  // Active Collaborators & Presence
  const [activeCollaborators, setActiveCollaborators] = useState<CollabPresence[]>([]);

  // Local Counts & Previews for Badges
  const [checklistCount, setChecklistCount] = useState<{ total: number; completed: number }>({
    total: 0,
    completed: 0
  });
  const [notesCount, setNotesCount] = useState<number>(0);
  const [strokesCount, setStrokesCount] = useState<number>(0);

  // Export Modal State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Subscribe to discovered peers and groups
  useEffect(() => {
    const unsubPeers = networkService.subscribePeers((peers) => {
      setAvailablePeers(peers.filter((p) => p.deviceId !== profile.userId));
    });

    const unsubGroups = networkService.subscribeGroups((groups) => {
      setAvailableGroups(groups);
    });

    return () => {
      unsubPeers();
      unsubGroups();
    };
  }, [profile.userId]);

  // Handle Session Name & Display Info
  const currentSessionName = React.useMemo(() => {
    if (sessionType === 'peer') {
      const peer = availablePeers.find((p) => p.deviceId === selectedSessionId);
      return peer ? `@${peer.username} (P2P Mesh)` : `Direct P2P Link (${selectedSessionId.substring(0, 8)})`;
    }
    if (sessionType === 'group') {
      const group = availableGroups.find((g) => g.groupId === selectedSessionId);
      return group ? `${group.groupName} (Group Hub)` : `Group Channel (${selectedSessionId.substring(0, 8)})`;
    }
    return 'Local Mesh Scratchpad (All Transports)';
  }, [sessionType, selectedSessionId, availablePeers, availableGroups]);

  // Export handlers
  const handleExportData = (format: 'markdown' | 'json' | 'png') => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fasdm_collab_${activeTab}_${timestamp}`;

      if (format === 'json') {
        const dataPayload = {
          exportType: 'FasDM_Collaboration_Snapshot',
          tab: activeTab,
          sessionId: selectedSessionId,
          sessionType,
          exportedBy: profile.username,
          exportedAt: Date.now(),
          metadata: {
            strokesCount,
            checklistCount,
            notesCount
          }
        };
        const blob = new Blob([JSON.stringify(dataPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'markdown') {
        const mdContent = `# FasDM Collaboration Export: ${activeTab.toUpperCase()}\n\n` +
          `* **Session**: ${currentSessionName}\n` +
          `* **Exported By**: ${profile.username}\n` +
          `* **Timestamp**: ${new Date().toLocaleString()}\n\n` +
          `---\n\n` +
          `### Workspace Summary\n` +
          `- Active Tab: ${activeTab}\n` +
          `- Total Checklist Items: ${checklistCount.total} (${checklistCount.completed} completed)\n` +
          `- Total Sticky Notes: ${notesCount}\n` +
          `- Total Drawing Strokes: ${strokesCount}\n`;

        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'png') {
        // Trigger Whiteboard PNG export if active, or capture notice
        const canvasElem = document.querySelector('canvas#fasdm-whiteboard-canvas') as HTMLCanvasElement | null;
        if (canvasElem) {
          const imageUri = canvasElem.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = imageUri;
          a.download = `${filename}.png`;
          a.click();
        } else {
          alert('Switch to the Whiteboard tab to export the canvas drawing as PNG.');
        }
      }

      setExportFeedback(`Exported ${format.toUpperCase()} snapshot successfully!`);
      setTimeout(() => setExportFeedback(null), 3500);
      setShowExportMenu(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP COLLABORATION HEADER BAR & SESSION SWITCHER */}
      {/* ========================================================================= */}
      <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-cyan-500/20 bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl">
        {/* Left Side: Session Context Selector */}
        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Layers size={22} className="animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Mesh Collaboration Hub
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
                {sessionType.toUpperCase()}
              </span>
            </div>

            {/* Session dropdown trigger */}
            <button
              onClick={() => setShowSessionSelector(!showSessionSelector)}
              className="mt-0.5 flex items-center gap-2 text-base font-bold text-white hover:text-cyan-300 transition group text-left"
            >
              <span className="truncate max-w-[280px] sm:max-w-md">{currentSessionName}</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showSessionSelector ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Session Switcher Dropdown Modal */}
          {showSessionSelector && (
            <div className="absolute top-14 left-0 z-50 w-80 sm:w-96 bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase font-mono">Select Active Mesh Session</span>
                <button
                  onClick={() => setShowSessionSelector(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>

              {/* Local Scratchpad option */}
              <button
                onClick={() => {
                  setSessionType('scratch');
                  setSelectedSessionId('local_scratchpad');
                  setShowSessionSelector(false);
                }}
                className={`w-full p-2.5 rounded-lg flex items-center gap-3 transition text-left text-xs font-semibold ${
                  sessionType === 'scratch'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 font-bold">
                  ★
                </div>
                <div>
                  <p className="font-bold text-white">Local Mesh Scratchpad</p>
                  <p className="text-[10px] text-slate-400">Universal scratchpad shared across local tabs</p>
                </div>
              </button>

              {/* Discovered Peers */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-slate-500 font-bold px-1">Discovered Peers (1-to-1)</p>
                {availablePeers.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic px-2 py-1">No peer devices connected</p>
                ) : (
                  availablePeers.map((peer) => (
                    <button
                      key={peer.deviceId}
                      onClick={() => {
                        setSessionType('peer');
                        setSelectedSessionId(peer.deviceId);
                        setShowSessionSelector(false);
                      }}
                      className={`w-full p-2 rounded-lg flex items-center justify-between transition text-xs ${
                        sessionType === 'peer' && selectedSessionId === peer.deviceId
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: peer.avatar || '#0284c7' }}
                        >
                          {peer.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white truncate">@{peer.username}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                        {peer.connectionType}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Group Channels */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-slate-500 font-bold px-1">Group Channels</p>
                {availableGroups.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic px-2 py-1">No active group hubs created</p>
                ) : (
                  availableGroups.map((group) => (
                    <button
                      key={group.groupId}
                      onClick={() => {
                        setSessionType('group');
                        setSelectedSessionId(group.groupId);
                        setShowSessionSelector(false);
                      }}
                      className={`w-full p-2 rounded-lg flex items-center justify-between transition text-xs ${
                        sessionType === 'group' && selectedSessionId === group.groupId
                          ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: group.avatarColor || '#7c3aed' }}
                        >
                          {group.groupName.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white truncate">{group.groupName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-400">
                        {group.members.length} members
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active Collaborators Presence & Export Tools */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Active Collaborators Bar */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Active Nodes:</span>
            </div>
            <div className="flex items-center -space-x-2">
              {/* Local User */}
              <div
                title={`${profile.username} (You)`}
                className="w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow"
                style={{ backgroundColor: profile.avatar || '#0284c7' }}
              >
                {profile.username.substring(0, 2).toUpperCase()}
              </div>

              {/* Remote Collaborators */}
              {activeCollaborators.length > 0 ? (
                activeCollaborators.slice(0, 3).map((collab) => (
                  <div
                    key={collab.userId}
                    title={`${collab.username} (${collab.activeTab})`}
                    className="w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-emerald-500/50 shadow"
                    style={{ backgroundColor: collab.avatar || '#10b981' }}
                  >
                    {collab.username.substring(0, 2).toUpperCase()}
                  </div>
                ))
              ) : availablePeers.length > 0 ? (
                <div
                  title={`Ready to sync with ${availablePeers.length} discovered peers`}
                  className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-cyan-400 font-mono font-bold"
                >
                  +{availablePeers.length}
                </div>
              ) : null}
            </div>
          </div>

          {/* Export & Snapshot Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow"
            >
              <Download size={14} className="text-cyan-400" />
              <span>Snapshot / Export</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {/* Export Menu Dropdown */}
            {showExportMenu && (
              <div className="absolute right-0 top-12 z-50 w-56 bg-slate-950/95 border border-slate-700 rounded-xl p-2 shadow-2xl backdrop-blur-xl space-y-1">
                <button
                  onClick={() => handleExportData('png')}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                >
                  <ImageIcon size={14} className="text-cyan-400" />
                  <span>Export Whiteboard (PNG)</span>
                </button>
                <button
                  onClick={() => handleExportData('markdown')}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                >
                  <FileCode size={14} className="text-emerald-400" />
                  <span>Export Markdown Summary (.md)</span>
                </button>
                <button
                  onClick={() => handleExportData('json')}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                >
                  <FileSpreadsheet size={14} className="text-purple-400" />
                  <span>Export Raw State (.json)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Notification Pill */}
      {exportFeedback && (
        <div className="p-2.5 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          {exportFeedback}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THREE-TAB WORKSPACE NAVIGATION BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          {/* Tab 1: Whiteboard */}
          <button
            onClick={() => setActiveTab('whiteboard')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'whiteboard'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <PenTool size={15} className={activeTab === 'whiteboard' ? 'text-cyan-200' : ''} />
            <span>Shared Whiteboard</span>
            {strokesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                {strokesCount}
              </span>
            )}
          </button>

          {/* Tab 2: Checklist */}
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'checklist'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CheckSquare size={15} className={activeTab === 'checklist' ? 'text-emerald-200' : ''} />
            <span>Shared Checklist</span>
            {checklistCount.total > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono text-emerald-200">
                {checklistCount.completed}/{checklistCount.total}
              </span>
            )}
          </button>

          {/* Tab 3: Sticky Notes */}
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'notes'
                ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <StickyIcon size={15} className={activeTab === 'notes' ? 'text-purple-200' : ''} />
            <span>Sticky Notes</span>
            {notesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono text-purple-200">
                {notesCount}
              </span>
            )}
          </button>
        </div>

        {/* Real-Time Sync Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 text-[11px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>OFFLINE-FIRST P2P REPLICATION ACTIVE</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COLLABORATION WORKSPACE CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="w-full min-h-[600px] rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-lg p-3 sm:p-5 relative overflow-hidden">
        {/* Whiteboard Workspace Placeholder / Component */}
        {activeTab === 'whiteboard' && (
          <div className="w-full h-full flex flex-col items-center justify-center min-h-[540px] text-center p-6 border-2 border-dashed border-cyan-500/20 rounded-xl bg-cyan-950/10">
            <div className="w-16 h-16 rounded-2xl bg-cyan-900/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] mb-4">
              <PenTool size={32} className="animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wide">Shared Whiteboard Engine</h3>
            <p className="text-slate-400 text-xs max-w-md mt-1.5 mb-6">
              Synchronized HTML5 2D Canvas with resolution-independent coordinate normalization, cyberpunk color palettes, smoothing interpolation, and vector stroke streaming over P2P mesh packets.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-cyan-300">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30">Submodule 10.3 Engine</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">COLLAB_WHITEBOARD_ACTION</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">60 FPS Throttle</span>
            </div>
          </div>
        )}

        {/* Checklist Workspace Placeholder / Component */}
        {activeTab === 'checklist' && (
          <div className="w-full h-full flex flex-col items-center justify-center min-h-[540px] text-center p-6 border-2 border-dashed border-emerald-500/20 rounded-xl bg-emerald-950/10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] mb-4">
              <CheckSquare size={32} className="animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wide">Interactive Multi-User Checklist</h3>
            <p className="text-slate-400 text-xs max-w-md mt-1.5 mb-6">
              Collaborative task lists with optimistic real-time checkbox status toggles, priority tags (Urgent, High, Medium, Low), assignee filters, and animated completion progress meters.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-emerald-300">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/30">Submodule 10.4 Engine</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">COLLAB_CHECKLIST_ACTION</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">Optimistic UI</span>
            </div>
          </div>
        )}

        {/* Sticky Notes Workspace Placeholder / Component */}
        {activeTab === 'notes' && (
          <div className="w-full h-full flex flex-col items-center justify-center min-h-[540px] text-center p-6 border-2 border-dashed border-purple-500/20 rounded-xl bg-purple-950/10">
            <div className="w-16 h-16 rounded-2xl bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)] mb-4">
              <StickyIcon size={32} className="animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wide">Collaborative Sticky Notes Board</h3>
            <p className="text-slate-400 text-xs max-w-md mt-1.5 mb-6">
              Interactive 2D drag-and-drop workspace for movable sticky notes with cyberpunk pastel palettes, concurrency edit locks, pin-to-top, and instant mesh delta replication.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-purple-300">
              <span className="px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-500/30">Submodule 10.5 Engine</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">COLLAB_STICKY_ACTION</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">2D Board Space</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
