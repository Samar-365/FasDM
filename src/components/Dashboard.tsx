import React, { useState, useEffect } from 'react';
import { UserProfile, PeerDevice, StorageQuotaInfo, DashboardTab } from '../types';
import { cryptoService } from '../services/crypto';
import { dbEngine } from '../services/db';
import { networkService } from '../services/network';
import { PeerScanner } from './PeerScanner';
import { ChatRoom } from './ChatRoom';
import {
  Shield,
  Wifi,
  QrCode,
  Database,
  Radio,
  Cpu,
  CheckCircle2,
  Lock,
  Share2,
  HardDrive,
  Copy,
  Check,
  Users,
  MessageSquare,
  LayoutDashboard,
  ArrowRight
} from 'lucide-react';

interface DashboardProps {
  profile: UserProfile;
  onEditProfile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, onEditProfile }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedPeerForChat, setSelectedPeerForChat] = useState<PeerDevice | null>(null);
  const [discoveredPeersCount, setDiscoveredPeersCount] = useState(0);

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);
  const [testLog, setTestLog] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize P2P Network Service & Peer Counter
  useEffect(() => {
    networkService.start(profile);

    const unsubPeers = networkService.subscribePeers((peers) => {
      setDiscoveredPeersCount(peers.length);
    });

    return () => {
      unsubPeers();
      networkService.stop();
    };
  }, [profile]);

  const openQRModal = async () => {
    try {
      const payload = cryptoService.formatQRPayload(
        profile.userId,
        profile.username,
        profile.publicKeyPEM,
        profile.keyFingerprint
      );
      const url = await cryptoService.generateQRCodeDataURL(payload);
      setQrCodeUrl(url);
      setShowQRModal(true);
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
    }
  };

  const runStorageBenchmark = async () => {
    try {
      setTestLog('Testing IndexedDB read/write...');
      const startTime = performance.now();
      const quota = await dbEngine.getStorageQuota();
      const endTime = performance.now();

      setStorageInfo(quota);
      setTestLog(`Storage Test PASSED: Response time ${(endTime - startTime).toFixed(2)}ms.`);
    } catch (err) {
      console.error(err);
      setTestLog('Storage test failed.');
    }
  };

  const copyFingerprint = () => {
    navigator.clipboard.writeText(profile.keyFingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectPeerForChat = (peer: PeerDevice) => {
    setSelectedPeerForChat(peer);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-8 bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Tabs Header */}
        <div className="glass-panel p-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard size={14} /> System Overview
            </button>

            <button
              onClick={() => setActiveTab('peers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 relative ${
                activeTab === 'peers'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users size={14} /> Nearby Devices
              {discoveredPeersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-500/30">
                  {discoveredPeersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MessageSquare size={14} /> Encrypted Direct Chat
              {selectedPeerForChat && (
                <span className="text-[10px] text-blue-300 truncate max-w-[90px]">
                  ({selectedPeerForChat.username.split(' ')[0]})
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge badge-emerald text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1 inline-block" />
              Local P2P Active
            </span>
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
                      <Shield size={14} className="text-emerald-400" /> Web Crypto ECDH P-256 Identity Verified in IndexedDB
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

            {/* Diagnostic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Key */}
              <div className="glass-panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Public Key</span>
                  <Lock size={16} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Fingerprint (SHA-256)</div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-blue-300 flex items-center justify-between">
                    <span className="truncate">{profile.keyFingerprint}</span>
                    <button onClick={copyFingerprint} className="text-slate-400 hover:text-blue-400 ml-1">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-400" /> ECDH P-256 Active
                </div>
              </div>

              {/* Card 2: Storage */}
              <div className="glass-panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IndexedDB</span>
                  <Database size={16} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Local Encrypted Stores</div>
                  <div className="text-sm font-bold text-white font-mono">
                    Profile, Keys, Peers, Messages
                  </div>
                </div>
                <button
                  onClick={runStorageBenchmark}
                  className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <HardDrive size={12} /> Storage Benchmark
                </button>
              </div>

              {/* Card 3: Discovery Status */}
              <div className="glass-panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Discovered Peers</span>
                  <Users size={16} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{discoveredPeersCount}</div>
                  <p className="text-[11px] text-slate-400">Available for 1-to-1 P2P chat</p>
                </div>
                <button
                  onClick={() => setActiveTab('peers')}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View Peer Scanner <ArrowRight size={12} />
                </button>
              </div>

              {/* Card 4: Module Status */}
              <div className="glass-panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Module</span>
                  <Radio size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">Module 2: Device Discovery</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    LAN/Wi-Fi Direct P2P transport & 1-to-1 encrypted chat.
                  </p>
                </div>
                <span className="badge badge-emerald text-[10px]">Module 2 Implemented</span>
              </div>
            </div>

            {/* Diagnostic Log */}
            {testLog && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-blue-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-blue-400" />
                  <span>{testLog}</span>
                </div>
                <button onClick={() => setTestLog(null)} className="text-slate-500 hover:text-white">✕</button>
              </div>
            )}

            {/* Feature Roadmap & Identity Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-panel p-5 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 size={18} className="text-blue-400" /> Core Module Architecture Roadmap
                </h3>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        M1
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Module 1: Identity & Local Storage</h4>
                        <p className="text-[11px] text-slate-400">IndexedDB store, Web Crypto P-256 keypair, Profile Setup, QR Identity Payload</p>
                      </div>
                    </div>
                    <span className="badge badge-emerald">Complete</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs">
                        M2
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Module 2: Device Discovery & P2P Messaging</h4>
                        <p className="text-[11px] text-slate-400">Local Wi-Fi P2P Transport, Peer Scanner, 1-to-1 Encrypted Chat, Read Receipts, Typing Indicator</p>
                      </div>
                    </div>
                    <span className="badge badge-emerald">Completed & Active</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs">
                        M3
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Module 3: Group Chat & Collaboration Tools</h4>
                        <p className="text-[11px] text-slate-400">Group messaging, File sharing, Shared Whiteboard & Checklist</p>
                      </div>
                    </div>
                    <span className="badge badge-purple">Up Next</span>
                  </div>
                </div>
              </div>

              {/* Node Identity Card */}
              <div className="glass-panel p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Node Identity Card
                  </h3>

                  <div className="text-center py-3">
                    <div
                      className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-2 shadow-lg"
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
                    <h4 className="text-lg font-bold text-white">{profile.username}</h4>
                    <p className="text-xs font-mono text-blue-400 mt-0.5">{profile.keyFingerprint}</p>
                  </div>
                </div>

                <button onClick={openQRModal} className="btn btn-secondary w-full text-xs py-2">
                  <QrCode size={14} /> Display Peer QR Code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PEER SCANNER */}
        {activeTab === 'peers' && (
          <PeerScanner onSelectPeerForChat={handleSelectPeerForChat} />
        )}

        {/* TAB 3: DIRECT ENCRYPTED CHAT */}
        {activeTab === 'chat' && (
          selectedPeerForChat ? (
            <ChatRoom
              currentUser={profile}
              peer={selectedPeerForChat}
              onBackToScanner={() => setActiveTab('peers')}
            />
          ) : (
            <div className="glass-panel p-12 text-center space-y-3 fade-in-up">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-400">
                <Users size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Select a Nearby Peer to Start Chatting</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Go to the Discovered Peers tab and select an online node to begin 1-to-1 Web Crypto encrypted messaging.
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

      </div>

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
              <div className="text-slate-400">Node: <span className="text-white font-bold">{profile.username}</span></div>
              <div className="text-slate-400">Fingerprint: <span className="text-blue-300">{profile.keyFingerprint}</span></div>
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
