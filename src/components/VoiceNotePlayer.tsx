import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2 } from 'lucide-react';
import { VoiceNote } from '../types';

// ============================================================================
// SUBMODULE 8.4: Inline Voice Note Audio Player Component
// ============================================================================
// Features:
//   - Play/Pause toggle with seamless HTML5 Audio integration
//   - Interactive seekable waveform visualization & timeline slider
//   - Dynamic elapsed / total duration labels (MM:SS)
//   - Offline audio playback from Base64 Data URL
//   - Compact download action
// ============================================================================

interface VoiceNotePlayerProps {
  voiceNote: VoiceNote;
  isSelf?: boolean;
}

// Generate a deterministic pseudo-waveform pattern from voiceId
function generateWaveformPattern(seed: string, count: number = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.7));
    // Height between 4px and 24px with nice rhythm
    const height = Math.round(5 + pseudoRandom * 19);
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
    generateWaveformPattern(voiceNote.voiceId || voiceNote.timestamp.toString())
  );

  // Sync duration if loaded metadata yields better duration
  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio playback prevented:', err);
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleWaveformClick = (index: number) => {
    const ratio = index / waveformHeights.current.length;
    const targetTime = ratio * (duration || 1);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`rounded-xl p-2.5 my-1 select-none flex flex-col gap-2 max-w-[280px] sm:max-w-[320px] transition ${
        isSelf
          ? 'bg-blue-700/70 border border-blue-400/40 text-white'
          : 'bg-slate-900/90 border border-slate-700/80 text-slate-100'
      }`}
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={voiceNote.audioData}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Top row: Play Button + Waveform scrubber */}
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition transform active:scale-95 shadow-md ${
            isSelf
              ? 'bg-white text-blue-700 hover:bg-blue-50'
              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          }`}
          title={isPlaying ? 'Pause' : 'Play Voice Note'}
        >
          {isPlaying ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Waveform Visualization Bars */}
        <div className="flex-1 flex items-center justify-between gap-[2px] h-7 px-1 cursor-pointer relative group">
          {waveformHeights.current.map((h, i) => {
            const barProgress = (i / waveformHeights.current.length) * 100;
            const isPassed = barProgress <= progressPercent;

            return (
              <div
                key={i}
                onClick={() => handleWaveformClick(i)}
                className="flex-1 flex items-center justify-center h-full group-hover:opacity-100 transition"
              >
                <div
                  className={`w-[2.5px] rounded-full transition-all duration-100 ${
                    isPassed
                      ? isSelf
                        ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]'
                        : 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]'
                      : isSelf
                      ? 'bg-blue-300/40 hover:bg-blue-200'
                      : 'bg-slate-700 hover:bg-slate-500'
                  }`}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden range input for fine scrub control */}
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.05"
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 bg-transparent appearance-none cursor-pointer opacity-0 absolute pointer-events-none"
        tabIndex={-1}
      />

      {/* Bottom row: Timestamps + Download */}
      <div className="flex items-center justify-between text-[10px] font-mono opacity-85 px-0.5">
        <div className="flex items-center gap-1.5">
          <Volume2 size={11} className={isPlaying ? 'animate-pulse text-cyan-300' : ''} />
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {voiceNote.fileSize && (
            <span className="opacity-70">
              {(voiceNote.fileSize / 1024).toFixed(0)} KB
            </span>
          )}
          <a
            href={voiceNote.audioData}
            download={`voice_${voiceNote.voiceId.slice(0, 8)}.${
              voiceNote.mimeType?.includes('ogg') ? 'ogg' : 'webm'
            }`}
            className={`p-1 rounded transition ${
              isSelf ? 'hover:bg-blue-600' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Download Voice Note"
          >
            <Download size={11} />
          </a>
        </div>
      </div>
    </div>
  );
};
