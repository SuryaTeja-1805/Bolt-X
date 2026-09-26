/**
 * WebRTC ICE Server Configuration
 * Provides STUN and robust TURN relay servers so peers behind symmetric NAT,
 * mobile carrier 4G/5G, and restrictive firewalls can connect reliably.
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const DEFAULT_STUN_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * Free public TURN servers from the OpenRelay project (Metered.ca)
 * This allows peers on mobile networks or behind symmetric NAT to connect
 * when direct STUN p2p traversal fails.
 */
export const DEFAULT_TURN_SERVERS: IceServerConfig[] = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function getRtcConfiguration(useTurn: boolean = true): RTCConfiguration {
  const iceServers: IceServerConfig[] = [...DEFAULT_STUN_SERVERS];

  if (useTurn) {
    iceServers.push(...DEFAULT_TURN_SERVERS);
  }

  // Check if custom TURN credentials were saved in localStorage
  try {
    const customTurn = localStorage.getItem('bolt_custom_turn_config');
    if (customTurn) {
      const parsed = JSON.parse(customTurn);
      if (Array.isArray(parsed) && parsed.length > 0) {
        iceServers.push(...parsed);
      }
    }
  } catch (e) {
    console.warn('Failed to parse custom TURN config', e);
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    sdpSemantics: 'unified-plan',
  } as any;
}
