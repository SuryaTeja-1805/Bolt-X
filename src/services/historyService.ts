/**
 * LocalStorage Transfer History Manager for Bolt
 */

export interface HistoryItem {
  id: string;
  name: string;
  size: number;
  direction: 'sent' | 'received';
  timestamp: number;
  sha256?: string;
  peerRoomCode: string;
  status: 'success' | 'failed';
}

const STORAGE_KEY = 'bolt_transfer_history_v1';

export function getTransferHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTransferHistory(item: HistoryItem): void {
  try {
    const existing = getTransferHistory().filter((i) => i.id !== item.id);
    const updated = [item, ...existing].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save transfer history', e);
  }
}

export function clearTransferHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
