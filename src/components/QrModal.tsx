import React, { useState } from 'react';
import {
  QrCode,
  X,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  const shareUrl = `${origin}${window.location.pathname}?room=${roomCode}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    shareUrl
  )}&bgcolor=ffffff&color=000000&margin=2`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#1b1c24] mb-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <QrCode className="w-4 h-4 text-zinc-300" />
            <span>Instant Mobile Pairing</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Graphic */}
        <div className="p-3 bg-white rounded-2xl shadow-xl mb-4">
          <img src={qrImageUrl} alt={`QR code for Room ${roomCode}`} className="w-48 h-48 rounded-lg" />
        </div>

        <p className="text-xs text-zinc-400 mb-4 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-zinc-300" />
          <span>Point any mobile camera to connect instantly</span>
        </p>

        {/* Share Link Preview */}
        <div className="w-full bg-[#060608] border border-[#1f1f28] rounded-xl p-2.5 flex items-center justify-between gap-2 mb-3">
          <span className="text-xs text-zinc-300 truncate font-mono text-left select-all">{shareUrl}</span>
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg bg-[#181820] hover:bg-[#252530] text-zinc-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Copy URL"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Copy Room Code Button */}
        <button
          onClick={handleCopyCode}
          className="w-full py-2.5 rounded-xl bg-[#14141a] hover:bg-[#1f1f28] border border-[#22222c] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {copiedCode ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Room Code Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy Code: {roomCode}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
