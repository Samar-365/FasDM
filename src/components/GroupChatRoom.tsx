import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GroupChat, GroupMessage, PeerDevice, TransportChannel, SharedFile, VoiceNote } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { networkService } from '../services/network';
import { dbEngine } from '../services/db';
import {
  Users,
  Plus,
  Send,
  Shield,
  Trash2,
  UserX,
  LogOut,
  ChevronLeft,
  MessageSquare,
  Radio,
  Smile,
  Info,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Eye,
  Download,
  Loader2
} from 'lucide-react';

interface GroupChatRoomProps {
  currentUser: UserProfile;
  onSelectFile?: (file: SharedFile) => void;
}

export const GroupChatRoom: React.FC<GroupChatRoomProps> = ({ currentUser, onSelectFile }) => {
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [availablePeers, setAvailablePeers] = useState<PeerDevice[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);

  // Form state
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Subscribe to live P2P groups list and available peers
  useEffect(() => {
    const unsubGroups = networkService.subscribeGroups((updatedGroups) => {
      setGroups(updatedGroups);
      // Keep selectedGroup state synchronized
      if (selectedGroup) {
        const found = updatedGroups.find((g) => g.groupId === selectedGroup.groupId);
        if (found) setSelectedGroup(found);
        else setSelectedGroup(null);
      }
    });

    const unsubPeers = networkService.subscribePeers((peers) => {
      setAvailablePeers(peers.filter((p) => p.deviceId !== currentUser.userId));
    });

    return () => {
      unsubGroups();
      unsubPeers();
    };
  }, [selectedGroup?.groupId]);

  // 2. Load group messages & subscribe to real-time group message events when group selected
  useEffect(() => {
    if (!selectedGroup) return;

    async function loadGroupMessages() {
      try {
        const history = await dbEngine.getGroupMessages(selectedGroup!.groupId);
        // Deduplicate history by messageId, fileId, or voiceId
        const uniqueHistory = history.filter(
          (msg, index, self) =>
            index ===
            self.findIndex(
              (m) =>
                m.messageId === msg.messageId ||
                (m.fileAttachment &&
                  msg.fileAttachment &&
                  m.fileAttachment.fileId === msg.fileAttachment.fileId) ||
                (m.voiceNote &&
                  msg.voiceNote &&
                  m.voiceNote.voiceId === msg.voiceNote.voiceId)
            )
        );
        setMessages(uniqueHistory);
      } catch (err) {
        console.error('Error loading group message history:', err);
      }
    }

    loadGroupMessages();

    const unsubGroupMsgs = networkService.subscribeGroupMessages((gId, newMsg) => {
      if (gId === selectedGroup.groupId) {
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m.messageId === newMsg.messageId ||
                (m.fileAttachment &&
                  newMsg.fileAttachment &&
                  m.fileAttachment.fileId === newMsg.fileAttachment.fileId) ||
                (m.voiceNote &&
                  newMsg.voiceNote &&
                  m.voiceNote.voiceId === newMsg.voiceNote.voiceId)
            )
          ) {
            return prev;
          }
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      unsubGroupMsgs();
    };
  }, [selectedGroup?.groupId]);

  // Auto-scroll timeline
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Create Group Form Submit
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;

    const invitedPeers = availablePeers.filter((p) => selectedPeerIds.includes(p.deviceId));

    try {
      const newGroup = await networkService.createGroup(
        groupNameInput.trim(),
        groupDescInput.trim(),
        invitedPeers
      );
      setSelectedGroup(newGroup);
      setGroupNameInput('');
      setGroupDescInput('');
      setSelectedPeerIds([]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const togglePeerSelection = (peerId: string) => {
    setSelectedPeerIds((prev) =>
      prev.includes(peerId) ? prev.filter((id) => id !== peerId) : [...prev, peerId]
    );
  };

  // Handle Send Group Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedGroup) return;

    const textToSend = inputText.trim();
    setInputText('');
    setShowQuickEmojis(false);

    try {
      const sentMsg = await networkService.sendGroupMessage(selectedGroup.groupId, textToSend);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      console.error('Failed to send group message:', err);
    }
  };

  // Handle Admin Action: Delete Group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (window.confirm(`Are you sure you want to delete group "${selectedGroup.groupName}" for all members?`)) {
      await networkService.deleteGroup(selectedGroup.groupId);
      setSelectedGroup(null);
      setShowMembersModal(false);
    }
  };

  // Handle Action: Leave Group or Remove Member
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!selectedGroup) return;
    const isSelf = memberId === currentUser.userId;
    const confirmMsg = isSelf
      ? `Leave group "${selectedGroup.groupName}"?`
      : `Remove ${memberName} from group?`;

    if (window.confirm(confirmMsg)) {
      await networkService.removeMemberFromGroup(selectedGroup.groupId, memberId);
      if (isSelf) {
        setSelectedGroup(null);
        setShowMembersModal(false);
      }
    }
  };

  const handleGroupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroup) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds maximum limit of 25MB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        await networkService.sendFile(
          { groupId: selectedGroup.groupId },
          { name: file.name, size: file.size, type: file.type, dataUrl }
        );
      } catch (err) {
        console.error('Failed to send file to group:', err);
        alert('Failed to send file across group transport');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  // ── Group Voice Note Send Handler (Submodules 8.3 & 8.5) ─────────────────
  const handleVoiceNoteSend = async (
    audioData: string,
    durationMs: number,
    mimeType: string,
    fileSize: number
  ) => {
    if (!selectedGroup) return;

    try {
      await networkService.sendVoiceNote(
        { groupId: selectedGroup.groupId },
        { audioData, durationMs, mimeType, fileSize }
      );
    } catch (err) {
      console.error('Failed to send group voice note:', err);
      alert('Failed to transmit voice note across group mesh');
    } finally {
      setIsRecording(false);
    }
  };

  const isAdmin = selectedGroup?.adminId === currentUser.userId;

  return (
    <div className="space-y-6 fade-in-up">
      {/* Group Hub Top Bar */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Users size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white">Group Messaging & Administration</h2>
              <span className="badge badge-cyan">{groups.length} Active Groups</span>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <Radio size={14} className="text-emerald-400" /> Offline multi-node P2P message broadcast
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus size={16} /> Create P2P Mesh Group
        </button>
      </div>

      {/* Main View: Group Chat Room or Group List Grid */}
      {selectedGroup ? (
        /* ACTIVE GROUP CHAT ROOM */
        <div className="glass-panel h-[calc(100vh-180px)] min-h-[520px] flex flex-col overflow-hidden fade-in-up">
          {/* Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Back to Groups List"
              >
                <ChevronLeft size={18} />
              </button>

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow"
                style={{ backgroundColor: selectedGroup.avatarColor }}
              >
                {selectedGroup.groupName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{selectedGroup.groupName}</h3>
                  {isAdmin && (
                    <span className="badge badge-purple text-[10px] flex items-center gap-1">
                      <Shield size={10} /> Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  {selectedGroup.members.length} Members • Created by {selectedGroup.adminName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMembersModal(true)}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Users size={14} /> Members ({selectedGroup.members.length})
              </button>
            </div>
          </div>

          {/* Messages Timeline */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/60">
            <div className="text-center py-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                Encrypted Mesh Channel ({selectedGroup.groupName})
              </span>
            </div>

            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-sm font-bold text-white">Group Room Active</h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  Send a broadcast message to all {selectedGroup.members.length} member nodes in this local network.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.userId;

                return (
                  <div
                    key={msg.messageId}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} fade-in-up`}
                  >
                    {/* Sender Name & Avatar above every message */}
                    <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{
                          background: msg.senderAvatar.startsWith('#') ? msg.senderAvatar : (isMe ? '#2563eb' : '#0284c7'),
                        }}
                      >
                        {(msg.senderName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[11px] font-semibold ${isMe ? 'text-blue-400' : 'text-cyan-400'}`}>
                        {isMe ? `${msg.senderName} (You)` : msg.senderName}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl space-y-1 shadow-md text-xs sm:text-sm ${
                        msg.voiceNote ? 'p-1.5 max-w-fit' : 'max-w-[80%] px-4 py-2.5'
                      } ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-none'
                      }`}
                    >
                      {/* Text content (hidden if message only contains a voiceNote) */}
                      {(!msg.voiceNote || (msg.content && !msg.content.startsWith('🎙️ Voice Note'))) && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      )}

                      {/* Inline Group Voice Note Player (Submodule 8.4) */}
                      {msg.voiceNote && (
                        <VoiceNotePlayer voiceNote={msg.voiceNote} isSelf={isMe} />
                      )}

                      {/* Inline Group File Attachment / Image Thumbnail Card */}
                      {msg.fileAttachment && (
                        <div style={{ marginTop: '6px', padding: '4px', background: '#020617', border: '1px solid #334155', width: '120px', flexShrink: 0 }}>
                          {msg.fileAttachment.fileType.startsWith('image/') ? (
                            <div
                              onClick={() => onSelectFile && onSelectFile(msg.fileAttachment!)}
                              style={{ cursor: 'pointer', overflow: 'hidden', width: '100%', height: '80px', border: '1px solid #1e293b', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                              title={`Click to view ${msg.fileAttachment.fileName}`}
                            >
                              <img
                                src={msg.fileAttachment.fileData}
                                alt={msg.fileAttachment.fileName}
                                style={{ maxHeight: '76px', maxWidth: '100%', objectFit: 'contain' }}
                              />
                            </div>
                          ) : msg.fileAttachment.fileType.startsWith('video/') ? (
                            <div
                              onClick={() => onSelectFile && onSelectFile(msg.fileAttachment!)}
                              style={{ cursor: 'pointer', overflow: 'hidden', width: '100%', height: '80px', border: '1px solid #1e293b', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                              title={`Click to play ${msg.fileAttachment.fileName}`}
                            >
                              <video
                                src={msg.fileAttachment.fileData}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                              />
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, gap: '3px' }}>
                                <Eye size={11} /> Play
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => onSelectFile && onSelectFile(msg.fileAttachment!)}
                              style={{ cursor: 'pointer', width: '100%', height: '80px', border: '1px solid #1e293b', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px' }}
                              title={`View ${msg.fileAttachment.fileName}`}
                            >
                              <div style={{ padding: '4px', background: 'rgba(37,99,235,0.15)', color: '#60a5fa' }}>
                                <FileText size={16} />
                              </div>
                              <p style={{ fontSize: '9px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', margin: 0 }}>
                                {msg.fileAttachment.fileName}
                              </p>
                            </div>
                          )}

                          {/* File name + size */}
                          <div style={{ padding: '3px 2px 0', overflow: 'hidden' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={msg.fileAttachment.fileName}>
                              {msg.fileAttachment.fileName}
                            </p>
                            <p style={{ fontSize: '8px', fontFamily: 'monospace', color: '#94a3b8', margin: '1px 0 0' }}>
                              {(msg.fileAttachment.fileSize / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>

                          {/* View + Download */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', paddingTop: '3px', borderTop: '1px solid #1e293b' }}>
                            <button
                              onClick={() => onSelectFile && onSelectFile(msg.fileAttachment!)}
                              style={{ flex: 1, padding: '2px 4px', background: '#2563eb', color: '#fff', border: 'none', fontSize: '9px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                              title="View Full"
                            >
                              <Eye size={9} /> View
                            </button>
                            <a
                              href={msg.fileAttachment.fileData}
                              download={msg.fileAttachment.fileName}
                              style={{ padding: '2px 4px', background: '#1e293b', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
                              title="Download"
                            >
                              <Download size={9} />
                            </a>
                          </div>
                        </div>
                      )}

                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] font-mono ${isMe ? 'text-blue-200' : 'text-slate-400'
                          }`}
                      >
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="opacity-70 text-[9px]">({msg.channel})</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Emoji Bar */}
          {showQuickEmojis && (
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-3 fade-in-up shrink-0">
              <span className="text-[11px] font-mono text-slate-400">Group Emoji:</span>
              {['👍', '🙌', '🚀', '🔥', '🎉', '⚡', '💯'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setInputText((prev) => prev + emoji)}
                  className="text-lg hover:scale-125 transition transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleGroupFileSelect}
            style={{ display: 'none' }}
          />

          {/* Uploading File Indicator */}
          {isUploading && (
            <div className="px-4 py-2 bg-blue-950/80 border-t border-blue-800 flex items-center justify-between text-xs text-blue-300 animate-pulse shrink-0">
              <span className="flex items-center gap-2 font-mono">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                Distributing media/file to group members across P2P mesh...
              </span>
              <span className="text-[10px] font-mono text-blue-400 uppercase">FR-6 Engine</span>
            </div>
          )}

          {/* Bottom Message Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0 z-10 relative"
          >
            {!isRecording && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-700 border border-slate-700/80 transition disabled:opacity-50 shrink-0 flex items-center justify-center cursor-pointer"
                  title="Attach Image or File (Max 25MB)"
                >
                  <Paperclip size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickEmojis(!showQuickEmojis)}
                  className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 border border-slate-700/80 transition shrink-0 flex items-center justify-center cursor-pointer"
                  title="Quick Emojis"
                >
                  <Smile size={18} />
                </button>
              </>
            )}

            {/* Group Voice Recorder — replaces text input when recording */}
            <AudioRecorder
              onSend={handleVoiceNoteSend}
              onCancel={() => setIsRecording(false)}
              onRecordingStart={() => setIsRecording(true)}
            />

            {!isRecording && (
              <>
                <input
                  type="text"
                  placeholder={`Message group ${selectedGroup.groupName}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isUploading}
                  className="btn btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={14} /> Send Group
                </button>
              </>
            )}
          </form>
        </div>
      ) : (
        /* GROUPS OVERVIEW GRID */
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="glass-panel p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500">
                <Users size={24} />
              </div>
              <h3 className="text-base font-bold text-white">No Local Mesh Groups Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Create a group chat room to communicate with multiple nearby users over local transport mediums.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
                >
                  <Plus size={14} /> Create First P2P Group
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div
                  key={group.groupId}
                  onClick={() => setSelectedGroup(group)}
                  className="glass-panel p-5 flex flex-col justify-between space-y-4 hover:border-slate-600 transition cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow"
                          style={{ backgroundColor: group.avatarColor }}
                        >
                          {group.groupName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition truncate max-w-[150px]">
                            {group.groupName}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {group.members.length} member node{group.members.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>

                      {group.adminId === currentUser.userId && (
                        <span className="badge badge-purple text-[10px]">Admin</span>
                      )}
                    </div>

                    {group.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[11px]">
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-blue-400 font-medium group-hover:underline flex items-center gap-1">
                      Open Room <ChevronLeft size={14} className="rotate-180" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 fade-in-up">
          <div className="glass-panel max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-400" /> Create P2P Mesh Group Room
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hackathon Team Alpha"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Off-grid mesh team chat"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Invite Discovered Peer Nodes ({selectedPeerIds.length} selected)
                </label>

                {availablePeers.length === 0 ? (
                  <p className="text-[11px] text-amber-400 bg-amber-950/40 p-2.5 rounded border border-amber-500/30 flex items-center gap-1.5">
                    <Info size={14} /> No active peers discovered yet. You can still create the group and peers can join later!
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {availablePeers.map((peer) => {
                      const isSelected = selectedPeerIds.includes(peer.deviceId);
                      return (
                        <div
                          key={peer.deviceId}
                          onClick={() => togglePeerSelection(peer.deviceId)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${isSelected
                            ? 'bg-blue-950/70 border-blue-500 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{
                                background: peer.avatar.startsWith('#') ? peer.avatar : '#0284c7',
                              }}
                            />
                            <span className="font-semibold truncate">{peer.username}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {peer.connectionType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupNameInput.trim()}
                  className="btn btn-primary text-xs py-2 px-4 disabled:opacity-50"
                >
                  Create & Launch Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GROUP MEMBERS & ADMIN CONTROLS MODAL */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 fade-in-up">
          <div className="glass-panel max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-400" /> {selectedGroup.groupName} Members
              </h3>
              <button onClick={() => setShowMembersModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedGroup.members.map((member) => {
                const isMemberSelf = member.userId === currentUser.userId;
                const isMemberAdmin = member.role === 'admin';

                return (
                  <div
                    key={member.userId}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{
                          background: member.avatar.startsWith('#') ? member.avatar : '#0284c7',
                        }}
                      >
                        {member.username.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white truncate">
                            {member.username} {isMemberSelf && '(You)'}
                          </span>
                          {isMemberAdmin && (
                            <span className="badge badge-purple text-[9px]">Admin</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div>
                      {isAdmin && !isMemberSelf && (
                        <button
                          onClick={() => handleRemoveMember(member.userId, member.username)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded transition"
                          title="Remove Member"
                        >
                          <UserX size={14} />
                        </button>
                      )}

                      {isMemberSelf && (
                        <button
                          onClick={() => handleRemoveMember(member.userId, member.username)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded transition text-[11px] flex items-center gap-1 font-mono"
                          title="Leave Group"
                        >
                          <LogOut size={12} /> Leave
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Admin Delete Group Button */}
            {isAdmin && (
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={handleDeleteGroup}
                  className="btn btn-secondary w-full text-xs py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Group Room Entirely
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
