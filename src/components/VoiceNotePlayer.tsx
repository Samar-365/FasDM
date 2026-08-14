import React, { useState, useRef } from 'react';
import { Play, Pause, Download, Volume2 } from 'lucide-react';
import { VoiceNote } from '../types';

// ============================================================================
// SUBMODULE 8.4: Minimal & Compact Inline Voice Note Player
// ============================================================================

interface VoiceNotePlayerProps {
  voiceNote: VoiceNote;
  isSelf?: boolean;
}

// Generate deterministic mini waveform bar heights (4px to 16px)
function generateWaveformPattern(seed: string, count: number = 20): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.8));
    const height = Math.round(4 + pseudoRandom * 12); // 4px to 16px
    heights.push(height);
  }
  return heights;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ voiceNote, isSelf = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(voiceNote.durationMs / 1000 || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformHeights = useRef<number[]>(
    generateWaveformPattern(voiceNote.voiceId || voiceNote.timestamp.toString(), 20)
  );

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback prevented:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleWaveformClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const ratio = (index + 0.5) / waveformHeights.current.length;
    const targetTime = ratio * (duration || 1);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        width: '210px',
        maxWidth: '210px',
        padding: '6px 8px',
        borderRadius: '10px',
        background: isSelf ? 'rgba(30, 58, 138, 0.5)' : '#090d16',
        border: isSelf ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={voiceNote.audioData}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Row 1: Play/Pause Button + Waveform scrubber */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: isSelf ? '#ffffff' : '#00e5ff',
            color: isSelf ? '#1d4ed8' : '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.1s ease',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={12} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" style={{ marginLeft: '1px' }} />
          )}
        </button>

        {/* 20 Clickable Waveform Bars */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2px',
            height: '20px',
            cursor: 'pointer',
          }}
        >
          {waveformHeights.current.map((h, i) => {
            const barProgress = (i / waveformHeights.current.length) * 100;
            const isPassed = barProgress <= progressPercent;

            return (
              <div
                key={i}
                onClick={(e) => handleWaveformClick(e, i)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: '3px',
                    height: `${h}px`,
                    borderRadius: '2px',
                    backgroundColor: isPassed
                      ? isSelf
                        ? '#ffffff'
                        : '#00e5ff'
                      : isSelf
                      ? 'rgba(191, 219, 254, 0.35)'
                      : '#334155',
                    boxShadow: isPassed
                      ? isSelf
                        ? '0 0 4px rgba(255, 255, 255, 0.6)'
                        : '0 0 4px rgba(0, 229, 255, 0.6)'
                      : 'none',
                    transition: 'all 0.08s ease',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: Compact time + Download */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '9px',
          fontFamily: 'monospace',
          color: isSelf ? '#bfdbfe' : '#94a3b8',
          paddingTop: '2px',
          borderTop: isSelf ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Volume2 size={10} style={{ opacity: isPlaying ? 1 : 0.6 }} />
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {voiceNote.fileSize > 0 && (
            <span>{(voiceNote.fileSize / 1024).toFixed(0)} KB</span>
          )}
          <a
            href={voiceNote.audioData}
            download={`voice_${(voiceNote.voiceId || 'audio').slice(0, 8)}.${
              voiceNote.mimeType?.includes('ogg') ? 'ogg' : 'webm'
            }`}
            style={{
              color: isSelf ? '#ffffff' : '#00e5ff',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              opacity: 0.85,
            }}
            title="Download Voice Note"
          >
            <Download size={10} />
          </a>
        </div>
      </div>
    </div>
  );
};
