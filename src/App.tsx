import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  RobustBoltPeerService,
  ConnectionState,
  FileItem,
  SharedTextMessage,
  SpeedSample,
  PeerDiagnostics,
  CHUNK_SIZE,
} from './services/peerService';
import {
  generate5DigitRoomCode,
  playAudioFeedback,
} from './services/cryptoService';
import { Header } from './components/Header';
import { RoomControlCard } from './components/RoomControlCard';
import { FileDropzonePanel } from './components/FileDropzonePanel';
import { TextRelayModal } from './components/TextRelayModal';
import { HistoryModal } from './components/HistoryModal';
import { FaqModal } from './components/FaqModal';
import { QrModal } from './components/QrModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { TermsPrivacyModal } from './components/TermsPrivacyModal';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  // Modes & Codes
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace('#', '');
      const codeFromUrl = urlParams.get('code') || (hash.length === 5 && /^\d+$/.test(hash) ? hash : '');
      if (codeFromUrl) return codeFromUrl;
    }
    return generate5DigitRoomCode();
  });
  const [targetRoomCode, setTargetRoomCode] = useState<string>('');

  // Passcodes
  const [protectPasscode, setProtectPasscode] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [receiverPasscode, setReceiverPasscode] = useState<string>('');

  // Connection & Diagnostics State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for peer to connect...');
  const [diagnostics, setDiagnostics] = useState<PeerDiagnostics>({
    signalingStatus: 'disconnected',
    iceConnectionState: 'uninitialized',
    connectionState: 'uninitialized',
    candidateType: 'unknown',
    selectedServer: '0.peerjs.com (STUN+TURN)',
    rttMs: null,
  });

  // Transfer Queue & Text
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sharedTexts, setSharedTexts] = useState<SharedTextMessage[]>([]);
  const [speedSamples, setSpeedSamples] = useState<SpeedSample[]>([]);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Direct-to-Disk Stream
  const [supportsDiskStream] = useState<boolean>(
    () => typeof window !== 'undefined' && 'showSaveFilePicker' in window
  );
  const [useDiskStream, setUseDiskStream] = useState<boolean>(true);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isTextRelayOpen, setIsTextRelayOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [termsPrivacyType, setTermsPrivacyType] = useState<'terms' | 'privacy' | null>(null);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const peerServiceRef = useRef<RobustBoltPeerService | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    }
  };

  // Instantiate peer service
  useEffect(() => {
    const service = new RobustBoltPeerService({
      onStatusChange: (status, message) => {
        setConnectionStatus(status);
        setStatusMessage(message);
        if (status === 'connected') {
          playAudioFeedback('connect');
        }
      },
      onDiagnosticsUpdate: (diag) => {
        setDiagnostics(diag);
      },
      onFilesUpdate: (updater) => {
        setFiles(updater);
      },
      onSpeedSample: (sample) => {
        setSpeedSamples((prev) => [...prev.slice(-35), sample]);
      },
      onTextReceived: (msg) => {
        setSharedTexts((prev) => [msg, ...prev]);
        playAudioFeedback('message');
      },
      onTransferComplete: () => {
        setIsTransferring(false);
        playAudioFeedback('complete');
        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#ffffff', '#10b981', '#f59e0b', '#3b82f6'],
          });
        } catch (_) {}
      },
    });

    peerServiceRef.current = service;

    return () => {
      service.cleanupPeer();
    };
  }, []);

  // Update options to peer service
  useEffect(() => {
    if (peerServiceRef.current) {
      peerServiceRef.current.setOptions({
        protectPasscode,
        passcode,
        useDiskStream,
      });
    }
  }, [protectPasscode, passcode, useDiskStream]);

  // Connect sender or auto-connect receiver if URL has code
  useEffect(() => {
    if (!peerServiceRef.current) return;

    if (mode === 'send' && roomCode) {
      peerServiceRef.current.initSender(roomCode);
    }
  }, [mode, roomCode]);

  // Auto-fill and connect from URL Hash / SearchParam
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(search);
    
    // Extract 5-digit code from any param or hash
    let extractedCode =
      urlParams.get('room') ||
      urlParams.get('code') ||
      urlParams.get('join') ||
      '';

    if (!extractedCode && hash) {
      const digitsOnly = hash.replace(/[^0-9]/g, '');
      if (digitsOnly.length === 5) {
        extractedCode = digitsOnly;
      }
    }

    if (extractedCode && extractedCode.length === 5) {
      setMode('receive');
      setTargetRoomCode(extractedCode);
      if (peerServiceRef.current) {
        peerServiceRef.current.connectAsReceiver(extractedCode);
      }
    }
  }, []);

  const handleAddFiles = useCallback((newFiles: File[]) => {
    const items: FileItem[] = newFiles.map((f, i) => {
      const chunks = Math.ceil(f.size / CHUNK_SIZE) || 1;
      return {
        id: `file_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        relativePath: (f as any).webkitRelativePath || undefined,
        file: f,
        totalChunks: chunks,
        chunksTransferred: 0,
        status: 'queued',
        speedBps: 0,
        etaSeconds: 0,
      };
    });

    setFiles((prev) => [...prev, ...items]);
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const handleSendToPeer = useCallback(async () => {
    if (!peerServiceRef.current) return;
    setIsTransferring(true);
    await peerServiceRef.current.sendQueuedFiles(files);
  }, [files]);

  const handleConnectReceiver = useCallback((code: string, pin?: string) => {
    if (!peerServiceRef.current) return;
    peerServiceRef.current.connectAsReceiver(code, pin);
  }, []);

  const handleSendText = useCallback((text: string) => {
    if (!peerServiceRef.current) return;
    peerServiceRef.current.sendSharedText(text);
  }, []);

  const handleRestartIce = useCallback(() => {
    if (!peerServiceRef.current) return;
    peerServiceRef.current.restartIce();
  }, []);

  const handleEnableLoopback = useCallback(() => {
    if (!peerServiceRef.current) return;
    peerServiceRef.current.enableLoopback();
  }, []);

  const handleRegenerateCode = useCallback(() => {
    const newCode = generate5DigitRoomCode();
    setRoomCode(newCode);
  }, []);

  const isConnected = connectionStatus === 'connected';
  const hasFilesToSend = files.some((f) => f.status === 'queued');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenFaq={() => setIsFaqOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        canInstall={!!installPrompt}
        onInstall={handleInstallApp}
        connectionStatus={connectionStatus}
        diagnostics={diagnostics}
      />

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Room Code & Connection Controls */}
          <div className="lg:col-span-5 xl:col-span-5">
            <RoomControlCard
              mode={mode}
              setMode={setMode}
              roomCode={roomCode}
              targetRoomCode={targetRoomCode}
              setTargetRoomCode={setTargetRoomCode}
              protectPasscode={protectPasscode}
              setProtectPasscode={setProtectPasscode}
              passcode={passcode}
              setPasscode={setPasscode}
              receiverPasscode={receiverPasscode}
              setReceiverPasscode={setReceiverPasscode}
              connectionStatus={connectionStatus}
              statusMessage={statusMessage}
              onSendToPeer={handleSendToPeer}
              onConnectReceiver={handleConnectReceiver}
              onOpenShareModal={() => setIsQrOpen(true)}
              onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
              hasFilesToSend={hasFilesToSend}
              isTransferring={isTransferring}
              supportsDiskStream={supportsDiskStream}
              useDiskStream={useDiskStream}
              setUseDiskStream={setUseDiskStream}
              onRegenerateCode={handleRegenerateCode}
              onEnableLoopback={handleEnableLoopback}
            />
          </div>

          {/* Right Column: Drag & Drop Files & Queue List */}
          <div className="lg:col-span-7 xl:col-span-7">
            <FileDropzonePanel
              files={files}
              speedSamples={speedSamples}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
              onClearFiles={handleClearFiles}
              onOpenTextRelay={() => setIsTextRelayOpen(true)}
              isConnected={isConnected}
              isTransferring={isTransferring}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onOpenTerms={() => setTermsPrivacyType('terms')}
        onOpenPrivacy={() => setTermsPrivacyType('privacy')}
        onOpenFaq={() => setIsFaqOpen(true)}
      />

      {/* Ephemeral Text & Clipboard Relay Modal */}
      <TextRelayModal
        isOpen={isTextRelayOpen}
        onClose={() => setIsTextRelayOpen(false)}
        sharedTexts={sharedTexts}
        onSendText={handleSendText}
        isConnected={isConnected}
      />

      {/* Transfer History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* FAQ Modal */}
      <FaqModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
      />

      {/* QR Code Mobile Scanner Modal */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        roomCode={roomCode}
      />

      {/* WebRTC Diagnostics & Troubleshooter Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={diagnostics}
        onRestartIce={handleRestartIce}
        onEnableLoopback={handleEnableLoopback}
      />

      {/* Terms & Privacy Modal */}
      <TermsPrivacyModal
        type={termsPrivacyType}
        onClose={() => setTermsPrivacyType(null)}
      />
    </div>
  );
};

export default App;
