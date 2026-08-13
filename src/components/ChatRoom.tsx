import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, PeerDevice, ChatMessage, TransportChannel, MessageStatus, SharedFile } from '../types';
import { networkService } from '../services/network';
import { dbEngine } from '../services/db';
import {
  Send,
  Wifi,
  Radio,
  Bluetooth,
  Check,
  CheckCheck,
  Smile,
  Trash2,
  ChevronLeft,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Eye,
  Download,
  Loader2
} from 'lucide-react';

interface ChatRoomProps {
  currentUser: UserProfile;
  peer: PeerDevice;
  onBackToScanner?: () => void;
  onSelectFile?: (file: SharedFile) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, peer, onBackToScanner, onSelectFile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChannel, setActiveChannel] = useState<TransportChannel>(peer.connectionType);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat history & subscribe to live P2P network events
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await dbEngine.getMessagesForPeer(currentUser.userId, peer.deviceId);
        // Deduplicate history by messageId or fileAttachment fileId
        const uniqueHistory = history.filter(
          (msg, index, self) =>
            index ===
            self.findIndex(
              (m) =>
                m.messageId === msg.messageId ||
                (m.fileAttachment &&
                  msg.fileAttachment &&
                  m.fileAttachment.fileId === msg.fileAttachment.fileId)
            )
        );
        setMessages(uniqueHistory);

        // Send 'read' status update for incoming messages from this peer
        uniqueHistory.forEach((msg) => {
          if (msg.senderId === peer.deviceId && msg.status !== 'read') {
            networkService.sendAck(peer.deviceId, msg.messageId, 'read');
            dbEngine.updateMessageStatus(msg.messageId, 'read');
          }
        });
      } catch (err) {
        console.error('Error loading chat history:', err);
      }
    }

    loadHistory();

    // Subscribe to incoming messages
    const unsubMsg = networkService.subscribeMessages((newMsg) => {
      if (
        (newMsg.senderId === peer.deviceId && newMsg.receiverId === currentUser.userId) ||
        (newMsg.senderId === currentUser.userId && newMsg.receiverId === peer.deviceId)
      ) {
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m.messageId === newMsg.messageId ||
                (m.fileAttachment &&
                  newMsg.fileAttachment &&
                  m.fileAttachment.fileId === newMsg.fileAttachment.fileId)
            )
          ) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Auto ACK read
        if (newMsg.senderId === peer.deviceId) {
          networkService.sendAck(peer.deviceId, newMsg.messageId, 'read');
          dbEngine.updateMessageStatus(newMsg.messageId, 'read');
        }
      }
    });

    // Subscribe to typing indicator
    const unsubTyping = networkService.subscribeTyping((peerId, typing) => {
      if (peerId === peer.deviceId) {
        setIsPeerTyping(typing);
      }
    });

    // Subscribe to delivery/read ACKs
    const unsubAck = networkService.subscribeAck((messageId, status) => {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, status } : m))
      );
    });

    return () => {
      unsubMsg();
      unsubTyping();
      unsubAck();
    };
  }, [currentUser.userId, peer.deviceId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Trigger typing notification
    networkService.sendTypingStatus(peer.deviceId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      networkService.sendTypingStatus(peer.deviceId, false);
    }, 1500);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const contentToSend = inputText.trim();
    setInputText('');
    setShowQuickEmojis(false);

    // Reset typing status
    networkService.sendTypingStatus(peer.deviceId, false);

    try {
      const sentMsg = await networkService.sendMessage(peer, contentToSend, activeChannel);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handleClearHistory = async () => {
    if (window.confirm(`Clear chat history with ${peer.username}?`)) {
      await dbEngine.clearMessagesForPeer(currentUser.userId, peer.deviceId);
      setMessages([]);
    }
  };

  const handleChannelSwitch = (channel: TransportChannel) => {
    setActiveChannel(channel);
    networkService.setTransportChannel(channel);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          { peer },
          { name: file.name, size: file.size, type: file.type, dataUrl },
          activeChannel
        );
      } catch (err) {
        console.error('Failed to send file:', err);
        alert('Failed to send file over P2P transport');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="glass-panel h-[calc(100vh-100px)] min-h-[500px] flex flex-col overflow-hidden fade-in-up">

      {/* Top Chat Header */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToScanner && (
            <button
              onClick={onBackToScanner}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Back to Peers Scanner"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow"
            style={{
              background: peer.avatar.startsWith('http') || peer.avatar.startsWith('data:') ? undefined : peer.avatar,
            }}
          >
            {peer.avatar.startsWith('http') || peer.avatar.startsWith('data:') ? (
              <img src={peer.avatar} alt={peer.username} className="w-full h-full rounded-xl object-cover" />
            ) : (
              peer.username.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">{peer.username}</h3>
              <span className="badge badge-emerald text-[10px]">Active</span>
            </div>

            <p className="text-[11px] text-slate-400 font-mono truncate">
              Channel: {activeChannel}
            </p>
          </div>
        </div>

        {/* Right Header Controls: Transport Channel Switcher & Actions */}
        <div className="flex items-center gap-2">
          {/* Transport Selector */}
          <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            {(['LAN', 'Wi-Fi Direct', 'Bluetooth'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => handleChannelSwitch(ch)}
                className={`px-2 py-1 rounded transition flex items-center gap-1 ${activeChannel === ch
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {ch === 'LAN' ? <Wifi size={10} /> : ch === 'Wi-Fi Direct' ? <Radio size={10} /> : <Bluetooth size={10} />}
                {ch}
              </button>
            ))}
          </div>

          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
            title="Clear Chat History"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Message Timeline */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/60">
        <div className="text-center py-2">
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
            Direct Peer-to-Peer Channel ({activeChannel})
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
              <MessageSquare size={22} />
            </div>
            <h4 className="text-sm font-bold text-white">Start P2P Conversation</h4>
            <p className="text-xs text-slate-400 max-w-xs">
              Direct offline peer communication over local {activeChannel}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.userId;
            const senderUsername = isMe ? currentUser.username : peer.username;

            return (
              <div
                key={msg.messageId}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} fade-in-up`}
              >
                {/* Username above message */}
                <span className={`text-[11px] font-semibold mb-1 px-1 ${isMe ? 'text-blue-400' : 'text-cyan-400'}`}>
                  {senderUsername}
                </span>

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1 shadow-md text-xs sm:text-sm ${isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-none'
                    }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>

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
                    className={`flex items-center justify-end gap-1.5 text-[10px] font-mono ${isMe ? 'text-blue-200' : 'text-slate-400'
                      }`}
                  >
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                    {/* Transport Channel Badge */}
                    <span className="opacity-70 text-[9px]">({msg.channel})</span>

                    {/* Status Ticks */}
                    {isMe && (
                      <span className="ml-0.5">
                        {msg.status === 'sent' && <Check size={12} className="text-blue-300" title="Sent" />}
                        {msg.status === 'delivered' && <CheckCheck size={12} className="text-slate-300" title="Delivered" />}
                        {msg.status === 'read' && <CheckCheck size={12} className="text-cyan-300 font-bold" title="Read" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Real-time Typing Indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 fade-in-up">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>{peer.username} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      {showQuickEmojis && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-3 fade-in-up shrink-0">
          <span className="text-[11px] font-mono text-slate-400">Quick Emoji:</span>
          {['👍', '🚀', '⚡', '❤️', '😊', '🔥', '🎉'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
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
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Uploading File Bar */}
      {isUploading && (
        <div className="px-4 py-2 bg-blue-950/80 border-t border-blue-800 flex items-center justify-between text-xs text-blue-300 animate-pulse shrink-0">
          <span className="flex items-center gap-2 font-mono">
            <Loader2 size={14} className="animate-spin text-blue-400" />
            Transmitting media/file over P2P transport ({activeChannel})...
          </span>
          <span className="text-[10px] font-mono text-blue-400 uppercase">FR-6 Engine</span>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0 z-10 relative"
      >
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

        <input
          type="text"
          placeholder={`Type message to ${peer.username} (P2P ${activeChannel})...`}
          value={inputText}
          onChange={handleInputChange}
          className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isUploading}
          className="btn btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
};

