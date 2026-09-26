import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
} from 'lucide-react';
import { getTransferHistory, clearTransferHistory, HistoryItem } from '../services/historyService';
import { formatBytes } from '../services/cryptoService';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHistory(getTransferHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    clearTransferHistory();
    setHistory([]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#15151c] text-white border border-[#252530]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Transfer History</h3>
              <p className="text-xs text-zinc-400">Local device transfer logs and SHA-256 integrity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-rose-400 hover:bg-[#181820] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* History items */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <History className="w-8 h-8 stroke-[1.5] mb-2 opacity-40" />
              <p className="text-sm font-medium text-zinc-400">No transfer history yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Completed file transfers and cryptographic verification records will appear here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-[#07070a] border border-[#1a1a24] rounded-2xl p-4 flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${
                        item.direction === 'sent'
                          ? 'bg-[#181a28] border-[#292c42] text-sky-400'
                          : 'bg-[#16231d] border-[#253d30] text-emerald-400'
                      }`}
                    >
                      {item.direction === 'sent' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-[280px] sm:max-w-[360px]">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                        <span>{formatBytes(item.size)}</span>
                        <span>•</span>
                        <span className="capitalize">{item.direction}</span>
                        <span>•</span>
                        <span>Room {item.peerRoomCode}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                    {new Date(item.timestamp).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.sha256 && (
                  <div className="pt-2 border-t border-[#14141c] flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span className="truncate max-w-[280px]" title={item.sha256}>
                      SHA-256: {item.sha256}
                    </span>
                    <button
                      onClick={() => handleCopy(item.id, item.sha256!)}
                      className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
