import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile, CryptographicKeyPair, StorageQuotaInfo } from '../types';
import { cryptoService } from '../services/crypto';
import { dbEngine } from '../services/db';
import {
  User,
  Key,
  QrCode,
  Database,
  CheckCircle2,
  Upload,
  RefreshCw,
  Copy,
  Check
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
  
  // Crypto State
  const [keyPair, setKeyPair] = useState<CryptographicKeyPair | null>(null);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  
  // Storage State
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);
  
  // UI State
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  useEffect(() => {
    generateKeys();
    loadStorageQuota();
  }, []);

  useEffect(() => {
    if (keyPair && username.trim().length >= 3) {
      const mockUserId = `usr_${Date.now().toString(36)}`;
      const payload = cryptoService.formatQRPayload(mockUserId, username, keyPair.publicKeyPEM, keyPair.keyFingerprint);
      cryptoService.generateQRCodeDataURL(payload).then(setQrDataUrl).catch(console.error);
    } else {
      setQrDataUrl(null);
    }
  }, [username, keyPair]);

  const generateKeys = async () => {
    setIsGeneratingKeys(true);
    try {
      const keys = await cryptoService.generateKeyPair();
      setKeyPair(keys);
    } catch (err) {
      console.error('Failed to generate keypair:', err);
      setError('Failed to generate cryptographic P-256 keypair.');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const loadStorageQuota = async () => {
    const quota = await dbEngine.getStorageQuota();
    setQuotaInfo(quota);
  };

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

  const copyFingerprint = () => {
    if (keyPair?.keyFingerprint) {
      navigator.clipboard.writeText(keyPair.keyFingerprint);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!keyPair) {
      setError('Cryptographic identity keys not ready yet.');
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
        publicKeyPEM: keyPair.publicKeyPEM,
        keyFingerprint: keyPair.keyFingerprint,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await dbEngine.saveProfile(profile);
      await dbEngine.saveKeyPair(keyPair);

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
      setError('Failed to persist profile in IndexedDB storage.');
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
              <h2 className="text-xl font-bold text-white">Profile & Local Identity</h2>
              <p className="text-xs text-slate-400">Set your handle and avatar for P2P discovery</p>
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
                  <img src={customAvatarUrl} alt="Avatar" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                    <User size={18} />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-200 block">Custom Avatar</span>
                  <span className="text-[11px] text-slate-400 block">Max 2MB image</span>
                </div>

                <label className="btn btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                  <Upload size={14} /> Upload
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Storage Info */}
            {quotaInfo && quotaInfo.isAvailable && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center gap-3">
                <Database size={16} className="text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">IndexedDB Storage</span>
                    <span className="text-slate-400 font-mono">
                      {(quotaInfo.usageBytes / (1024 * 1024)).toFixed(2)} MB / {(quotaInfo.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.max(1, quotaInfo.percentageUsed)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              {onBackToSplash && (
                <button type="button" onClick={onBackToSplash} className="btn btn-secondary">
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || isGeneratingKeys || username.trim().length < 3}
                className="btn btn-emerald flex-1 py-2.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Saving Profile...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Keys & QR Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Key Card */}
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-400">
                <Key size={18} />
                <h3 className="font-bold text-white text-sm">Cryptographic Identity</h3>
              </div>
              <button
                type="button"
                onClick={generateKeys}
                disabled={isGeneratingKeys}
                className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1"
              >
                <RefreshCw size={12} className={isGeneratingKeys ? 'animate-spin' : ''} /> Regenerate
              </button>
            </div>

            {isGeneratingKeys ? (
              <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={20} className="animate-spin text-blue-400" />
                <span>Generating P-256 Keypair...</span>
              </div>
            ) : keyPair ? (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                    <span>Key Fingerprint (SHA-256)</span>
                    <button
                      type="button"
                      onClick={copyFingerprint}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {copiedFingerprint ? <Check size={12} /> : <Copy size={12} />}
                      {copiedFingerprint ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-700 font-mono text-blue-300 text-xs text-center tracking-wider">
                    {keyPair.keyFingerprint}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Algorithm:</span>
                    <span className="font-mono text-slate-200">ECDH P-256</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage:</span>
                    <span className="font-mono text-emerald-400">IndexedDB Local</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* QR Code Card */}
          <div className="glass-panel p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-300 mb-3 text-xs font-semibold">
              <QrCode size={16} className="text-emerald-400" />
              <span>Identity QR Code Preview</span>
            </div>

            {qrDataUrl ? (
              <div className="inline-block p-2 rounded-xl bg-white mb-2">
                <img src={qrDataUrl} alt="Identity QR Code" className="w-40 h-40 mx-auto rounded" />
              </div>
            ) : (
              <div className="w-40 h-40 mx-auto rounded-xl bg-slate-900 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs p-3 mb-2">
                <QrCode size={28} className="mb-1 opacity-50" />
                Enter username to generate QR code.
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Shareable QR code for peer pairing (FR-3).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
