import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types';
import { cryptoService } from '../services/crypto';
import { dbEngine } from '../services/db';
import {
  User,
  QrCode,
  CheckCircle2,
  Upload,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

interface ProfileSetupProps {
  onProfileCreated: (profile: UserProfile) => void;
  onBackToSplash?: () => void;
}

const PRESET_AVATARS = [
  { id: 'blue', color: '#2563eb', label: 'Classic Blue' },
  { id: 'emerald', color: '#059669', label: 'Emerald' },
  { id: 'purple', color: '#7c3aed', label: 'Purple' },
  { id: 'amber', color: '#d97706', label: 'Amber' },
  { id: 'slate', color: '#475569', label: 'Slate' },
];

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ onProfileCreated, onBackToSplash }) => {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].color);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  
  // UI State
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (username.trim().length >= 3) {
      const mockUserId = `usr_${Date.now().toString(36)}`;
      const payload = cryptoService.formatQRPayload(mockUserId, username);
      cryptoService.generateQRCodeDataURL(payload).then(setQrDataUrl).catch(console.error);
    } else {
      setQrDataUrl(null);
    }
  }, [username]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCustomAvatarUrl(event.target.result as string);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const activeAvatar = customAvatarUrl || selectedAvatar;

      const profile: UserProfile = {
        userId,
        username: username.trim(),
        avatar: activeAvatar,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await dbEngine.saveProfile(profile);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });

      setTimeout(() => {
        onProfileCreated(profile);
      }, 500);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to persist profile in local storage.');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] py-8 px-4 bg-slate-950 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg bg-blue-600/20 text-blue-400">
              <User size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Profile Setup</h2>
              <p className="text-xs text-slate-400">Set your handle and avatar for offline P2P discovery</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950 border border-rose-700 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Username / Handle <span className="text-blue-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Alex_Node"
                  maxLength={24}
                  className="glass-input font-mono pr-10"
                  required
                />
                {username.trim().length >= 3 && (
                  <CheckCircle2 size={18} className="absolute right-3 top-3 text-emerald-400" />
                )}
              </div>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
                Choose Color Avatar
              </label>
              
              <div className="flex items-center gap-3 mb-4">
                {PRESET_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(avatar.color);
                      setCustomAvatarUrl(null);
                    }}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm transition ${
                      !customAvatarUrl && selectedAvatar === avatar.color
                        ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 scale-105'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: avatar.color }}
                  >
                    {username ? username.charAt(0).toUpperCase() : 'N'}
                  </button>
                ))}
              </div>

              {/* Custom Image Upload */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-700">
                {customAvatarUrl ? (
                  <img src={customAvatarUrl} alt="Custom Avatar" className="w-10 h-10 rounded-lg object-cover border border-blue-500/50 shadow" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                    <User size={18} />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-200 block">
                    {customAvatarUrl ? 'Custom Avatar Uploaded' : 'Custom Avatar'}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    {customAvatarUrl ? 'Remove existing avatar to upload a new one' : 'Max 2MB image'}
                  </span>
                </div>

                {customAvatarUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomAvatarUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="btn bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/80 text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0 transition"
                    title="Discard uploaded avatar"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                ) : (
                  <label className="btn btn-secondary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5 shrink-0">
                    <Upload size={14} /> Upload
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              {onBackToSplash && (
                <button type="button" onClick={onBackToSplash} className="btn btn-secondary">
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || username.trim().length < 3}
                className="btn btn-emerald flex-1 py-2.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Saving Profile...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: QR Code Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="glass-panel p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-semibold">
              <QrCode size={18} className="text-emerald-400" />
              <span>Peer Identity QR Code</span>
            </div>

            {qrDataUrl ? (
              <div className="inline-block p-3 rounded-xl bg-white shadow-lg">
                <img src={qrDataUrl} alt="Identity QR Code" className="w-48 h-48 mx-auto rounded" />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto rounded-xl bg-slate-900 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs p-4">
                <QrCode size={32} className="mb-2 opacity-50" />
                Type username to preview QR Code
              </div>
            )}

            <p className="text-xs text-slate-400">
              Shareable QR code for instant offline peer pairing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

