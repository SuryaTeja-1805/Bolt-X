/**
 * Cryptographic & Formatting Utilities for Bolt P2P
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

/**
 * Incremental SHA-256 Hash Streamer
 * Allows calculating SHA-256 chunk-by-chunk without loading multi-GB files in RAM.
 */
export class IncrementalSha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private totalBytes = 0;
  private w = new Uint32Array(64);

  public update(chunk: ArrayBuffer | Uint8Array): void {
    const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    let offset = 0;
    const len = data.length;
    this.totalBytes += len;

    if (this.bufferLength > 0) {
      const needed = 64 - this.bufferLength;
      if (len >= needed) {
        this.buffer.set(data.subarray(0, needed), this.bufferLength);
        this.processBlock(this.buffer);
        this.bufferLength = 0;
        offset = needed;
      } else {
        this.buffer.set(data, this.bufferLength);
        this.bufferLength += len;
        return;
      }
    }

    while (offset + 64 <= len) {
      this.processBlock(data.subarray(offset, offset + 64));
      offset += 64;
    }

    if (offset < len) {
      this.buffer.set(data.subarray(offset), 0);
      this.bufferLength = len - offset;
    }
  }

  private processBlock(block: Uint8Array): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const idx = i * 4;
      w[i] = (block[idx] << 24) | (block[idx + 1] << 16) | (block[idx + 2] << 8) | block[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = this.h[0];
    let b = this.h[1];
    let c = this.h[2];
    let d = this.h[3];
    let e = this.h[4];
    let f = this.h[5];
    let g = this.h[6];
    let h = this.h[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + b) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
    this.h[5] = (this.h[5] + f) | 0;
    this.h[6] = (this.h[6] + g) | 0;
    this.h[7] = (this.h[7] + h) | 0;
  }

  public digest(): string {
    const finalBlock = new Uint8Array(64);
    finalBlock.set(this.buffer.subarray(0, this.bufferLength), 0);
    finalBlock[this.bufferLength] = 0x80;

    if (this.bufferLength >= 56) {
      this.processBlock(finalBlock);
      finalBlock.fill(0);
    } else {
      finalBlock.fill(0, this.bufferLength + 1);
    }

    const totalBits = this.totalBytes * 8;
    const view = new DataView(finalBlock.buffer);
    view.setUint32(56, Math.floor(totalBits / 0x100000000), false);
    view.setUint32(60, totalBits >>> 0, false);
    this.processBlock(finalBlock);

    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += (this.h[i] >>> 0).toString(16).padStart(8, '0');
    }
    return hex;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m < 60 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function generate5DigitRoomCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function playAudioFeedback(type: 'connect' | 'complete' | 'message'): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'connect') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'complete') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.frequency.setValueAtTime(700, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (_) {}
}
