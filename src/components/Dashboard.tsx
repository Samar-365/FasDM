import React, { useState, useEffect } from 'react';
import { UserProfile, PeerDevice, DashboardTab } from '../types';
import { cryptoService } from '../services/crypto';
import { networkService } from '../services/network';
import { PeerScanner } from './PeerScanner';
import { ChatRoom } from './ChatRoom';
import {
  Shield,
  QrCode,
  Radio,
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
              <MessageSquare size={14} /> Direct P2P Chat
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

              {/* Card 2: Active Transport */}
              <div className="glass-panel p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Channel</span>
                    <Radio size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Local Mesh Transport</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Auto-switching transport: Local LAN Wi-Fi, Wi-Fi Direct, and Bluetooth LE.
                    </p>
                  </div>
                </div>
                <div>
                  <span className="badge badge-emerald text-xs">High Speed P2P Ready</span>
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
          </div>
        )}

        {/* TAB 2: PEER SCANNER */}
        {activeTab === 'peers' && (
          <PeerScanner onSelectPeerForChat={handleSelectPeerForChat} />
        )}

        {/* TAB 3: DIRECT CHAT */}
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

