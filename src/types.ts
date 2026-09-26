export type TransferStatus =
  | 'queued'
  | 'transferring'
  | 'verifying'
  | 'completed'
  | 'error'
  | 'cancelled';

export type TransferDirection = 'send' | 'receive';

export interface FileTransferItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number; // 0 - 100
  bytesTransferred: number;
  speedBps: number;
  etaSeconds: number;
  totalChunks: number;
  chunksTransferred: number;
  sha256: string | null;
  expectedSha256?: string | null;
  hashVerified?: boolean;
  downloadUrl?: string;
  fileBlob?: Blob;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  usingDirectDisk?: boolean;
}

export interface ClipboardMessage {
  id: string;
  text: string;
  sender: 'self' | 'peer';
  timestamp: number;
  expiresInSeconds?: number;
}

export type ConnectionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface PeerState {
  status: ConnectionStatus;
  peerId: string;
  remotePeerId: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  isLoopback: boolean;
}

export type BoltProtocolMessage =
  | {
      type: 'METADATA';
      transferId: string;
      name: string;
      size: number;
      mimeType: string;
      totalChunks: number;
      expectedSha256?: string;
    }
  | {
      type: 'CHUNK';
      transferId: string;
      chunkIndex: number;
      data: ArrayBuffer;
    }
  | {
      type: 'CHUNK_ACK';
      transferId: string;
      chunkIndex: number;
    }
  | {
      type: 'COMPLETE';
      transferId: string;
      sha256: string;
    }
  | {
      type: 'CANCEL';
      transferId: string;
      reason?: string;
    }
  | {
      type: 'CLIPBOARD';
      id: string;
      text: string;
      timestamp: number;
      expiresInSeconds?: number;
    }
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'PONG';
      timestamp: number;
    };
