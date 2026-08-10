import React from 'react';
import { Radio, Shield, Wifi, Database, ArrowRight, Zap, Cpu } from 'lucide-react';

interface SplashScreenProps {
  onStartSetup: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onStartSetup }) => {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-slate-950">
      {/* Main Card */}
      <div className="max-w-2xl w-full glass-panel p-8 md:p-10 text-center fade-in-up">
        {/* Brand Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-5">
          <Radio size={36} />
        </div>

        {/* Header */}
        <div className="inline-block mb-3">
          <span className="badge badge-cyan px-3 py-1">
            <Zap size={12} className="inline mr-1" /> IEEE 29148 P2P Standard
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-white">
          FasDM <span className="text-blue-400">Mesh</span>
        </h1>

        <p className="text-sm md:text-base text-slate-300 max-w-lg mx-auto mb-8 leading-relaxed">
          Decentralized, internet-free messaging powered by local network discovery, cryptographic Web Crypto identity, and instant peer pairing.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-left">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center text-center">
            <Wifi size={18} className="text-blue-400 mb-1.5" />
            <span className="text-xs font-semibold text-slate-200">Zero Internet</span>
            <span className="text-[11px] text-slate-400">LAN & Wi-Fi Direct</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center text-center">
            <Shield size={18} className="text-emerald-400 mb-1.5" />
            <span className="text-xs font-semibold text-slate-200">Web Crypto</span>
            <span className="text-[11px] text-slate-400">P-256 Key Exchange</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center text-center">
            <Database size={18} className="text-purple-400 mb-1.5" />
            <span className="text-xs font-semibold text-slate-200">IndexedDB</span>
            <span className="text-[11px] text-slate-400">Local Store</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center text-center">
            <Cpu size={18} className="text-amber-400 mb-1.5" />
            <span className="text-xs font-semibold text-slate-200">Mesh Ready</span>
            <span className="text-[11px] text-slate-400">Multi-Hop Routing</span>
          </div>
        </div>

        {/* CTA Button */}
        <button onClick={onStartSetup} className="btn btn-primary text-sm px-6 py-3 w-full sm:w-auto">
          Create Local Profile & Keys <ArrowRight size={18} />
        </button>

        <p className="mt-4 text-xs text-slate-400">
          No cloud server or phone numbers required. Keys stay 100% local on your device.
        </p>
      </div>
    </div>
  );
};
