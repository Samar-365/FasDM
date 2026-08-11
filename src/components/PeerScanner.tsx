import React, { useState, useEffect } from 'react';
import { PeerDevice, TransportChannel } from '../types';
import { networkService } from '../services/network';
import {
  Wifi,
  Radio,
  Bluetooth,
  MessageSquare,
  Plus,
  Search,
  Cpu,
  RefreshCw,
  SignalHigh
} from 'lucide-react';

interface PeerScannerProps {
  onSelectPeerForChat: (peer: PeerDevice) => void;
}

export const PeerScanner: React.FC<PeerScannerProps> = ({ onSelectPeerForChat }) => {
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | TransportChannel>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const unsubscribe = networkService.subscribePeers((updatedPeers) => {
      setPeers(updatedPeers);
    });

    // Auto-trigger discovery beacon scan
    networkService.sendDiscoveryBeacon();

    return () => unsubscribe();
  }, []);

  const handleScanRefresh = () => {
    setIsScanning(true);
    networkService.sendDiscoveryBeacon();
    setTimeout(() => setIsScanning(false), 1500);
  };

  const handleSimulatePeer = async (channel: TransportChannel) => {
    const names = ['Rahul Sharma', 'Priya Patel', 'Ankit Verma', 'Sneha Kapoor', 'Vikram Singh'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    await networkService.createSimulatedPeer(`${randomName} (${channel})`, channel);
  };

  const filteredPeers = peers.filter((p) => {
    const matchesTab = activeTab === 'All' || p.connectionType === activeTab;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = query === '' || p.username.toLowerCase().includes(query);
    return matchesTab && matchesQuery;
  });

  const lanCount = peers.filter((p) => p.connectionType === 'LAN').length;
  const wifiDirectCount = peers.filter((p) => p.connectionType === 'Wi-Fi Direct').length;
  const bluetoothCount = peers.filter((p) => p.connectionType === 'Bluetooth').length;

  return (
    <div className="space-y-6 fade-in-up">
      {/* Radar Discovery Header */}
      <div className="glass-panel p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Animated Radar Pulse Circle */}
            <div className="relative w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Radio size={28} className={isScanning ? 'animate-pulse text-cyan-300' : ''} />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">Local Device Scanner</h2>
                <span className="badge badge-cyan">{peers.length} Peers Discovered</span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <Wifi size={14} className="text-emerald-400" /> Scanning local LAN, Wi-Fi Direct & Bluetooth channels
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleScanRefresh}
              className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} /> Rescan Network
            </button>

            <button
              onClick={() => networkService.clearAllPeers()}
              className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-rose-400 hover:text-rose-300"
              title="Clear old test peers"
            >
              Clear Peers Grid
            </button>
          </div>
        </div>

        {/* Connection Channel Priority Banner */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-emerald-400" />
              <span className="font-semibold text-white">Priority 1: Local LAN</span>
            </div>
            <span className="badge badge-emerald">{lanCount} Active</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-cyan-400" />
              <span className="font-semibold text-white">Priority 2: Wi-Fi Direct</span>
            </div>
            <span className="badge badge-cyan">{wifiDirectCount} Active</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bluetooth size={16} className="text-purple-400" />
              <span className="font-semibold text-white">Priority 3: Bluetooth LE</span>
            </div>
            <span className="badge badge-purple">{bluetoothCount} Active</span>
          </div>
        </div>
      </div>

      {/* Simulator Test Tool Bar */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">
            Single-Tab Peer Simulation Generator:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSimulatePeer('LAN')}
            className="text-[11px] px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 transition flex items-center gap-1 font-mono"
          >
            <Plus size={12} /> + Sim LAN Peer
          </button>
          <button
            onClick={() => handleSimulatePeer('Wi-Fi Direct')}
            className="text-[11px] px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 transition flex items-center gap-1 font-mono"
          >
            <Plus size={12} /> + Sim Wi-Fi Direct
          </button>
          <button
            onClick={() => handleSimulatePeer('Bluetooth')}
            className="text-[11px] px-2.5 py-1 rounded bg-purple-950 border border-purple-500/40 text-purple-300 hover:bg-purple-900 transition flex items-center gap-1 font-mono"
          >
            <Plus size={12} /> + Sim Bluetooth
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Channel Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {(['All', 'LAN', 'Wi-Fi Direct', 'Bluetooth'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === tab
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              {tab === 'All' ? `All (${peers.length})` : tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search peer handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Discovered Peer Grid */}
      {filteredPeers.length === 0 ? (
        <div className="glass-panel p-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500">
            <Radio size={24} />
          </div>
          <h3 className="text-base font-bold text-white">No Nearby Peers Discovered Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Make sure other devices are on the same local Wi-Fi / LAN, or click below to simulate peer nodes in this browser window.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleSimulatePeer('LAN')}
              className="btn btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
            >
              <Plus size={14} /> Spawn Test LAN Peer Node
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeers.map((peer) => (
            <div
              key={peer.deviceId}
              className="glass-panel p-4 flex flex-col justify-between space-y-4 hover:border-slate-600 transition group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md"
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
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition truncate max-w-[140px]">
                        {peer.username}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${peer.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                        />
                        <span className="text-[11px] text-slate-400 font-mono">
                          {peer.status === 'connected' ? 'Online' : 'Discovered'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Channel Tag */}
                  <span
                    className={`badge text-[10px] ${peer.connectionType === 'LAN'
                        ? 'badge-emerald'
                        : peer.connectionType === 'Wi-Fi Direct'
                          ? 'badge-cyan'
                          : 'badge-purple'
                      }`}
                  >
                    {peer.connectionType === 'LAN' ? (
                      <Wifi size={10} className="inline mr-1" />
                    ) : peer.connectionType === 'Wi-Fi Direct' ? (
                      <Radio size={10} className="inline mr-1" />
                    ) : (
                      <Bluetooth size={10} className="inline mr-1" />
                    )}
                    {peer.connectionType}
                  </span>
                </div>

                {/* Signal & Latency Stats */}
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[11px] flex justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <SignalHigh size={10} className="text-slate-400" /> Signal & Latency
                  </span>
                  <span className="text-slate-300">
                    {peer.rssi} dBm ({peer.latencyMs || 10} ms)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => onSelectPeerForChat(peer)}
                  className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} /> Start P2P Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

