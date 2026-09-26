import {
  ClientMessage,
  ServerMessage,
  RoomStateSync,
  NetworkPlayerInput,
  NetworkAttackEvent,
  NetworkPowerUpSync,
} from '../types/multiplayer';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface ConnectionDiagnostic {
  pageProtocol: string;
  pageHost: string;
  wsUrl: string;
  apiUrl: string;
  readyState: number;
  readyStateStr: string;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
  timestamp: string;
}

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
  private lastDiagnostic: ConnectionDiagnostic | null = null;

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

  public getLastDiagnostic(): ConnectionDiagnostic | null {
    return this.lastDiagnostic;
  }

  /**
   * Resolves target backend endpoints with support for:
   * 1. Explicit VITE_MULTIPLAYER_URL or VITE_BACKEND_URL environment variables.
   * 2. Automatic derivation from window.location in both development and production.
   * 3. Enforces wss:// when page is loaded over https://.
   */
  public getTargetBackend(): { wsBase: string; apiBase: string } {
    const rawEnv = (
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_MULTIPLAYER_URL || import.meta.env.VITE_BACKEND_URL)
        : '') || ''
    ).trim();

    if (rawEnv) {
      try {
        const cleanUrl = rawEnv.replace(/\/+$/, '');
        let wsBase = '';
        let apiBase = '';

        if (cleanUrl.startsWith('wss://') || cleanUrl.startsWith('ws://')) {
          wsBase = cleanUrl;
          apiBase = cleanUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
        } else if (cleanUrl.startsWith('https://') || cleanUrl.startsWith('http://')) {
          apiBase = cleanUrl;
          wsBase = cleanUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
        } else {
          const isSecure = typeof window !== 'undefined' && (window.location.protocol === 'https:' || !cleanUrl.includes('localhost'));
          wsBase = `${isSecure ? 'wss:' : 'ws:'}//${cleanUrl}`;
          apiBase = `${isSecure ? 'https:' : 'http:'}//${cleanUrl}`;
        }

        // Ensure WebSocket endpoint targets /ws
        if (!wsBase.endsWith('/ws')) {
          wsBase = `${wsBase}/ws`;
        }

        return { wsBase, apiBase };
      } catch (err) {
        console.warn('[MultiplayerClient] Failed to parse custom backend URL:', err);
      }
    }

    // Default: Use current browser host and origin
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const host = window.location.host;
      return {
        wsBase: `${isHttps ? 'wss:' : 'ws:'}//${host}/ws`,
        apiBase: window.location.origin,
      };
    }

    return {
      wsBase: 'ws://localhost:3000/ws',
      apiBase: 'http://localhost:3000',
    };
  }

  public getWebSocketUrl(roomCode?: string, playerId?: string, role?: string): string {
    const { wsBase } = this.getTargetBackend();
    const params = new URLSearchParams();
    if (roomCode) params.set('roomCode', roomCode);
    if (playerId) params.set('playerId', playerId);
    if (role) params.set('role', role);
    const queryString = params.toString();
    return queryString ? `${wsBase}?${queryString}` : wsBase;
  }

  private getReadyStateString(state: number): string {
    switch (state) {
      case 0: return 'CONNECTING (0)';
      case 1: return 'OPEN (1)';
      case 2: return 'CLOSING (2)';
      case 3: return 'CLOSED (3)';
      default: return `UNKNOWN (${state})`;
    }
  }

  /**
   * Diagnostic Health Check:
   * Tests if the backend server is reachable via HTTP REST.
   */
  public async checkHealth(): Promise<{ ok: boolean; status?: string; latencyMs: number; error?: string }> {
    const { apiBase } = this.getTargetBackend();
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${apiBase}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, status: data.status, latencyMs };
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return { ok: false, latencyMs, error: err?.message || 'Connection failed' };
    }
  }

  /**
   * Connects to WebSocket server with robust lifecycle management:
   * - Prevents duplicate or overlapping sockets
   * - 12-second timeout adapted for mobile cellular handshakes
   * - Detailed diagnostics recording close codes and target URLs
   */
  public connect(roomCode?: string, playerId?: string, role?: string): Promise<boolean> {
    // 1. If socket is already fully OPEN, optionally attach and return true
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

    // 2. If a connection attempt is already in flight, reuse the promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // 3. Clean up any stale or closing sockets
    this.cleanupSocket();

    this.manualDisconnect = false;
    this.updateStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    this.connectPromise = new Promise((resolve) => {
      let resolved = false;
      const targetRoom = roomCode || this.roomCode || undefined;
      const targetId = playerId || this.playerId || undefined;
      const targetRole = role || this.role || undefined;
      const url = this.getWebSocketUrl(targetRoom, targetId, targetRole);
      const { apiBase } = this.getTargetBackend();

      // Mobile networks may experience TLS handshake latency; use 12-second timeout
      const CONNECTION_TIMEOUT_MS = 12000;
      let connectionTimeout: any = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.lastDiagnostic = {
            pageProtocol: typeof window !== 'undefined' ? window.location.protocol : 'https:',
            pageHost: typeof window !== 'undefined' ? window.location.host : 'unknown',
            wsUrl: url,
            apiUrl: apiBase,
            readyState: this.ws ? this.ws.readyState : 3,
            readyStateStr: this.ws ? this.getReadyStateString(this.ws.readyState) : 'CLOSED',
            lastError: `Connection attempt timed out after ${CONNECTION_TIMEOUT_MS / 1000}s`,
            timestamp: new Date().toISOString(),
          };
          console.warn('[MultiplayerClient] WebSocket connection timed out:', this.lastDiagnostic);
          this.cleanupSocket();
          this.connectPromise = null;
          this.updateStatus('DISCONNECTED');
          resolve(false);
        }
      }, CONNECTION_TIMEOUT_MS);

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

          this.lastDiagnostic = {
            pageProtocol: window.location.protocol,
            pageHost: window.location.host,
            wsUrl: url,
            apiUrl: apiBase,
            readyState: socket.readyState,
            readyStateStr: this.getReadyStateString(socket.readyState),
            timestamp: new Date().toISOString(),
          };

          // Attach room metadata if available
          if (targetRoom && targetId && targetRole) {
            this.sendDirect(socket, {
              type: 'ATTACH_ROOM',
              roomCode: targetRoom,
              playerId: targetId,
              role: targetRole as 'PLAYER_1' | 'PLAYER_2',
            });
          }

          // Flush queued messages
          this.flushPendingMessages();
          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (err) {
            console.error('[MultiplayerClient] Failed to parse server message:', err);
          }
        };

        socket.onclose = (event) => {
          this.lastDiagnostic = {
            pageProtocol: typeof window !== 'undefined' ? window.location.protocol : 'https:',
            pageHost: typeof window !== 'undefined' ? window.location.host : 'unknown',
            wsUrl: url,
            apiUrl: apiBase,
            readyState: socket.readyState,
            readyStateStr: this.getReadyStateString(socket.readyState),
            closeCode: event.code,
            closeReason: event.reason || (event.code === 1006 ? 'Connection terminated abnormally (Code 1006)' : ''),
            timestamp: new Date().toISOString(),
          };

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
          console.warn('[MultiplayerClient] WebSocket event error:', err);
          if (!resolved) {
            if (this.lastDiagnostic) {
              this.lastDiagnostic.lastError = 'WebSocket connection failed';
            }
          }
        };
      } catch (err: any) {
        console.error('[MultiplayerClient] Failed to construct WebSocket:', err);
        clearTimeout(connectionTimeout);
        this.lastDiagnostic = {
          pageProtocol: typeof window !== 'undefined' ? window.location.protocol : 'https:',
          pageHost: typeof window !== 'undefined' ? window.location.host : 'unknown',
          wsUrl: url,
          apiUrl: apiBase,
          readyState: 3,
          readyStateStr: 'FAILED_TO_CONSTRUCT',
          lastError: err?.message || 'WebSocket constructor error',
          timestamp: new Date().toISOString(),
        };
        this.connectPromise = null;
        this.updateStatus('DISCONNECTED');
        resolve(false);
      }
    });

    return this.connectPromise;
  }

  private cleanupSocket() {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {
        // ignore
      }
      this.ws = null;
    }
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
   * 1. Primary path: REST POST to ${apiBase}/api/multiplayer/room/create (8-second timeout)
   * 2. Connects and attaches WebSocket for real-time match state
   * 3. Fallback path: Direct WebSocket CREATE_ROOM with 15-second mandatory timeout
   * 4. Reports exact connection diagnostics on failure instead of generic messages
   */
  public async createRoom(playerName: string): Promise<boolean> {
    const validName = playerName.trim() || 'Player 1';
    this.pendingPlayerName = validName;

    const OVERALL_TIMEOUT_MS = 15000;
    let timedOut = false;

    return new Promise<boolean>(async (resolve) => {
      // Mandatory timeout handler
      const mandatoryTimer = setTimeout(() => {
        timedOut = true;
        const diag = this.lastDiagnostic;
        const detail = diag?.wsUrl ? ` (Target: ${diag.wsUrl})` : '';
        const errorMsg = `Room creation timed out after 15s${detail}. Please check network connection.`;
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMsg);
        }
        resolve(false);
      }, OVERALL_TIMEOUT_MS);

      const { apiBase } = this.getTargetBackend();

      // 1. Primary path: REST POST with AbortController timeout (8s)
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`${apiBase}/api/multiplayer/room/create`, {
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
            this.connect(data.roomCode, data.playerId, 'PLAYER_1').catch((err) => {
              console.warn('[MultiplayerClient] WebSocket attach warning:', err);
            });
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

        const diag = this.lastDiagnostic;
        let detail = 'Server connection failed';
        if (diag?.closeCode) {
          detail = `Server closed socket (Code: ${diag.closeCode}${diag.closeReason ? ' - ' + diag.closeReason : ''})`;
        } else if (diag?.lastError) {
          detail = diag.lastError;
        }

        const connErr = `Unable to connect to multiplayer server: ${detail}. Target: ${diag?.wsUrl || apiBase}`;
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
   * then connects WebSocket channel with 15-second mandatory timeout.
   */
  public async joinRoom(roomCode: string, playerName: string): Promise<boolean> {
    const cleanCode = roomCode.trim().toUpperCase();
    const validName = playerName.trim() || 'Player 2';
    this.pendingRoomCode = cleanCode;
    this.pendingPlayerName = validName;

    const OVERALL_TIMEOUT_MS = 15000;
    let timedOut = false;

    return new Promise<boolean>(async (resolve) => {
      // Mandatory timeout handler
      const mandatoryTimer = setTimeout(() => {
        timedOut = true;
        const diag = this.lastDiagnostic;
        const detail = diag?.wsUrl ? ` (Target: ${diag.wsUrl})` : '';
        const errorMsg = `Joining room timed out after 15s${detail}. Please check network connection.`;
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMsg);
        }
        resolve(false);
      }, OVERALL_TIMEOUT_MS);

      const { apiBase } = this.getTargetBackend();

      // 1. Primary path: REST POST with AbortController (8s)
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`${apiBase}/api/multiplayer/room/join`, {
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
          this.connect(cleanCode, data.playerId, 'PLAYER_2').catch((err) => {
            console.warn('[MultiplayerClient] WebSocket attach warning:', err);
          });
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

        const diag = this.lastDiagnostic;
        let detail = 'Server connection failed';
        if (diag?.closeCode) {
          detail = `Server closed socket (Code: ${diag.closeCode}${diag.closeReason ? ' - ' + diag.closeReason : ''})`;
        } else if (diag?.lastError) {
          detail = diag.lastError;
        }

        const connErr = `Unable to connect to game server: ${detail}. Target: ${diag?.wsUrl || apiBase}`;
        if (this.callbacks.onError) {
          this.callbacks.onError(connErr);
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
        const { apiBase } = this.getTargetBackend();
        fetch(`${apiBase}/api/multiplayer/room/leave`, {
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
    this.cleanupSocket();
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
      console.error('[MultiplayerClient] Failed to send WebSocket message:', err);
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
