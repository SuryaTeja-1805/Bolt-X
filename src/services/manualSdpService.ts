/**
 * Serverless / Manual WebRTC SDP Handshake Service
 * Allows two peers to connect directly without ANY signaling server or WebSocket.
 * Perfect fallback when 0.peerjs.com is down, blocked by ISP/adblockers, or firewalls.
 */

import { getRtcConfiguration } from './webrtcConfig';

export class ManualSdpService {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;

  public async createOffer(): Promise<{
    offerJson: string;
    onConnected: Promise<RTCDataChannel>;
    applyAnswer: (answerJson: string) => Promise<void>;
  }> {
    const pc = new RTCPeerConnection(getRtcConfiguration(true));
    this.pc = pc;

    const dc = pc.createDataChannel('bolt-manual-dc', { ordered: true });
    this.dc = dc;

    const onConnected = new Promise<RTCDataChannel>((resolve) => {
      dc.onopen = () => resolve(dc);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidates gathering to complete so the JSON includes all STUN/TURN candidates
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
        // Fallback after 2.5s if gathering takes too long
        setTimeout(() => resolve(), 2500);
      }
    });

    const offerJson = JSON.stringify(pc.localDescription);

    const applyAnswer = async (answerJson: string) => {
      const parsed = JSON.parse(answerJson);
      await pc.setRemoteDescription(new RTCSessionDescription(parsed));
    };

    return { offerJson, onConnected, applyAnswer };
  }

  public async acceptOffer(offerJson: string): Promise<{
    answerJson: string;
    onConnected: Promise<RTCDataChannel>;
  }> {
    const pc = new RTCPeerConnection(getRtcConfiguration(true));
    this.pc = pc;

    const onConnected = new Promise<RTCDataChannel>((resolve) => {
      pc.ondatachannel = (e) => {
        this.dc = e.channel;
        e.channel.onopen = () => resolve(e.channel);
      };
    });

    const parsedOffer = JSON.parse(offerJson);
    await pc.setRemoteDescription(new RTCSessionDescription(parsedOffer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for candidate gathering
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
        setTimeout(() => resolve(), 2500);
      }
    });

    const answerJson = JSON.stringify(pc.localDescription);
    return { answerJson, onConnected };
  }

  public cleanup(): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
