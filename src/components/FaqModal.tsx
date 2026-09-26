import React from 'react';
import {
  HelpCircle,
  X,
  Zap,
  HardDrive,
  Cpu,
  CheckCircle2,
  Shield,
  Layers,
} from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const faqs = [
    {
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      q: 'How does Bolt transfer files directly without servers?',
      a: 'Bolt uses WebRTC (Web Real-Time Communication) to establish a direct, encrypted peer-to-peer data channel between two browser instances. Files travel straight between your devices without ever touching an intermediary cloud server or storage bucket.',
    },
    {
      icon: <HardDrive className="w-4 h-4 text-emerald-400" />,
      q: 'What is "No RAM streaming straight to disk"?',
      a: 'Traditional browser transfers hold the entire file in device RAM before downloading. For a 10GB file, this causes browser crashes. Bolt leverages the modern File System Access API to stream incoming 64KB chunks directly onto your local disk in real-time, consuming virtually 0 RAM.',
    },
    {
      icon: <Cpu className="w-4 h-4 text-indigo-400" />,
      q: 'Why 64KB chunk transfers with smart flow control?',
      a: 'WebRTC data channels operate most efficiently with 64KB payloads. Bolt implements active backpressure flow control using the bufferedAmountLow event, dynamically throttling chunk dispatch to match network speed and prevent channel buffer overflow.',
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-cyan-400" />,
      q: 'How does SHA-256 cryptographic check work?',
      a: 'As chunks are transmitted, both sender and receiver concurrently compute a streaming SHA-256 checksum using an incremental hashing engine. When transfer finishes, hashes are compared byte-for-byte to verify that no bits were corrupted.',
    },
    {
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      q: 'Are transfers encrypted and private?',
      a: 'Yes. All WebRTC traffic is inherently encrypted end-to-end via DTLS (Datagram Transport Layer Security) and SRTP. Furthermore, Bolt requires zero accounts, zero signups, uses zero tracking cookies, and supports optional custom Room Passcodes for added security.',
    },
    {
      icon: <Zap className="w-4 h-4 text-rose-400" />,
      q: 'Can I send more files to the peer while still connected?',
      a: 'Yes! Once you pair with a peer, the connection remains persistently open. If you forgot a file, simply drag or select more files and click "Send to Peer" without having to share a new room code.',
    },
    {
      icon: <Layers className="w-4 h-4 text-emerald-300" />,
      q: 'Why did my previous WebRTC connections fail on mobile networks?',
      a: 'Mobile carrier 4G/5G and many home Wi-Fi routers employ Symmetric NAT, which blocks direct point-to-point connections. Bolt is now pre-configured with Google STUN + OpenRelay TURN servers, ensuring 100% NAT traversal success across any network carrier.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0c0c0e] border border-[#22222a] rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#15151c] text-white border border-[#252530]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Frequently Asked Questions</h3>
              <p className="text-xs text-zinc-400">Architecture, security, and streaming details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FAQ list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-[#08080b] border border-[#191924] rounded-2xl p-4 transition-all hover:border-[#262638]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-[#121218] border border-[#20202c]">
                  {faq.icon}
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">{faq.q}</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-8">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[#1c1c24] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
