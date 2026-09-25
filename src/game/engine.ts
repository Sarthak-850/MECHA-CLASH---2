import { soundManager } from '../audio/soundManager';
import {
  AIDifficultyConfig,
  CollapsingPlatform,
  DifficultyLevel,
  FloatingText,
  GameMode,
  GameState,
  HazardNode,
  MatchStats,
  MechState,
  MovingBarrier,
  Obstacle,
  Particle,
  PowerUp,
  PowerUpType,
} from '../types/game';
import { MechAI } from './ai';
import {
  AI_DIFFICULTIES,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ATTACK_ARC,
  ATTACK_COOLDOWN,
  ATTACK_DURATION,
  ATTACK_REACH,
  BASE_ATTACK_DAMAGE,
  BASE_HP,
  BASE_SPEED,
  CAMPAIGN_LEVELS,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_INVULNERABLE_TIME,
  DASH_SPEED,
  HIT_STUN_DURATION,
  INVULNERABLE_AFTER_HIT,
  MAX_LIVES,
  MECH_RADIUS,
  POWER_ATTACK_DAMAGE,
  POWER_UP_DURATION,
  SPEED_BOOST_DURATION,
  SPEED_BOOST_SPEED,
} from './constants';

export class GameEngine {
  public gameState: GameState = 'MENU';
  public gameMode: GameMode = 'QUICK_DUEL';
  public difficulty: DifficultyLevel = 'NORMAL';
  public currentLevel: number = 1;
  public currentRound: number = 1;
  public vexRoundsWon: number = 0;
  public novaRoundsWon: number = 0;

  // Mechs
  public vex!: MechState;
  public nova!: MechState;
  private aiController!: MechAI;

  // Arena & Entities
  public obstacles: Obstacle[] = [];
  public hazards: HazardNode[] = [];
  public collapsingPlatforms: CollapsingPlatform[] = [];
  public barriers: MovingBarrier[] = [];
  public powerUps: PowerUp[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  // Timers & Triggers
  public countdownTimer: number = 0; // 3, 2, 1, 0 (FIGHT)
  public countdownStep: number = 3;
  public roundEndTimer: number = 0;
  public roundWinner: 'VEX' | 'NOVA' | null = null;
  public powerUpSpawnTimer: number = 8;
  public screenShake: { x: number; y: number } = { x: 0, y: 0 };
  private shakeIntensity: number = 0;

  // Scoring & Stats
  public score: number = 0;
  public winStreak: number = 0;
  public matchStats: MatchStats = {
    damageDealt: 0,
    damageReceived: 0,
    powerUpsCollected: 0,
    durationSeconds: 0,
    perfectRounds: 0,
    roundWins: 0,
    roundLosses: 0,
  };

  // Keyboard input states
  public keys: Record<string, boolean> = {};

  // Virtual joystick vector (-1 to 1) from touch controls
  public joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  public touchAttackRequested: boolean = false;
  public touchDashRequested: boolean = false;
  public touchUltimateRequested: boolean = false;

  // Multiplayer State
  public isMultiplayer: boolean = false;
  public localRole: 'PLAYER_1' | 'PLAYER_2' = 'PLAYER_1';
  public localPlayerName: string = 'VEX';
  public remotePlayerName: string = 'NOVA';
  public multiplayerRoomCode: string = '';
  private netSyncTimer: number = 0;
  private netSeq: number = 0;
  private remoteTarget: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    walkCycle: number;
    isDashing: boolean;
  } | null = null;
  private pendingPowerUpCollects = new Set<string>();

  // Multiplayer Event Callbacks
  public onSendPlayerState?: (state: any) => void;
  public onSendPlayerAttack?: (attack: any) => void;
  public onSendPlayerDash?: (dx: number, dy: number) => void;
  public onSendPlayerUltimate?: (x: number, y: number) => void;
  public onSendDamage?: (targetRole: 'PLAYER_1' | 'PLAYER_2', damage: number, isCritical: boolean, source: string, newHp: number) => void;
  public onSendCollectPowerUp?: (powerUpId: string, role: 'PLAYER_1' | 'PLAYER_2') => void;

  // Callback to inform React UI of state changes
  public onStateChange?: (state: GameState) => void;

  public setJoystickVector(x: number, y: number) {
    this.joystickVector.x = x;
    this.joystickVector.y = y;
  }

  public triggerPlayerAttack() {
    this.touchAttackRequested = true;
  }

  public triggerPlayerDash() {
    this.touchDashRequested = true;
  }

  public triggerPlayerUltimate() {
    this.touchUltimateRequested = true;
  }

  constructor() {
    this.initEntities();
  }

  private initEntities() {
    this.vex = this.createDefaultMech('VEX', 180, ARENA_HEIGHT / 2, 0);
    this.nova = this.createDefaultMech('NOVA', ARENA_WIDTH - 180, ARENA_HEIGHT / 2, Math.PI);
    this.aiController = new MechAI(AI_DIFFICULTIES[this.difficulty]);
    this.setupArenaHazards();
  }

  private createDefaultMech(
    id: 'VEX' | 'NOVA',
    x: number,
    y: number,
    angle: number
  ): MechState {
    return {
      id,
      name: id,
      x,
      y,
      vx: 0,
      vy: 0,
      angle,
      radius: MECH_RADIUS,
      hp: BASE_HP,
      maxHp: BASE_HP,
      lives: MAX_LIVES,
      attackCooldown: 0,
      maxAttackCooldown: ATTACK_COOLDOWN,
      isAttacking: false,
      attackTimer: 0,
      attackRadius: ATTACK_REACH,
      attackArc: ATTACK_ARC,
      dashCooldown: 0,
      maxDashCooldown: DASH_COOLDOWN,
      isDashing: false,
      dashTimer: 0,
      dashDuration: DASH_DURATION,
      dashDirX: 1,
      dashDirY: 0,
      ultimateCooldown: 0,
      maxUltimateCooldown: 7.5,
      hitStunTimer: 0,
      invulnerableTimer: 0,
      isVictorious: false,
      isDefeated: false,
      walkCycle: 0,
      speedBoostTimer: 0,
      hasShield: false,
      hasPowerAttack: false,
    };
  }

  public startMatch(mode: GameMode, diff: DifficultyLevel = 'NORMAL', level: number = 1) {
    this.isMultiplayer = false;
    this.gameMode = mode;
    this.difficulty = diff;
    this.currentLevel = level;
    this.currentRound = 1;
    this.vexRoundsWon = 0;
    this.novaRoundsWon = 0;

    if (mode === 'CAMPAIGN') {
      const campConfig = CAMPAIGN_LEVELS[level - 1] || CAMPAIGN_LEVELS[0];
      this.difficulty = campConfig.difficulty;
      if (campConfig.isBoss) {
        this.nova.isBoss = true;
        this.nova.bossTier = campConfig.bossTier;
        this.nova.name = campConfig.bossName || 'NOVA';
      } else {
        this.nova.isBoss = false;
        this.nova.bossTier = undefined;
        this.nova.name = 'NOVA';
      }
    } else {
      this.nova.isBoss = false;
      this.nova.bossTier = undefined;
      this.nova.name = 'NOVA';
      if (mode === 'ENDLESS') {
        // Dynamic endless difficulty scaling
        this.difficulty = this.getEndlessDifficulty(level);
      }
    }

    const effectiveAiConfig = this.getEffectiveAIConfig();
    this.aiController.setConfig(effectiveAiConfig);
    this.nova.aiPersonality = effectiveAiConfig.personality;

    // Reset mechs
    this.vex.lives = MAX_LIVES;
    this.nova.lives = MAX_LIVES;
    this.resetRoundEntities();

    // Reset stats
    this.matchStats = {
      damageDealt: 0,
      damageReceived: 0,
      powerUpsCollected: 0,
      durationSeconds: 0,
      perfectRounds: 0,
      roundWins: 0,
      roundLosses: 0,
    };

    this.setupArenaHazards();
    this.startCountdown();
  }

  public startMultiplayerMatch(
    role: 'PLAYER_1' | 'PLAYER_2',
    localName: string,
    remoteName: string,
    roomCode: string
  ) {
    this.isMultiplayer = true;
    this.localRole = role;
    this.localPlayerName = localName;
    this.remotePlayerName = remoteName;
    this.multiplayerRoomCode = roomCode;
    this.gameMode = 'QUICK_DUEL';
    this.difficulty = 'NORMAL';
    this.currentLevel = 1;
    this.currentRound = 1;
    this.vexRoundsWon = 0;
    this.novaRoundsWon = 0;
    this.pendingPowerUpCollects.clear();
    this.remoteTarget = null;

    this.nova.isBoss = false;
    this.nova.bossTier = undefined;
    this.vex.name = role === 'PLAYER_1' ? localName : remoteName;
    this.nova.name = role === 'PLAYER_2' ? localName : remoteName;

    this.vex.lives = 2;
    this.nova.lives = 2;
    this.resetRoundEntities();

    this.matchStats = {
      damageDealt: 0,
      damageReceived: 0,
      powerUpsCollected: 0,
      durationSeconds: 0,
      perfectRounds: 0,
      roundWins: 0,
      roundLosses: 0,
    };

    this.setupArenaHazards();
    this.startCountdown();
  }

  public applyRemotePlayerState(role: 'PLAYER_1' | 'PLAYER_2', state: any) {
    if (!this.isMultiplayer) return;
    const remoteRole = this.localRole === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
    if (role !== remoteRole) return;

    this.remoteTarget = {
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      angle: state.angle,
      walkCycle: state.walkCycle,
      isDashing: state.isDashing,
    };
  }

  public applyRemoteAttack(attack: any) {
    if (!this.isMultiplayer) return;
    const remoteMech = this.localRole === 'PLAYER_1' ? this.nova : this.vex;
    remoteMech.isAttacking = true;
    remoteMech.attackTimer = ATTACK_DURATION;
    remoteMech.attackCooldown = ATTACK_COOLDOWN;
    remoteMech.hasPowerAttack = Boolean(attack.hasPowerAttack);
    soundManager.playAttack(remoteMech.hasPowerAttack);
  }

  public applyRemoteDash(role: 'PLAYER_1' | 'PLAYER_2', dx: number, dy: number) {
    if (!this.isMultiplayer) return;
    const remoteMech = this.localRole === 'PLAYER_1' ? this.nova : this.vex;
    remoteMech.isDashing = true;
    remoteMech.dashTimer = DASH_DURATION;
    remoteMech.dashCooldown = DASH_COOLDOWN;
    remoteMech.invulnerableTimer = DASH_INVULNERABLE_TIME;
    remoteMech.dashDirX = dx || Math.cos(remoteMech.angle);
    remoteMech.dashDirY = dy || Math.sin(remoteMech.angle);

    soundManager.playDash();
    this.triggerScreenShake(3);

    const color = remoteMech.id === 'VEX' ? '#38bdf8' : '#ef4444';
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: remoteMech.x - remoteMech.dashDirX * 16,
        y: remoteMech.y - remoteMech.dashDirY * 16,
        vx: -remoteMech.dashDirX * 120 + (Math.random() - 0.5) * 80,
        vy: -remoteMech.dashDirY * 120 + (Math.random() - 0.5) * 80,
        color,
        size: 3 + Math.random() * 3,
        alpha: 1,
        decay: 3.5,
        type: 'TRAIL',
      });
    }
  }

  public applyRemoteUltimate(_role: 'PLAYER_1' | 'PLAYER_2', x: number, y: number) {
    if (!this.isMultiplayer) return;
    const remoteMech = this.localRole === 'PLAYER_1' ? this.nova : this.vex;
    remoteMech.ultimateCooldown = remoteMech.maxUltimateCooldown;
    soundManager.playAttack(true);
    this.triggerScreenShake(7);

    const color = remoteMech.id === 'VEX' ? '#38bdf8' : '#f43f5e';
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 190,
        vy: Math.sin(angle) * 190,
        color,
        size: 4 + Math.random() * 3,
        alpha: 1,
        decay: 2.2,
        type: 'SHOCKWAVE',
      });
    }

    this.addFloatingText('ENERGY BURST!', x, y - 32, color, 1.3);
  }

  public applyRemoteDamage(
    targetRole: 'PLAYER_1' | 'PLAYER_2',
    damage: number,
    isCritical: boolean,
    _source: string,
    newHp: number
  ) {
    const targetMech = targetRole === 'PLAYER_1' ? this.vex : this.nova;
    targetMech.hp = Math.max(0, newHp);

    if (targetRole === this.localRole) {
      this.matchStats.damageReceived += damage;
    } else {
      this.matchStats.damageDealt += damage;
    }

    const intDmg = Math.round(damage);
    const color = targetMech.id === 'VEX' ? '#ef4444' : isCritical ? '#f59e0b' : '#38bdf8';
    this.addFloatingText(
      `-${intDmg}${isCritical ? ' CRIT!' : ''}`,
      targetMech.x,
      targetMech.y - 25,
      color,
      isCritical ? 1.4 : 1.0
    );

    targetMech.hitStunTimer = HIT_STUN_DURATION;
    targetMech.invulnerableTimer = INVULNERABLE_AFTER_HIT;
    soundManager.playHit(isCritical);
    this.triggerScreenShake(isCritical ? 8 : 4);

    // Hit sparks
    for (let i = 0; i < (isCritical ? 18 : 10); i++) {
      const sAngle = Math.random() * Math.PI * 2;
      const sSpeed = 60 + Math.random() * 140;
      this.particles.push({
        x: targetMech.x,
        y: targetMech.y,
        vx: Math.cos(sAngle) * sSpeed,
        vy: Math.sin(sAngle) * sSpeed,
        color: isCritical ? '#f59e0b' : '#ffffff',
        size: 2.5 + Math.random() * 2,
        alpha: 1,
        decay: 3.5,
        type: 'SPARK',
      });
    }
  }

  public applyRemotePowerUpSpawn(powerUp: any) {
    if (this.powerUps.some((p) => p.id === powerUp.id)) return;
    this.powerUps.push({
      id: powerUp.id,
      type: powerUp.type,
      x: powerUp.x,
      y: powerUp.y,
      radius: powerUp.radius || 16,
      spawnTime: Date.now(),
      duration: POWER_UP_DURATION,
    });
  }

  public applyRemotePowerUpCollected(powerUpId: string, collectorRole: 'PLAYER_1' | 'PLAYER_2') {
    const idx = this.powerUps.findIndex((p) => p.id === powerUpId);
    const collectorMech = collectorRole === 'PLAYER_1' ? this.vex : this.nova;
    let powerUpType: PowerUpType = 'SPEED_BOOST';

    if (idx !== -1) {
      powerUpType = this.powerUps[idx].type;
      this.powerUps.splice(idx, 1);
    }
    this.pendingPowerUpCollects.delete(powerUpId);

    this.collectPowerUp(collectorMech, {
      id: powerUpId,
      type: powerUpType,
      x: collectorMech.x,
      y: collectorMech.y,
      radius: 16,
      spawnTime: Date.now(),
      duration: POWER_UP_DURATION,
    });
  }

  public applyRemoteRoundFinished(
    round: number,
    winner: 'PLAYER_1' | 'PLAYER_2',
    p1RoundsWon: number,
    p2RoundsWon: number,
    _matchOver: boolean
  ) {
    this.gameState = 'ROUND_END';
    this.currentRound = round;
    this.roundWinner = winner === 'PLAYER_1' ? 'VEX' : 'NOVA';
    this.vexRoundsWon = p1RoundsWon;
    this.novaRoundsWon = p2RoundsWon;
    this.roundEndTimer = 3.0;

    const amWinner = winner === this.localRole;
    if (amWinner) {
      soundManager.playRoundWon();
      this.matchStats.roundWins++;
      this.addFloatingText('ROUND WON!', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#06b6d4', 1.8);
    } else {
      soundManager.playRoundLost();
      this.matchStats.roundLosses++;
      this.addFloatingText('ROUND LOST', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#ef4444', 1.8);
    }

    if (this.onStateChange) this.onStateChange(this.gameState);
  }

  public applyRemoteMatchFinished(
    winner: 'PLAYER_1' | 'PLAYER_2',
    p1RoundsWon: number,
    p2RoundsWon: number
  ) {
    this.vexRoundsWon = p1RoundsWon;
    this.novaRoundsWon = p2RoundsWon;
    const amWinner = winner === this.localRole;
    this.gameState = amWinner ? 'VICTORY' : 'DEFEAT';
    if (amWinner) {
      soundManager.playVictory();
    } else {
      soundManager.playDefeat();
    }
    if (this.onStateChange) this.onStateChange(this.gameState);
  }

  private getEndlessDifficulty(level: number): DifficultyLevel {
    if (level <= 2) return 'NORMAL';
    if (level <= 5) return 'MEDIUM';
    if (level <= 8) return 'HARD';
    if (level <= 12) return 'EXTREME_HARD';
    return 'HARDCORE';
  }

  private getEffectiveAIConfig(): AIDifficultyConfig {
    const base = { ...AI_DIFFICULTIES[this.difficulty] };

    if (this.gameMode === 'CAMPAIGN') {
      const campConfig = CAMPAIGN_LEVELS[this.currentLevel - 1];
      // Progressive scaling across the 50 levels (0.0 to 1.0)
      const progressRatio = Math.min(1.0, (this.currentLevel - 1) / 49);

      // Reaction delay drops smoothly as level advances (respecting human limits)
      base.reactionDelay = Math.max(0.045, base.reactionDelay - progressRatio * 0.12);

      // Trajectory prediction grows
      base.predictionStrength = Math.min(0.92, (base.predictionStrength || 0.1) + progressRatio * 0.35);

      // Power-up contest priority accelerates
      base.powerUpPriority = Math.min(0.98, (base.powerUpPriority || 0.4) + progressRatio * 0.28);

      // Hazard avoidance & spatial positioning
      base.hazardAwareness = Math.min(0.99, (base.hazardAwareness || 0.6) + progressRatio * 0.25);
      base.strafeTendency = Math.min(0.9, (base.strafeTendency || 0.3) + progressRatio * 0.25);

      // Counter-attack probability scaling
      base.counterProbability = Math.min(0.92, (base.counterProbability || 0.3) + progressRatio * 0.3);

      // Distinct AI Personalities across campaign chapters and bosses
      if (campConfig?.aiPersonality) {
        base.personality = campConfig.aiPersonality;
      } else if (campConfig?.isBoss) {
        if (campConfig.bossTier === 'FINAL_BOSS') {
          base.personality = 'APEX';
        } else if (campConfig.bossTier === 'MAJOR_BOSS') {
          base.personality = 'KITER';
        } else if (campConfig.level === 30) {
          base.personality = 'BRAWLER';
        } else if (campConfig.level === 20) {
          base.personality = 'FLANKER';
        } else {
          base.personality = 'BRAWLER';
        }
      } else {
        if (campConfig?.chapter === 1) {
          base.personality = 'BALANCED';
        } else if (campConfig?.chapter === 2) {
          base.personality = campConfig.level % 2 === 0 ? 'FLANKER' : 'BALANCED';
        } else if (campConfig?.chapter === 3) {
          base.personality = campConfig.level % 2 === 0 ? 'BRAWLER' : 'DEFENSIVE';
        } else if (campConfig?.chapter === 4) {
          base.personality = campConfig.level % 2 === 0 ? 'KITER' : 'FLANKER';
        } else {
          base.personality = campConfig?.level === 50 ? 'APEX' : (campConfig?.level % 2 === 0 ? 'BRAWLER' : 'DEFENSIVE');
        }
      }

      // Boss encounter specialized AI tuning
      if (campConfig?.isBoss) {
        base.moveSpeedMultiplier = Math.min(1.12, base.moveSpeedMultiplier + 0.05);
        base.dashProbability = Math.min(0.92, base.dashProbability + 0.12);
        base.powerUpPriority = Math.max(0.75, base.powerUpPriority + 0.15);
        base.dodgeProbability = Math.min(0.90, base.dodgeProbability + 0.1);
        base.attackProbability = Math.min(0.96, base.attackProbability + 0.08);
      }
    } else if (this.gameMode === 'ENDLESS' && this.currentLevel > 1) {
      // Smooth gradual enhancement
      const bonus = Math.min(0.2, (this.currentLevel - 1) * 0.015);
      base.moveSpeedMultiplier += bonus;
      base.predictionStrength = Math.min(0.92, (base.predictionStrength || 0.2) + bonus);

      // Cycle personalities in endless mode for variety
      const styles: ('BALANCED' | 'BRAWLER' | 'FLANKER' | 'KITER' | 'DEFENSIVE' | 'APEX')[] = [
        'BALANCED',
        'BRAWLER',
        'FLANKER',
        'KITER',
        'DEFENSIVE',
      ];
      base.personality = styles[(this.currentLevel - 1) % styles.length];
    }

    return base;
  }

  public setupArenaHazards() {
    let layout = 'STANDARD';
    let enableCollapse = false;
    let enableElectric = false;
    let enableBarriers = false;
    let barrierSpeed = 65;

    if (this.gameMode === 'CAMPAIGN') {
      const camp = CAMPAIGN_LEVELS[this.currentLevel - 1];
      if (camp) {
        layout = camp.arenaLayout || 'STANDARD';
        if (camp.hazardsEnabled) {
          enableCollapse = camp.hazardTypes.includes('COLLAPSE');
          enableElectric = camp.hazardTypes.includes('ELECTRIC');
          enableBarriers = camp.hazardTypes.includes('BARRIER');
        }
        // Barrier speed scales with chapter
        barrierSpeed = 50 + (camp.chapter - 1) * 14;
      }
    } else {
      // Quick duel or Endless
      if (this.difficulty !== 'NORMAL') {
        enableCollapse = true;
      }
      if (
        this.difficulty === 'HARD' ||
        this.difficulty === 'EXTREME_HARD' ||
        this.difficulty === 'HARDCORE'
      ) {
        enableElectric = true;
      }
      if (
        this.difficulty === 'EXTREME_HARD' ||
        this.difficulty === 'HARDCORE' ||
        (this.gameMode === 'ENDLESS' && this.currentLevel >= 6)
      ) {
        enableBarriers = true;
        barrierSpeed = 75;
      }
    }

    // Set obstacles based on layout
    switch (layout) {
      case 'PILLARS_4':
        this.obstacles = [
          { x: 230, y: ARENA_HEIGHT / 2 - 22, width: 44, height: 44, type: 'PILLAR' },
          { x: ARENA_WIDTH - 274, y: ARENA_HEIGHT / 2 - 22, width: 44, height: 44, type: 'PILLAR' },
          { x: ARENA_WIDTH / 2 - 22, y: 130, width: 44, height: 44, type: 'PILLAR' },
          { x: ARENA_WIDTH / 2 - 22, y: ARENA_HEIGHT - 174, width: 44, height: 44, type: 'PILLAR' },
        ];
        break;

      case 'CROSS_CORRIDOR':
        this.obstacles = [
          { x: 350, y: 100, width: 30, height: 150, type: 'TECH_BARRIER' },
          { x: 350, y: ARENA_HEIGHT - 250, width: 30, height: 150, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 380, y: 100, width: 30, height: 150, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 380, y: ARENA_HEIGHT - 250, width: 30, height: 150, type: 'TECH_BARRIER' },
        ];
        break;

      case 'FORTRESS':
        this.obstacles = [
          { x: 220, y: 120, width: 48, height: 48, type: 'PILLAR' },
          { x: ARENA_WIDTH - 268, y: 120, width: 48, height: 48, type: 'PILLAR' },
          { x: 220, y: ARENA_HEIGHT - 168, width: 48, height: 48, type: 'PILLAR' },
          { x: ARENA_WIDTH - 268, y: ARENA_HEIGHT - 168, width: 48, height: 48, type: 'PILLAR' },
          { x: ARENA_WIDTH / 2 - 22, y: ARENA_HEIGHT / 2 - 55, width: 44, height: 110, type: 'GENERATOR' },
        ];
        break;

      case 'TWIN_BUNKERS':
        this.obstacles = [
          { x: 310, y: ARENA_HEIGHT / 2 - 70, width: 42, height: 140, type: 'GENERATOR' },
          { x: ARENA_WIDTH - 352, y: ARENA_HEIGHT / 2 - 70, width: 42, height: 140, type: 'GENERATOR' },
        ];
        break;

      case 'OPEN_GAUNTLET':
        this.obstacles = [
          { x: 170, y: 120, width: 34, height: 34, type: 'PILLAR' },
          { x: ARENA_WIDTH - 204, y: ARENA_HEIGHT - 154, width: 34, height: 34, type: 'PILLAR' },
        ];
        break;

      case 'OCTAGON':
        this.obstacles = [
          { x: 160, y: 95, width: 70, height: 24, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 230, y: 95, width: 70, height: 24, type: 'TECH_BARRIER' },
          { x: 160, y: ARENA_HEIGHT - 119, width: 70, height: 24, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 230, y: ARENA_HEIGHT - 119, width: 70, height: 24, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH / 2 - 20, y: ARENA_HEIGHT / 2 - 20, width: 40, height: 40, type: 'PILLAR' },
        ];
        break;

      case 'PERIMETER_WALLS':
        this.obstacles = [
          { x: 260, y: 75, width: 130, height: 24, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 390, y: ARENA_HEIGHT - 99, width: 130, height: 24, type: 'TECH_BARRIER' },
          { x: 160, y: ARENA_HEIGHT / 2 - 50, width: 24, height: 100, type: 'TECH_BARRIER' },
          { x: ARENA_WIDTH - 184, y: ARENA_HEIGHT / 2 - 50, width: 24, height: 100, type: 'TECH_BARRIER' },
        ];
        break;

      case 'STANDARD':
      default:
        this.obstacles = [
          { x: 300, y: 150, width: 44, height: 44, type: 'PILLAR' },
          { x: ARENA_WIDTH - 344, y: 150, width: 44, height: 44, type: 'PILLAR' },
          { x: 300, y: ARENA_HEIGHT - 194, width: 44, height: 44, type: 'PILLAR' },
          { x: ARENA_WIDTH - 344, y: ARENA_HEIGHT - 194, width: 44, height: 44, type: 'PILLAR' },
        ];
        break;
    }

    this.hazards = [];
    this.collapsingPlatforms = [];
    this.barriers = [];

    if (enableCollapse) {
      // 2 collapsing tactical platforms
      this.collapsingPlatforms = [
        {
          id: 'plat_1',
          x: ARENA_WIDTH / 2 - 120,
          y: ARENA_HEIGHT / 2 - 40,
          width: 70,
          height: 80,
          state: 'SOLID',
          timer: 4.0,
          warningDuration: 2.2,
          collapsedDuration: 2.8,
          restoreDuration: 1.2,
        },
        {
          id: 'plat_2',
          x: ARENA_WIDTH / 2 + 50,
          y: ARENA_HEIGHT / 2 - 40,
          width: 70,
          height: 80,
          state: 'SOLID',
          timer: 6.5,
          warningDuration: 2.2,
          collapsedDuration: 2.8,
          restoreDuration: 1.2,
        },
      ];
    }

    if (enableElectric) {
      // 2 electric nodes near upper/lower center
      this.hazards = [
        {
          id: 'zap_top',
          x: ARENA_WIDTH / 2,
          y: 90,
          radius: 46,
          state: 'IDLE',
          timer: 3.5,
          warningDuration: 1.6,
          activeDuration: 1.8,
          cooldownDuration: 4.0,
        },
        {
          id: 'zap_bot',
          x: ARENA_WIDTH / 2,
          y: ARENA_HEIGHT - 90,
          radius: 46,
          state: 'IDLE',
          timer: 6.0,
          warningDuration: 1.6,
          activeDuration: 1.8,
          cooldownDuration: 4.0,
        },
      ];
    }

    if (enableBarriers) {
      // Moving energy laser barrier sweeping vertically
      this.barriers = [
        {
          id: 'bar_center',
          x1: ARENA_WIDTH / 2,
          y1: 180,
          x2: ARENA_WIDTH / 2,
          y2: ARENA_HEIGHT - 180,
          axis: 'X',
          minPos: ARENA_WIDTH / 2 - 90,
          maxPos: ARENA_WIDTH / 2 + 90,
          currentPos: ARENA_WIDTH / 2,
          speed: barrierSpeed,
          direction: 1,
          thickness: 5,
          damage: 12,
        },
      ];
    }
  }

  public resetRoundEntities() {
    // Reset positions
    this.vex.x = 180;
    this.vex.y = ARENA_HEIGHT / 2;
    this.vex.vx = 0;
    this.vex.vy = 0;
    this.vex.angle = 0;
    this.vex.hp = BASE_HP;
    this.vex.isAttacking = false;
    this.vex.attackTimer = 0;
    this.vex.attackCooldown = 0;
    this.vex.isDashing = false;
    this.vex.dashTimer = 0;
    this.vex.dashCooldown = 0;
    this.vex.hitStunTimer = 0;
    this.vex.invulnerableTimer = 0;
    this.vex.isDefeated = false;
    this.vex.isVictorious = false;
    this.vex.speedBoostTimer = 0;
    this.vex.hasShield = false;
    this.vex.hasPowerAttack = false;

    this.nova.x = ARENA_WIDTH - 180;
    this.nova.y = ARENA_HEIGHT / 2;
    this.nova.vx = 0;
    this.nova.vy = 0;
    this.nova.angle = Math.PI;
    this.nova.hp = BASE_HP;
    this.nova.isAttacking = false;
    this.nova.attackTimer = 0;
    this.nova.attackCooldown = 0;
    this.nova.isDashing = false;
    this.nova.dashTimer = 0;
    this.nova.dashCooldown = 0;
    this.nova.hitStunTimer = 0;
    this.nova.invulnerableTimer = 0;
    this.nova.isDefeated = false;
    this.nova.isVictorious = false;
    this.nova.speedBoostTimer = 0;
    this.nova.hasShield = false;
    this.nova.hasPowerAttack = false;

    this.powerUps = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerUpSpawnTimer = 6;
  }

  public startCountdown() {
    this.gameState = 'COUNTDOWN';
    this.countdownTimer = 3.2;
    this.countdownStep = 3;
    soundManager.playCountdown(3);
    if (this.onStateChange) this.onStateChange(this.gameState);
  }

  public update(dt: number) {
    if (this.gameState === 'PAUSED') return;

    // Decay screen shake
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 25);
      this.screenShake = {
        x: (Math.random() - 0.5) * this.shakeIntensity,
        y: (Math.random() - 0.5) * this.shakeIntensity,
      };
    } else {
      this.screenShake = { x: 0, y: 0 };
    }

    // Update particles & floating texts
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);

    // State branches
    if (this.gameState === 'COUNTDOWN') {
      this.updateCountdown(dt);
      return;
    }

    if (this.gameState === 'ROUND_END') {
      this.updateRoundEnd(dt);
      return;
    }

    if (this.gameState === 'BATTLE') {
      this.updateBattle(dt);
    }
  }

  private updateCountdown(dt: number) {
    this.countdownTimer -= dt;

    if (this.countdownTimer > 2.0 && this.countdownStep !== 3) {
      this.countdownStep = 3;
      soundManager.playCountdown(3);
    } else if (
      this.countdownTimer <= 2.0 &&
      this.countdownTimer > 1.0 &&
      this.countdownStep !== 2
    ) {
      this.countdownStep = 2;
      soundManager.playCountdown(2);
    } else if (
      this.countdownTimer <= 1.0 &&
      this.countdownTimer > 0.0 &&
      this.countdownStep !== 1
    ) {
      this.countdownStep = 1;
      soundManager.playCountdown(1);
    } else if (this.countdownTimer <= 0.0) {
      this.countdownStep = 0; // FIGHT!
      soundManager.playCountdown(0);
      this.gameState = 'BATTLE';
      if (this.onStateChange) this.onStateChange(this.gameState);
    }
  }

  private updateRoundEnd(dt: number) {
    this.roundEndTimer -= dt;
    if (this.roundEndTimer <= 0) {
      if (this.vex.lives <= 0) {
        // MATCH LOST
        this.gameState = 'DEFEAT';
        soundManager.playDefeat();
        this.saveHighScores();
        if (this.onStateChange) this.onStateChange(this.gameState);
      } else if (this.nova.lives <= 0) {
        // MATCH WON
        this.gameState = 'VICTORY';
        soundManager.playVictory();
        this.winStreak++;
        this.addScore(1000 + this.winStreak * 250);
        this.unlockProgression();
        this.saveHighScores();
        if (this.onStateChange) this.onStateChange(this.gameState);
      } else {
        // Next round in match!
        this.currentRound++;
        this.resetRoundEntities();
        this.startCountdown();
      }
    }
  }

  private updateBattle(dt: number) {
    this.matchStats.durationSeconds += dt;

    if (this.isMultiplayer) {
      // In multiplayer: Local player controls their assigned mech
      const localMech = this.localRole === 'PLAYER_1' ? this.vex : this.nova;
      this.processPlayerInputForMech(localMech, dt);

      // Periodically sync local mech state to opponent via WebSocket (~20Hz / 50ms)
      this.netSyncTimer += dt;
      if (this.netSyncTimer >= 0.05) {
        this.netSyncTimer = 0;
        this.netSeq++;
        if (this.onSendPlayerState) {
          this.onSendPlayerState({
            seq: this.netSeq,
            x: Math.round(localMech.x * 10) / 10,
            y: Math.round(localMech.y * 10) / 10,
            vx: Math.round(localMech.vx),
            vy: Math.round(localMech.vy),
            angle: Math.round(localMech.angle * 100) / 100,
            walkCycle: Math.round(localMech.walkCycle * 10) / 10,
            isDashing: localMech.isDashing,
            dashDirX: Math.round(localMech.dashDirX * 100) / 100,
            dashDirY: Math.round(localMech.dashDirY * 100) / 100,
          });
        }
      }
    } else {
      // 1. Process Player Input for VEX (Single Player)
      this.processPlayerInput(dt);

      // 2. Process AI Controller for NOVA
      this.processAIInput(dt);
    }

    // 3. Update Mech Physics & Cooldowns
    this.updateMech(this.vex, dt);
    this.updateMech(this.nova, dt);

    // 4. Resolve Mech-to-Mech Collision
    this.resolveMechCollision();

    // 5. Update Hazards (Platforms, Electric, Barriers)
    this.updateHazards(dt);

    // 6. Update Power-ups
    this.updatePowerUps(dt);

    // 7. Check Combat Hit Detection
    this.checkAttacks();

    // 8. Check Round Defeat Condition
    this.checkRoundDefeat();
  }

  private processPlayerInputForMech(mech: MechState, dt: number) {
    if (mech.hitStunTimer > 0 || mech.isDefeated) return;

    // Movement axes (Keyboard WASD/Arrows)
    let dx = 0;
    let dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    // Merge Virtual Joystick input if active
    const joyMag = Math.hypot(this.joystickVector.x, this.joystickVector.y);
    if (joyMag > 0.05) {
      dx += this.joystickVector.x;
      dy += this.joystickVector.y;
    }

    const mag = Math.hypot(dx, dy);
    if (mag > 0) {
      const scale = mag > 1 ? 1 / mag : 1;
      dx *= scale;
      dy *= scale;

      mech.angle = Math.atan2(dy, dx);
      mech.walkCycle += dt * 14;

      const speed = mech.speedBoostTimer > 0 ? SPEED_BOOST_SPEED : BASE_SPEED;
      mech.vx = dx * speed;
      mech.vy = dy * speed;
    } else {
      mech.vx = 0;
      mech.vy = 0;
    }

    // Attack Action
    if (this.keys['KeyF'] || this.touchAttackRequested) {
      this.triggerAttack(mech);
      this.touchAttackRequested = false;
    }

    // Dash Action
    if (this.keys['KeyG'] || this.touchDashRequested) {
      this.triggerDash(mech, dx, dy);
      this.touchDashRequested = false;
    }

    // Ultimate Action
    if (this.keys['Space'] || this.touchUltimateRequested) {
      this.triggerUltimate(mech);
      this.touchUltimateRequested = false;
    }
  }

  private processPlayerInput(dt: number) {
    this.processPlayerInputForMech(this.vex, dt);
  }

  private processAIInput(dt: number) {
    if (this.nova.hitStunTimer > 0 || this.nova.isDefeated) return;

    const action = this.aiController.update(
      dt,
      this.nova,
      this.vex,
      this.powerUps,
      this.obstacles,
      this.hazards,
      this.collapsingPlatforms,
      this.barriers
    );

    // AI Facing
    this.nova.angle = action.aimAngle;
    this.nova.aiBehaviorState = action.behaviorState;
    this.nova.aiPersonality = this.aiController.getPersonality();

    // AI Movement
    const speed =
      (this.nova.speedBoostTimer > 0 ? SPEED_BOOST_SPEED : BASE_SPEED) *
      this.getEffectiveAIConfig().moveSpeedMultiplier;

    if (action.moveDir.x !== 0 || action.moveDir.y !== 0) {
      this.nova.vx = action.moveDir.x * speed;
      this.nova.vy = action.moveDir.y * speed;
      this.nova.walkCycle += dt * 14;
    } else {
      this.nova.vx = 0;
      this.nova.vy = 0;
    }

    // AI Dash
    if (action.wantsDash) {
      this.triggerDash(this.nova, action.moveDir.x, action.moveDir.y);
      if (action.behaviorState === 'DODGE') {
        this.addFloatingText('EVADED!', this.nova.x, this.nova.y - 28, '#ec4899', 1.0);
      }
    }

    // AI Attack
    if (action.wantsAttack) {
      this.triggerAttack(this.nova);
    }
  }

  public triggerAttack(mech: MechState) {
    if (mech.attackCooldown > 0 || mech.isAttacking || mech.isDashing) return;

    mech.isAttacking = true;
    mech.attackTimer = ATTACK_DURATION;
    mech.attackCooldown = ATTACK_COOLDOWN;

    soundManager.playAttack(mech.hasPowerAttack);

    if (this.isMultiplayer && this.onSendPlayerAttack) {
      const isLocalMech = (this.localRole === 'PLAYER_1' && mech.id === 'VEX') ||
                          (this.localRole === 'PLAYER_2' && mech.id === 'NOVA');
      if (isLocalMech) {
        this.onSendPlayerAttack({
          id: 'atk_' + Date.now(),
          attackerId: this.localRole,
          type: 'SLASH',
          x: mech.x,
          y: mech.y,
          angle: mech.angle,
          hasPowerAttack: mech.hasPowerAttack,
          timestamp: Date.now(),
        });
      }
    }
  }

  public triggerDash(mech: MechState, inputDx: number, inputDy: number) {
    if (mech.dashCooldown > 0 || mech.isDashing) return;

    mech.isDashing = true;
    mech.dashTimer = DASH_DURATION;
    mech.dashCooldown = DASH_COOLDOWN;
    mech.invulnerableTimer = DASH_INVULNERABLE_TIME;

    // Use current input dir or facing direction
    if (inputDx !== 0 || inputDy !== 0) {
      mech.dashDirX = inputDx;
      mech.dashDirY = inputDy;
    } else {
      mech.dashDirX = Math.cos(mech.angle);
      mech.dashDirY = Math.sin(mech.angle);
    }

    soundManager.playDash();
    this.triggerScreenShake(3);

    // Spawn dash thruster particles
    const color = mech.id === 'VEX' ? '#38bdf8' : '#ef4444';
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: mech.x - mech.dashDirX * 16,
        y: mech.y - mech.dashDirY * 16,
        vx: -mech.dashDirX * 120 + (Math.random() - 0.5) * 80,
        vy: -mech.dashDirY * 120 + (Math.random() - 0.5) * 80,
        color,
        size: 3 + Math.random() * 3,
        alpha: 1,
        decay: 3.5,
        type: 'TRAIL',
      });
    }

    if (this.isMultiplayer && this.onSendPlayerDash) {
      const isLocalMech = (this.localRole === 'PLAYER_1' && mech.id === 'VEX') ||
                          (this.localRole === 'PLAYER_2' && mech.id === 'NOVA');
      if (isLocalMech) {
        this.onSendPlayerDash(inputDx, inputDy);
      }
    }
  }

  public triggerUltimate(mech: MechState) {
    if (mech.ultimateCooldown > 0 || mech.isDefeated || mech.hitStunTimer > 0) return;

    mech.ultimateCooldown = mech.maxUltimateCooldown;
    mech.invulnerableTimer = 0.35;
    soundManager.playAttack(true);
    this.triggerScreenShake(7);

    const opponent = mech.id === 'VEX' ? this.nova : this.vex;
    const dist = Math.hypot(opponent.x - mech.x, opponent.y - mech.y);
    const burstRadius = 120;

    // Visual shockwave particles
    const color = mech.id === 'VEX' ? '#38bdf8' : '#f43f5e';
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      this.particles.push({
        x: mech.x,
        y: mech.y,
        vx: Math.cos(angle) * 190,
        vy: Math.sin(angle) * 190,
        color,
        size: 4 + Math.random() * 3,
        alpha: 1,
        decay: 2.2,
        type: 'SHOCKWAVE',
      });
    }

    this.addFloatingText('ENERGY BURST!', mech.x, mech.y - 32, color, 1.3);

    if (this.isMultiplayer && this.onSendPlayerUltimate) {
      const isLocalMech = (this.localRole === 'PLAYER_1' && mech.id === 'VEX') ||
                          (this.localRole === 'PLAYER_2' && mech.id === 'NOVA');
      if (isLocalMech) {
        this.onSendPlayerUltimate(mech.x, mech.y);
      }
    }

    // Hit opponent if in blast radius
    if (dist <= burstRadius + opponent.radius && opponent.invulnerableTimer <= 0) {
      const dmg = 24;
      if (this.isMultiplayer) {
        const isLocal =
          (this.localRole === 'PLAYER_1' && mech.id === 'VEX') ||
          (this.localRole === 'PLAYER_2' && mech.id === 'NOVA');
        if (isLocal && this.onSendDamage) {
          const targetRole = this.localRole === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
          const newHp = Math.max(0, opponent.hp - dmg);
          this.onSendDamage(targetRole, dmg, true, 'BURST', newHp);
        }
      } else {
        this.applyDamage(opponent, dmg, true, mech.id);
        const pushAngle = Math.atan2(opponent.y - mech.y, opponent.x - mech.x);
        opponent.x += Math.cos(pushAngle) * 35;
        opponent.y += Math.sin(pushAngle) * 35;
        opponent.hitStunTimer = HIT_STUN_DURATION;
        opponent.invulnerableTimer = INVULNERABLE_AFTER_HIT;
        soundManager.playHit(true);
        if (mech.id === 'VEX') {
          this.matchStats.damageDealt += dmg;
          this.addScore(dmg * 12);
        }
      }
    }
  }

  private updateMech(mech: MechState, dt: number) {
    // Cooldown decays
    if (mech.attackCooldown > 0) mech.attackCooldown -= dt;
    if (mech.dashCooldown > 0) mech.dashCooldown -= dt;
    if (mech.ultimateCooldown > 0) mech.ultimateCooldown -= dt;
    if (mech.hitStunTimer > 0) mech.hitStunTimer -= dt;
    if (mech.invulnerableTimer > 0) mech.invulnerableTimer -= dt;
    if (mech.speedBoostTimer > 0) mech.speedBoostTimer -= dt;

    if (mech.isAttacking) {
      mech.attackTimer -= dt;
      if (mech.attackTimer <= 0) {
        mech.isAttacking = false;
      }
    }

    if (mech.isDashing) {
      mech.dashTimer -= dt;
      mech.vx = mech.dashDirX * DASH_SPEED;
      mech.vy = mech.dashDirY * DASH_SPEED;

      // Spawn motion ghost
      if (Math.random() > 0.4) {
        this.particles.push({
          x: mech.x,
          y: mech.y,
          vx: 0,
          vy: 0,
          color: mech.id === 'VEX' ? '#06b6d4' : '#ef4444',
          size: mech.radius * 0.85,
          alpha: 0.35,
          decay: 2.2,
          type: 'GLOW',
        });
      }

      if (mech.dashTimer <= 0) {
        mech.isDashing = false;
      }
    }

    // Apply movement
    if (this.isMultiplayer) {
      const isRemote =
        (this.localRole === 'PLAYER_1' && mech.id === 'NOVA') ||
        (this.localRole === 'PLAYER_2' && mech.id === 'VEX');

      if (isRemote && this.remoteTarget) {
        const dx = this.remoteTarget.x - mech.x;
        const dy = this.remoteTarget.y - mech.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 180) {
          // Snap if large desync
          mech.x = this.remoteTarget.x;
          mech.y = this.remoteTarget.y;
        } else {
          // Smooth exponential lerp
          mech.x += dx * Math.min(1, dt * 18);
          mech.y += dy * Math.min(1, dt * 18);
        }

        mech.vx = this.remoteTarget.vx;
        mech.vy = this.remoteTarget.vy;
        mech.angle = this.remoteTarget.angle;
        mech.walkCycle = this.remoteTarget.walkCycle;
        mech.isDashing = this.remoteTarget.isDashing;
      } else {
        mech.x += mech.vx * dt;
        mech.y += mech.vy * dt;
      }
    } else {
      mech.x += mech.vx * dt;
      mech.y += mech.vy * dt;
    }

    // Obstacle collisions
    this.resolveObstacleCollision(mech);

    // Arena boundary containment
    const r = mech.radius;
    if (mech.x < r + 10) mech.x = r + 10;
    if (mech.x > ARENA_WIDTH - r - 10) mech.x = ARENA_WIDTH - r - 10;
    if (mech.y < r + 10) mech.y = r + 10;
    if (mech.y > ARENA_HEIGHT - r - 10) mech.y = ARENA_HEIGHT - r - 10;
  }

  private resolveObstacleCollision(mech: MechState) {
    for (const obs of this.obstacles) {
      // Find closest point on rectangle to circle
      const closestX = Math.max(obs.x, Math.min(mech.x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(mech.y, obs.y + obs.height));

      const dx = mech.x - closestX;
      const dy = mech.y - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist < mech.radius && dist > 0.0001) {
        const overlap = mech.radius - dist;
        mech.x += (dx / dist) * overlap;
        mech.y += (dy / dist) * overlap;
      }
    }
  }

  private resolveMechCollision() {
    const dx = this.nova.x - this.vex.x;
    const dy = this.nova.y - this.vex.y;
    const dist = Math.hypot(dx, dy);
    const minDist = this.vex.radius + this.nova.radius;

    if (dist < minDist && dist > 0.0001) {
      const overlap = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;

      this.vex.x -= nx * overlap;
      this.vex.y -= ny * overlap;
      this.nova.x += nx * overlap;
      this.nova.y += ny * overlap;
    }
  }

  private updateHazards(dt: number) {
    // 1. Collapsing Platforms
    for (const plat of this.collapsingPlatforms) {
      plat.timer -= dt;
      if (plat.state === 'SOLID' && plat.timer <= 0) {
        plat.state = 'WARNING';
        plat.timer = plat.warningDuration;
        soundManager.playPlatformWarning();
      } else if (plat.state === 'WARNING' && plat.timer <= 0) {
        plat.state = 'COLLAPSED';
        plat.timer = plat.collapsedDuration;
        this.triggerScreenShake(4);
      } else if (plat.state === 'COLLAPSED') {
        // Void damage to any mech standing on it!
        this.checkVoidDamage(plat, this.vex, dt);
        this.checkVoidDamage(plat, this.nova, dt);

        if (plat.timer <= 0) {
          plat.state = 'RESTORING';
          plat.timer = plat.restoreDuration;
        }
      } else if (plat.state === 'RESTORING' && plat.timer <= 0) {
        plat.state = 'SOLID';
        plat.timer = 5.0 + Math.random() * 4.0;
      }
    }

    // 2. Electric Nodes
    for (const node of this.hazards) {
      node.timer -= dt;
      if (node.state === 'IDLE' && node.timer <= 0) {
        node.state = 'WARNING';
        node.timer = node.warningDuration;
      } else if (node.state === 'WARNING' && node.timer <= 0) {
        node.state = 'ACTIVE';
        node.timer = node.activeDuration;
        soundManager.playHazardZap();
        this.triggerScreenShake(4);
      } else if (node.state === 'ACTIVE') {
        // Zap check
        this.checkElectricZap(node, this.vex);
        this.checkElectricZap(node, this.nova);

        if (node.timer <= 0) {
          node.state = 'IDLE';
          node.timer = node.cooldownDuration;
        }
      }
    }

    // 3. Moving Barriers
    for (const bar of this.barriers) {
      bar.currentPos += bar.speed * bar.direction * dt;
      if (bar.currentPos > bar.maxPos) {
        bar.currentPos = bar.maxPos;
        bar.direction = -1;
      } else if (bar.currentPos < bar.minPos) {
        bar.currentPos = bar.minPos;
        bar.direction = 1;
      }

      this.checkBarrierCollision(bar, this.vex);
      this.checkBarrierCollision(bar, this.nova);
    }
  }

  private checkVoidDamage(plat: CollapsingPlatform, mech: MechState, dt: number) {
    if (
      mech.x >= plat.x &&
      mech.x <= plat.x + plat.width &&
      mech.y >= plat.y &&
      mech.y <= plat.y + plat.height
    ) {
      const dmg = 22 * dt;
      this.applyDamage(mech, dmg, false, 'VOID HAZARD');
      this.triggerScreenShake(2);
    }
  }

  private checkElectricZap(node: HazardNode, mech: MechState) {
    if (mech.invulnerableTimer > 0) return;
    const dist = Math.hypot(mech.x - node.x, mech.y - node.y);
    if (dist < node.radius + mech.radius) {
      // Zap hit
      const pushX = (mech.x - node.x) / (dist || 1);
      const pushY = (mech.y - node.y) / (dist || 1);
      mech.x += pushX * 25;
      mech.y += pushY * 25;
      this.applyDamage(mech, 14, false, 'ELECTRIC ZAP');
      soundManager.playHazardZap();
      this.triggerScreenShake(6);
    }
  }

  private checkBarrierCollision(bar: MovingBarrier, mech: MechState) {
    if (mech.invulnerableTimer > 0) return;
    if (bar.axis === 'X') {
      if (
        Math.abs(mech.x - bar.currentPos) < mech.radius + bar.thickness &&
        mech.y >= bar.y1 &&
        mech.y <= bar.y2
      ) {
        const pushDir = mech.x > bar.currentPos ? 1 : -1;
        mech.x += pushDir * 20;
        this.applyDamage(mech, bar.damage, false, 'PLASMA BARRIER');
      }
    }
  }

  private updatePowerUps(dt: number) {
    if (this.isMultiplayer) {
      // In multiplayer, the server manages spawn intervals
      // Local client checks collision and sends collect event
      const localMech = this.localRole === 'PLAYER_1' ? this.vex : this.nova;
      for (const p of this.powerUps) {
        if (this.pendingPowerUpCollects.has(p.id)) continue;
        if (Math.hypot(localMech.x - p.x, localMech.y - p.y) < localMech.radius + p.radius) {
          this.pendingPowerUpCollects.add(p.id);
          if (this.onSendCollectPowerUp) {
            this.onSendCollectPowerUp(p.id, this.localRole);
          }
        }
      }
      return;
    }

    this.powerUpSpawnTimer -= dt;
    if (this.powerUpSpawnTimer <= 0 && this.powerUps.length < 2) {
      this.spawnRandomPowerUp();
      this.powerUpSpawnTimer = 10 + Math.random() * 6;
    }

    // Check collection
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.duration -= dt;
      if (p.duration <= 0) {
        this.powerUps.splice(i, 1);
        continue;
      }

      if (Math.hypot(this.vex.x - p.x, this.vex.y - p.y) < this.vex.radius + p.radius) {
        this.collectPowerUp(this.vex, p);
        this.powerUps.splice(i, 1);
        continue;
      }

      if (Math.hypot(this.nova.x - p.x, this.nova.y - p.y) < this.nova.radius + p.radius) {
        this.collectPowerUp(this.nova, p);
        this.powerUps.splice(i, 1);
        continue;
      }
    }
  }

  private spawnRandomPowerUp() {
    const types: PowerUpType[] = [
      'SPEED_BOOST',
      'SHIELD',
      'POWER_ATTACK',
      'HEAL',
      'ENERGY',
    ];
    const type = types[Math.floor(Math.random() * types.length)];

    // Pick random location away from obstacles
    let px = 150 + Math.random() * (ARENA_WIDTH - 300);
    let py = 120 + Math.random() * (ARENA_HEIGHT - 240);

    this.powerUps.push({
      id: 'pow_' + Date.now(),
      type,
      x: px,
      y: py,
      radius: 16,
      spawnTime: Date.now(),
      duration: POWER_UP_DURATION,
    });
  }

  private collectPowerUp(mech: MechState, powerUp: PowerUp) {
    soundManager.playPowerUp();
    const isVex = mech.id === 'VEX';

    if (isVex) {
      this.matchStats.powerUpsCollected++;
      this.addScore(150);
    }

    let text = '';
    let color = '#06b6d4';

    switch (powerUp.type) {
      case 'SPEED_BOOST':
        mech.speedBoostTimer = SPEED_BOOST_DURATION;
        text = '+SPEED BOOST!';
        color = '#06b6d4';
        break;
      case 'SHIELD':
        mech.hasShield = true;
        text = '+SHIELD READY!';
        color = '#3b82f6';
        break;
      case 'POWER_ATTACK':
        mech.hasPowerAttack = true;
        text = '+POWER CHARGED!';
        color = '#ef4444';
        break;
      case 'HEAL':
        mech.hp = Math.min(BASE_HP, mech.hp + 30);
        text = '+30 HP REPAIRED!';
        color = '#10b981';
        break;
      case 'ENERGY':
        mech.dashCooldown = 0;
        text = '+DASH RECHARGED!';
        color = '#f59e0b';
        break;
    }

    this.addFloatingText(text, mech.x, mech.y - 28, color, 1.2);

    // Particle burst
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      this.particles.push({
        x: mech.x,
        y: mech.y,
        vx: Math.cos(angle) * 90,
        vy: Math.sin(angle) * 90,
        color,
        size: 3,
        alpha: 1,
        decay: 2.5,
        type: 'SPARK',
      });
    }
  }

  private checkAttacks() {
    if (this.isMultiplayer) {
      if (this.localRole === 'PLAYER_1') {
        if (this.vex.isAttacking && this.vex.attackTimer > 0.08) {
          this.evaluateHit(this.vex, this.nova);
        }
      } else {
        if (this.nova.isAttacking && this.nova.attackTimer > 0.08) {
          this.evaluateHit(this.nova, this.vex);
        }
      }
      return;
    }

    // VEX attacking NOVA
    if (this.vex.isAttacking && this.vex.attackTimer > 0.08) {
      this.evaluateHit(this.vex, this.nova);
    }
    // NOVA attacking VEX
    if (this.nova.isAttacking && this.nova.attackTimer > 0.08) {
      this.evaluateHit(this.nova, this.vex);
    }
  }

  private evaluateHit(attacker: MechState, defender: MechState) {
    if (defender.invulnerableTimer > 0 || defender.hitStunTimer > 0) return;

    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    const dist = Math.hypot(dx, dy);

    // Distance check
    if (dist > attacker.attackRadius + defender.radius) return;

    // Angle check (within attackArc centered on facing direction)
    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = Math.abs(angleToTarget - attacker.angle);
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    angleDiff = Math.abs(angleDiff);

    if (angleDiff <= attacker.attackArc / 2) {
      // HIT LANDED!
      const isCritical = attacker.hasPowerAttack;
      const damage = isCritical ? POWER_ATTACK_DAMAGE : BASE_ATTACK_DAMAGE;

      // Consume power attack buff
      attacker.hasPowerAttack = false;

      // Check Shield on defender
      if (defender.hasShield) {
        defender.hasShield = false;
        defender.invulnerableTimer = 0.25;
        soundManager.playShieldBlock();
        this.addFloatingText('SHIELD BLOCKED!', defender.x, defender.y - 30, '#38bdf8', 1.2);
        this.triggerScreenShake(4);
        return;
      }

      if (this.isMultiplayer) {
        const targetRole = this.localRole === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
        const newHp = Math.max(0, defender.hp - damage);
        if (this.onSendDamage) {
          this.onSendDamage(targetRole, damage, isCritical, attacker.id, newHp);
        }
      } else {
        // Apply damage locally in single player
        this.applyDamage(defender, damage, isCritical, attacker.id);
      }

      // Knockback impulse
      const knockSpeed = isCritical ? 260 : 180;
      defender.x += Math.cos(attacker.angle) * 24;
      defender.y += Math.sin(attacker.angle) * 24;
      defender.hitStunTimer = HIT_STUN_DURATION;
      defender.invulnerableTimer = INVULNERABLE_AFTER_HIT;

      // Audio & Shake
      soundManager.playHit(isCritical);
      this.triggerScreenShake(isCritical ? 9 : 5);

      // Score bonus if player hit AI
      if (!this.isMultiplayer) {
        if (attacker.id === 'VEX') {
          this.matchStats.damageDealt += damage;
          this.addScore(damage * 10 + (isCritical ? 100 : 0));
        } else {
          this.matchStats.damageReceived += damage;
          if (attacker.aiBehaviorState === 'COUNTER') {
            this.addFloatingText('COUNTER-STRIKE!', attacker.x, attacker.y - 30, '#f97316', 1.25);
          }
        }
      }

      // Hit sparks
      const sparkColor = isCritical ? '#f59e0b' : '#ffffff';
      for (let i = 0; i < (isCritical ? 20 : 12); i++) {
        const sAngle = Math.random() * Math.PI * 2;
        const sSpeed = 60 + Math.random() * 140;
        this.particles.push({
          x: defender.x,
          y: defender.y,
          vx: Math.cos(sAngle) * sSpeed,
          vy: Math.sin(sAngle) * sSpeed,
          color: sparkColor,
          size: 2.5 + Math.random() * 2,
          alpha: 1,
          decay: 3.5,
          type: 'SPARK',
        });
      }
    }
  }

  private applyDamage(
    mech: MechState,
    amount: number,
    critical: boolean,
    source: string
  ) {
    mech.hp = Math.max(0, mech.hp - amount);
    const intDamage = Math.round(amount);

    if (mech.id === 'VEX') {
      this.addFloatingText(
        `-${intDamage}`,
        mech.x,
        mech.y - 25,
        '#ef4444',
        critical ? 1.4 : 1.0
      );
    } else {
      this.addFloatingText(
        `-${intDamage}${critical ? ' CRIT!' : ''}`,
        mech.x,
        mech.y - 25,
        critical ? '#f59e0b' : '#38bdf8',
        critical ? 1.4 : 1.0
      );
    }
  }

  private checkRoundDefeat() {
    if (this.isMultiplayer) return;

    if (this.vex.hp <= 0 && !this.vex.isDefeated) {
      this.resolveRoundDefeat('VEX');
    } else if (this.nova.hp <= 0 && !this.nova.isDefeated) {
      this.resolveRoundDefeat('NOVA');
    }
  }

  private resolveRoundDefeat(defeatedId: 'VEX' | 'NOVA') {
    this.gameState = 'ROUND_END';
    this.roundEndTimer = 2.0;

    if (defeatedId === 'VEX') {
      this.vex.isDefeated = true;
      this.vex.lives = Math.max(0, this.vex.lives - 1);
      this.roundWinner = 'NOVA';
      this.novaRoundsWon++;
      this.matchStats.roundLosses++;
      soundManager.playRoundLost();
      this.triggerScreenShake(12);
      this.addFloatingText('ROUND LOST', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#ef4444', 1.8);
    } else {
      this.nova.isDefeated = true;
      this.nova.lives = Math.max(0, this.nova.lives - 1);
      this.roundWinner = 'VEX';
      this.vexRoundsWon++;
      this.matchStats.roundWins++;
      if (this.vex.hp === BASE_HP) {
        this.matchStats.perfectRounds++;
        this.addScore(500); // Perfect round bonus
      }
      soundManager.playRoundWon();
      this.triggerScreenShake(12);
      this.addScore(500);
      this.addFloatingText('ROUND WON!', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#06b6d4', 1.8);
    }

    // Explosion shockwave & sparks
    const targetMech = defeatedId === 'VEX' ? this.vex : this.nova;
    this.particles.push({
      x: targetMech.x,
      y: targetMech.y,
      vx: 0,
      vy: 0,
      color: defeatedId === 'VEX' ? '#06b6d4' : '#ef4444',
      size: 10,
      alpha: 1,
      decay: 1.5,
      type: 'SHOCKWAVE',
    });

    for (let i = 0; i < 35; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 200;
      this.particles.push({
        x: targetMech.x,
        y: targetMech.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444',
        size: 3 + Math.random() * 3,
        alpha: 1,
        decay: 2.0,
        type: 'SPARK',
      });
    }

    if (this.onStateChange) this.onStateChange(this.gameState);
  }

  private addScore(points: number) {
    this.score += points;
  }

  private triggerScreenShake(intensity: number) {
    this.shakeIntensity = Math.min(18, this.shakeIntensity + intensity);
  }

  private addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string,
    scale: number = 1.0
  ) {
    this.floatingTexts.push({
      id: 'txt_' + Math.random(),
      text,
      x,
      y,
      color,
      alpha: 1.0,
      scale,
      vy: -35,
      life: 1.2,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'SHOCKWAVE') {
        p.size += dt * 180;
      }
      p.alpha -= dt * p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / 1.2);
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public pause() {
    if (this.gameState === 'BATTLE') {
      this.gameState = 'PAUSED';
      if (this.onStateChange) this.onStateChange(this.gameState);
    }
  }

  public resume() {
    if (this.gameState === 'PAUSED') {
      this.gameState = 'BATTLE';
      if (this.onStateChange) this.onStateChange(this.gameState);
    }
  }

  private unlockProgression() {
    if (this.gameMode === 'CAMPAIGN') {
      const nextLvl = this.currentLevel + 1;
      try {
        const saved = parseInt(
          localStorage.getItem('mecha_clash_campaign_unlocked') || '1',
          10
        );
        if (nextLvl > saved) {
          localStorage.setItem(
            'mecha_clash_campaign_unlocked',
            String(nextLvl)
          );
        }
      } catch {
        // ignore
      }
    } else if (this.gameMode === 'ENDLESS') {
      try {
        const savedBestEndless = parseInt(
          localStorage.getItem('mecha_clash_best_endless_level') || '1',
          10
        );
        if (this.currentLevel > savedBestEndless) {
          localStorage.setItem(
            'mecha_clash_best_endless_level',
            String(this.currentLevel)
          );
        }
      } catch {
        // ignore
      }
    }
  }

  private saveHighScores() {
    try {
      const savedBestScore = parseInt(
        localStorage.getItem('mecha_clash_best_score') || '0',
        10
      );
      if (this.score > savedBestScore) {
        localStorage.setItem('mecha_clash_best_score', String(this.score));
      }
    } catch {
      // ignore
    }
  }
}
