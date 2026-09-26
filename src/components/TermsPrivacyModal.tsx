import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface TermsPrivacyModalProps {
  type: 'terms' | 'privacy' | null;
  onClose: () => void;
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const isTerms = type === 'terms';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              {isTerms ? 'Terms of Service' : 'Privacy Policy'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 text-xs text-zinc-400 space-y-3 leading-relaxed">
          {isTerms ? (
            <>
              <p>
                <strong className="text-zinc-200">Decentralized P2P Architecture:</strong> Bolt acts purely as a browser-side application facilitating WebRTC direct peer connections. We do not operate file storage servers, relays, or intermediaries.
              </p>
              <p>
                <strong className="text-zinc-200">User Responsibility:</strong> You are solely responsible for all content, files, or information transferred using Bolt. You agree not to transmit illegal, unauthorized, or infringing materials.
              </p>
              <p>
                <strong className="text-zinc-200">As-Is Service:</strong> Bolt is provided “as is” without warranties of any kind. Network speeds and delivery reliability depend on peer network topology, NAT types, and device configurations.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong className="text-zinc-200">Zero Tracking & Zero Logs:</strong> Bolt does not collect personal data, IP logs, analytics, or behavioral cookies.
              </p>
              <p>
                <strong className="text-zinc-200">End-to-End Encryption:</strong> All data packets are encrypted directly between participating browser peers using WebRTC's native DTLS/SRTP cryptography.
              </p>
              <p>
                <strong className="text-zinc-200">Zero File Storage:</strong> Files never touch any centralized servers or cloud databases. Once transmission completes, data exists solely on the sender and recipient devices.
              </p>
            </>
          )}
        </div>

        <div className="pt-3 border-t border-[#1c1c24] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
