import React from 'react';
import { SharedFile } from '../types';
import {
  X,
  Download,
  FileText,
  FileImage,
  FileVideo,
  FileCode,
  FileArchive,
  File as GenericFile,
  ShieldCheck,
  Radio,
  Wifi,
  Bluetooth,
  Trash2,
} from 'lucide-react';

interface FileViewerModalProps {
  file: SharedFile | null;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  file,
  onClose,
  onDelete,
}) => {
  if (!file) return null;

  const isImage = file.fileType.startsWith('image/');
  const isVideo = file.fileType.startsWith('video/');
  const isAudio = file.fileType.startsWith('audio/');
  const isPdf = file.fileType === 'application/pdf';
  const isZip = file.fileType.includes('zip') || file.fileName.endsWith('.zip');
  const isCode =
    file.fileName.endsWith('.json') ||
    file.fileName.endsWith('.js') ||
    file.fileName.endsWith('.ts') ||
    file.fileName.endsWith('.html') ||
    file.fileName.endsWith('.css');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = file.fileData;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getFileIcon = () => {
    if (isImage) return <FileImage size={28} className="text-cyan-400" />;
    if (isVideo) return <FileVideo size={28} className="text-purple-400" />;
    if (isAudio) return <FileText size={28} className="text-amber-400" />;
    if (isCode) return <FileCode size={28} className="text-emerald-400" />;
    if (isZip) return <FileArchive size={28} className="text-rose-400" />;
    return <GenericFile size={28} className="text-blue-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
      <div className="glass-panel w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800/90 border border-slate-700">
              {getFileIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={file.fileName}>
                {file.fileName}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {formatFileSize(file.fileSize)} • {file.fileType || 'Binary File'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Viewer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Container */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col items-center justify-center bg-slate-950/40">
          {isImage ? (
            <div className="max-h-[380px] flex items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-2 shadow-inner">
              <img
                src={file.fileData}
                alt={file.fileName}
                className="max-h-[360px] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : isVideo ? (
            <div className="w-full max-w-lg rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-lg">
              <video controls src={file.fileData} className="w-full max-h-[360px]" />
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-lg">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FileText size={32} />
              </div>
              <audio controls src={file.fileData} className="w-full" />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[360px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <iframe src={file.fileData} title={file.fileName} className="w-full h-full border-none" />
            </div>
          ) : (
            <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-4 shadow-lg">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                {getFileIcon()}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{file.fileName}</h4>
                <p className="text-xs font-mono text-slate-400 mt-1">
                  Ready for direct offline P2P download
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Details Bar */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
          <div>
            <span className="block text-[10px] uppercase font-mono text-slate-500">Shared By</span>
            <span className="font-semibold text-white truncate block">{file.senderName}</span>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-mono text-slate-500">Transport Channel</span>
            <div className="flex items-center gap-1 font-semibold text-blue-400">
              {file.channel === 'LAN' ? (
                <Wifi size={12} />
              ) : file.channel === 'Wi-Fi Direct' ? (
                <Radio size={12} className="text-emerald-400" />
              ) : (
                <Bluetooth size={12} />
              )}
              <span className={file.escalatedToWifiDirect ? 'text-emerald-400 font-bold' : ''}>
                {file.channel}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-mono text-slate-500">Timestamp</span>
            <span className="font-mono text-slate-300">
              {new Date(file.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-mono text-slate-500">Fingerprint ID</span>
            <div className="flex items-center gap-1 font-mono text-slate-400">
              <ShieldCheck size={12} className="text-cyan-400 shrink-0" />
              <span className="truncate">{file.fileId.slice(0, 12)}</span>
            </div>
          </div>
        </div>

        {/* Auto-escalation Badge Banner if large file */}
        {file.escalatedToWifiDirect && (
          <div className="px-6 py-1.5 bg-emerald-950/60 border-t border-emerald-800/60 flex items-center justify-between text-[11px] text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Radio size={13} className="animate-pulse text-emerald-400" />
              Auto-escalated to Wi-Fi Direct transport (&gt;5MB payload size optimized)
            </span>
            <span className="font-mono text-[10px] uppercase bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-700">
              FR-6 Compliant
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              onClick={() => onDelete(file.fileId)}
              className="btn bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800 text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary text-xs py-2 px-4"
            >
              Close
            </button>

            <button
              onClick={handleDownload}
              className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2"
            >
              <Download size={14} /> Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
