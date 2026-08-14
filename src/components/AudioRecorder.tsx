import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, X, Send, Loader2 } from 'lucide-react';

// ============================================================================
// SUBMODULE 8.2: MediaRecorder & Waveform Analyzer Engine
// ============================================================================
// Core audio capture engine using:
//   - MediaRecorder API (audio/webm;codecs=opus preferred, audio/ogg fallback)
//   - Web Audio API (AudioContext + AnalyserNode) for real-time frequency data
//   - Microphone permission handling via navigator.mediaDevices.getUserMedia
//   - Audio chunk → Blob → Base64 Data URL conversion pipeline
//   - Precise duration tracking with 120-second safety auto-stop
// ============================================================================

interface AudioRecorderProps {
  /** Called when user sends a completed recording */
  onSend: (audioData: string, durationMs: number, mimeType: string, fileSize: number) => void;
  /** Called when user cancels the recorder */
  onCancel: () => void;
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
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ''; // browser default
}

/** Convert a Blob to a Base64 Data URL */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onSend,
  onCancel,
  maxDurationSec = 120,
}) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(24).fill(4));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Recorded audio blob (available after stopping)
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedDataUrlRef = useRef<string | null>(null);
  const recordedDurationRef = useRef<number>(0);

  // ── Cleanup all audio resources ──────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Stop animation frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Stop elapsed timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;

    // Release microphone stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
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

      // Sample frequency bands evenly into barCount bars
      const step = Math.floor(bufferLength / barCount);
      const bars: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const start = i * step;
        let sum = 0;
        for (let j = start; j < start + step && j < bufferLength; j++) {
          sum += dataArray[j];
        }
        const avg = sum / step;
        // Normalize to 4–40 range for visual height
        const height = Math.max(4, Math.round((avg / 255) * 40));
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

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Set up Web Audio API analyser for waveform visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Configure MediaRecorder with best available codec
      const mimeType = detectMimeType();
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];
      recordedBlobRef.current = null;
      recordedDataUrlRef.current = null;

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
        recordedBlobRef.current = blob;
        mimeTypeRef.current = finalMime;

        try {
          const dataUrl = await blobToDataUrl(blob);
          recordedDataUrlRef.current = dataUrl;
        } catch {
          setErrorMsg('Failed to process audio recording.');
        }
      };

      // 4. Start recording
      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setState('recording');

      // 5. Start elapsed timer (update every 100ms for smooth display)
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        // Auto-stop safety at max duration
        if (elapsed >= maxDurationSec * 1000) {
          stopRecording();
        }
      }, 100);

      // 6. Start waveform visualization loop
      startWaveformLoop();
    } catch (err: any) {
      cleanup();
      setState('idle');
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied. Please allow mic permissions.');
      } else if (err?.name === 'NotFoundError') {
        setErrorMsg('No microphone detected on this device.');
      } else {
        setErrorMsg('Failed to access microphone.');
      }
    }
  }, [cleanup, maxDurationSec, startWaveformLoop]);

  // ── Stop Recording ───────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    recordedDurationRef.current = Date.now() - startTimeRef.current;

    // Stop animation and timer
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Stop MediaRecorder (triggers onstop → builds blob)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Release microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Reset waveform to flat
    setWaveformBars(new Array(24).fill(4));
    setState('stopped');
  }, []);

  // ── Cancel Recording ─────────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    recordedBlobRef.current = null;
    recordedDataUrlRef.current = null;
    setElapsedMs(0);
    setWaveformBars(new Array(24).fill(4));
    setState('idle');
    onCancel();
  }, [cleanup, onCancel]);

  // ── Send Recorded Audio ──────────────────────────────────────────────────
  const sendRecording = useCallback(() => {
    const dataUrl = recordedDataUrlRef.current;
    const blob = recordedBlobRef.current;
    if (!dataUrl || !blob) return;

    const durationMs = recordedDurationRef.current;
    const mimeType = mimeTypeRef.current || 'audio/webm';
    const fileSize = blob.size;

    onSend(dataUrl, durationMs, mimeType, fileSize);

    // Reset state
    chunksRef.current = [];
    recordedBlobRef.current = null;
    recordedDataUrlRef.current = null;
    setElapsedMs(0);
    setState('idle');
  }, [onSend]);

  // ── Format elapsed time as MM:SS ─────────────────────────────────────────
  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // RENDER — Minimal functional UI (polished in Submodule 8.3)
  // =========================================================================

  // Idle state — just the mic trigger button
  if (state === 'idle') {
    return (
      <>
        <button
          type="button"
          onClick={startRecording}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 border border-slate-700/80 transition shrink-0 flex items-center justify-center cursor-pointer"
          title="Record Voice Note"
        >
          <Mic size={18} />
        </button>
        {errorMsg && (
          <div className="absolute bottom-16 left-4 right-4 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/50 text-rose-300 text-[11px] font-mono z-20 fade-in-up">
            {errorMsg}
          </div>
        )}
      </>
    );
  }

  // Requesting mic permission
  if (state === 'requesting') {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
        <Loader2 size={14} className="animate-spin text-blue-400" />
        Requesting microphone access...
      </div>
    );
  }

  // Recording state — waveform + timer + stop/cancel
  if (state === 'recording') {
    const maxMs = maxDurationSec * 1000;
    return (
      <div className="flex-1 flex items-center gap-2.5 px-2">
        {/* Cancel */}
        <button
          type="button"
          onClick={cancelRecording}
          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-slate-700 transition shrink-0"
          title="Cancel Recording"
        >
          <X size={16} />
        </button>

        {/* Recording indicator + Timer */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <span className="text-xs font-mono text-rose-400 font-bold tabular-nums">
            {formatTime(elapsedMs)}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            / {formatTime(maxMs)}
          </span>
        </div>

        {/* Live Waveform Bars */}
        <div className="flex-1 flex items-center justify-center gap-[2px] h-8 overflow-hidden">
          {waveformBars.map((h, i) => (
            <div
              key={i}
              className="rounded-full bg-rose-500/80 transition-all duration-75"
              style={{
                width: '3px',
                height: `${h}px`,
                opacity: 0.5 + (h / 40) * 0.5,
              }}
            />
          ))}
        </div>

        {/* Stop */}
        <button
          type="button"
          onClick={stopRecording}
          className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition shrink-0 flex items-center justify-center shadow-lg"
          title="Stop Recording"
        >
          <Square size={16} fill="currentColor" />
        </button>
      </div>
    );
  }

  // Stopped state — preview + send/cancel
  if (state === 'stopped') {
    return (
      <div className="flex-1 flex items-center gap-2.5 px-2">
        {/* Discard */}
        <button
          type="button"
          onClick={cancelRecording}
          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-slate-700 transition shrink-0"
          title="Discard Recording"
        >
          <X size={16} />
        </button>

        {/* Duration info */}
        <div className="flex items-center gap-2 flex-1">
          <Mic size={14} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-slate-300">
            Voice Note — {formatTime(recordedDurationRef.current)}
          </span>
          {recordedBlobRef.current && (
            <span className="text-[10px] font-mono text-slate-500">
              ({(recordedBlobRef.current.size / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>

        {/* Send */}
        <button
          type="button"
          onClick={sendRecording}
          disabled={!recordedDataUrlRef.current}
          className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          title="Send Voice Note"
        >
          <Send size={14} /> Send
        </button>
      </div>
    );
  }

  return null;
};
