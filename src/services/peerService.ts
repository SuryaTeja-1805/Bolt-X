import { IncrementalSha256 } from './cryptoService';
import { saveTransferHistory } from './historyService';
import { getRtcConfiguration } from './webrtcConfig';

export const CHUNK_SIZE = 64 * 1024; // 64 KB binary chunks
export const ROOM_PREFIX = 'bolt-v2-';

export type ConnectionState =
  | 'idle'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'auth_failed'
  | 'disconnected'
  | 'error';

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  relativePath?: string;
  file?: File;
  totalChunks: number;
  chunksTransferred: number;
  status: 'queued' | 'transferring' | 'completed' | 'error';
  speedBps: number;
  etaSeconds: number;
  sha256?: string;
  verified?: boolean;
  receivedBlobUrl?: string;
  diskStreamed?: boolean;
}

export interface SharedTextMessage {
  id: string;
  text: string;
  sender: 'self' | 'peer';
  timestamp: number;
}

export interface SpeedSample {
  time: string;
  timestamp: number;
  speedMbps: number;
  speedBps: number;
  fileName: string;
}

export interface PeerDiagnostics {
  signalingStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  iceConnectionState: RTCIceConnectionState | 'uninitialized';
  connectionState: RTCPeerConnectionState | 'uninitialized';
  candidateType: string;
  selectedServer: string;
  rttMs: number | null;
  errorMessage?: string;
}

export interface PeerServiceEvents {
  onStatusChange: (status: ConnectionState, message: string) => void;
  onDiagnosticsUpdate: (diag: PeerDiagnostics) => void;
  onFilesUpdate: (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
  onSpeedSample?: (sample: SpeedSample) => void;
  onTextReceived: (msg: SharedTextMessage) => void;
  onTransferComplete: () => void;
}

export class RobustBoltPeerService {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  // Incoming messages must be processed strictly in order (a file_start handler
  // that awaits must not let chunks/file_end overtake it).
  private rxQueue: Promise<void> = Promise.resolve();
  // Relay-mode flow control: receiver acks every ACK_EVERY chunks, sender keeps
  // at most RELAY_WINDOW chunks in flight so the server never gets flooded.
  private relayAcked = 0;
  private relayAckFileId = '';
  private relayLastAckTime = 0;
  private enqueueRx(task: () => Promise<void>): void {
    this.rxQueue = this.rxQueue.then(task).catch((e) => {
      console.warn('[Receive queue error]', e);
    });
  }
  private transportMode: 'p2p' | 'relay' | 'loopback' = 'p2p';
  private events: PeerServiceEvents;

  private currentRoomCode: string = '';
  private currentMode: 'send' | 'receive' = 'send';
  private currentPasscode: string = '';
  private protectPasscode: boolean = false;
  private roomPasscode: string = '';
  private useDiskStream: boolean = true;
  private isLoopbackMode: boolean = false;

  private p2pTimeoutTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastPingSentTime: number = 0;

  // Manual SDP Pairing
  private manualPc: RTCPeerConnection | null = null;
  private manualDc: RTCDataChannel | null = null;

  // Active receive state
  private currentReceive: {
    meta: FileItem;
    sha: IncrementalSha256;
    chunks: Uint8Array[];
    receivedChunks: number;
    writableStream?: FileSystemWritableFileStream;
    fileHandle?: FileSystemFileHandle;
    startTime: number;
    lastSpeedCalcTime: number;
    lastBytesTransferred: number;
  } | null = null;

  private diagnostics: PeerDiagnostics = {
    signalingStatus: 'disconnected',
    iceConnectionState: 'uninitialized',
    connectionState: 'uninitialized',
    candidateType: 'unknown',
    selectedServer: 'Dedicated Server (WebSocket & WebRTC)',
    rttMs: null,
  };

  constructor(events: PeerServiceEvents) {
    this.events = events;
  }

  public setProtectPasscode(protect: boolean): void {
    this.protectPasscode = protect;
  }

  public setRoomPasscode(code: string): void {
    this.roomPasscode = code;
  }

  public setUseDiskStream(val: boolean): void {
    this.useDiskStream = val;
  }

  public setOptions(opts: { protectPasscode?: boolean; passcode?: string; useDiskStream?: boolean }): void {
    if (opts.protectPasscode !== undefined) this.protectPasscode = opts.protectPasscode;
    if (opts.passcode !== undefined) this.roomPasscode = opts.passcode;
    if (opts.useDiskStream !== undefined) this.useDiskStream = opts.useDiskStream;
  }

  public restartIce(): void {
    this.forceIceRestart();
  }

  public getDiagnostics(): PeerDiagnostics {
    return { ...this.diagnostics };
  }

  private updateDiagnostics(partial: Partial<PeerDiagnostics>): void {
    this.diagnostics = { ...this.diagnostics, ...partial };
    this.events.onDiagnosticsUpdate(this.diagnostics);
  }

  private getSignalingUrl(roomCode: string, role: 'sender' | 'receiver'): string {
    const params = `room=${encodeURIComponent(roomCode)}&role=${role}`;
    if (typeof window === 'undefined') return `ws://localhost:3000/ws/signaling?${params}`;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // The room/role query params let the Node server (which ignores them) and the
    // Cloudflare Workers Durable Object variant (which needs them to route to the
    // right room instance) both work against the exact same frontend build.
    return `${proto}//${window.location.host}/ws/signaling?${params}`;
  }

  public initSender(roomCode: string, passcode: string = ''): void {
    this.currentMode = 'send';
    this.currentRoomCode = roomCode;
    this.currentPasscode = passcode;
    this.isLoopbackMode = false;

    this.cleanup();
    this.events.onStatusChange('waiting', `Ready! Room ${roomCode} created. Waiting for peer...`);
    this.updateDiagnostics({ signalingStatus: 'connecting' });

    this.connectSignaling(roomCode, 'sender', passcode);
  }

  public connectAsReceiver(targetRoomCode: string, inputPasscode: string = ''): void {
    this.currentMode = 'receive';
    this.currentRoomCode = targetRoomCode;
    this.currentPasscode = inputPasscode;
    this.isLoopbackMode = false;

    if (!targetRoomCode || targetRoomCode.length < 5) {
      this.events.onStatusChange('error', 'Please enter a valid 5-digit room code');
      return;
    }

    this.cleanup();
    this.events.onStatusChange('connecting', `Connecting to Room ${targetRoomCode}...`);
    this.updateDiagnostics({ signalingStatus: 'connecting' });

    this.connectSignaling(targetRoomCode, 'receiver', inputPasscode);
  }

  private connectSignaling(roomCode: string, role: 'sender' | 'receiver', passcode: string): void {
    try {
      const url = this.getSignalingUrl(roomCode, role);
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        this.updateDiagnostics({ signalingStatus: 'connected' });
        ws.send(
          JSON.stringify({
            type: 'join_room',
            roomCode,
            role,
            passcode: this.protectPasscode ? this.roomPasscode : undefined,
          })
        );
      };

      ws.onmessage = (evt: MessageEvent) => {
        this.enqueueRx(async () => {
          if (evt.data instanceof ArrayBuffer) {
            // Binary packet relayed via high-speed server tunnel
            await this.handleBinaryChunk(evt.data);
            return;
          }

          try {
            const msg = JSON.parse(evt.data);
            await this.handleSignalingMessage(msg);
          } catch (e) {
            console.warn('[Signaling Message Parse Error]', e);
          }
        });
      };

      ws.onclose = () => {
        this.updateDiagnostics({ signalingStatus: 'disconnected' });
      };

      ws.onerror = (err) => {
        console.warn('[Signaling WS Error]', err);
        this.updateDiagnostics({ signalingStatus: 'error', errorMessage: 'WebSocket connection failed' });
      };
    } catch (e: any) {
      this.events.onStatusChange('error', `Failed to connect signaling: ${e.message}`);
    }
  }

  private async handleSignalingMessage(msg: any): Promise<void> {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'room_joined':
        if (msg.role === 'sender') {
          this.events.onStatusChange('waiting', `Room ${msg.roomCode} ready! Waiting for peer...`);
        } else {
          this.events.onStatusChange('connecting', `Connected to room ${msg.roomCode}. Connecting to peer...`);
        }
        break;

      case 'peer_ready':
        // Both peers are in the room! Initiate WebRTC P2P connection
        this.events.onStatusChange('connecting', 'Peer detected! Establishing connection...');
        this.startP2PHandshake();
        break;

      case 'signal':
        await this.handleWebRtcSignal(msg.payload);
        break;

      case 'relay_packet':
        // Control message received via server relay
        await this.handleControlMessage(msg.payload);
        break;

      case 'peer_disconnected':
        this.events.onStatusChange('disconnected', 'Peer disconnected from the room.');
        this.updateDiagnostics({ connectionState: 'disconnected' });
        break;

      case 'ping':
        this.sendControlMessage({ type: 'pong', sentAt: msg.sentAt });
        break;

      case 'pong':
        if (msg.sentAt) {
          const rtt = Math.max(1, Math.round(Date.now() - msg.sentAt));
          this.updateDiagnostics({ rttMs: rtt });
        }
        break;

      default:
        break;
    }
  }

  private async startP2PHandshake(): Promise<void> {
    const isSender = this.currentMode === 'send';
    const rtcConfig = getRtcConfiguration(true);
    const pc = new RTCPeerConnection(rtcConfig);
    this.pc = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'signal',
            payload: { type: 'candidate', candidate: event.candidate },
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.updateDiagnostics({ iceConnectionState: pc.iceConnectionState });
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.clearP2pTimeout();
        this.transportMode = 'p2p';
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateDiagnostics({ connectionState: pc.connectionState });
    };

    if (isSender) {
      const dc = pc.createDataChannel('bolt-channel', { ordered: true });
      this.setupDataChannel(dc);
      this.dataChannel = dc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'signal',
            payload: { type: 'offer', sdp: offer.sdp },
          })
        );
      }
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
        this.dataChannel = event.channel;
      };
    }

    // Set fallback timeout: If WebRTC DataChannel doesn't open within 3.5s,
    // seamlessly switch to High-Speed Dedicated Server Relay!
    this.clearP2pTimeout();
    this.p2pTimeoutTimer = window.setTimeout(() => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        this.fallbackToServerRelay();
      }
    }, 3500);
  }

  private async handleWebRtcSignal(payload: any): Promise<void> {
    if (!this.pc) return;

    try {
      if (payload.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'signal',
              payload: { type: 'answer', sdp: answer.sdp },
            })
          );
        }
      } else if (payload.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
      } else if (payload.type === 'candidate' && payload.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch (e) {
      console.warn('[WebRTC Signaling Error]', e);
    }
  }

  private setupDataChannel(dc: RTCDataChannel): void {
    dc.bufferedAmountLowThreshold = 256 * 1024;
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      this.clearP2pTimeout();
      this.transportMode = 'p2p';
      this.startHeartbeat();
      this.handleChannelReady();
    };

    dc.onmessage = (evt: MessageEvent) => {
      this.enqueueRx(async () => {
        if (evt.data instanceof ArrayBuffer) {
          await this.handleBinaryChunk(evt.data);
        } else {
          try {
            const msg = JSON.parse(evt.data);
            await this.handleControlMessage(msg);
          } catch (e) {
            console.warn('[DataChannel Message Parse Error]', e);
          }
        }
      });
    };

    dc.onclose = () => {
      if (this.transportMode === 'p2p') {
        this.fallbackToServerRelay();
      }
    };
  }

  private fallbackToServerRelay(): void {
    this.clearP2pTimeout();
    this.transportMode = 'relay';
    this.updateDiagnostics({
      candidateType: 'Dedicated Server Relay',
      selectedServer: 'High-Speed WebSocket Tunnel',
    });
    this.startHeartbeat();
    this.handleChannelReady();
  }

  private handleChannelReady(): void {
    const isSender = this.currentMode === 'send';
    const modeLabel = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';

    if (isSender) {
      if (this.protectPasscode && this.roomPasscode.trim()) {
        this.sendControlMessage({ type: 'auth_challenge', requiresPasscode: true });
      } else {
        this.sendControlMessage({ type: 'auth_challenge', requiresPasscode: false });
        this.events.onStatusChange('connected', `Connected to Peer (${modeLabel})!`);
      }
    } else {
      this.sendControlMessage({ type: 'peer_hello' });
    }
  }

  private sendControlMessage(payload: any): void {
    if (this.transportMode === 'p2p' && this.dataChannel?.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(payload));
        return;
      } catch (_) {}
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay_packet', payload }));
    }
  }

  private async handleControlMessage(msg: any): Promise<void> {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'peer_hello':
        if (this.currentMode === 'send') {
          if (this.protectPasscode && this.roomPasscode.trim()) {
            this.sendControlMessage({ type: 'auth_challenge', requiresPasscode: true });
          } else {
            this.sendControlMessage({ type: 'auth_challenge', requiresPasscode: false });
            const label = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';
            this.events.onStatusChange('connected', `Connected to Peer (${label})!`);
          }
        }
        break;

      case 'auth_challenge':
        if (msg.requiresPasscode) {
          if (this.currentPasscode.trim()) {
            this.sendControlMessage({ type: 'auth_response', passcode: this.currentPasscode.trim() });
          } else {
            this.events.onStatusChange('auth_failed', 'This room is protected by a passcode.');
          }
        } else {
          this.sendControlMessage({ type: 'auth_ack' });
          const label = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';
          this.events.onStatusChange('connected', `Connected to Peer (${label})!`);
        }
        break;

      case 'auth_ack': {
        const label = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';
        this.events.onStatusChange('connected', `Connected to Peer (${label})!`);
        break;
      }

      case 'auth_response':
        if (this.currentMode === 'send' && this.protectPasscode) {
          if (msg.passcode === this.roomPasscode.trim()) {
            this.sendControlMessage({ type: 'auth_result', success: true });
            const label = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';
            this.events.onStatusChange('connected', `Connected to Peer (${label})!`);
          } else {
            this.sendControlMessage({ type: 'auth_result', success: false, error: 'Incorrect room passcode' });
            this.events.onStatusChange('auth_failed', 'Peer entered incorrect passcode.');
          }
        }
        break;

      case 'auth_result':
        if (msg.success) {
          const label = this.transportMode === 'p2p' ? 'Direct P2P' : 'Dedicated Server Relay';
          this.events.onStatusChange('connected', `Connected to Peer (${label})!`);
        } else {
          this.events.onStatusChange('auth_failed', msg.error || 'Passcode rejected.');
        }
        break;

      case 'shared_text':
        this.events.onTextReceived({
          id: msg.id || String(Date.now()),
          text: msg.text,
          sender: 'peer',
          timestamp: msg.timestamp || Date.now(),
        });
        break;

      case 'file_start':
        await this.handleFileStart(msg);
        break;

      case 'file_end':
        await this.handleFileEnd(msg);
        break;

      case 'chunk_ack':
        if (msg.fileId === this.relayAckFileId) {
          this.relayAcked = Math.max(this.relayAcked, msg.received || 0);
          this.relayLastAckTime = Date.now();
        }
        break;

      case 'file_received_ack':
        this.events.onFilesUpdate((prev) =>
          prev.map((f) =>
            f.id === msg.fileId
              ? {
                  ...f,
                  status: 'completed',
                  chunksTransferred: f.totalChunks,
                  verified: msg.verified,
                  sha256: msg.sha256,
                  speedBps: 0,
                  etaSeconds: 0,
                }
              : f
          )
        );
        this.events.onTransferComplete();
        break;

      default:
        break;
    }
  }

  private async handleFileStart(msg: any): Promise<void> {
    const item: FileItem = {
      id: msg.fileId,
      name: msg.name,
      size: msg.size,
      type: msg.mimeType || 'application/octet-stream',
      relativePath: msg.relativePath,
      totalChunks: msg.totalChunks,
      chunksTransferred: 0,
      status: 'transferring',
      speedBps: 0,
      etaSeconds: 0,
    };

    let writable: FileSystemWritableFileStream | undefined;
    let fileHandle: FileSystemFileHandle | undefined;

    const hasGesture = typeof navigator !== 'undefined' && (navigator as any).userActivation?.isActive;
    if (this.useDiskStream && hasGesture && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: msg.name,
        });
        if (fileHandle) {
          writable = await (fileHandle as any).createWritable();
        }
      } catch (_) {
        writable = undefined;
      }
    }

    this.currentReceive = {
      meta: item,
      sha: new IncrementalSha256(),
      chunks: [],
      receivedChunks: 0,
      writableStream: writable,
      fileHandle,
      startTime: Date.now(),
      lastSpeedCalcTime: Date.now(),
      lastBytesTransferred: 0,
    };

    this.events.onFilesUpdate((prev) => {
      const exists = prev.some((f) => f.id === item.id);
      return exists ? prev.map((f) => (f.id === item.id ? item : f)) : [...prev, item];
    });
  }

  private async handleBinaryChunk(buffer: ArrayBuffer): Promise<void> {
    const rec = this.currentReceive;
    if (!rec) return;

    if (buffer.byteLength < 16) return;

    const chunkData = new Uint8Array(buffer, 16);
    rec.sha.update(chunkData);
    rec.receivedChunks++;

    if (rec.receivedChunks % 32 === 0) {
      this.sendControlMessage({ type: 'chunk_ack', fileId: rec.meta.id, received: rec.receivedChunks });
    }

    if (rec.writableStream) {
      await rec.writableStream.write(chunkData);
    } else {
      rec.chunks.push(chunkData);
    }

    const now = Date.now();
    const elapsed = (now - rec.lastSpeedCalcTime) / 1000;
    const transferredBytes = rec.receivedChunks * CHUNK_SIZE;

    if (elapsed >= 0.25 || rec.receivedChunks === rec.meta.totalChunks) {
      const bytesDelta = transferredBytes - rec.lastBytesTransferred;
      const speed = elapsed > 0 ? bytesDelta / elapsed : 0;
      rec.lastSpeedCalcTime = now;
      rec.lastBytesTransferred = transferredBytes;

      const remainingBytes = Math.max(0, rec.meta.size - transferredBytes);
      const eta = speed > 0 ? remainingBytes / speed : 0;

      this.events.onSpeedSample?.({
        time: new Date(now).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        timestamp: now,
        speedMbps: parseFloat((speed / (1024 * 1024)).toFixed(2)),
        speedBps: speed,
        fileName: rec.meta.name,
      });

      this.events.onFilesUpdate((prev) =>
        prev.map((f) =>
          f.id === rec.meta.id
            ? {
                ...f,
                chunksTransferred: rec.receivedChunks,
                speedBps: speed,
                etaSeconds: eta,
                diskStreamed: !!rec.writableStream,
              }
            : f
        )
      );
    }
  }

  private async handleFileEnd(msg: any): Promise<void> {
    const rec = this.currentReceive;
    if (!rec) return;

    if (rec.writableStream) {
      await rec.writableStream.close();
    }

    const computedHash = rec.sha.digest();
    const verified = computedHash.toLowerCase() === (msg.sha256 || '').toLowerCase();

    let downloadUrl: string | undefined;
    if (!rec.writableStream) {
      const blob = new Blob(rec.chunks as any, { type: rec.meta.type || 'application/octet-stream' });
      downloadUrl = URL.createObjectURL(blob);

      // Auto-trigger browser download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = rec.meta.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    this.events.onFilesUpdate((prev) =>
      prev.map((f) =>
        f.id === msg.fileId
          ? {
              ...f,
              status: 'completed',
              chunksTransferred: f.totalChunks,
              sha256: computedHash,
              verified,
              receivedBlobUrl: downloadUrl,
              speedBps: 0,
              etaSeconds: 0,
            }
          : f
      )
    );

    saveTransferHistory({
      id: rec.meta.id,
      name: rec.meta.name,
      size: rec.meta.size,
      direction: 'received',
      timestamp: Date.now(),
      sha256: computedHash,
      peerRoomCode: this.currentRoomCode,
      status: verified ? 'success' : 'failed',
    });

    this.sendControlMessage({
      type: 'file_received_ack',
      fileId: msg.fileId,
      sha256: computedHash,
      verified,
    });

    this.currentReceive = null;
    this.events.onTransferComplete();
  }

  public async sendQueuedFiles(files: FileItem[]): Promise<void> {
    const queued = files.filter((f) => f.status === 'queued');
    if (queued.length === 0) return;

    // Loopback mode simulation
    if (this.isLoopbackMode) {
      for (const item of queued) {
        const file = item.file;
        if (!file) continue;

        this.events.onFilesUpdate((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'transferring' } : f))
        );

        const hasher = new IncrementalSha256();
        const total = item.totalChunks;
        const startTime = Date.now();

        for (let i = 0; i < total; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkBuf = await file.slice(start, end).arrayBuffer();
          hasher.update(chunkBuf);

          if (total > 5) {
            await new Promise((r) => setTimeout(r, 10));
          }

          const transferred = (i + 1) * CHUNK_SIZE;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? transferred / elapsed : 0;
          const remaining = Math.max(0, file.size - transferred);
          const eta = speed > 0 ? remaining / speed : 0;

          this.events.onSpeedSample?.({
            time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
            timestamp: Date.now(),
            speedMbps: parseFloat((speed / (1024 * 1024)).toFixed(2)),
            speedBps: speed,
            fileName: item.name,
          });

          this.events.onFilesUpdate((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    chunksTransferred: i + 1,
                    speedBps: speed,
                    etaSeconds: eta,
                  }
                : f
            )
          );
        }

        const hash = hasher.digest();
        const url = URL.createObjectURL(file);

        this.events.onFilesUpdate((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'completed',
                  chunksTransferred: total,
                  sha256: hash,
                  verified: true,
                  receivedBlobUrl: url,
                  speedBps: 0,
                  etaSeconds: 0,
                }
              : f
          )
        );

        saveTransferHistory({
          id: item.id,
          name: item.name,
          size: item.size,
          direction: 'sent',
          timestamp: Date.now(),
          sha256: hash,
          peerRoomCode: this.currentRoomCode || 'loopback',
          status: 'success',
        });
      }

      this.events.onTransferComplete();
      return;
    }

    const isP2p = this.transportMode === 'p2p' && this.dataChannel?.readyState === 'open';
    const isRelay = this.ws?.readyState === WebSocket.OPEN;

    if (!isP2p && !isRelay) {
      this.events.onStatusChange('error', 'Cannot send: Peer is not connected.');
      return;
    }

    for (let fIdx = 0; fIdx < queued.length; fIdx++) {
      const item = queued[fIdx];
      const file = item.file;
      if (!file) continue;

      this.sendControlMessage({
        type: 'file_start',
        fileId: item.id,
        name: item.name,
        size: item.size,
        mimeType: item.type,
        relativePath: item.relativePath,
        totalChunks: item.totalChunks,
      });

      this.events.onFilesUpdate((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'transferring' } : f))
      );

      const hasher = new IncrementalSha256();
      const total = item.totalChunks;
      let lastTime = Date.now();
      let lastBytes = 0;
      this.relayAckFileId = item.id;
      this.relayAcked = 0;
      this.relayLastAckTime = Date.now();

      try {
      for (let chunkIdx = 0; chunkIdx < total; chunkIdx++) {
        // Backpressure: never let the send buffer grow past ~1 MB
        if (isP2p) {
          const dc = this.dataChannel;
          while (dc && dc.readyState === 'open' && dc.bufferedAmount > 1024 * 1024) {
            await new Promise<void>((resolve) => {
              const done = () => {
                dc.removeEventListener('bufferedamountlow', done);
                clearTimeout(t);
                resolve();
              };
              const t = setTimeout(done, 100);
              dc.addEventListener('bufferedamountlow', done);
            });
          }
          if (!dc || dc.readyState !== 'open') throw new Error('Connection to peer was lost');
        } else {
          // Relay: bounded window of un-acked chunks (8 MB) + socket buffer limit.
          // If no ack arrives for 5s (e.g. older receiver build) just keep going.
          while (
            this.ws &&
            this.ws.readyState === WebSocket.OPEN &&
            (this.ws.bufferedAmount > 1024 * 1024 ||
              (chunkIdx - this.relayAcked > 128 && Date.now() - this.relayLastAckTime < 5000))
          ) {
            await new Promise((r) => setTimeout(r, 15));
          }
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('Connection to server was lost');
        }

        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBuf = await file.slice(start, end).arrayBuffer();
        hasher.update(chunkBuf);

        // Header: 16 bytes (1 byte 'B', 4 bytes fIdx, 4 bytes chunkIdx, 4 bytes total, 3 pad)
        const packet = new Uint8Array(16 + chunkBuf.byteLength);
        packet[0] = 66; // 'B'
        const headerView = new DataView(packet.buffer);
        headerView.setUint32(1, fIdx, false);
        headerView.setUint32(5, chunkIdx, false);
        headerView.setUint32(9, total, false);
        packet.set(new Uint8Array(chunkBuf), 16);

        if (isP2p && this.dataChannel) {
          this.dataChannel.send(packet.buffer);
        } else if (this.ws) {
          this.ws.send(packet.buffer);
        }

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        const transferredBytes = (chunkIdx + 1) * CHUNK_SIZE;

        if (elapsed >= 0.25 || chunkIdx === total - 1) {
          const speed = elapsed > 0 ? (transferredBytes - lastBytes) / elapsed : 0;
          lastTime = now;
          lastBytes = transferredBytes;
          const remaining = Math.max(0, file.size - transferredBytes);
          const eta = speed > 0 ? remaining / speed : 0;

          this.events.onSpeedSample?.({
            time: new Date(now).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
            timestamp: now,
            speedMbps: parseFloat((speed / (1024 * 1024)).toFixed(2)),
            speedBps: speed,
            fileName: item.name,
          });

          this.events.onFilesUpdate((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    chunksTransferred: chunkIdx + 1,
                    speedBps: speed,
                    etaSeconds: eta,
                  }
                : f
            )
          );
        }
      }

      } catch (err: any) {
        console.warn('[Send aborted]', err);
        this.events.onFilesUpdate((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'error', speedBps: 0, etaSeconds: 0 } : f))
        );
        this.events.onStatusChange('error', err?.message || 'Transfer interrupted');
        return;
      }

      const hash = hasher.digest();
      this.sendControlMessage({
        type: 'file_end',
        fileId: item.id,
        sha256: hash,
      });

      saveTransferHistory({
        id: item.id,
        name: item.name,
        size: item.size,
        direction: 'sent',
        timestamp: Date.now(),
        sha256: hash,
        peerRoomCode: this.currentRoomCode,
        status: 'success',
      });
    }
  }

  public sendSharedText(text: string): boolean {
    if (!text.trim()) return false;
    const msg: SharedTextMessage = {
      id: String(Date.now()),
      text: text.trim(),
      sender: 'self',
      timestamp: Date.now(),
    };

    this.sendControlMessage({
      type: 'shared_text',
      id: msg.id,
      text: msg.text,
      timestamp: msg.timestamp,
    });

    return true;
  }

  public enableLoopback(): void {
    this.isLoopbackMode = true;
    this.transportMode = 'loopback';
    this.currentRoomCode = 'loopback';
    this.events.onStatusChange('connected', 'Connected in Local In-Tab Loopback Mode');
    this.updateDiagnostics({
      signalingStatus: 'connected',
      iceConnectionState: 'completed',
      connectionState: 'connected',
      candidateType: 'Local Loopback (In-Tab Engine)',
      selectedServer: 'In-Memory Loopback Pipeline',
      rttMs: 1,
    });
  }

  public forceIceRestart(): void {
    this.events.onStatusChange('connecting', 'Restarting ICE / Switching to Dedicated Server Relay...');
    this.fallbackToServerRelay();
  }

  public disconnect(): void {
    this.cleanup();
    this.events.onStatusChange('idle', 'Disconnected');
  }

  public cleanupPeer(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.clearP2pTimeout();
    this.stopHeartbeat();

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (_) {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (_) {}
      this.pc = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    if (this.currentReceive?.writableStream) {
      try {
        this.currentReceive.writableStream.close();
      } catch (_) {}
      this.currentReceive = null;
    }
  }

  private clearP2pTimeout(): void {
    if (this.p2pTimeoutTimer !== null) {
      clearTimeout(this.p2pTimeoutTimer);
      this.p2pTimeoutTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.lastPingSentTime = Date.now();
      this.sendControlMessage({ type: 'ping', sentAt: this.lastPingSentTime });
    }, 4000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Manual SDP Pairing for zero-signaling setups
  public async exportManualOffer(): Promise<string> {
    const pc = new RTCPeerConnection(getRtcConfiguration(true));
    this.manualPc = pc;

    const dc = pc.createDataChannel('manual-bolt', { ordered: true });
    this.setupDataChannel(dc);
    this.manualDc = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1500);
      }
    });

    return JSON.stringify(pc.localDescription);
  }

  public async importManualOfferAndCreateAnswer(offerJson: string): Promise<string> {
    const offer = JSON.parse(offerJson);
    const pc = new RTCPeerConnection(getRtcConfiguration(true));
    this.manualPc = pc;

    pc.ondatachannel = (e) => {
      this.setupDataChannel(e.channel);
      this.manualDc = e.channel;
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, 1500);
      }
    });

    return JSON.stringify(pc.localDescription);
  }

  public async importManualAnswer(answerJson: string): Promise<void> {
    if (!this.manualPc) {
      throw new Error('No active manual pairing session found.');
    }
    const answer = JSON.parse(answerJson);
    await this.manualPc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}
