import React, { useEffect } from 'react';
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
  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '900px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          background: '#0f172a',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: 'default',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '8px 12px',
            background: '#020617',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ padding: '4px', background: '#1e293b', border: '1px solid #334155', flexShrink: 0 }}>
              {getFileIcon()}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }} title={file.fileName}>
                {file.fileName}
              </h3>
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatFileSize(file.fileSize)} • {file.senderName} ({file.channel})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={handleDownload}
              style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Download File"
            >
              <Download size={11} /> Download
            </button>
            <button
              onClick={onClose}
              style={{ padding: '4px', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Preview Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#020617',
            minHeight: 0,
          }}
        >
          {isImage ? (
            <div style={{ width: '100%', maxHeight: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #1e293b', background: '#0f172a', padding: '8px' }}>
              <img
                src={file.fileData}
                alt={file.fileName}
                style={{ maxHeight: '460px', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : isVideo ? (
            <div style={{ width: '100%', overflow: 'hidden', border: '1px solid #1e293b', background: '#020617' }}>
              <video controls src={file.fileData} style={{ width: '100%', maxHeight: '460px' }} />
            </div>
          ) : isAudio ? (
            <div style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', margin: '0 auto 8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                <FileText size={16} />
              </div>
              <audio controls src={file.fileData} style={{ width: '100%', height: '28px' }} />
            </div>
          ) : isPdf ? (
            <div style={{ width: '100%', height: '450px', overflow: 'hidden', border: '1px solid #1e293b', background: '#0f172a' }}>
              <iframe src={file.fileData} title={file.fileName} style={{ width: '100%', height: '100%', border: 'none' }} />
            </div>
          ) : (
            <div style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', margin: '0 auto 6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                {getFileIcon()}
              </div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</p>
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', margin: '4px 0 0' }}>Ready for P2P download</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
