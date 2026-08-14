import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, X, Send, Loader2, Play, Pause, RotateCcw } from 'lucide-react';

// ============================================================================
// SUBMODULE 8.2 & 8.3: MediaRecorder & Voice Recording Bar Component
// ============================================================================
// Features:
//   - MediaRecorder audio capture with automatic Opus codec selection
//   - Web Audio API (AnalyserNode) real-time 24-bar waveform visualizer
//   - Instant One-Click Send (Stop & Send immediately while recording)
//   - Stop & Preview mode with audio playback and scrub counter
//   - 120-second safety auto-stop with robust state synchronization
// ============================================================================

interface AudioRecorderProps {
  /** Called when user sends a completed recording */
  onSend: (audioData: string, durationMs: number, mimeType: string, fileSize: number) => void;
  /** Called when user cancels the recorder */
  onCancel: () => void;
  /** Called when recording starts or is active */
  onRecordingStart?: () => void;
  /** Max recording duration in seconds (default 120) */
  maxDurationSec?: number;
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped';

/** Detect best supported audio MIME type for MediaRecorder */
function detectMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return ''; // browser default
}

/** Convert a Blob to a Base64 Data URL */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onSend,
  onCancel,
  onRecordingStart,
  maxDurationSec = 120,
}) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(24).fill(4));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review / Preview state
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const [previewFileSize, setPreviewFileSize] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Audio engine refs (stable across renders)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoSendOnStopRef = useRef<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Cleanup all audio resources ──────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ── Real-time waveform visualization loop ────────────────────────────────
  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 24;

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      const step = Math.floor(bufferLength / barCount);
      const bars: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const start = i * step;
        let sum = 0;
        for (let j = start; j < start + step && j < bufferLength; j++) {
          sum += dataArray[j];
        }
        const avg = sum / step;
        const height = Math.max(4, Math.round((avg / 255) * 36));
        bars.push(height);
      }
      setWaveformBars(bars);
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  // ── Start Recording ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setState('requesting');
    setPreviewDataUrl(null);
    setIsPlayingPreview(false);
    setIsProcessing(false);
    autoSendOnStopRef.current = false;
    onRecordingStart?.();

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Set up Web Audio API analyser for waveform visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Configure MediaRecorder with best available codec
      const mimeType = detectMimeType();
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const finalMime = mimeType || recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        mimeTypeRef.current = finalMime;

        const durationMs = Math.max(500, Date.now() - startTimeRef.current);
        const fileSize = blob.size;

        setIsProcessing(true);

        try {
          const dataUrl = await blobToDataUrl(blob);
          setPreviewDataUrl(dataUrl);
          setPreviewDurationMs(durationMs);
          setPreviewFileSize(fileSize);
          setIsProcessing(false);

          // If user clicked instant send while recording, dispatch immediately
          if (autoSendOnStopRef.current) {
            onSend(dataUrl, durationMs, finalMime, fileSize);
            // Reset to idle
            chunksRef.current = [];
            setPreviewDataUrl(null);
            setElapsedMs(0);
            setWaveformBars(new Array(24).fill(4));
            setState('idle');
          }
        } catch (err) {
          console.error('Error generating audio data URL:', err);
          setErrorMsg('Failed to process recorded audio.');
          setIsProcessing(false);
        }
      };

      // 4. Start recording
      recorder.start(200); // Collect chunk every 200ms
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setState('recording');

      // 5. Start elapsed timer
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        if (elapsed >= maxDurationSec * 1000) {
          stopRecording();
        }
      }, 100);

      // 6. Start waveform visualization loop
      startWaveformLoop();
    } catch (err: any) {
      cleanup();
      setState('idle');
      onCancel?.();
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied. Please allow mic permissions in browser.');
      } else if (err?.name === 'NotFoundError') {
        setErrorMsg('No microphone detected on this device.');
      } else {
        setErrorMsg('Failed to start microphone recording.');
      }
    }
  }, [cleanup, maxDurationSec, onCancel, onRecordingStart, onSend, startWaveformLoop]);

  // ── Stop Recording (to review) ───────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    setWaveformBars(new Array(24).fill(4));
    if (!autoSendOnStopRef.current) {
      setState('stopped');
    }
  }, []);

  // ── Instant Send while Recording (One-Click Stop & Transmit) ─────────────
  const handleInstantSend = useCallback(() => {
    autoSendOnStopRef.current = true;
    stopRecording();
  }, [stopRecording]);

  // ── Cancel / Discard Recording ───────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    setPreviewDataUrl(null);
    setElapsedMs(0);
    setWaveformBars(new Array(24).fill(4));
    setIsPlayingPreview(false);
    setIsProcessing(false);
    setState('idle');
    onCancel();
  }, [cleanup, onCancel]);

  // ── Send Recorded Audio from Review Mode ─────────────────────────────────
  const handleSendFromReview = useCallback(() => {
    if (!previewDataUrl) return;

    const mimeType = mimeTypeRef.current || 'audio/webm';
    onSend(previewDataUrl, previewDurationMs, mimeType, previewFileSize);

    // Reset state
    cleanup();
    chunksRef.current = [];
    setPreviewDataUrl(null);
    setElapsedMs(0);
    setState('idle');
  }, [cleanup, onSend, previewDataUrl, previewDurationMs, previewFileSize]);

  // ── Preview Audio Playback Toggle ────────────────────────────────────────
  const togglePreviewPlay = () => {
    if (!previewDataUrl) return;

    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(previewDataUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
      audio.onerror = () => setIsPlayingPreview(false);
      audio.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
    }
  };

  // ── Format elapsed time as MM:SS ─────────────────────────────────────────
  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // RENDER STATES
  // =========================================================================

  // 1. Idle State — Microphone trigger button
  if (state === 'idle') {
    return (
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={startRecording}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 border border-slate-700/80 transition shrink-0 flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
          title="Record Voice Note (P2P Mesh)"
        >
          <Mic size={18} />
        </button>
        {errorMsg && (
          <div className="absolute bottom-14 left-0 w-64 p-2 rounded-lg bg-rose-950/95 border border-rose-500/60 text-rose-200 text-[11px] font-mono shadow-xl z-30">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // 2. Requesting Mic State
  if (state === 'requesting') {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono animate-pulse">
        <Loader2 size={15} className="animate-spin text-blue-400" />
        Requesting microphone access...
      </div>
    );
  }

  // 3. Recording State — Real-time waveform, timer, discard, review, & instant send
  if (state === 'recording') {
    const maxMs = maxDurationSec * 1000;
    return (
      <div className="flex-1 flex items-center gap-2 py-1.5 px-2.5 bg-slate-950 rounded-xl border border-rose-500/40 shadow-inner">
        {/* Discard Button */}
        <button
          type="button"
          onClick={cancelRecording}
          className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 border border-slate-800 transition shrink-0"
          title="Cancel & Discard Recording"
        >
          <X size={16} />
        </button>

        {/* Pulsing Dot + Live Timer */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <span className="text-xs font-mono text-rose-400 font-bold tabular-nums">
            {formatTime(elapsedMs)}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            / {formatTime(maxMs)}
          </span>
        </div>

        {/* Live Frequency Waveform Visualizer */}
        <div className="flex-1 flex items-center justify-center gap-[2.5px] h-7 overflow-hidden px-1">
          {waveformBars.map((h, i) => (
            <div
              key={i}
              className="rounded-full bg-rose-500 transition-all duration-75"
              style={{
                width: '3px',
                height: `${h}px`,
                opacity: 0.45 + (h / 36) * 0.55,
              }}
            />
          ))}
        </div>

        {/* Stop & Review Button */}
        <button
          type="button"
          onClick={stopRecording}
          className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition shrink-0 flex items-center justify-center"
          title="Stop & Review"
        >
          <Square size={14} fill="currentColor" />
        </button>

        {/* Instant Send Button (One-Click) */}
        <button
          type="button"
          onClick={handleInstantSend}
          className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0 shadow-lg"
          title="Instant Stop & Send"
        >
          <Send size={13} /> Send
        </button>
      </div>
    );
  }

  // 4. Stopped / Review Mode — Listen preview, re-record, or send
  if (state === 'stopped') {
    return (
      <div className="flex-1 flex items-center justify-between gap-2 py-1.5 px-2.5 bg-slate-950 rounded-xl border border-blue-500/40 shadow-inner">
        {/* Discard */}
        <button
          type="button"
          onClick={cancelRecording}
          className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 border border-slate-800 transition shrink-0"
          title="Discard Recording"
        >
          <X size={15} />
        </button>

        {/* Play / Pause Preview */}
        <button
          type="button"
          onClick={togglePreviewPlay}
          disabled={!previewDataUrl || isProcessing}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shrink-0 flex items-center justify-center shadow-md disabled:opacity-50"
          title={isPlayingPreview ? 'Pause Preview' : 'Listen Preview'}
        >
          {isPlayingPreview ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
        </button>

        {/* Duration & Status */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-slate-200 truncate">
            {isProcessing ? 'Processing audio...' : `Voice Note (${formatTime(previewDurationMs)})`}
          </span>
          {previewFileSize > 0 && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {(previewFileSize / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        {/* Re-record */}
        <button
          type="button"
          onClick={startRecording}
          className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition shrink-0"
          title="Re-record"
        >
          <RotateCcw size={14} />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSendFromReview}
          disabled={!previewDataUrl || isProcessing}
          className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          title="Send Voice Note"
        >
          {isProcessing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
          Send
        </button>
      </div>
    );
  }

  return null;
};
