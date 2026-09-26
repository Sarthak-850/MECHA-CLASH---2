import {
  ClientMessage,
  ServerMessage,
  RoomStateSync,
  NetworkPlayerInput,
  NetworkAttackEvent,
  NetworkPowerUpSync,
} from '../types/multiplayer';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface MultiplayerClientCallbacks {
  onConnectionChange?: (status: ConnectionStatus) => void;
  onRoomCreated?: (roomCode: string, role: 'PLAYER_1') => void;
  onRoomJoined?: (roomCode: string, role: 'PLAYER_2') => void;
  onRoomState?: (room: RoomStateSync) => void;
  onCountdown?: (step: number) => void;
  onStartMatch?: (round: number, powerUps: NetworkPowerUpSync[]) => void;
  onRemotePlayerState?: (role: 'PLAYER_1' | 'PLAYER_2', state: NetworkPlayerInput) => void;
  onRemoteAttack?: (attack: NetworkAttackEvent) => void;
  onRemoteDash?: (role: 'PLAYER_1' | 'PLAYER_2', dx: number, dy: number) => void;
  onRemoteUltimate?: (role: 'PLAYER_1' | 'PLAYER_2', x: number, y: number) => void;
  onDamageApplied?: (
    targetRole: 'PLAYER_1' | 'PLAYER_2',
    damage: number,
    isCritical: boolean,
    source: string,
    newHp: number
  ) => void;
  onPowerUpSpawn?: (powerUp: NetworkPowerUpSync) => void;
  onPowerUpCollected?: (powerUpId: string, collectorRole: 'PLAYER_1' | 'PLAYER_2') => void;
  onRoundFinished?: (
    round: number,
    winner: 'PLAYER_1' | 'PLAYER_2',
    p1RoundsWon: number,
    p2RoundsWon: number,
    matchOver: boolean
  ) => void;
  onMatchFinished?: (
    winner: 'PLAYER_1' | 'PLAYER_2',
    p1RoundsWon: number,
    p2RoundsWon: number
  ) => void;
  onOpponentDisconnected?: (message: string) => void;
  onError?: (message: string) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private callbacks: MultiplayerClientCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private pendingRoomCode: string | null = null;
  private pendingPlayerName: string = 'Pilot';
  private manualDisconnect = false;
  private role: 'PLAYER_1' | 'PLAYER_2' | null = null;
  private playerId: string | null = null;
  private roomCode: string | null = null;
  private pendingMessages: ClientMessage[] = [];
  private connectPromise: Promise<boolean> | null = null;

  constructor(callbacks: MultiplayerClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: MultiplayerClientCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getRole(): 'PLAYER_1' | 'PLAYER_2' | null {
    return this.role;
  }

  public getRoomCode(): string | null {
    return this.roomCode;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  private getWebSocketUrl(roomCode?: string, playerId?: string, role?: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}/ws`;
    const params = new URLSearchParams();
    if (roomCode) params.set('roomCode', roomCode);
    if (playerId) params.set('playerId', playerId);
    if (role) params.set('role', role);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Connects to WebSocket server with reliable promise tracking and message queueing.
   * If already connecting, returns the active promise instead of prematurely resolving true.
   */
  public connect(roomCode?: string, playerId?: string, role?: string): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (roomCode && playerId && role) {
        this.send({
          type: 'ATTACH_ROOM',
          roomCode,
          playerId,
          role: role as 'PLAYER_1' | 'PLAYER_2',
        });
      }
      return Promise.resolve(true);
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.manualDisconnect = false;
    this.updateStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    this.connectPromise = new Promise((resolve) => {
      let resolved = false;
      const targetRoom = roomCode || this.roomCode || undefined;
      const targetId = playerId || this.playerId || undefined;
      const targetRole = role || this.role || undefined;
      const url = this.getWebSocketUrl(targetRoom, targetId, targetRole);

      let connectionTimeout: any = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[MultiplayerClient] Connection attempt timed out');
          if (this.ws) {
            try {
              this.ws.close();
            } catch {
              // ignore
            }
          }
          this.connectPromise = null;
          this.updateStatus('DISCONNECTED');
          resolve(false);
        }
      }, 7000);

      try {
        const socket = new WebSocket(url);
        this.ws = socket;

        socket.onopen = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          this.updateStatus('CONNECTED');
          this.connectPromise = null;

          // If room info is available, send attach message as well to guarantee association
          if (targetRoom && targetId && targetRole) {
            this.sendDirect(socket, {
              type: 'ATTACH_ROOM',
              roomCode: targetRoom,
              playerId: targetId,
              role: targetRole as 'PLAYER_1' | 'PLAYER_2',
            });
          }

          // Flush any messages queued during handshake
          this.flushPendingMessages();
          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (err) {
            console.error('Failed to parse server message:', err);
          }
        };

        socket.onclose = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimeout);
            this.connectPromise = null;
            this.updateStatus('DISCONNECTED');
            resolve(false);
          } else {
            this.updateStatus('DISCONNECTED');
            if (!this.manualDisconnect && this.roomCode) {
              this.attemptReconnect();
            }
          }
        };

        socket.onerror = (err) => {
          console.warn('WebSocket connection event error:', err);
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimeout);
            this.connectPromise = null;
            this.updateStatus('DISCONNECTED');
            resolve(false);
          }
        };
      } catch (err) {
        console.error('Failed to construct WebSocket:', err);
        clearTimeout(connectionTimeout);
        this.connectPromise = null;
        this.updateStatus('DISCONNECTED');
        resolve(false);
      }
    });

    return this.connectPromise;
  }

  private flushPendingMessages() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift();
      if (msg) {
        this.sendDirect(this.ws, msg);
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.callbacks.onError) {
        this.callbacks.onError('Connection lost. Please rejoin the room.');
      }
      return;
    }

    this.reconnectAttempts++;
    this.updateStatus('RECONNECTING');

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
    this.reconnectTimer = setTimeout(async () => {
      const ok = await this.connect(this.roomCode || undefined, this.playerId || undefined, this.role || undefined);
      if (ok && this.roomCode && this.pendingPlayerName) {
        if (this.role === 'PLAYER_1') {
          this.send({
            type: 'ATTACH_ROOM',
            roomCode: this.roomCode,
            playerId: this.playerId || '',
            role: 'PLAYER_1',
          });
        } else {
          this.joinRoom(this.roomCode, this.pendingPlayerName);
        }
      }
    }, delay);
  }

  private updateStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      if (this.callbacks.onConnectionChange) {
        this.callbacks.onConnectionChange(newStatus);
      }
    }
  }

  /**
   * Device-Independent Room Creation:
   * Uses REST API first for sub-50ms deterministic creation on cellular or Wi-Fi,
   * with AbortController timeout to prevent mobile browser hangs.
   * Then attaches WebSocket for 60fps real-time gameplay.
   * Fallback to direct WebSocket if REST fails, enforced by an overall mandatory timeout.
   */
  public async createRoom(playerName: string): Promise<boolean> {
    const validName = playerName.trim() || 'Player 1';
    this.pendingPlayerName = validName;

    const TIMEOUT_MS = 6000;
    let timedOut = false;

    return new Promise<boolean>(async (resolve) => {
      // Mandatory timeout handler with user-facing error state
      const mandatoryTimer = setTimeout(() => {
        timedOut = true;
        const errorMsg =
          'Room creation timed out. Please check that mobile browser privacy restrictions or connection settings do not block network requests.';
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMsg);
        }
        resolve(false);
      }, TIMEOUT_MS);

      // 1. Primary path: REST POST with AbortController timeout
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch('/api/multiplayer/room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: validName }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimer);

        if (!timedOut && res.ok) {
          const data = await res.json();
          if (data.success && data.roomCode) {
            clearTimeout(mandatoryTimer);
            this.roomCode = data.roomCode;
            this.role = 'PLAYER_1';
            this.playerId = data.playerId;

            if (this.callbacks.onRoomCreated) {
              this.callbacks.onRoomCreated(data.roomCode, 'PLAYER_1');
            }
            if (data.room && this.callbacks.onRoomState) {
              this.callbacks.onRoomState(data.room);
            }

            // Connect WebSocket channel attached to this specific room
            this.connect(data.roomCode, data.playerId, 'PLAYER_1').catch(() => {});
            resolve(true);
            return;
          }
        }
      } catch (err) {
        clearTimeout(fetchTimer);
        // Fallback to WebSocket path if REST failed or aborted
      }

      if (timedOut) return;

      // 2. Direct WebSocket fallback with response listener
      const prevOnRoomCreated = this.callbacks.onRoomCreated;
      const prevOnError = this.callbacks.onError;

      this.callbacks.onRoomCreated = (code, role) => {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomCreated = prevOnRoomCreated;
        this.callbacks.onError = prevOnError;
        if (prevOnRoomCreated) prevOnRoomCreated(code, role);
        resolve(true);
      };

      this.callbacks.onError = (msg) => {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomCreated = prevOnRoomCreated;
        this.callbacks.onError = prevOnError;
        if (prevOnError) prevOnError(msg);
        resolve(false);
      };

      const ok = await this.connect();
      if (!ok) {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomCreated = prevOnRoomCreated;
        this.callbacks.onError = prevOnError;
        const connErr =
          'Unable to establish arena channel. Please check mobile browser privacy restrictions or connection.';
        if (this.callbacks.onError) {
          this.callbacks.onError(connErr);
        }
        resolve(false);
        return;
      }

      this.send({
        type: 'CREATE_ROOM',
        playerName: validName,
      });
    });
  }

  /**
   * Device-Independent Room Joining:
   * Uses REST API first to validate code and register Player 2,
   * then connects/attaches WebSocket with mandatory timeout.
   */
  public async joinRoom(roomCode: string, playerName: string): Promise<boolean> {
    const cleanCode = roomCode.trim().toUpperCase();
    const validName = playerName.trim() || 'Player 2';
    this.pendingRoomCode = cleanCode;
    this.pendingPlayerName = validName;

    const TIMEOUT_MS = 6000;
    let timedOut = false;

    return new Promise<boolean>(async (resolve) => {
      // Mandatory timeout handler
      const mandatoryTimer = setTimeout(() => {
        timedOut = true;
        const errorMsg =
          'Joining room timed out. Please check that mobile browser privacy restrictions or connection settings do not block network requests.';
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMsg);
        }
        resolve(false);
      }, TIMEOUT_MS);

      // 1. Primary path: REST POST with AbortController
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch('/api/multiplayer/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: cleanCode, playerName: validName }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimer);

        if (!timedOut) {
          const data = await res.json();
          if (!res.ok || !data.success) {
            clearTimeout(mandatoryTimer);
            const errorMsg = data.message || 'Unable to join room. Please check the code.';
            if (this.callbacks.onError) {
              this.callbacks.onError(errorMsg);
            }
            resolve(false);
            return;
          }

          clearTimeout(mandatoryTimer);
          this.roomCode = cleanCode;
          this.role = 'PLAYER_2';
          this.playerId = data.playerId;

          if (this.callbacks.onRoomJoined) {
            this.callbacks.onRoomJoined(cleanCode, 'PLAYER_2');
          }
          if (data.room && this.callbacks.onRoomState) {
            this.callbacks.onRoomState(data.room);
          }

          // Connect WebSocket channel attached to this room
          this.connect(cleanCode, data.playerId, 'PLAYER_2').catch(() => {});
          resolve(true);
          return;
        }
      } catch {
        clearTimeout(fetchTimer);
        // Fallback to WebSocket join
      }

      if (timedOut) return;

      // 2. Direct WebSocket fallback with response listener
      const prevOnRoomJoined = this.callbacks.onRoomJoined;
      const prevOnError = this.callbacks.onError;

      this.callbacks.onRoomJoined = (code, role) => {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomJoined = prevOnRoomJoined;
        this.callbacks.onError = prevOnError;
        if (prevOnRoomJoined) prevOnRoomJoined(code, role);
        resolve(true);
      };

      this.callbacks.onError = (msg) => {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomJoined = prevOnRoomJoined;
        this.callbacks.onError = prevOnError;
        if (prevOnError) prevOnError(msg);
        resolve(false);
      };

      const ok = await this.connect();
      if (!ok) {
        clearTimeout(mandatoryTimer);
        this.callbacks.onRoomJoined = prevOnRoomJoined;
        this.callbacks.onError = prevOnError;
        if (this.callbacks.onError) {
          this.callbacks.onError('Unable to connect to game server. Please check your connection.');
        }
        resolve(false);
        return;
      }

      this.send({
        type: 'JOIN_ROOM',
        roomCode: cleanCode,
        playerName: validName,
      });
    });
  }

  public leaveRoom() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.roomCode) {
      try {
        fetch('/api/multiplayer/room/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: this.roomCode, playerId: this.playerId }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore
      }
    }

    this.send({ type: 'LEAVE_ROOM' });
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.role = null;
    this.playerId = null;
    this.roomCode = null;
    this.pendingMessages = [];
    this.connectPromise = null;
    this.updateStatus('DISCONNECTED');
  }

  public requestRematch() {
    this.send({ type: 'REQUEST_REMATCH' });
  }

  public sendPlayerState(state: NetworkPlayerInput) {
    this.send({
      type: 'PLAYER_STATE',
      state,
    });
  }

  public sendPlayerAttack(attack: NetworkAttackEvent) {
    this.send({
      type: 'PLAYER_ATTACK',
      attack,
    });
  }

  public sendPlayerDash(dx: number, dy: number) {
    this.send({
      type: 'PLAYER_DASH',
      dx,
      dy,
    });
  }

  public sendPlayerUltimate(x: number, y: number) {
    this.send({
      type: 'PLAYER_ULTIMATE',
      x,
      y,
    });
  }

  public sendDamage(
    targetRole: 'PLAYER_1' | 'PLAYER_2',
    damage: number,
    isCritical: boolean,
    source: string,
    newHp: number
  ) {
    this.send({
      type: 'SYNC_DAMAGE',
      targetRole,
      damage,
      isCritical,
      source,
      newHp,
    });
  }

  public sendCollectPowerUp(powerUpId: string, role: 'PLAYER_1' | 'PLAYER_2') {
    this.send({
      type: 'COLLECT_POWERUP',
      powerUpId,
      role,
    });
  }

  /**
   * Sends message if socket is open; otherwise queues message so it is NEVER lost.
   */
  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendDirect(this.ws, msg);
    } else {
      // Queue critical handshake messages
      if (
        msg.type === 'CREATE_ROOM' ||
        msg.type === 'JOIN_ROOM' ||
        msg.type === 'ATTACH_ROOM' ||
        msg.type === 'REQUEST_REMATCH'
      ) {
        this.pendingMessages.push(msg);
      }
    }
  }

  private sendDirect(socket: WebSocket, msg: ClientMessage) {
    try {
      socket.send(JSON.stringify(msg));
    } catch (err) {
      console.error('Failed to send WebSocket message:', err);
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        this.role = msg.playerRole;
        this.playerId = msg.playerId;
        if (this.callbacks.onRoomCreated) {
          this.callbacks.onRoomCreated(msg.roomCode, msg.playerRole);
        }
        break;

      case 'ROOM_JOINED':
        this.roomCode = msg.roomCode;
        this.role = msg.playerRole;
        this.playerId = msg.playerId;
        if (this.callbacks.onRoomJoined) {
          this.callbacks.onRoomJoined(msg.roomCode, msg.playerRole);
        }
        break;

      case 'ROOM_STATE':
        if (this.callbacks.onRoomState) {
          this.callbacks.onRoomState(msg.room);
        }
        break;

      case 'COUNTDOWN':
        if (this.callbacks.onCountdown) {
          this.callbacks.onCountdown(msg.step);
        }
        break;

      case 'START_MATCH':
        if (this.callbacks.onStartMatch) {
          this.callbacks.onStartMatch(msg.round, msg.powerUps);
        }
        break;

      case 'REMOTE_PLAYER_STATE':
        if (this.callbacks.onRemotePlayerState) {
          this.callbacks.onRemotePlayerState(msg.role, msg.state);
        }
        break;

      case 'REMOTE_ATTACK':
        if (this.callbacks.onRemoteAttack) {
          this.callbacks.onRemoteAttack(msg.attack);
        }
        break;

      case 'REMOTE_DASH':
        if (this.callbacks.onRemoteDash) {
          this.callbacks.onRemoteDash(msg.role, msg.dx, msg.dy);
        }
        break;

      case 'REMOTE_ULTIMATE':
        if (this.callbacks.onRemoteUltimate) {
          this.callbacks.onRemoteUltimate(msg.role, msg.x, msg.y);
        }
        break;

      case 'DAMAGE_APPLIED':
        if (this.callbacks.onDamageApplied) {
          this.callbacks.onDamageApplied(
            msg.targetRole,
            msg.damage,
            msg.isCritical,
            msg.source,
            msg.newHp
          );
        }
        break;

      case 'POWERUP_SPAWN':
        if (this.callbacks.onPowerUpSpawn) {
          this.callbacks.onPowerUpSpawn(msg.powerUp);
        }
        break;

      case 'POWERUP_COLLECTED':
        if (this.callbacks.onPowerUpCollected) {
          this.callbacks.onPowerUpCollected(msg.powerUpId, msg.collectorRole);
        }
        break;

      case 'ROUND_FINISHED':
        if (this.callbacks.onRoundFinished) {
          this.callbacks.onRoundFinished(
            msg.round,
            msg.winner,
            msg.p1RoundsWon,
            msg.p2RoundsWon,
            msg.matchOver
          );
        }
        break;

      case 'MATCH_FINISHED':
        if (this.callbacks.onMatchFinished) {
          this.callbacks.onMatchFinished(
            msg.winner,
            msg.p1RoundsWon,
            msg.p2RoundsWon
          );
        }
        break;

      case 'OPPONENT_DISCONNECTED':
        if (this.callbacks.onOpponentDisconnected) {
          this.callbacks.onOpponentDisconnected(msg.message);
        }
        break;

      case 'ERROR':
        if (this.callbacks.onError) {
          this.callbacks.onError(msg.message);
        }
        break;
    }
  }
}

// Global singleton instance
export const multiplayerClient = new MultiplayerClient();
