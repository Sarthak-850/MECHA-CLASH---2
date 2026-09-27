import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ClientMessage,
  ServerMessage,
  RoomStateSync,
  NetworkPowerUpSync,
} from './src/types/multiplayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Enable proxy trust for Cloud Run, Render, Railway, and Cloudflare HTTPS
app.use(express.json());

// Dynamic CORS allowing deployed Vercel frontend, custom domains, and localhost
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Port configuration (Vite dev server, Cloud Run, Render, or Railway)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    process.env.npm_lifecycle_event !== 'dev' &&
    process.env.npm_lifecycle_event !== 'dev:web');

// Heartbeat to keep connections alive across reverse proxies & prune dead sockets
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// In-Memory Room Management
interface PlayerSession {
  ws?: WebSocket | null;
  id: string;
  name: string;
  role: 'PLAYER_1' | 'PLAYER_2';
  roomCode: string;
  lastPing: number;
  latestState?: any;
  latestStateTime?: number;
  lastBroadcastTime?: number;
  hasNewState?: boolean;
  lastReceivedStateTime?: number;
  disconnectedAt?: number;
  disconnectTimer?: NodeJS.Timeout | null;
}

interface RoomData {
  code: string;
  status: 'LOBBY' | 'STARTING' | 'BATTLE' | 'ROUND_END' | 'MATCH_OVER';
  players: {
    PLAYER_1?: PlayerSession;
    PLAYER_2?: PlayerSession;
  };
  currentRound: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  p1Hp: number;
  p2Hp: number;
  p1Rematch: boolean;
  p2Rematch: boolean;
  countdownTimer?: NodeJS.Timeout | null;
  roundEndTimer?: NodeJS.Timeout | null;
  powerUpInterval?: NodeJS.Timeout | null;
  createdAt: number;
  lastActivity: number;
  lastSimTime?: number;
  roundFinishedEmitted?: boolean;
  gameOverEmitted?: boolean;
}

const rooms = new Map<string, RoomData>();

// Helper to generate 5-character alphanumeric room code (e.g. 7K4P2)
function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

function sendTo(ws: WebSocket | null | undefined, message: ServerMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(room: RoomData, message: ServerMessage, excludeWs?: WebSocket | null) {
  const p1 = room.players.PLAYER_1;
  const p2 = room.players.PLAYER_2;

  if (p1 && p1.ws && p1.ws !== excludeWs && p1.ws.readyState === WebSocket.OPEN) {
    p1.ws.send(JSON.stringify(message));
  }
  if (p2 && p2.ws && p2.ws !== excludeWs && p2.ws.readyState === WebSocket.OPEN) {
    p2.ws.send(JSON.stringify(message));
  }
}

function getRoomStateSync(room: RoomData): RoomStateSync {
  return {
    roomCode: room.code,
    status: room.status,
    players: {
      PLAYER_1: room.players.PLAYER_1
        ? {
            id: room.players.PLAYER_1.id,
            role: 'PLAYER_1',
            name: room.players.PLAYER_1.name,
            connected: Boolean(room.players.PLAYER_1.ws && room.players.PLAYER_1.ws.readyState === WebSocket.OPEN),
            rematchReady: room.p1Rematch,
          }
        : undefined,
      PLAYER_2: room.players.PLAYER_2
        ? {
            id: room.players.PLAYER_2.id,
            role: 'PLAYER_2',
            name: room.players.PLAYER_2.name,
            connected: Boolean(room.players.PLAYER_2.ws && room.players.PLAYER_2.ws.readyState === WebSocket.OPEN),
            rematchReady: room.p2Rematch,
          }
        : undefined,
    },
    currentRound: room.currentRound,
    player1RoundsWon: room.p1RoundsWon,
    player2RoundsWon: room.p2RoundsWon,
    winner: room.p1RoundsWon >= 2 ? 'PLAYER_1' : room.p2RoundsWon >= 2 ? 'PLAYER_2' : null,
  };
}

function startMatchCountdown(room: RoomData) {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
  }
  room.status = 'STARTING';
  broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });

  let count = 3;
  broadcastToRoom(room, { type: 'COUNTDOWN', step: count });

  room.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      broadcastToRoom(room, { type: 'COUNTDOWN', step: count });
    } else if (count === 0) {
      broadcastToRoom(room, { type: 'COUNTDOWN', step: 0 }); // FIGHT!
    } else {
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      room.status = 'BATTLE';
      room.p1Hp = 100;
      room.p2Hp = 100;
      room.p1Rematch = false;
      room.p2Rematch = false;
      room.roundFinishedEmitted = false;
      room.gameOverEmitted = false;

      // Initial power-up
      const initialPowerUps: NetworkPowerUpSync[] = [
        {
          id: 'pow_' + Date.now(),
          type: 'SPEED_BOOST',
          x: 480,
          y: 300,
          radius: 16,
        },
      ];

      broadcastToRoom(room, {
        type: 'START_MATCH',
        round: room.currentRound,
        powerUps: initialPowerUps,
      });

      broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });

      // Start periodic power-up spawner
      startPowerUpSpawner(room);
    }
  }, 1000);
}

function startPowerUpSpawner(room: RoomData) {
  if (room.powerUpInterval) clearInterval(room.powerUpInterval);

  room.powerUpInterval = setInterval(() => {
    if (room.status !== 'BATTLE') return;

    const types: NetworkPowerUpSync['type'][] = [
      'SPEED_BOOST',
      'SHIELD',
      'POWER_ATTACK',
      'HEAL',
      'ENERGY',
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const px = 180 + Math.random() * (960 - 360);
    const py = 140 + Math.random() * (600 - 280);

    const newPowerUp: NetworkPowerUpSync = {
      id: 'pow_' + Date.now(),
      type,
      x: px,
      y: py,
      radius: 16,
    };

    broadcastToRoom(room, {
      type: 'POWERUP_SPAWN',
      powerUp: newPowerUp,
    });
  }, 12000);
}

function cleanupRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.countdownTimer) clearInterval(room.countdownTimer);
  if (room.roundEndTimer) clearTimeout(room.roundEndTimer);
  if (room.powerUpInterval) clearInterval(room.powerUpInterval);
  if (room.players.PLAYER_1?.disconnectTimer) clearTimeout(room.players.PLAYER_1.disconnectTimer);
  if (room.players.PLAYER_2?.disconnectTimer) clearTimeout(room.players.PLAYER_2.disconnectTimer);

  rooms.delete(roomCode);
}

// Periodic cleanup of stale/abandoned rooms (inactive > 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms.entries()) {
    const hasP1 = Boolean(r.players.PLAYER_1?.ws && r.players.PLAYER_1.ws.readyState === WebSocket.OPEN);
    const hasP2 = Boolean(r.players.PLAYER_2?.ws && r.players.PLAYER_2.ws.readyState === WebSocket.OPEN);
    if (!hasP1 && !hasP2 && (now - r.createdAt > 1000 * 60 * 3)) {
      cleanupRoom(code);
    } else if (now - r.lastActivity > 1000 * 60 * 30) {
      cleanupRoom(code);
    }
  }
}, 60000);

// WebSocket Connection handling
wss.on('connection', (ws: WebSocket, request?: any) => {
  let currentSession: PlayerSession | null = null;
  (ws as any).isAlive = true;

  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  // Check if client provided roomCode / playerId / role in connection URL query
  try {
    if (request && request.url) {
      const parsedUrl = new URL(request.url, 'http://localhost');
      const qRoomCode = (parsedUrl.searchParams.get('roomCode') || parsedUrl.searchParams.get('room'))?.toUpperCase();
      const qPlayerId = parsedUrl.searchParams.get('playerId');
      const qRole = parsedUrl.searchParams.get('role') as 'PLAYER_1' | 'PLAYER_2' | null;

      if (qRoomCode && rooms.has(qRoomCode)) {
        const room = rooms.get(qRoomCode)!;
        if (qRole === 'PLAYER_1' && room.players.PLAYER_1) {
          room.players.PLAYER_1.ws = ws;
          if (qPlayerId) room.players.PLAYER_1.id = qPlayerId;
          currentSession = room.players.PLAYER_1;
          sendTo(ws, {
            type: 'ROOM_CREATED',
            roomCode: qRoomCode,
            playerRole: 'PLAYER_1',
            playerId: room.players.PLAYER_1.id,
          });
          sendTo(ws, { type: 'ROOM_STATE', room: getRoomStateSync(room) });
        } else if (qRole === 'PLAYER_2' && room.players.PLAYER_2) {
          room.players.PLAYER_2.ws = ws;
          if (qPlayerId) room.players.PLAYER_2.id = qPlayerId;
          currentSession = room.players.PLAYER_2;
          sendTo(ws, {
            type: 'ROOM_JOINED',
            roomCode: qRoomCode,
            playerRole: 'PLAYER_2',
            playerId: room.players.PLAYER_2.id,
          });
          broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });
          if (room.players.PLAYER_1?.ws && room.players.PLAYER_2?.ws && room.status === 'LOBBY') {
            setTimeout(() => startMatchCountdown(room), 1200);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error handling connection query params:', err);
  }

  ws.on('message', (data: string) => {
    try {
      const rawText = data.toString();
      const msg: any = JSON.parse(rawText);

      // Handle heartbeat ping
      if (msg.type === 'PING') {
        (ws as any).isAlive = true;
        if (currentSession) currentSession.lastPing = Date.now();
        try {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: msg.timestamp }));
        } catch {}
        return;
      }

      if (msg.type === 'ATTACH_ROOM') {
        const cleanCode = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(cleanCode);
        if (room) {
          let session: PlayerSession | undefined;
          if (msg.role === 'PLAYER_1' && room.players.PLAYER_1) {
            session = room.players.PLAYER_1;
          } else if (msg.role === 'PLAYER_2' && room.players.PLAYER_2) {
            session = room.players.PLAYER_2;
          }

          if (session) {
            // Cancel disconnect grace period if reconnecting within grace window
            if (session.disconnectTimer) {
              clearTimeout(session.disconnectTimer);
              session.disconnectTimer = null;
            }
            session.ws = ws;
            session.disconnectedAt = undefined;
            session.lastPing = Date.now();
            currentSession = session;
            (ws as any).isAlive = true;

            if (session.role === 'PLAYER_1') {
              sendTo(ws, {
                type: 'ROOM_CREATED',
                roomCode: cleanCode,
                playerRole: 'PLAYER_1',
                playerId: session.id,
              });
            } else {
              sendTo(ws, {
                type: 'ROOM_JOINED',
                roomCode: cleanCode,
                playerRole: 'PLAYER_2',
                playerId: session.id,
              });
            }

            // Resynchronize room state
            sendTo(ws, { type: 'ROOM_STATE', room: getRoomStateSync(room) });

            if (room.status === 'BATTLE') {
              // Resynchronize authoritative combat state (Requirement 8)
              sendTo(ws, {
                type: 'DAMAGE_APPLIED',
                targetRole: 'PLAYER_1',
                damage: 0,
                isCritical: false,
                source: 'RECONNECT_SYNC',
                newHp: room.p1Hp,
              });
              sendTo(ws, {
                type: 'DAMAGE_APPLIED',
                targetRole: 'PLAYER_2',
                damage: 0,
                isCritical: false,
                source: 'RECONNECT_SYNC',
                newHp: room.p2Hp,
              });
              broadcastToRoom(room, {
                type: 'OPPONENT_RECONNECTED',
                message: `${session.name} has reconnected to the match.`,
              });
            } else if (room.status === 'LOBBY' && room.players.PLAYER_1?.ws && room.players.PLAYER_2?.ws) {
              setTimeout(() => startMatchCountdown(room), 1200);
            }

            broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });
          }
        }
      } else if (msg.type === 'CREATE_ROOM') {
        const roomCode = generateRoomCode();
        const playerId = 'p1_' + Math.random().toString(36).substring(2, 9);
        const name = (msg.playerName || 'Player 1').trim().substring(0, 16);

        const session: PlayerSession = {
          ws,
          id: playerId,
          name,
          role: 'PLAYER_1',
          roomCode,
          lastPing: Date.now(),
        };

        const newRoom: RoomData = {
          code: roomCode,
          status: 'LOBBY',
          players: { PLAYER_1: session },
          currentRound: 1,
          p1RoundsWon: 0,
          p2RoundsWon: 0,
          p1Hp: 100,
          p2Hp: 100,
          p1Rematch: false,
          p2Rematch: false,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };

        rooms.set(roomCode, newRoom);
        currentSession = session;

        sendTo(ws, {
          type: 'ROOM_CREATED',
          roomCode,
          playerRole: 'PLAYER_1',
          playerId,
        });

        sendTo(ws, {
          type: 'ROOM_STATE',
          room: getRoomStateSync(newRoom),
        });
      } else if (msg.type === 'JOIN_ROOM') {
        const cleanCode = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(cleanCode);

        if (!room) {
          sendTo(ws, { type: 'ERROR', message: 'Room not found. Check the code and try again.' });
          return;
        }

        if (room.players.PLAYER_2 && room.players.PLAYER_2.ws && room.players.PLAYER_2.ws.readyState === WebSocket.OPEN) {
          sendTo(ws, { type: 'ERROR', message: 'Room is full. 2 players are already in this room.' });
          return;
        }

        const playerId = 'p2_' + Math.random().toString(36).substring(2, 9);
        const name = (msg.playerName || 'Player 2').trim().substring(0, 16);

        const session: PlayerSession = {
          ws,
          id: playerId,
          name,
          role: 'PLAYER_2',
          roomCode: cleanCode,
          lastPing: Date.now(),
        };

        room.players.PLAYER_2 = session;
        room.lastActivity = Date.now();
        currentSession = session;

        sendTo(ws, {
          type: 'ROOM_JOINED',
          roomCode: cleanCode,
          playerRole: 'PLAYER_2',
          playerId,
        });

        broadcastToRoom(room, {
          type: 'ROOM_STATE',
          room: getRoomStateSync(room),
        });

        // Both players are now connected! Trigger match countdown
        setTimeout(() => {
          startMatchCountdown(room);
        }, 1200);
      } else if (msg.type === 'PLAYER_STATE') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room || room.status !== 'BATTLE') return;

        const serverNow = Date.now();
        // Server-side state throttling: Discard packets exceeding ~28Hz from client
        if (currentSession.lastReceivedStateTime && (serverNow - currentSession.lastReceivedStateTime < 35)) {
          return;
        }
        currentSession.lastReceivedStateTime = serverNow;

        // Authoritative timestamping & compact state buffering
        const stateWithTimestamp = {
          seq: msg.state.seq,
          x: msg.state.x,
          y: msg.state.y,
          vx: msg.state.vx,
          vy: msg.state.vy,
          angle: msg.state.angle,
          walkCycle: msg.state.walkCycle,
          isDashing: Boolean(msg.state.isDashing),
          dashDirX: msg.state.dashDirX,
          dashDirY: msg.state.dashDirY,
          time: msg.state.time,
          serverTime: serverNow,
        };
        currentSession.latestState = stateWithTimestamp;
        currentSession.latestStateTime = serverNow;
        currentSession.hasNewState = true;
        // Note: Broadcast is handled at the fixed 20Hz tick rate in serverSimulationLoop
      } else if (msg.type === 'PLAYER_ATTACK') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room) return;

        broadcastToRoom(
          room,
          {
            type: 'REMOTE_ATTACK',
            attack: msg.attack,
          },
          ws
        );
      } else if (msg.type === 'PLAYER_DASH') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room) return;

        broadcastToRoom(
          room,
          {
            type: 'REMOTE_DASH',
            role: currentSession.role,
            dx: msg.dx,
            dy: msg.dy,
          },
          ws
        );
      } else if (msg.type === 'PLAYER_ULTIMATE') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room) return;

        broadcastToRoom(
          room,
          {
            type: 'REMOTE_ULTIMATE',
            role: currentSession.role,
            x: msg.x,
            y: msg.y,
          },
          ws
        );
      } else if (msg.type === 'SYNC_DAMAGE') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);

        // Requirement 9: Add roundFinished guard
        if (!room || room.status !== 'BATTLE') return;

        // Validate roles: Attacker must target opponent
        const attackerRole = currentSession.role;
        const targetRole = msg.targetRole;
        if (targetRole !== (attackerRole === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1')) {
          return;
        }

        // Requirement 4: Server stores authoritative HP values
        const hpBefore = targetRole === 'PLAYER_1' ? room.p1Hp : room.p2Hp;

        // Requirement 8: Ignore duplicate kill events
        if (hpBefore <= 0) return;

        // Requirement 5: Server calculates damage (never trust client newHp)
        const damage = Math.max(0, Math.round(Number(msg.damage) || 0));
        const hpAfter = Math.max(0, hpBefore - damage);

        // Store authoritative HP
        if (targetRole === 'PLAYER_1') {
          room.p1Hp = hpAfter;
        } else {
          room.p2Hp = hpAfter;
        }

        // Requirement 6: Server determines round winner
        const isKill = hpAfter <= 0;
        const roundWinner = isKill ? (targetRole === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1') : null;

        // Requirement 10: Event logs (roomCode, attackerRole, targetRole, damage, HP before, HP after, winner)
        console.log(
          `[Damage Event] roomCode: ${room.code} | attackerRole: ${attackerRole} | targetRole: ${targetRole} | damage: ${damage} | HP before: ${hpBefore} | HP after: ${hpAfter} | winner: ${roundWinner || 'NONE'}`
        );

        // Broadcast authoritative damage and server-calculated newHp
        broadcastToRoom(room, {
          type: 'DAMAGE_APPLIED',
          targetRole,
          damage,
          isCritical: Boolean(msg.isCritical),
          source: msg.source || 'MELEE',
          newHp: hpAfter,
        });

        // Handle round completion if player was defeated
        if (isKill && roundWinner && room.status === 'BATTLE') {
          // Requirement 11: Prevent multiple ROUND_FINISHED broadcasts
          if (room.roundFinishedEmitted) return;
          room.roundFinishedEmitted = true;
          room.status = 'ROUND_END';

          if (roundWinner === 'PLAYER_1') {
            room.p1RoundsWon++;
          } else {
            room.p2RoundsWon++;
          }

          // Requirement 7: Server determines match winner
          const matchOver = room.p1RoundsWon >= 2 || room.p2RoundsWon >= 2;
          const isP1RoundWinner = roundWinner === 'PLAYER_1';
          const p1Id = room.players.PLAYER_1?.id || 'PLAYER_1';
          const p2Id = room.players.PLAYER_2?.id || 'PLAYER_2';
          const roundWinnerId = isP1RoundWinner ? p1Id : p2Id;
          const roundLoserId = isP1RoundWinner ? p2Id : p1Id;
          const matchWinner = matchOver ? (room.p1RoundsWon >= 2 ? 'PLAYER_1' : 'PLAYER_2') : null;
          const matchWinnerId = matchOver ? (matchWinner === 'PLAYER_1' ? p1Id : p2Id) : undefined;
          const matchLoserId = matchOver ? (matchWinner === 'PLAYER_1' ? p2Id : p1Id) : undefined;

          broadcastToRoom(room, {
            type: 'ROUND_FINISHED',
            round: room.currentRound,
            winner: roundWinner,
            roundWinner,
            winnerId: roundWinnerId,
            loserId: roundLoserId,
            matchWinner,
            p1RoundsWon: room.p1RoundsWon,
            p2RoundsWon: room.p2RoundsWon,
            matchOver,
          });

          if (matchOver) {
            room.status = 'MATCH_OVER';

            // Requirement 12: Prevent multiple MATCH_FINISHED / GAME_OVER broadcasts
            if (!room.gameOverEmitted) {
              room.gameOverEmitted = true;

              console.log(
                `[Server MATCH_OVER] roomCode: ${room.code} | winnerId: ${matchWinnerId} | loserId: ${matchLoserId} | roundWinner: ${roundWinner} | matchWinner: ${matchWinner} | P1 (${p1Id}): ${room.p1RoundsWon} | P2 (${p2Id}): ${room.p2RoundsWon}`
              );

              broadcastToRoom(room, {
                type: 'GAME_OVER',
                roomId: room.code,
                winnerId: matchWinnerId || roundWinnerId,
                loserId: matchLoserId || roundLoserId,
                roundWinner,
                matchWinner: matchWinner!,
                gameState: 'GAME_OVER',
                p1RoundsWon: room.p1RoundsWon,
                p2RoundsWon: room.p2RoundsWon,
              });

              broadcastToRoom(room, {
                type: 'MATCH_FINISHED',
                winner: matchWinner!,
                matchWinner: matchWinner!,
                winnerId: matchWinnerId || roundWinnerId,
                loserId: matchLoserId || roundLoserId,
                p1RoundsWon: room.p1RoundsWon,
                p2RoundsWon: room.p2RoundsWon,
              });

              broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });
            }
          } else {
            // Next round after brief delay
            room.roundEndTimer = setTimeout(() => {
              room.currentRound++;
              startMatchCountdown(room);
            }, 3000);
          }
        }
      } else if (msg.type === 'COLLECT_POWERUP') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'POWERUP_COLLECTED',
          powerUpId: msg.powerUpId,
          collectorRole: msg.role,
        });
      } else if (msg.type === 'REQUEST_REMATCH') {
        if (!currentSession) return;
        const room = rooms.get(currentSession.roomCode);
        if (!room) return;

        if (currentSession.role === 'PLAYER_1') {
          room.p1Rematch = true;
        } else {
          room.p2Rematch = true;
        }

        broadcastToRoom(room, { type: 'ROOM_STATE', room: getRoomStateSync(room) });

        // If both agreed on rematch, reset and start match!
        if (room.p1Rematch && room.p2Rematch) {
          room.currentRound = 1;
          room.p1RoundsWon = 0;
          room.p2RoundsWon = 0;
          room.p1Rematch = false;
          room.p2Rematch = false;
          room.roundFinishedEmitted = false;
          room.gameOverEmitted = false;
          startMatchCountdown(room);
        }
      } else if (msg.type === 'LEAVE_ROOM') {
        if (currentSession) {
          handlePlayerExplicitLeave(currentSession);
          currentSession = null;
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (currentSession) {
      handleSocketClose(currentSession);
      currentSession = null;
    }
  });

  function handleSocketClose(session: PlayerSession) {
    const room = rooms.get(session.roomCode);
    if (!room) return;

    session.ws = null;
    session.disconnectedAt = Date.now();

    // Broadcast room state showing player temporarily disconnected
    broadcastToRoom(room, {
      type: 'ROOM_STATE',
      room: getRoomStateSync(room),
    });

    // 15-second grace period for reconnection recovery (Requirement 8)
    if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
    session.disconnectTimer = setTimeout(() => {
      // Grace period expired without reconnection
      if (session.role === 'PLAYER_1') {
        delete room.players.PLAYER_1;
      } else {
        delete room.players.PLAYER_2;
      }

      broadcastToRoom(room, {
        type: 'OPPONENT_DISCONNECTED',
        message: `${session.name} disconnected from the room.`,
      });

      broadcastToRoom(room, {
        type: 'ROOM_STATE',
        room: getRoomStateSync(room),
      });

      if (!room.players.PLAYER_1 && !room.players.PLAYER_2) {
        cleanupRoom(room.code);
      }
    }, 15000);
  }

  function handlePlayerExplicitLeave(session: PlayerSession) {
    const room = rooms.get(session.roomCode);
    if (!room) return;

    if (session.disconnectTimer) {
      clearTimeout(session.disconnectTimer);
      session.disconnectTimer = null;
    }

    if (session.role === 'PLAYER_1') {
      delete room.players.PLAYER_1;
    } else {
      delete room.players.PLAYER_2;
    }

    broadcastToRoom(room, {
      type: 'OPPONENT_DISCONNECTED',
      message: `${session.name} has left the room.`,
    });

    broadcastToRoom(room, {
      type: 'ROOM_STATE',
      room: getRoomStateSync(room),
    });

    if (!room.players.PLAYER_1 && !room.players.PLAYER_2) {
      cleanupRoom(room.code);
    }
  }
});

// Upgrade handling for WebSocket on /ws, /ws/, or /api/ws path (Multiplayer), while delegating dev HMR to Vite
server.on('upgrade', (request, socket, head) => {
  try {
    const host = request.headers.host || 'localhost';
    const parsed = new URL(request.url || '', `http://${host}`);
    const pathname = parsed.pathname;

    // MECHA CLASH multiplayer WebSocket endpoint
    if (pathname === '/ws' || pathname === '/ws/' || pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }

    // In development mode, allow Vite HMR to handle its own WebSocket upgrades ('vite-hmr' / 'vite-ping')
    const protocol = request.headers['sec-websocket-protocol'];
    if (!isProd && (protocol === 'vite-hmr' || protocol === 'vite-ping')) {
      return;
    }

    // Cleanly destroy unrecognized upgrade requests so connections don't hang
    socket.destroy();
  } catch (err) {
    console.error('Error handling WebSocket upgrade:', err);
    socket.destroy();
  }
});

// --- REST API Endpoints for Guaranteed Device-Independent Room Management ---

// 1. Create Room (Returns unique 5-char code & registers P1)
app.post('/api/multiplayer/room/create', (req, res) => {
  try {
    const rawName = req.body?.playerName;
    const playerName = (typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Player 1').substring(0, 16);
    const roomCode = generateRoomCode();
    const playerId = 'p1_' + Math.random().toString(36).substring(2, 9);

    const session: PlayerSession = {
      ws: null,
      id: playerId,
      name: playerName,
      role: 'PLAYER_1',
      roomCode,
      lastPing: Date.now(),
    };

    const newRoom: RoomData = {
      code: roomCode,
      status: 'LOBBY',
      players: { PLAYER_1: session },
      currentRound: 1,
      p1RoundsWon: 0,
      p2RoundsWon: 0,
      p1Hp: 100,
      p2Hp: 100,
      p1Rematch: false,
      p2Rematch: false,
      roundFinishedEmitted: false,
      gameOverEmitted: false,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    rooms.set(roomCode, newRoom);

    res.json({
      success: true,
      roomCode,
      playerRole: 'PLAYER_1',
      playerId,
      room: getRoomStateSync(newRoom),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create room' });
  }
});

// 2. Join Room (Validates code, checks capacity, registers P2)
app.post('/api/multiplayer/room/join', (req, res) => {
  try {
    const code = (req.body?.roomCode || '').trim().toUpperCase();
    const rawName = req.body?.playerName;
    const playerName = (typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Player 2').substring(0, 16);

    if (!code) {
      return res.status(400).json({ success: false, message: 'Room code is required.' });
    }

    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found. Check the code and try again.' });
    }

    const p2IsActive = Boolean(
      room.players.PLAYER_2 && (
        (room.players.PLAYER_2.ws && room.players.PLAYER_2.ws.readyState === WebSocket.OPEN) ||
        (Date.now() - (room.players.PLAYER_2.lastPing || 0) < 30000)
      )
    );

    if (p2IsActive) {
      return res.status(400).json({ success: false, message: 'Room is full. 2 players are already in this room.' });
    }

    const playerId = 'p2_' + Math.random().toString(36).substring(2, 9);
    const session: PlayerSession = {
      ws: null,
      id: playerId,
      name: playerName,
      role: 'PLAYER_2',
      roomCode: code,
      lastPing: Date.now(),
    };

    room.players.PLAYER_2 = session;
    room.lastActivity = Date.now();

    // Broadcast updated state if P1 is connected
    broadcastToRoom(room, {
      type: 'ROOM_STATE',
      room: getRoomStateSync(room),
    });

    res.json({
      success: true,
      roomCode: code,
      playerRole: 'PLAYER_2',
      playerId,
      room: getRoomStateSync(room),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to join room' });
  }
});

// 3. Room Status
app.get('/api/multiplayer/room/:code', (req, res) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }
  res.json({ success: true, room: getRoomStateSync(room) });
});

// 4. Leave Room
app.post('/api/multiplayer/room/leave', (req, res) => {
  const code = (req.body?.roomCode || '').trim().toUpperCase();
  const playerId = req.body?.playerId;
  const room = rooms.get(code);
  if (room && playerId) {
    if (room.players.PLAYER_1?.id === playerId) {
      delete room.players.PLAYER_1;
    } else if (room.players.PLAYER_2?.id === playerId) {
      delete room.players.PLAYER_2;
    }
    broadcastToRoom(room, {
      type: 'ROOM_STATE',
      room: getRoomStateSync(room),
    });
    if (!room.players.PLAYER_1 && !room.players.PLAYER_2) {
      cleanupRoom(code);
    }
  }
  res.json({ success: true });
});

// Authoritative Fixed-Rate Simulation & Snapshot Broadcast Loop (20Hz / 50ms)
const SERVER_TICK_RATE = 20; // Exactly 20Hz (Requirements 2 & 5)
const SERVER_TICK_INTERVAL_MS = 1000 / SERVER_TICK_RATE; // 50ms
let serverTickDurationMs = 0;

const serverSimulationLoop = setInterval(() => {
  const wallNow = Date.now();
  const tickStart = performance.now();

  for (const [_code, room] of rooms.entries()) {
    if (room.status !== 'BATTLE') continue;

    const p1 = room.players.PLAYER_1;
    const p2 = room.players.PLAYER_2;

    // Fixed-rate snapshot broadcast for Player 1 -> Player 2
    if (p1 && p1.latestState && p2 && p2.ws && p2.ws.readyState === WebSocket.OPEN) {
      const needsBroadcast = p1.hasNewState || (wallNow - (p1.lastBroadcastTime || 0) >= 500);
      if (needsBroadcast) {
        p1.hasNewState = false;
        p1.lastBroadcastTime = wallNow;
        sendTo(p2.ws, {
          type: 'REMOTE_PLAYER_STATE',
          role: 'PLAYER_1',
          state: {
            ...p1.latestState,
            serverTime: wallNow,
          },
        });
      }
    }

    // Fixed-rate snapshot broadcast for Player 2 -> Player 1
    if (p2 && p2.latestState && p1 && p1.ws && p1.ws.readyState === WebSocket.OPEN) {
      const needsBroadcast = p2.hasNewState || (wallNow - (p2.lastBroadcastTime || 0) >= 500);
      if (needsBroadcast) {
        p2.hasNewState = false;
        p2.lastBroadcastTime = wallNow;
        sendTo(p1.ws, {
          type: 'REMOTE_PLAYER_STATE',
          role: 'PLAYER_2',
          state: {
            ...p2.latestState,
            serverTime: wallNow,
          },
        });
      }
    }
  }

  serverTickDurationMs = Math.round((performance.now() - tickStart) * 100) / 100;
}, SERVER_TICK_INTERVAL_MS);

// Health check endpoints (both /health and /api/health)
const handleHealthCheck = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    serverTickRate: SERVER_TICK_RATE,
    serverTickDurationMs,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MECHA CLASH] Server running on http://0.0.0.0:${PORT} (Mode: ${isProd ? 'Production' : 'Development'})`);
  });
}

startServer();
