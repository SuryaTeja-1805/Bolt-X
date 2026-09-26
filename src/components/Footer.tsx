import React from 'react';

interface FooterProps {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenFaq: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenTerms, onOpenPrivacy, onOpenFaq }) => {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center justify-center text-center mt-auto">
      <p className="text-xs sm:text-sm text-zinc-400 font-medium mb-3">
        Direct browser-to-browser P2P file transfer. Zero cloud storage.
      </p>
      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
        <button onClick={onOpenTerms} className="hover:text-zinc-300 transition-colors cursor-pointer">
          Terms of Service
        </button>
        <span>·</span>
        <button onClick={onOpenPrivacy} className="hover:text-zinc-300 transition-colors cursor-pointer">
          Privacy Policy
        </button>
        <span>·</span>
        <button onClick={onOpenFaq} className="hover:text-zinc-300 transition-colors cursor-pointer">
          FAQ
        </button>
      </div>
      <p className="text-[11px] text-zinc-600">
        © {new Date().getFullYear()} Bolt. Decentralized peer-to-peer WebRTC file streaming.
      </p>
    </footer>
  );
};
