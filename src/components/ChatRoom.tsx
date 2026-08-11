import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, PeerDevice, ChatMessage, TransportChannel, MessageStatus } from '../types';
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
  MessageSquare
} from 'lucide-react';

interface ChatRoomProps {
  currentUser: UserProfile;
  peer: PeerDevice;
  onBackToScanner?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, peer, onBackToScanner }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChannel, setActiveChannel] = useState<TransportChannel>(peer.connectionType);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  // Load chat history & subscribe to live P2P network events
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await dbEngine.getMessagesForPeer(currentUser.userId, peer.deviceId);
        setMessages(history);

        // Send 'read' status update for incoming messages from this peer
        history.forEach((msg) => {
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
          if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
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
                className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                  activeChannel === ch
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
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1 shadow-md text-xs sm:text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>

                  <div
                    className={`flex items-center justify-end gap-1.5 text-[10px] font-mono ${
                      isMe ? 'text-blue-200' : 'text-slate-400'
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

      {/* Bottom Message Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
      >
        <button
          type="button"
          onClick={() => setShowQuickEmojis(!showQuickEmojis)}
          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 transition"
          title="Quick Emojis"
        >
          <Smile size={18} />
        </button>

        <input
          type="text"
          placeholder={`Type message to ${peer.username} (P2P ${activeChannel})...`}
          value={inputText}
          onChange={handleInputChange}
          className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
};

