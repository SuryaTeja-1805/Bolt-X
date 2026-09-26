import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Share2,
  QrCode,
  Lock,
  Clock,
  HardDrive,
  Send,
  Check,
  RotateCw,
  Sparkles,
  HelpCircle,
  Wifi,
} from 'lucide-react';
import { ConnectionState } from '../services/peerService';

interface RoomControlCardProps {
  mode: 'send' | 'receive';
  setMode: (mode: 'send' | 'receive') => void;
  roomCode: string;
  targetRoomCode: string;
  setTargetRoomCode: (code: string) => void;
  protectPasscode: boolean;
  setProtectPasscode: (protect: boolean) => void;
  passcode: string;
  setPasscode: (code: string) => void;
  receiverPasscode: string;
  setReceiverPasscode: (code: string) => void;
  connectionStatus: ConnectionState;
  statusMessage: string;
  onSendToPeer: () => void;
  onConnectReceiver: (code: string, passcode?: string) => void;
  onOpenShareModal: () => void;
  onOpenDiagnostics: () => void;
  hasFilesToSend: boolean;
  isTransferring: boolean;
  supportsDiskStream: boolean;
  useDiskStream: boolean;
  setUseDiskStream: (val: boolean) => void;
  onRegenerateCode: () => void;
  onEnableLoopback?: () => void;
}

export const RoomControlCard: React.FC<RoomControlCardProps> = ({
  mode,
  setMode,
  roomCode,
  targetRoomCode,
  setTargetRoomCode,
  protectPasscode,
  setProtectPasscode,
  passcode,
  setPasscode,
  receiverPasscode,
  setReceiverPasscode,
  connectionStatus,
  statusMessage,
  onSendToPeer,
  onConnectReceiver,
  onOpenShareModal,
  onOpenDiagnostics,
  hasFilesToSend,
  isTransferring,
  supportsDiskStream,
  useDiskStream,
  setUseDiskStream,
  onRegenerateCode,
  onEnableLoopback,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const digitInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleShareLink = async () => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const link = `${origin}${window.location.pathname}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    const digits = targetRoomCode.split('');
    while (digits.length < 5) digits.push('');

    // Handle full paste
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 5).split('');
      pasted.forEach((d, i) => {
        if (i < 5) digits[i] = d;
      });
      setTargetRoomCode(digits.join(''));
      const nextIdx = Math.min(pasted.length, 4);
      digitInputsRef.current[nextIdx]?.focus();
      return;
    }

    digits[index] = cleaned;
    setTargetRoomCode(digits.join(''));

    if (cleaned && index < 4) {
      digitInputsRef.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !targetRoomCode[index] && index > 0) {
      digitInputsRef.current[index - 1]?.focus();
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="w-full bg-[#0c0c0e] border border-[#1c1c22] rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-2xl backdrop-blur-md">
      <div>
        {/* Send / Receive Tabs */}
        <div className="w-full bg-[#15151a] p-1 rounded-full flex items-center mb-6 border border-[#202028]">
          <button
            onClick={() => setMode('send')}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer ${
              mode === 'send'
                ? 'bg-[#25252e] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Send Files
          </button>
          <button
            onClick={() => setMode('receive')}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer ${
              mode === 'receive'
                ? 'bg-[#25252e] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Receive Files
          </button>
        </div>

        {mode === 'send' ? (
          /* Sender Mode View */
          <div className="flex flex-col items-center">
            {/* Status Pill */}
            <div className="mb-5 flex items-center gap-2 px-3 py-1 rounded-full bg-[#141418] border border-[#22222a] text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse'
                }`}
              />
              <span className={isConnected ? 'text-emerald-300' : 'text-zinc-300'}>
                {isConnected ? '• Peer connected & ready!' : '• Waiting for peer to connect...'}
              </span>
            </div>

            <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-500 uppercase mb-2">
              YOUR ROOM CODE
            </span>

            {/* Room Code Display */}
            <div className="w-full bg-[#060608] border border-[#1f1f26] rounded-2xl py-4 sm:py-5 px-6 text-center mb-4 relative group">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-[0.35em] text-white font-mono select-all">
                {roomCode.split('').join(' ')}
              </div>
            </div>

            {/* Copy & Share Buttons */}
            <div className="w-full grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#141419] hover:bg-[#1f1f26] border border-[#23232c] text-xs sm:text-sm font-medium text-zinc-200 hover:text-white transition-all cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShareLink}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#141419] hover:bg-[#1f1f26] border border-[#23232c] text-xs sm:text-sm font-medium text-zinc-200 hover:text-white transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-zinc-400" />
                    <span>Share Link</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Action */}
            <button
              onClick={onOpenShareModal}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-transparent hover:bg-[#141418] border border-[#1a1a20] text-xs text-zinc-400 hover:text-zinc-200 transition-all mb-4 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR Code for Mobile Scanning</span>
            </button>

            {/* Passcode Protection Toggle */}
            <div className="w-full bg-[#0a0a0d] border border-[#1c1c22] rounded-xl p-3 mb-4">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Protect with Passcode</span>
                </span>
                <input
                  type="checkbox"
                  checked={protectPasscode}
                  onChange={(e) => setProtectPasscode(e.target.checked)}
                  className="w-4 h-4 accent-zinc-200 rounded cursor-pointer"
                />
              </label>

              {protectPasscode && (
                <div className="mt-2.5 pt-2 border-t border-[#181820]">
                  <input
                    type="password"
                    placeholder="Enter room passcode (e.g. 1234)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-[#121216] border border-[#24242e] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Peer must enter this passcode before connecting.
                  </span>
                </div>
              )}
            </div>

            {/* Instruction Callout */}
            <div className="w-full bg-[#09090c] border border-[#1a1a22] rounded-2xl p-4 mb-4 text-left flex items-start gap-3">
              <div className="p-1 rounded-full bg-[#181820] text-zinc-400 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">
                  {isConnected ? 'Peer Connected & Ready' : 'Ready to Connect'}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isConnected
                    ? 'Connection is established. Select files or folders to transfer instantly.'
                    : 'Share room code with the recipient, then add files or folders to send.'}
                </p>
              </div>
            </div>

            {/* Troubleshoot prompt if taking long */}
            {!isConnected && (
              <button
                onClick={onOpenDiagnostics}
                className="text-[11px] text-zinc-400 hover:text-white underline mb-4 transition-colors cursor-pointer"
              >
                Having trouble connecting? Open WebRTC Diagnostics & STUN/TURN Tools
              </button>
            )}
          </div>
        ) : (
          /* Receiver Mode View */
          <div className="flex flex-col items-center">
            {/* Status Pill */}
            <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-[#141418] border border-[#22222a] text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : connectionStatus === 'connecting'
                    ? 'bg-sky-400 animate-spin'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="text-zinc-300">{statusMessage}</span>
            </div>

            <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3">
              ENTER 5-DIGIT ROOM CODE
            </span>

            {/* 5-Digit Inputs */}
            <div className="flex gap-2 sm:gap-2.5 justify-center mb-5 w-full">
              {[0, 1, 2, 3, 4].map((idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputsRef.current[idx] = el;
                  }}
                  type="text"
                  maxLength={1}
                  value={targetRoomCode[idx] || ''}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-mono font-bold bg-[#07070a] border border-[#22222c] rounded-xl text-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all"
                  inputMode="numeric"
                />
              ))}
            </div>

            {/* Optional Passcode Input */}
            <div className="w-full mb-4">
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                Room Passcode (if sender protected with PIN)
              </label>
              <input
                type="password"
                placeholder="Optional passcode..."
                value={receiverPasscode}
                onChange={(e) => setReceiverPasscode(e.target.value)}
                className="w-full bg-[#0a0a0d] border border-[#202028] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 font-mono"
              />
            </div>

            {/* Direct-to-Disk Stream Toggle */}
            {supportsDiskStream && (
              <div className="w-full bg-[#09090c] border border-[#1b1b22] rounded-xl p-3 mb-5 text-left">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Direct-to-Disk Stream (0 RAM)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={useDiskStream}
                    onChange={(e) => setUseDiskStream(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>
                <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                  Streams multi-gigabyte files directly to your hard drive without consuming browser RAM.
                </p>
              </div>
            )}

            {/* Connect Button */}
            {!isConnected && (
              <button
                onClick={() => onConnectReceiver(targetRoomCode, receiverPasscode)}
                disabled={targetRoomCode.length < 5 || connectionStatus === 'connecting'}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all mb-3 cursor-pointer flex items-center justify-center gap-2 ${
                  targetRoomCode.length === 5 && connectionStatus !== 'connecting'
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-lg'
                    : 'bg-[#181820] text-zinc-500 cursor-not-allowed'
                }`}
              >
                {connectionStatus === 'connecting' ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Peer...</span>
                  </>
                ) : (
                  <span>Connect to Peer</span>
                )}
              </button>
            )}

            {/* Troubleshooting option & Quick Test */}
            <div className="flex flex-col items-center gap-1.5 mb-3">
              <button
                onClick={onOpenDiagnostics}
                className="text-[11px] text-zinc-400 hover:text-white underline transition-colors cursor-pointer"
              >
                Connection Diagnostics & Manual Pairing
              </button>
              {onEnableLoopback && !isConnected && (
                <button
                  onClick={onEnableLoopback}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                >
                  ⚡ Test In-Tab Loopback Mode (Instant Test)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Button (Sender) */}
      {mode === 'send' && (
        <button
          onClick={onSendToPeer}
          disabled={!isConnected || !hasFilesToSend || isTransferring}
          className={`w-full py-3.5 sm:py-4 rounded-2xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isConnected && hasFilesToSend && !isTransferring
              ? 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-[0.99]'
              : 'bg-[#1c1c22] text-zinc-500 cursor-not-allowed border border-[#25252e]'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>
            {isTransferring
              ? 'Transferring Files...'
              : isConnected
              ? hasFilesToSend
                ? 'Send to Peer'
                : 'Add Files to Send'
              : 'Waiting for Peer to Connect'}
          </span>
        </button>
      )}
    </div>
  );
};
