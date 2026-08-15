import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserProfile,
  DrawingStroke,
  WhiteboardAction,
  WhiteboardTool,
  Point,
  CollabPresence
} from '../../types';
import { networkService } from '../../services/network';
import {
  Pen,
  Paintbrush,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Grid,
  Sparkles,
  MousePointer,
  Maximize2,
  Layers,
  Palette
} from 'lucide-react';

interface SharedWhiteboardProps {
  profile: UserProfile;
  sessionId: string;
  sessionType: 'peer' | 'group' | 'scratch';
  onStrokesCountChange?: (count: number) => void;
}

const NEON_PALETTE = [
  { name: 'Cyan Glow', hex: '#06b6d4' },
  { name: 'Electric Blue', hex: '#3b82f6' },
  { name: 'Neon Emerald', hex: '#10b981' },
  { name: 'Rose Red', hex: '#f43f5e' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Purple Neon', hex: '#a855f7' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Slate Dark', hex: '#1e293b' },
];

const BRUSH_SIZES = [
  { label: 'Fine', size: 2 },
  { label: 'Medium', size: 5 },
  { label: 'Thick', size: 10 },
  { label: 'Broad', size: 18 },
  { label: 'Extra', size: 26 },
];

export const SharedWhiteboard: React.FC<SharedWhiteboardProps> = ({
  profile,
  sessionId,
  sessionType,
  onStrokesCountChange,
}) => {
  // Canvas References
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing Tools State
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#06b6d4');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Stroke History
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[]>([]);

  // Active Local Drawing State
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<Point[]>([]);
  const currentStrokeIdRef = useRef<string | null>(null);

  // Remote Peer Cursors
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number; username: string; avatar: string; color: string; lastSeen: number }>>(new Map());
  const lastPresenceBroadcastRef = useRef<number>(0);

  // Notify parent on strokes change
  useEffect(() => {
    onStrokesCountChange?.(strokes.length);
  }, [strokes.length, onStrokesCountChange]);

  // Redraw Canvas when strokes or grid changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear whole canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Cyberpunk Grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 32;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw subtle dot matrix intersections
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      for (let x = gridSize; x < width; x += gridSize * 2) {
        for (let y = gridSize; y < height; y += gridSize * 2) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      ctx.restore();
    }

    // Render all saved strokes
    strokes.forEach((stroke) => {
      renderStroke(ctx, stroke, width, height);
    });
  }, [strokes, showGrid]);

  // Render a single stroke with Bezier Curve Smoothing
  const renderStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: DrawingStroke,
    width: number,
    height: number
  ) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.brushSize * 2.2;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.brushSize * 2.5;
    } else if (stroke.tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.brushSize * 1.5;
    } else {
      // Pen
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.brushSize;
    }

    const points = stroke.points;
    if (points.length === 1) {
      // Single point dot
      const p = points[0];
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, stroke.brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = ((p1.x + p2.x) / 2) * width;
      const midY = ((p1.y + p2.y) / 2) * height;
      ctx.quadraticCurveTo(p1.x * width, p1.y * height, midX, midY);
    }

    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x * width, lastPoint.y * height);
    ctx.stroke();
    ctx.restore();
  };

  // Resize canvas according to container dimensions
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set actual pixel buffer
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context for DPR
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      redrawCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Subscribe to P2P Mesh Collaboration Packets
  useEffect(() => {
    const unsubWhiteboard = networkService.subscribeCollabWhiteboard((action: WhiteboardAction) => {
      if (action.sessionId !== sessionId && sessionId !== 'local_scratchpad' && action.sessionId !== 'local_scratchpad') {
        return;
      }

      if (action.type === 'stroke_add' && action.stroke) {
        const newStroke = action.stroke;
        setStrokes((prev) => {
          if (prev.some((s) => s.strokeId === newStroke.strokeId)) return prev;
          return [...prev, newStroke];
        });
      } else if (action.type === 'stroke_undo') {
        setStrokes((prev) => prev.slice(0, -1));
      } else if (action.type === 'canvas_clear') {
        setStrokes([]);
        setRedoStack([]);
      }
    });

    // Remote Cursor Presence
    const unsubPresence = networkService.subscribeCollabPresence((presence: CollabPresence) => {
      if (presence.userId === profile.userId) return;
      if (presence.sessionId !== sessionId && sessionId !== 'local_scratchpad') return;

      if (presence.cursorPosition) {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(presence.userId, {
            x: presence.cursorPosition!.x,
            y: presence.cursorPosition!.y,
            username: presence.username,
            avatar: presence.avatar,
            color: '#38bdf8',
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    });

    // Cleanup stale remote cursors every 3 seconds
    const cursorInterval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [userId, cursor] of next.entries()) {
          if (now - cursor.lastSeen > 4000) {
            next.delete(userId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      unsubWhiteboard();
      unsubPresence();
      clearInterval(cursorInterval);
    };
  }, [sessionId, profile.userId]);

  // Pointer & Touch Events for Drawing
  const getNormalizedCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedCoordinates(e);
    if (!pt) return;

    isDrawingRef.current = true;
    currentPointsRef.current = [pt];
    currentStrokeIdRef.current = `str_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedCoordinates(e);
    if (!pt) return;

    // Broadcast cursor position throttle (~30ms)
    const now = Date.now();
    if (now - lastPresenceBroadcastRef.current > 30) {
      lastPresenceBroadcastRef.current = now;
      networkService.sendCollabPresence({
        userId: profile.userId,
        username: profile.username,
        avatar: profile.avatar,
        sessionId,
        activeTab: 'whiteboard',
        cursorPosition: pt,
        lastActive: now,
      });
    }

    if (!isDrawingRef.current) return;

    currentPointsRef.current.push(pt);

    // Live preview on local canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempStroke: DrawingStroke = {
      strokeId: currentStrokeIdRef.current || 'temp',
      sessionId,
      authorId: profile.userId,
      authorName: profile.username,
      tool: selectedTool,
      color: selectedColor,
      brushSize,
      points: currentPointsRef.current,
      timestamp: Date.now(),
    };

    redrawCanvas();
    renderStroke(ctx, tempStroke, canvas.width, canvas.height);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentPointsRef.current.length === 0 || !currentStrokeIdRef.current) return;

    const newStroke: DrawingStroke = {
      strokeId: currentStrokeIdRef.current,
      sessionId,
      authorId: profile.userId,
      authorName: profile.username,
      tool: selectedTool,
      color: selectedColor,
      brushSize,
      points: [...currentPointsRef.current],
      timestamp: Date.now(),
    };

    // Save to local strokes state
    setStrokes((prev) => [...prev, newStroke]);
    setRedoStack([]);

    // Broadcast stroke to mesh network
    networkService.sendCollabWhiteboardAction({
      actionId: crypto.randomUUID(),
      type: 'stroke_add',
      sessionId,
      stroke: newStroke,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });

    currentPointsRef.current = [];
    currentStrokeIdRef.current = null;
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastStroke]);

    networkService.sendCollabWhiteboardAction({
      actionId: crypto.randomUUID(),
      type: 'stroke_undo',
      sessionId,
      strokeId: lastStroke.strokeId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const strokeToRestore = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, strokeToRestore]);

    networkService.sendCollabWhiteboardAction({
      actionId: crypto.randomUUID(),
      type: 'stroke_add',
      sessionId,
      stroke: strokeToRestore,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  const handleClearCanvas = () => {
    setStrokes([]);
    setRedoStack([]);
    setShowClearConfirm(false);

    networkService.sendCollabWhiteboardAction({
      actionId: crypto.randomUUID(),
      type: 'canvas_clear',
      sessionId,
      authorId: profile.userId,
      authorName: profile.username,
      timestamp: Date.now(),
    });
  };

  const handleSavePNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `fasdm_whiteboard_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="w-full flex flex-col gap-3 font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP DRAWING TOOLBAR */}
      {/* ========================================================================= */}
      <div className="glass-panel p-2.5 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-cyan-500/20 rounded-xl shadow-lg">
        {/* Tool Selectors */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSelectedTool('pen')}
            className={`p-2 rounded-md transition flex items-center gap-1.5 text-xs font-semibold ${
              selectedTool === 'pen'
                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Fine Pen (Crisp Vector Stroke)"
          >
            <Pen size={15} />
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => setSelectedTool('brush')}
            className={`p-2 rounded-md transition flex items-center gap-1.5 text-xs font-semibold ${
              selectedTool === 'brush'
                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Neon Glow Brush"
          >
            <Paintbrush size={15} />
            <span className="hidden sm:inline">Brush</span>
          </button>

          <button
            onClick={() => setSelectedTool('highlighter')}
            className={`p-2 rounded-md transition flex items-center gap-1.5 text-xs font-semibold ${
              selectedTool === 'highlighter'
                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Semi-Transparent Highlighter"
          >
            <Highlighter size={15} />
            <span className="hidden sm:inline">Highlighter</span>
          </button>

          <button
            onClick={() => setSelectedTool('eraser')}
            className={`p-2 rounded-md transition flex items-center gap-1.5 text-xs font-semibold ${
              selectedTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Precision Eraser"
          >
            <Eraser size={15} />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Cyberpunk Neon Color Swatches */}
        {selectedTool !== 'eraser' && (
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {NEON_PALETTE.map((color) => (
              <button
                key={color.hex}
                onClick={() => setSelectedColor(color.hex)}
                className={`w-6 h-6 rounded-full transition-transform border ${
                  selectedColor === color.hex
                    ? 'scale-125 border-white shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                    : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}

            {/* Custom Color Input */}
            <label
              className="w-6 h-6 rounded-full border border-slate-700 hover:border-white cursor-pointer flex items-center justify-center text-slate-400 hover:text-white overflow-hidden"
              title="Custom Color Picker"
            >
              <Palette size={12} />
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="opacity-0 w-0 h-0 absolute pointer-events-none"
              />
            </label>
          </div>
        )}

        {/* Brush Size Selector */}
        <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400">Size</span>
          <div className="flex items-center gap-1">
            {BRUSH_SIZES.map((b) => (
              <button
                key={b.size}
                onClick={() => setBrushSize(b.size)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  brushSize === b.size
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {b.size}px
              </button>
            ))}
          </div>
        </div>

        {/* Undo / Redo / Grid / Clear Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo Last Stroke"
          >
            <Undo2 size={15} />
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo Stroke"
          >
            <Redo2 size={15} />
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition ${
              showGrid
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Matrix Grid"
          >
            <Grid size={15} />
          </button>

          <button
            onClick={handleSavePNG}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Download Canvas PNG"
          >
            <Download size={15} />
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900 transition"
            title="Clear All Canvas Strokes"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN HTML5 DRAWING CANVAS CONTAINER */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="w-full h-[560px] sm:h-[620px] bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-2xl touch-none select-none cursor-crosshair"
      >
        <canvas
          id="fasdm-whiteboard-canvas"
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
        />

        {/* Remote Live Cursor Pointers Overlay */}
        {Array.from(remoteCursors.entries()).map(([peerUserId, cursor]) => (
          <div
            key={peerUserId}
            className="absolute pointer-events-none transition-all duration-75 z-20 flex items-center gap-1.5"
            style={{
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              transform: 'translate(2px, 2px)',
            }}
          >
            <MousePointer size={16} className="text-cyan-400 fill-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg border border-slate-700/80 backdrop-blur-md"
              style={{ backgroundColor: cursor.avatar || '#0284c7' }}
            >
              {cursor.username}
            </span>
          </div>
        ))}

        {/* Status Watermark */}
        <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{strokes.length} VECTOR STROKES</span>
          <span>•</span>
          <span>{selectedTool.toUpperCase()} ({brushSize}PX)</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CLEAR CANVAS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 text-center space-y-4 border border-rose-500/30 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Clear Entire Whiteboard?</h3>
            <p className="text-xs text-slate-300">
              This action will broadcast a canvas clear command to all connected mesh nodes in this session.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn btn-secondary flex-1 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCanvas}
                className="btn bg-rose-600 hover:bg-rose-500 text-white font-bold flex-1 py-2 text-xs shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
