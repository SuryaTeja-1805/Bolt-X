import React from 'react';
import {
  Zap,
  Download,
  HelpCircle,
  History,
  Activity,
  Check,
} from 'lucide-react';
import { PeerDiagnostics } from '../services/peerService';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenFaq: () => void;
  onOpenDiagnostics: () => void;
  canInstall: boolean;
  onInstall: () => void;
  connectionStatus: string;
  diagnostics: PeerDiagnostics;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenFaq,
  onOpenDiagnostics,
  canInstall,
  onInstall,
  connectionStatus,
  diagnostics,
}) => {
  const isConnected = connectionStatus === 'connected';

  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-white shadow-inner">
          <Zap className="w-5 h-5 fill-white text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Bolt
          </span>
          <span className="text-xs text-zinc-500 font-medium hidden sm:inline-block">
            P2P File Transfer
          </span>
        </div>
      </div>

      {/* Actions & Diagnostics */}
      <div className="flex items-center gap-2">
        {/* P2P / ICE Diagnostics Pill */}
        <button
          onClick={onOpenDiagnostics}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
            isConnected
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/50'
              : connectionStatus === 'connecting'
              ? 'bg-amber-950/30 border-amber-800/50 text-amber-300 hover:bg-amber-950/50'
              : 'bg-[#121216] hover:bg-[#1a1a20] border-[#23232c] text-zinc-400 hover:text-white'
          }`}
          title="WebRTC ICE & Signaling Diagnostics"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isConnected ? `P2P Connected (${diagnostics.rttMs ? `${diagnostics.rttMs}ms` : 'Active'})` : 'Connection Diagnostics'}
          </span>
          <span className="md:hidden">
            {isConnected ? 'Connected' : 'Network'}
          </span>
        </button>

        {/* Install PWA Button */}
        {canInstall && (
          <button
            onClick={onInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216] hover:bg-[#1a1a20] border border-[#23232c] text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}

        {/* FAQ Button */}
        <button
          onClick={onOpenFaq}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0c0c0e] hover:bg-[#16161c] border border-[#222228] text-xs font-medium text-zinc-400 hover:text-white transition-all cursor-pointer"
          title="Frequently Asked Questions"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">FAQ</span>
        </button>

        {/* History Button */}
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0c0c0e] hover:bg-[#16161c] border border-[#222228] text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all shadow-sm cursor-pointer"
        >
          <History className="w-4 h-4 text-zinc-400" />
          <span>History</span>
        </button>
      </div>
    </header>
  );
};
