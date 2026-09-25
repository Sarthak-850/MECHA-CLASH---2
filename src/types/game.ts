/**
 * Mecha Clash - Core Game Types
 */

export type GameMode = 'QUICK_DUEL' | 'CAMPAIGN' | 'ENDLESS' | 'MULTIPLAYER';

export type DifficultyLevel =
  | 'NORMAL'
  | 'MEDIUM'
  | 'HARD'
  | 'EXTREME_HARD'
  | 'HARDCORE';

export type GameState =
  | 'MENU'
  | 'MODE_SELECT'
  | 'DIFFICULTY_SELECT'
  | 'CAMPAIGN_SELECT'
  | 'HOW_TO_PLAY'
  | 'MULTIPLAYER_LOBBY'
  | 'COUNTDOWN'
  | 'BATTLE'
  | 'ROUND_END'
  | 'VICTORY'
  | 'DEFEAT'
  | 'PAUSED';

export type PowerUpType =
  | 'SPEED_BOOST'
  | 'SHIELD'
  | 'POWER_ATTACK'
  | 'HEAL'
  | 'ENERGY';

export interface PowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  radius: number;
  spawnTime: number;
  duration: number; // Duration in arena before despawning if uncollected
}

export interface HazardNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  state: 'IDLE' | 'WARNING' | 'ACTIVE';
  timer: number;
  warningDuration: number;
  activeDuration: number;
  cooldownDuration: number;
}

export interface CollapsingPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'SOLID' | 'WARNING' | 'COLLAPSED' | 'RESTORING';
  timer: number;
  warningDuration: number;
  collapsedDuration: number;
  restoreDuration: number;
}

export interface MovingBarrier {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: 'X' | 'Y';
  minPos: number;
  maxPos: number;
  currentPos: number;
  speed: number;
  direction: 1 | -1;
  thickness: number;
  damage: number;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'PILLAR' | 'TECH_BARRIER' | 'GENERATOR';
}

export type BossTier = 'MINI_BOSS' | 'BOSS' | 'MAJOR_BOSS' | 'FINAL_BOSS';

export type AIPersonality =
  | 'BALANCED'
  | 'BRAWLER'
  | 'FLANKER'
  | 'KITER'
  | 'DEFENSIVE'
  | 'APEX';

export type AIBehaviorState =
  | 'APPROACH'
  | 'ATTACK'
  | 'RETREAT'
  | 'DODGE'
  | 'DASH'
  | 'COUNTER'
  | 'COLLECT_POWERUP'
  | 'DEFEND'
  | 'WAIT'
  | 'REPOSITION';

export interface MechState {
  id: 'VEX' | 'NOVA';
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Angle mech is facing in radians
  radius: number;
  hp: number;
  maxHp: number;
  lives: number;

  // Boss state
  isBoss?: boolean;
  bossTier?: BossTier;
  bossTitle?: string;

  // AI Tactical state (for AI-controlled mechs)
  aiBehaviorState?: AIBehaviorState;
  aiPersonality?: AIPersonality;

  // Attack state
  attackCooldown: number;
  maxAttackCooldown: number;
  isAttacking: boolean;
  attackTimer: number;
  attackRadius: number;
  attackArc: number; // radians

  // Dash state
  dashCooldown: number;
  maxDashCooldown: number;
  isDashing: boolean;
  dashTimer: number;
  dashDuration: number;
  dashDirX: number;
  dashDirY: number;

  // Ultimate ability state
  ultimateCooldown: number;
  maxUltimateCooldown: number;

  // Visual & feedback
  hitStunTimer: number;
  invulnerableTimer: number;
  isVictorious: boolean;
  isDefeated: boolean;
  walkCycle: number;

  // Active Power-up Buffs
  speedBoostTimer: number;
  hasShield: boolean;
  hasPowerAttack: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  type?: 'SPARK' | 'TRAIL' | 'SMOKE' | 'SHOCKWAVE' | 'ELECTRIC' | 'GLOW';
  maxLife?: number;
  life?: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
  life: number;
}

export interface AIDifficultyConfig {
  reactionDelay: number; // seconds (0.4s to 0.04s)
  moveSpeedMultiplier: number;
  attackRange: number;
  attackProbability: number;
  dodgeProbability: number;
  dashProbability: number;
  counterProbability?: number; // 0 to 1
  powerUpPriority: number; // 0 to 1
  predictionStrength: number; // 0 to 1
  hazardAwareness: number; // 0 to 1
  retreatThreshold: number; // HP threshold
  strafeTendency: number;
  personality?: AIPersonality;
  repositionChance?: number;
  feintChance?: number;
  description: string;
}

export type ArenaColorTheme =
  | 'CYAN_MATRIX'
  | 'NEON_PURPLE'
  | 'CRIMSON_FORGE'
  | 'EMERALD_NEXUS'
  | 'GOLD_CORE'
  | 'OBSIDIAN_VOID';

export type ArenaLayoutType =
  | 'STANDARD'
  | 'PILLARS_4'
  | 'CROSS_CORRIDOR'
  | 'FORTRESS'
  | 'TWIN_BUNKERS'
  | 'OPEN_GAUNTLET'
  | 'OCTAGON'
  | 'PERIMETER_WALLS';

export interface CampaignChapter {
  id: number;
  title: string;
  subtitle: string;
  levelRange: [number, number];
  theme: ArenaColorTheme;
  description: string;
}

export interface CampaignLevelConfig {
  level: number;
  chapter: number;
  chapterTitle: string;
  title: string;
  subtitle: string;
  difficulty: DifficultyLevel;
  isBoss?: boolean;
  bossTier?: BossTier;
  bossName?: string;
  hazardsEnabled: boolean;
  hazardTypes: ('ELECTRIC' | 'COLLAPSE' | 'BARRIER')[];
  arenaColorTheme: ArenaColorTheme;
  arenaLayout: ArenaLayoutType;
  briefing: string;
  aiPersonality?: AIPersonality;
}

export interface MatchStats {
  damageDealt: number;
  damageReceived: number;
  powerUpsCollected: number;
  durationSeconds: number;
  perfectRounds: number;
  roundWins: number;
  roundLosses: number;
}

export interface GameScoreState {
  currentScore: number;
  currentStreak: number;
  bestScore: number;
  bestEndlessLevel: number;
  campaignUnlockedLevel: number;
}
