import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json({ limit: '50mb' }));

interface ClientInfo {
  ws: WebSocket;
  roomCode: string;
  role: 'sender' | 'receiver';
  joinedAt: number;
}

interface Room {
  code: string;
  sender: ClientInfo | null;
  receiver: ClientInfo | null;
  passcode?: string;
  lastActive: number;
}

const rooms = new Map<string, Room>();

// Clean up stale rooms older than 3 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActive > 3 * 3600 * 1000) {
      rooms.delete(code);
    }
  }
}, 60000);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: Date.now(),
  });
});

// Room status query
app.get('/api/rooms/:code/status', (req, res) => {
  const code = req.params.code;
  const room = rooms.get(code);
  if (!room) {
    return res.json({ exists: false, hasSender: false, hasReceiver: false });
  }
  return res.json({
    exists: true,
    hasSender: !!room.sender && room.sender.ws.readyState === WebSocket.OPEN,
    hasReceiver: !!room.receiver && room.receiver.ws.readyState === WebSocket.OPEN,
    requiresPasscode: !!room.passcode,
  });
});

// Setup WebSocket Signaling & High-Speed In-Memory Packet Relay
const wss = new WebSocketServer({ server, path: '/ws/signaling' });

wss.on('connection', (ws: WebSocket) => {
  let clientRoomCode: string | null = null;
  let clientRole: 'sender' | 'receiver' | null = null;

  ws.on('message', (data: any, isBinary: boolean) => {
    // If binary data, route directly to peer if in relay mode
    if (isBinary) {
      if (clientRoomCode && clientRole) {
        const room = rooms.get(clientRoomCode);
        if (room) {
          const peer = clientRole === 'sender' ? room.receiver : room.sender;
          if (peer && peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(data, { binary: true });
          }
        }
      }
      return;
    }

    try {
      const msg = JSON.parse(data.toString());
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'join_room': {
          const { roomCode, role, passcode } = msg;
          clientRoomCode = roomCode;
          clientRole = role;

          let room = rooms.get(roomCode);
          if (!room) {
            room = {
              code: roomCode,
              sender: null,
              receiver: null,
              lastActive: Date.now(),
            };
            rooms.set(roomCode, room);
          }

          room.lastActive = Date.now();
          if (passcode && role === 'sender') {
            room.passcode = passcode;
          }

          const clientInfo: ClientInfo = {
            ws,
            roomCode,
            role,
            joinedAt: Date.now(),
          };

          if (role === 'sender') {
            room.sender = clientInfo;
          } else {
            room.receiver = clientInfo;
          }

          // Acknowledge joined
          ws.send(
            JSON.stringify({
              type: 'room_joined',
              roomCode,
              role,
              requiresPasscode: !!room.passcode,
            })
          );

          // If both peers are now present, notify both!
          const senderActive = room.sender && room.sender.ws.readyState === WebSocket.OPEN;
          const receiverActive = room.receiver && room.receiver.ws.readyState === WebSocket.OPEN;

          if (senderActive && receiverActive) {
            room.sender?.ws.send(
              JSON.stringify({
                type: 'peer_ready',
                peerRole: 'receiver',
                requiresPasscode: !!room.passcode,
              })
            );

            room.receiver?.ws.send(
              JSON.stringify({
                type: 'peer_ready',
                peerRole: 'sender',
                requiresPasscode: !!room.passcode,
              })
            );
          }
          break;
        }

        case 'signal':
        case 'relay_packet':
        case 'auth_challenge':
        case 'auth_response':
        case 'auth_result':
        case 'auth_ack':
        case 'ping':
        case 'pong': {
          if (!clientRoomCode) return;
          const room = rooms.get(clientRoomCode);
          if (!room) return;
          room.lastActive = Date.now();

          // Forward to the other peer in the room
          const target = clientRole === 'sender' ? room.receiver : room.sender;
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify(msg));
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.warn('[Signaling Parse Error]', e);
    }
  });

  ws.on('close', () => {
    if (clientRoomCode && clientRole) {
      const room = rooms.get(clientRoomCode);
      if (room) {
        if (clientRole === 'sender') {
          room.sender = null;
        } else {
          room.receiver = null;
        }

        const other = clientRole === 'sender' ? room.receiver : room.sender;
        if (other && other.ws.readyState === WebSocket.OPEN) {
          other.ws.send(
            JSON.stringify({
              type: 'peer_disconnected',
              disconnectedRole: clientRole,
            })
          );
        }

        if (!room.sender && !room.receiver) {
          rooms.delete(clientRoomCode);
        }
      }
    }
  });
});

// Mount Vite or serve static
const startApp = async () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Bolt P2P High-Speed Server listening on port ${PORT}`);
  });
};

startApp();
