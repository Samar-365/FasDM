import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Radio, Wifi, Shield, User, LogOut } from 'lucide-react';

interface NavbarProps {
  profile: UserProfile | null;
  onEditProfile?: () => void;
  onNewTabNode?: () => void;
  onResetProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ profile, onEditProfile, onNewTabNode, onResetProfile }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Radio size={18} />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1">
                FasDM <span className="text-blue-400">Mesh</span>
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="badge badge-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Internet-Free Active
            </span>
            <span className="badge badge-cyan">
              <Wifi size={12} className="inline mr-1" /> P2P Network
            </span>
          </div>
        </div>

        {/* Right: Active Profile Badge & Actions */}
        {profile && (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition"
            >
              {profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? (
                <img src={profile.avatar} alt={profile.username} className="w-6 h-6 rounded object-cover" />
              ) : (
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px] shrink-0"
                  style={{ background: profile.avatar }}
                >
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="text-left hidden md:flex flex-col">
                <span className="text-xs font-semibold text-white leading-none">
                  {profile.username}
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5 leading-none">
                  Online
                </span>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-60 glass-panel p-3.5 shadow-xl z-50 fade-in-up">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-700 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ background: profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? undefined : profile.avatar }}
                  >
                    {profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? (
                      <img src={profile.avatar} alt={profile.username} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      profile.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{profile.username}</h4>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Shield size={10} /> Local P2P Node
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {onEditProfile && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onEditProfile();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-xs font-medium text-slate-200 hover:bg-slate-800 transition flex items-center gap-2"
                    >
                      <User size={12} className="text-blue-400" /> Edit Profile & Avatar
                    </button>
                  )}

                  {onNewTabNode && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNewTabNode();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-xs font-medium text-cyan-300 hover:bg-slate-800 transition flex items-center gap-2"
                    >
                      <Radio size={12} className="text-cyan-400" /> Switch / New Tab Node
                    </button>
                  )}

                  {onResetProfile && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onResetProfile();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-xs font-medium text-rose-400 hover:bg-rose-950 transition flex items-center gap-2"
                    >
                      <LogOut size={12} /> Clear Local Data
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

