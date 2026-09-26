import React, { useState } from 'react';
import {
  MessageSquare,
  Shield,
  X,
  Copy,
  Check,
  ExternalLink,
  Send,
} from 'lucide-react';
import { SharedTextMessage } from '../services/peerService';

interface TextRelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedTexts: SharedTextMessage[];
  onSendText: (text: string) => void;
  isConnected: boolean;
}

export const TextRelayModal: React.FC<TextRelayModalProps> = ({
  isOpen,
  onClose,
  sharedTexts,
  onSendText,
  isConnected,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim()) {
      onSendText(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#15151c] text-white border border-[#252530]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Peer Text & Clipboard Relay</h3>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Zero-footprint ephemeral peer messaging</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isConnected && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
            <span>• Peer is not yet connected. Text will queue locally and send once connected.</span>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[160px] max-h-[360px]">
          {sharedTexts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <MessageSquare className="w-8 h-8 stroke-[1.5] mb-2 opacity-40" />
              <p className="text-sm font-medium text-zinc-400">No shared text yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Paste passwords, long URLs, Wi-Fi credentials, or quick notes to transfer instantly to peer.
              </p>
            </div>
          ) : (
            sharedTexts.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.sender === 'self'
                    ? 'bg-[#121217] border-[#22222c] ml-6'
                    : 'bg-[#0f1118] border-[#232838] mr-6'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[11px] font-semibold ${
                      item.sender === 'self' ? 'text-zinc-400' : 'text-indigo-400'
                    }`}
                  >
                    {item.sender === 'self' ? 'You' : 'Peer'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleCopy(item.id, item.text)}
                      className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5"
                      title="Copy to clipboard"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap break-words font-mono">
                  {item.text}
                </p>

                {isUrl(item.text) && (
                  <a
                    href={item.text.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-2 font-sans"
                  >
                    <span>Open Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="pt-3 border-t border-[#1c1c24] flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or paste link, note, secret, password (Shift+Enter for new line)..."
            rows={2}
            className="flex-1 bg-[#060608] border border-[#22222a] rounded-xl p-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 resize-none font-mono"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="self-end p-3 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:bg-[#181820] disabled:text-zinc-600 transition-all cursor-pointer shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
