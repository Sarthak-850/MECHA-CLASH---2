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
  private roomCode: string | null = null;
  private isConnecting = false;

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

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    this.manualDisconnect = false;
    this.updateStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    return new Promise((resolve) => {
      try {
        const url = this.getWebSocketUrl();
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.updateStatus('CONNECTED');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (err) {
            console.error('Failed to parse server message:', err);
          }
        };

        this.ws.onclose = () => {
          this.updateStatus('DISCONNECTED');
          if (!this.manualDisconnect && this.roomCode) {
            this.attemptReconnect();
          }
          resolve(false);
        };

        this.ws.onerror = (err) => {
          console.error('WebSocket connection error:', err);
          resolve(false);
        };
      } catch (err) {
        console.error('Failed to construct WebSocket:', err);
        this.updateStatus('DISCONNECTED');
        resolve(false);
      }
    });
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
      const ok = await this.connect();
      if (ok && this.roomCode && this.pendingPlayerName) {
        // Re-join existing room
        this.joinRoom(this.roomCode, this.pendingPlayerName);
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

  public async createRoom(playerName: string) {
    this.pendingPlayerName = playerName;
    await this.connect();
    this.send({
      type: 'CREATE_ROOM',
      playerName,
    });
  }

  public async joinRoom(roomCode: string, playerName: string) {
    this.pendingRoomCode = roomCode.trim().toUpperCase();
    this.pendingPlayerName = playerName;
    await this.connect();
    this.send({
      type: 'JOIN_ROOM',
      roomCode: this.pendingRoomCode,
      playerName,
    });
  }

  public leaveRoom() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.send({ type: 'LEAVE_ROOM' });
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.role = null;
    this.roomCode = null;
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

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        this.role = msg.playerRole;
        if (this.callbacks.onRoomCreated) {
          this.callbacks.onRoomCreated(msg.roomCode, msg.playerRole);
        }
        break;

      case 'ROOM_JOINED':
        this.roomCode = msg.roomCode;
        this.role = msg.playerRole;
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
