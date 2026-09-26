import React, { useState } from 'react';
import {
  X,
  Activity,
  RotateCw,
  ShieldCheck,
  Server,
  Radio,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
} from 'lucide-react';
import { PeerDiagnostics } from '../services/peerService';
import { ManualSdpService } from '../services/manualSdpService';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: PeerDiagnostics;
  onRestartIce: () => void;
  onEnableLoopback: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  onRestartIce,
  onEnableLoopback,
}) => {
  const [manualMode, setManualMode] = useState<'off' | 'offer' | 'answer'>('off');
  const [manualOfferText, setManualOfferText] = useState('');
  const [manualAnswerText, setManualAnswerText] = useState('');
  const [copiedOffer, setCopiedOffer] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [manualConnected, setManualConnected] = useState(false);
  const [manualService] = useState(() => new ManualSdpService());

  if (!isOpen) return null;

  const handleStartManualOffer = async () => {
    setManualMode('offer');
    try {
      const { offerJson, onConnected, applyAnswer } = await manualService.createOffer();
      setManualOfferText(offerJson);
      (window as any)._boltManualApplyAnswer = applyAnswer;

      onConnected.then(() => {
        setManualConnected(true);
      });
    } catch (e: any) {
      alert('Error creating manual offer: ' + e.message);
    }
  };

  const handleGenerateManualAnswer = async () => {
    try {
      const { answerJson, onConnected } = await manualService.acceptOffer(manualOfferText.trim());
      setManualAnswerText(answerJson);
      onConnected.then(() => {
        setManualConnected(true);
      });
    } catch (e: any) {
      alert('Error generating answer: ' + e.message);
    }
  };

  const handleApplyAnswerOnSender = async () => {
    try {
      const applyAnswer = (window as any)._boltManualApplyAnswer;
      if (applyAnswer && manualAnswerText.trim()) {
        await applyAnswer(manualAnswerText.trim());
      }
    } catch (e: any) {
      alert('Error applying answer: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#15151c] text-white border border-[#252530]">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connection Troubleshooter & Diagnostics</h3>
              <p className="text-xs text-zinc-400">Real-time WebRTC ICE, STUN/TURN, and signaling telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Status Cards */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Signaling Server */}
            <div className="bg-[#07070a] border border-[#1a1a24] rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-zinc-500" />
                  Signaling Relay
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    diagnostics.signalingStatus === 'connected'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                      : diagnostics.signalingStatus === 'connecting'
                      ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
                      : 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
                  }`}
                >
                  {diagnostics.signalingStatus}
                </span>
              </div>
              <p className="text-xs font-mono text-white mt-1">{diagnostics.selectedServer}</p>
              <p className="text-[11px] text-zinc-500">
                Maintains room code presence and exchanges WebRTC SDP offers/answers over WebSocket.
              </p>
            </div>

            {/* ICE NAT Traversal */}
            <div className="bg-[#07070a] border border-[#1a1a24] rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-zinc-500" />
                  ICE Connection
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    diagnostics.iceConnectionState === 'connected' || diagnostics.iceConnectionState === 'completed'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                      : diagnostics.iceConnectionState === 'checking'
                      ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50 animate-pulse'
                      : diagnostics.iceConnectionState === 'failed'
                      ? 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
                      : 'bg-[#181820] text-zinc-400'
                  }`}
                >
                  {diagnostics.iceConnectionState}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-white">Route: {diagnostics.candidateType}</span>
                {diagnostics.rttMs !== null && (
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                    {diagnostics.rttMs}ms RTT
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Configured with 5 Google/Cloudflare STUN servers and OpenRelay TURN fallback for symmetric NATs.
              </p>
            </div>
          </div>

          {/* Quick Troubleshooting Actions */}
          <div className="bg-[#09090c] border border-[#1a1a22] rounded-2xl p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1-Click Connection Repair Tools
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  onRestartIce();
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#141419] hover:bg-[#1f1f26] border border-[#23232c] text-xs font-medium text-white transition-all cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Force ICE / TURN Restart</span>
              </button>

              <button
                onClick={() => {
                  onEnableLoopback();
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#141419] hover:bg-[#1f1f26] border border-[#23232c] text-xs font-medium text-white transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test In-Tab Loopback Mode</span>
              </button>
            </div>
          </div>

          {/* Serverless Manual SDP Handshake */}
          <div className="bg-[#08080b] border border-[#191924] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Serverless / Manual SDP Pairing (Zero-Relay Fallback)
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Use this if your network or firewall blocks all WebSocket signaling servers.
                </p>
              </div>
              {manualMode === 'off' && (
                <button
                  onClick={handleStartManualOffer}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                >
                  Start Manual Pairing
                </button>
              )}
            </div>

            {manualMode === 'offer' && (
              <div className="space-y-3 pt-2 border-t border-[#181820]">
                <div>
                  <span className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Step 1: Sender copy this Offer & share with Receiver:
                  </span>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={manualOfferText || 'Generating offer with STUN/TURN candidates...'}
                      rows={3}
                      className="w-full bg-[#060608] border border-[#22222c] rounded-xl p-2.5 text-[10px] font-mono text-zinc-300 resize-none select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(manualOfferText);
                        setCopiedOffer(true);
                        setTimeout(() => setCopiedOffer(false), 2000);
                      }}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-[#181820] text-[10px] text-zinc-300 flex items-center gap-1"
                    >
                      {copiedOffer ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOffer ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Step 2: Receiver paste Offer below to generate Answer:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Offer JSON here..."
                      value={manualOfferText}
                      onChange={(e) => setManualOfferText(e.target.value)}
                      className="flex-1 bg-[#060608] border border-[#22222c] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono"
                    />
                    <button
                      onClick={handleGenerateManualAnswer}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 cursor-pointer"
                    >
                      Generate Answer
                    </button>
                  </div>
                </div>

                {manualAnswerText && (
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-300 block mb-1">
                      Step 3: Sender paste Answer here & apply:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste Answer JSON..."
                        value={manualAnswerText}
                        onChange={(e) => setManualAnswerText(e.target.value)}
                        className="flex-1 bg-[#060608] border border-[#22222c] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <button
                        onClick={handleApplyAnswerOnSender}
                        className="px-3 py-1.5 rounded-xl bg-emerald-400 text-black text-xs font-semibold hover:bg-emerald-300 cursor-pointer"
                      >
                        Apply Answer
                      </button>
                    </div>
                  </div>
                )}

                {manualConnected && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Direct Serverless WebRTC Data Channel Connected!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#1c1c24] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Powered by WebRTC DTLS 1.2 & OpenRelay TURN Network
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
