import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, PeerDevice, DashboardTab, SharedFile } from '../types';
import { cryptoService } from '../services/crypto';
import { networkService } from '../services/network';
import { dbEngine } from '../services/db';
import { PeerScanner } from './PeerScanner';
import { ChatRoom } from './ChatRoom';
import { GroupChatRoom } from './GroupChatRoom';
import { FileViewerModal } from './FileViewerModal';
import { CollaborationHub } from './CollaborationHub';
import {
  Shield,
  QrCode,
  Radio,
  Wifi,
  Users,
  MessageSquare,
  LayoutDashboard,
  ArrowRight,
  FileText,
  Bell,
  Layers
} from 'lucide-react';

interface DashboardProps {
  profile: UserProfile;
  onEditProfile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, onEditProfile }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedPeerForChat, setSelectedPeerForChat] = useState<PeerDevice | null>(null);
  const [discoveredPeersCount, setDiscoveredPeersCount] = useState(0);
  const [sharedFilesCount, setSharedFilesCount] = useState(0);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<SharedFile | null>(null);
  const [unreadPeerIds, setUnreadPeerIds] = useState<Set<string>>(new Set());

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Refs for tracking active view state inside long-lived event listeners without stale closures
  const activeTabRef = useRef(activeTab);
  const selectedPeerRef = useRef(selectedPeerForChat);

  useEffect(() => {
    activeTabRef.current = activeTab;
    selectedPeerRef.current = selectedPeerForChat;
  }, [activeTab, selectedPeerForChat]);

  // Immediately clear unread notification highlight whenever the chatroom for that peer is opened/active
  useEffect(() => {
    if (activeTab === 'chat' && selectedPeerForChat) {
      const peerId = selectedPeerForChat.deviceId;
      setUnreadPeerIds((prev) => {
        if (!prev.has(peerId)) return prev;
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    }
  }, [activeTab, selectedPeerForChat]);

  // Initialize P2P Network Service & Counters
  useEffect(() => {
    networkService.start(profile);

    // Load initial unread message senders from DB
    dbEngine.getUnreadSenders(profile.userId).then((senders) => {
      if (senders.length > 0) {
        setUnreadPeerIds(new Set(senders));
      }
    }).catch(console.warn);

    const unsubPeers = networkService.subscribePeers((peers) => {
      setDiscoveredPeersCount(peers.length);
    });

    const unsubFiles = networkService.subscribeFiles(() => {
      loadFilesCount();
    });

    // Listen to real-time incoming messages to trigger unread notifications if chatroom is not active
    const unsubMessages = networkService.subscribeMessages((msg) => {
      if (msg.receiverId === profile.userId && msg.senderId !== profile.userId) {
        setUnreadPeerIds((prev) => {
          // If currently actively chatting with this peer on chat tab, ignore
          const isCurrentlyChatting =
            activeTabRef.current === 'chat' && selectedPeerRef.current?.deviceId === msg.senderId;
          if (isCurrentlyChatting) return prev;
          return new Set(prev).add(msg.senderId);
        });
      }
    });

    loadFilesCount();

    return () => {
      unsubPeers();
      unsubFiles();
      unsubMessages();
      networkService.stop();
    };
  }, [profile]);

  const loadFilesCount = async () => {
    try {
      const files = await dbEngine.getAllFiles();
      setSharedFilesCount(files.length);
    } catch (err) {
      console.warn('Failed to load files count:', err);
    }
  };

  const openQRModal = async () => {
    try {
      const payload = cryptoService.formatQRPayload(
        profile.userId,
        profile.username
      );
      const url = await cryptoService.generateQRCodeDataURL(payload);
      setQrCodeUrl(url);
      setShowQRModal(true);
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
    }
  };

  const handleSelectPeerForChat = (peer: PeerDevice) => {
    setSelectedPeerForChat(peer);
    setActiveTab('chat');
    // Clear unread notification for this peer right after chatroom is opened
    setUnreadPeerIds((prev) => {
      const next = new Set(prev);
      next.delete(peer.deviceId);
      return next;
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-8 bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Navigation Tabs Header */}
        <div className="glass-panel p-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <LayoutDashboard size={14} /> System Overview
            </button>

            <button
              onClick={() => setActiveTab('peers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 relative ${activeTab === 'peers'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Users size={14} /> Nearby Devices
              {unreadPeerIds.size > 0 ? (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold animate-pulse shadow-md flex items-center gap-1">
                  <Bell size={10} className="animate-spin" /> {unreadPeerIds.size} New
                </span>
              ) : discoveredPeersCount > 0 ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-500/30">
                  {discoveredPeersCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setActiveTab('chat');
                if (selectedPeerForChat) {
                  setUnreadPeerIds((prev) => {
                    const next = new Set(prev);
                    next.delete(selectedPeerForChat.deviceId);
                    return next;
                  });
                }
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'chat'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <MessageSquare size={14} /> Direct P2P Chat
              {selectedPeerForChat && (
                <span className="text-[10px] text-blue-300 truncate max-w-[90px]">
                  ({selectedPeerForChat.username.split(' ')[0]})
                </span>
              )}
              {unreadPeerIds.size > 0 && activeTab !== 'chat' && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'groups'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Users size={14} /> Group Hub
            </button>

            <button
              onClick={() => setActiveTab('collab')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'collab'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Layers size={14} /> Collab Hub
            </button>
          </div>
        </div>

        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 fade-in-up">
            {/* Welcome Header */}
            <div className="glass-panel p-6 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                    style={{
                      background: profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? undefined : profile.avatar,
                    }}
                  >
                    {profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? (
                      <img src={profile.avatar} alt={profile.username} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      profile.username.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-bold text-white">
                        Welcome, <span className="text-blue-400">{profile.username}</span>
                      </h1>
                      <span className="badge badge-emerald">Node Active</span>
                    </div>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Shield size={14} className="text-emerald-400" /> Offline Peer-to-Peer Mesh Node Ready
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button onClick={openQRModal} className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5">
                    <QrCode size={14} /> Peer QR Identity
                  </button>
                  <button onClick={onEditProfile} className="btn btn-secondary text-xs py-2 px-3">
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>

            {/* System Features Card */}
            <div className="glass-panel p-5 space-y-3.5 border border-emerald-500/20 bg-slate-950/70 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Features</span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  All Core Protocols Online
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="badge badge-emerald py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Internet-Free Active
                </span>

                <span className="badge badge-cyan py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <Wifi size={13} />
                  P2P Network
                </span>

                <span className="badge badge-purple py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <Shield size={13} />
                  End-to-End Encrypted
                </span>

                <span className="badge badge-cyan py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <FileText size={13} />
                  Wi-Fi Direct File Sharing
                </span>

                <span className="badge badge-emerald py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <Layers size={13} />
                  Real-Time Mesh Collaboration
                </span>

                <span className="badge badge-purple py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                  <QrCode size={13} />
                  Peer QR Pairing
                </span>
              </div>
            </div>

            {/* System Status & Node Identity Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Discovery Status */}
              <div className="glass-panel p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Discovered Peers</span>
                    <Users size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white">{discoveredPeersCount}</div>
                    <p className="text-xs text-slate-400 mt-1">Active nodes ready for direct local messaging</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('peers')}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium pt-1"
                >
                  View Peer Scanner <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 2: Shared P2P Files */}
              <div className="glass-panel p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shared Files Engine</span>
                    <FileText size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white">{sharedFilesCount}</div>
                    <p className="text-xs text-slate-400 mt-1">
                      P2P media & document files transferred offline (FR-6)
                    </p>
                  </div>
                </div>
                <div>
                  <span className="badge badge-cyan text-[10px]">Auto Wi-Fi Direct &gt;5MB</span>
                </div>
              </div>

              {/* Card 3: Node Identity */}
              <div className="glass-panel p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Node Identity</span>
                    <QrCode size={18} className="text-blue-400" />
                  </div>

                  <div className="text-center py-2">
                    <div
                      className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2 shadow"
                      style={{
                        background: profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? undefined : profile.avatar,
                      }}
                    >
                      {profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? (
                        <img src={profile.avatar} alt={profile.username} className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        profile.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white">{profile.username}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{profile.userId}</p>
                  </div>
                </div>

                <button onClick={openQRModal} className="btn btn-secondary w-full text-xs py-2">
                  <QrCode size={14} /> Display Peer QR Code
                </button>
              </div>
            </div>

            {/* Quick Action: Collaboration Workspace Suite */}
            <div className="glass-panel p-5 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0">
                  <Layers size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Shared Collaboration Suite (Module 10)</h3>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                      Offline-First
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Real-time synchronized Whiteboard, interactive Checklist, and movable Sticky Notes over P2P mesh links.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('collab')}
                className="btn btn-primary text-xs py-2.5 px-5 shrink-0 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] bg-gradient-to-r from-cyan-600 to-blue-600 border-none"
              >
                <Layers size={15} /> Open Collaboration Hub <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PEER SCANNER */}
        {activeTab === 'peers' && (
          <PeerScanner
            onSelectPeerForChat={handleSelectPeerForChat}
            unreadPeerIds={unreadPeerIds}
          />
        )}

        {/* TAB 3: DIRECT CHAT */}
        {activeTab === 'chat' && (
          selectedPeerForChat ? (
            <ChatRoom
              currentUser={profile}
              peer={selectedPeerForChat}
              onBackToScanner={() => setActiveTab('peers')}
              onSelectFile={(file) => setSelectedFileForViewer(file)}
              onOpenCollab={() => setActiveTab('collab')}
            />
          ) : (
            <div className="glass-panel p-12 text-center space-y-3 fade-in-up">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-400">
                <Users size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Select a Nearby Peer to Start Chatting</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Go to the Discovered Peers tab and select an online node to begin 1-to-1 direct messaging.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('peers')}
                  className="btn btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
                >
                  <Users size={14} /> Open Discovered Peers Scanner
                </button>
              </div>
            </div>
          )
        )}

        {/* TAB 4: GROUP CHAT HUB */}
        {activeTab === 'groups' && (
          <GroupChatRoom
            currentUser={profile}
            onSelectFile={(file) => setSelectedFileForViewer(file)}
            onOpenCollab={() => setActiveTab('collab')}
          />
        )}

        {/* TAB 5: COLLABORATION WORKSPACE HUB */}
        {activeTab === 'collab' && (
          <CollaborationHub
            profile={profile}
            initialSessionId={selectedPeerForChat?.deviceId}
            initialSessionType={selectedPeerForChat ? 'peer' : 'scratch'}
            onOpenChatWithPeer={handleSelectPeerForChat}
          />
        )}

      </div>

      {/* File Viewer Modal */}
      {selectedFileForViewer && (
        <FileViewerModal
          file={selectedFileForViewer}
          onClose={() => setSelectedFileForViewer(null)}
          onDelete={async (fileId) => {
            await dbEngine.deleteFile(fileId);
            setSelectedFileForViewer(null);
            loadFilesCount();
          }}
        />
      )}

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 fade-in-up">
          <div className="glass-panel max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <h3 className="font-bold text-white text-sm">Peer Pairing QR Code</h3>
              <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {qrCodeUrl && (
              <div className="p-2 bg-white rounded-xl inline-block">
                <img src={qrCodeUrl} alt="Identity QR Code" className="w-52 h-52 mx-auto rounded" />
              </div>
            )}

            <div className="text-left space-y-1 text-xs p-2.5 rounded bg-slate-900 border border-slate-800 font-mono">
              <div className="text-slate-400">Node Handle: <span className="text-white font-bold">{profile.username}</span></div>
            </div>

            <button onClick={() => setShowQRModal(false)} className="btn btn-secondary w-full py-2 text-xs">
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

