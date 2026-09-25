/**
 * Mecha Clash - Multiplayer Network Protocol Types
 */

export interface NetworkPlayerInput {
  seq: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  walkCycle: number;
  isDashing: boolean;
  dashDirX: number;
  dashDirY: number;
}

export interface NetworkAttackEvent {
  id: string;
  attackerId: 'PLAYER_1' | 'PLAYER_2';
  type: 'SLASH' | 'ULTIMATE';
  x: number;
  y: number;
  angle: number;
  hasPowerAttack: boolean;
  timestamp: number;
}

export interface NetworkDamageEvent {
  id: string;
  targetId: 'PLAYER_1' | 'PLAYER_2';
  damage: number;
  isCritical: boolean;
  source: string;
  newHp: number;
}

export interface NetworkPowerUpSync {
  id: string;
  type: 'SPEED_BOOST' | 'SHIELD' | 'POWER_ATTACK' | 'HEAL' | 'ENERGY';
  x: number;
  y: number;
  radius: number;
}

export interface RoomPlayerInfo {
  id: string;
  role: 'PLAYER_1' | 'PLAYER_2';
  name: string;
  connected: boolean;
  rematchReady: boolean;
}

export interface RoomStateSync {
  roomCode: string;
  status: 'LOBBY' | 'STARTING' | 'BATTLE' | 'ROUND_END' | 'MATCH_OVER';
  players: {
    PLAYER_1?: RoomPlayerInfo;
    PLAYER_2?: RoomPlayerInfo;
  };
  currentRound: number;
  player1RoundsWon: number;
  player2RoundsWon: number;
  winner?: 'PLAYER_1' | 'PLAYER_2' | null;
  countdownStep?: number;
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'REQUEST_REMATCH' }
  | {
      type: 'PLAYER_STATE';
      state: NetworkPlayerInput;
    }
  | {
      type: 'PLAYER_ATTACK';
      attack: NetworkAttackEvent;
    }
  | {
      type: 'PLAYER_DASH';
      dx: number;
      dy: number;
    }
  | {
      type: 'PLAYER_ULTIMATE';
      x: number;
      y: number;
    }
  | {
      type: 'SYNC_DAMAGE';
      targetRole: 'PLAYER_1' | 'PLAYER_2';
      damage: number;
      isCritical: boolean;
      source: string;
      newHp: number;
    }
  | {
      type: 'COLLECT_POWERUP';
      powerUpId: string;
      role: 'PLAYER_1' | 'PLAYER_2';
    };

// Server -> Client messages
export type ServerMessage =
  | {
      type: 'ROOM_CREATED';
      roomCode: string;
      playerRole: 'PLAYER_1';
      playerId: string;
    }
  | {
      type: 'ROOM_JOINED';
      roomCode: string;
      playerRole: 'PLAYER_2';
      playerId: string;
    }
  | {
      type: 'ROOM_STATE';
      room: RoomStateSync;
    }
  | {
      type: 'COUNTDOWN';
      step: number; // 3, 2, 1, 0
    }
  | {
      type: 'START_MATCH';
      round: number;
      powerUps: NetworkPowerUpSync[];
    }
  | {
      type: 'REMOTE_PLAYER_STATE';
      role: 'PLAYER_1' | 'PLAYER_2';
      state: NetworkPlayerInput;
    }
  | {
      type: 'REMOTE_ATTACK';
      attack: NetworkAttackEvent;
    }
  | {
      type: 'REMOTE_DASH';
      role: 'PLAYER_1' | 'PLAYER_2';
      dx: number;
      dy: number;
    }
  | {
      type: 'REMOTE_ULTIMATE';
      role: 'PLAYER_1' | 'PLAYER_2';
      x: number;
      y: number;
    }
  | {
      type: 'DAMAGE_APPLIED';
      targetRole: 'PLAYER_1' | 'PLAYER_2';
      damage: number;
      isCritical: boolean;
      source: string;
      newHp: number;
    }
  | {
      type: 'POWERUP_SPAWN';
      powerUp: NetworkPowerUpSync;
    }
  | {
      type: 'POWERUP_COLLECTED';
      powerUpId: string;
      collectorRole: 'PLAYER_1' | 'PLAYER_2';
    }
  | {
      type: 'ROUND_FINISHED';
      round: number;
      winner: 'PLAYER_1' | 'PLAYER_2';
      p1RoundsWon: number;
      p2RoundsWon: number;
      matchOver: boolean;
    }
  | {
      type: 'MATCH_FINISHED';
      winner: 'PLAYER_1' | 'PLAYER_2';
      p1RoundsWon: number;
      p2RoundsWon: number;
    }
  | {
      type: 'OPPONENT_DISCONNECTED';
      message: string;
    }
  | {
      type: 'OPPONENT_RECONNECTED';
      message: string;
    }
  | {
      type: 'ERROR';
      message: string;
    };
