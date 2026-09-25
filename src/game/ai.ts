import {
  AIBehaviorState,
  AIDifficultyConfig,
  AIPersonality,
  CollapsingPlatform,
  HazardNode,
  MechState,
  MovingBarrier,
  Obstacle,
  PowerUp,
} from '../types/game';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ATTACK_COOLDOWN,
  ATTACK_REACH,
  DASH_COOLDOWN,
  MECH_RADIUS,
} from './constants';

export interface AIAction {
  moveDir: { x: number; y: number };
  aimAngle: number;
  wantsAttack: boolean;
  wantsDash: boolean;
  behaviorState: AIBehaviorState;
}

interface PerceivedTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isAttacking: boolean;
  isDashing: boolean;
  hp: number;
}

export class MechAI {
  private config: AIDifficultyConfig;
  private currentPersonality: AIPersonality = 'BALANCED';

  // State machine timers & memory
  private currentBehavior: AIBehaviorState = 'APPROACH';
  private behaviorLockTimer: number = 0;
  private reactionTimer: number = 0;
  private strafeDir: number = 1;
  private strafeSwitchTimer: number = 1.5;
  private feintWaitTimer: number = 0;
  private postAttackDisengageTimer: number = 0;
  private counterWindowTimer: number = 0;
  private recentDodgeTimer: number = 0;

  // Smoothed outputs
  private currentMoveDir: { x: number; y: number } = { x: 0, y: 0 };
  private currentAimAngle: number = 0;
  private wantsAttack: boolean = false;
  private wantsDash: boolean = false;

  // Humanized perception (not instant frame-0 omniscience)
  private perceivedTarget: PerceivedTarget = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isAttacking: false,
    isDashing: false,
    hp: 100,
  };
  private lastObservedPlayerAttacking: boolean = false;
  private playerAttackDetected: boolean = false;

  constructor(config: AIDifficultyConfig) {
    this.config = config;
    this.currentPersonality = config.personality || 'BALANCED';
  }

  public setConfig(config: AIDifficultyConfig) {
    this.config = config;
    if (config.personality) {
      this.currentPersonality = config.personality;
    }
  }

  public getPersonality(): AIPersonality {
    return this.currentPersonality;
  }

  public getBehaviorState(): AIBehaviorState {
    return this.currentBehavior;
  }

  /**
   * Main AI Update Loop - Called once per physics frame (dt)
   */
  public update(
    dt: number,
    self: MechState,
    target: MechState,
    powerUps: PowerUp[],
    obstacles: Obstacle[],
    hazards: HazardNode[],
    collapsingPlatforms: CollapsingPlatform[],
    barriers: MovingBarrier[]
  ): AIAction {
    // 1. Decrement state machine & tactical timers
    this.reactionTimer -= dt;
    this.strafeSwitchTimer -= dt;
    if (this.behaviorLockTimer > 0) this.behaviorLockTimer -= dt;
    if (this.feintWaitTimer > 0) this.feintWaitTimer -= dt;
    if (this.postAttackDisengageTimer > 0) this.postAttackDisengageTimer -= dt;
    if (this.counterWindowTimer > 0) this.counterWindowTimer -= dt;
    if (this.recentDodgeTimer > 0) this.recentDodgeTimer -= dt;

    // Strafe rhythm switch
    if (this.strafeSwitchTimer <= 0) {
      this.strafeDir = Math.random() > 0.5 ? 1 : -1;
      this.strafeSwitchTimer = 0.8 + Math.random() * 1.4;
    }

    // Detect player attack start (trigger immediate reaction evaluation)
    if (target.isAttacking && !this.lastObservedPlayerAttacking) {
      this.playerAttackDetected = true;
    }
    this.lastObservedPlayerAttacking = target.isAttacking;

    // Reset single-frame action flags
    this.wantsAttack = false;
    this.wantsDash = false;

    // 2. Humanized Perception Update
    // Perception updates on reaction tick or when attack is newly detected with reaction delay
    if (this.reactionTimer <= 0 || (this.playerAttackDetected && this.reactionTimer <= this.config.reactionDelay * 0.5)) {
      this.updatePerception(target);
      this.reactionTimer = this.config.reactionDelay * (0.85 + Math.random() * 0.3);
      this.playerAttackDetected = false;

      // 3. Make high-level tactical decision
      this.evaluateTactics(
        self,
        powerUps,
        obstacles,
        hazards,
        collapsingPlatforms,
        barriers
      );
    }

    // 4. Execute current behavior and compute physical steering forces
    this.executeBehavior(
      dt,
      self,
      obstacles,
      hazards,
      collapsingPlatforms,
      barriers,
      powerUps
    );

    return {
      moveDir: this.currentMoveDir,
      aimAngle: this.currentAimAngle,
      wantsAttack: this.wantsAttack,
      wantsDash: this.wantsDash,
      behaviorState: this.currentBehavior,
    };
  }

  /**
   * Updates AI's perceived model of the player with realistic human latency & prediction
   */
  private updatePerception(target: MechState) {
    this.perceivedTarget.x = target.x;
    this.perceivedTarget.y = target.y;
    this.perceivedTarget.vx = target.vx;
    this.perceivedTarget.vy = target.vy;
    this.perceivedTarget.isAttacking = target.isAttacking;
    this.perceivedTarget.isDashing = target.isDashing;
    this.perceivedTarget.hp = target.hp;
  }

  /**
   * Evaluates the combat scenario and selects an appropriate behavior state
   */
  private evaluateTactics(
    self: MechState,
    powerUps: PowerUp[],
    obstacles: Obstacle[],
    hazards: HazardNode[],
    collapsingPlatforms: CollapsingPlatform[],
    barriers: MovingBarrier[]
  ) {
    // If locked into an ongoing brief action (e.g. dodging or countering), maintain it
    if (this.behaviorLockTimer > 0) return;

    // Calculate distance and angles to perceived player
    const actualDx = this.perceivedTarget.x - self.x;
    const actualDy = this.perceivedTarget.y - self.y;
    const distToTarget = Math.hypot(actualDx, actualDy);

    // Dynamic personality resolution for APEX
    let activePersonality = this.currentPersonality;
    if (activePersonality === 'APEX') {
      if (self.hp < 35 && this.perceivedTarget.hp > self.hp) {
        activePersonality = 'FLANKER';
      } else if (this.perceivedTarget.hp < 40) {
        activePersonality = 'BRAWLER';
      } else if (distToTarget > 140) {
        activePersonality = 'KITER';
      } else {
        activePersonality = 'BALANCED';
      }
    }

    // 1. INCOMING ATTACK EVALUATION & DODGE / DEFEND
    if (this.perceivedTarget.isAttacking) {
      const isCloseEnough = distToTarget <= ATTACK_REACH + MECH_RADIUS + 25;
      // Is player aiming towards AI?
      const anglePlayerToAI = Math.atan2(self.y - this.perceivedTarget.y, self.x - this.perceivedTarget.x);
      const playerFacingAngle = Math.atan2(this.perceivedTarget.vy || 1, this.perceivedTarget.vx || 1);
      const angleDiff = Math.abs(this.normalizeAngle(anglePlayerToAI - playerFacingAngle));
      const isThreatening = isCloseEnough && angleDiff < Math.PI * 0.55;

      if (isThreatening) {
        const dodgeRoll = Math.random();
        if (dodgeRoll < this.config.dodgeProbability) {
          // Successful Dodge!
          this.currentBehavior = 'DODGE';
          this.behaviorLockTimer = 0.22 + Math.random() * 0.12;
          this.recentDodgeTimer = 0.6; // Open counter window upon dodging
          this.counterWindowTimer = 0.55;

          // Check if AI should use dash to dodge
          if (self.dashCooldown <= 0 && Math.random() < this.config.dashProbability) {
            this.wantsDash = true;
          }
          return;
        } else if (dodgeRoll < this.config.dodgeProbability + 0.15) {
          // Fallback to DEFEND (step back)
          this.currentBehavior = 'DEFEND';
          this.behaviorLockTimer = 0.2;
          return;
        }
      }
    }

    // 2. COUNTER ATTACK EXPLOITATION
    // Player just missed or finished an attack and is on cooldown, or AI recently dodged
    const canCounter =
      (this.counterWindowTimer > 0 || (!this.perceivedTarget.isAttacking && this.recentDodgeTimer > 0)) &&
      self.attackCooldown <= 0;
    const counterProb = this.config.counterProbability ?? 0.5;

    if (canCounter && Math.random() < counterProb) {
      if (distToTarget <= this.config.attackRange + 15) {
        this.currentBehavior = 'COUNTER';
        this.behaviorLockTimer = 0.2;
        this.counterWindowTimer = 0;
        this.recentDodgeTimer = 0;
        this.wantsAttack = true;
        return;
      } else if (distToTarget <= 150 && self.dashCooldown <= 0 && Math.random() < this.config.dashProbability * 0.8) {
        // Dash Counter-Strike!
        this.currentBehavior = 'COUNTER';
        this.behaviorLockTimer = 0.24;
        this.counterWindowTimer = 0;
        this.recentDodgeTimer = 0;
        this.wantsDash = true;
        this.wantsAttack = true;
        return;
      }
    }

    // 3. LOW HEALTH RETREAT / POWER-UP SEEKING
    const isCriticallyLow = self.hp <= this.config.retreatThreshold && self.hp < this.perceivedTarget.hp;
    const bestPowerUp = this.evaluatePowerUps(self, powerUps, hazards, collapsingPlatforms);

    if (bestPowerUp) {
      const pDist = Math.hypot(bestPowerUp.x - self.x, bestPowerUp.y - self.y);
      const pPlayerDist = Math.hypot(bestPowerUp.x - this.perceivedTarget.x, bestPowerUp.y - this.perceivedTarget.y);

      // If low health and heal is available, or AI is closer, go for it!
      const shouldPrioritizePowerUp =
        (bestPowerUp.type === 'HEAL' && isCriticallyLow) ||
        (pDist < pPlayerDist + 60 && Math.random() < this.config.powerUpPriority);

      if (shouldPrioritizePowerUp) {
        this.currentBehavior = 'COLLECT_POWERUP';
        this.behaviorLockTimer = 0.35;
        return;
      }
    }

    if (isCriticallyLow && Math.random() < 0.75) {
      this.currentBehavior = 'RETREAT';
      this.behaviorLockTimer = 0.35;
      return;
    }

    // 4. POST-ATTACK DISENGAGE & RESET (Avoids mindless glue sticking)
    if (this.postAttackDisengageTimer > 0) {
      this.currentBehavior = 'REPOSITION';
      return;
    }

    // 5. DISTANCE & COMBAT RANGE MANAGEMENT
    const attackReach = this.config.attackRange;
    const preferredDistance = this.getPreferredDistance(activePersonality);

    // Dangerously close check
    if (distToTarget < 42 && activePersonality !== 'BRAWLER') {
      this.currentBehavior = 'REPOSITION';
      this.behaviorLockTimer = 0.2;
      return;
    }

    // In attack range
    if (distToTarget <= attackReach) {
      if (self.attackCooldown <= 0) {
        const attackRoll = Math.random();
        if (attackRoll < this.config.attackProbability) {
          this.currentBehavior = 'ATTACK';
          this.wantsAttack = true;
          // Set post-attack disengage/reposition timer to make AI feel human
          const disengageChance = activePersonality === 'FLANKER' ? 0.85 : activePersonality === 'KITER' ? 0.7 : 0.4;
          if (Math.random() < disengageChance) {
            this.postAttackDisengageTimer = 0.25 + Math.random() * 0.2;
          }
          return;
        } else {
          // Hesitate / reposition slightly before attacking
          this.currentBehavior = 'REPOSITION';
          this.behaviorLockTimer = 0.15;
          return;
        }
      } else {
        // Attack is on cooldown - do not stand idle!
        this.currentBehavior = 'REPOSITION';
        return;
      }
    }

    // Sweet-spot zone / Feint check
    if (distToTarget > attackReach && distToTarget < attackReach + 45) {
      const feintRoll = Math.random();
      const feintChance = this.config.feintChance ?? 0.2;
      if (feintRoll < feintChance && this.feintWaitTimer <= 0) {
        this.currentBehavior = 'WAIT';
        this.feintWaitTimer = 0.35 + Math.random() * 0.25;
        this.behaviorLockTimer = 0.25;
        return;
      }

      // If personality prefers spacing, stay and strafe
      if (activePersonality === 'KITER' || activePersonality === 'DEFENSIVE') {
        this.currentBehavior = 'DEFEND';
        return;
      }
    }

    // Flanker or Brawler Dash Engage
    if (
      distToTarget >= 110 &&
      distToTarget <= 220 &&
      self.dashCooldown <= 0 &&
      !isCriticallyLow
    ) {
      const dashChance =
        activePersonality === 'FLANKER'
          ? this.config.dashProbability * 0.85
          : activePersonality === 'BRAWLER'
          ? this.config.dashProbability * 0.7
          : this.config.dashProbability * 0.4;

      if (Math.random() < dashChance) {
        this.currentBehavior = 'DASH';
        this.wantsDash = true;
        this.behaviorLockTimer = 0.25;
        return;
      }
    }

    // Default engagement
    this.currentBehavior = 'APPROACH';
  }

  /**
   * Executes steering, vector calculations, and action generation for current behavior
   */
  private executeBehavior(
    dt: number,
    self: MechState,
    obstacles: Obstacle[],
    hazards: HazardNode[],
    collapsingPlatforms: CollapsingPlatform[],
    barriers: MovingBarrier[],
    powerUps: PowerUp[]
  ) {
    // 1. Calculate predicted target position with limited human-like precision
    let aimX = this.perceivedTarget.x;
    let aimY = this.perceivedTarget.y;

    if (this.config.predictionStrength > 0) {
      // Prediction window scales with strength
      const predLeadTime = 0.22 * this.config.predictionStrength;
      aimX += this.perceivedTarget.vx * predLeadTime;
      aimY += this.perceivedTarget.vy * predLeadTime;

      // Add intentional human variance (higher difficulty = lower noise)
      const noiseAmp = (1 - this.config.predictionStrength) * 18;
      aimX += (Math.random() - 0.5) * noiseAmp;
      aimY += (Math.random() - 0.5) * noiseAmp;
    }

    const toPlayerDx = aimX - self.x;
    const toPlayerDy = aimY - self.y;
    const distToAim = Math.hypot(toPlayerDx, toPlayerDy);
    const normPlayerDx = distToAim > 0.001 ? toPlayerDx / distToAim : 1;
    const normPlayerDy = distToAim > 0.001 ? toPlayerDy / distToAim : 0;

    // Facing direction: smoothly aim toward target
    const targetAimAngle = Math.atan2(toPlayerDy, toPlayerDx);
    this.currentAimAngle = this.smoothAngle(this.currentAimAngle, targetAimAngle, dt * 18);

    // 2. Base Intent Direction Vector based on current state
    let desiredDirX = 0;
    let desiredDirY = 0;

    const perpX = -normPlayerDy * this.strafeDir;
    const perpY = normPlayerDx * this.strafeDir;

    switch (this.currentBehavior) {
      case 'ATTACK':
      case 'COUNTER':
        // Move directly in to connect slash
        desiredDirX = normPlayerDx;
        desiredDirY = normPlayerDy;
        break;

      case 'APPROACH':
        // Approach with subtle strafe blending
        if (Math.random() < this.config.strafeTendency) {
          desiredDirX = normPlayerDx * 0.75 + perpX * 0.45;
          desiredDirY = normPlayerDy * 0.75 + perpY * 0.45;
        } else {
          desiredDirX = normPlayerDx;
          desiredDirY = normPlayerDy;
        }
        break;

      case 'RETREAT':
        // Back away, weaving laterally
        desiredDirX = -normPlayerDx * 0.85 + perpX * 0.4;
        desiredDirY = -normPlayerDy * 0.85 + perpY * 0.4;
        break;

      case 'DODGE':
        // Dodge aggressively perpendicular to the player's slash arc
        desiredDirX = perpX * 1.2 - normPlayerDx * 0.4;
        desiredDirY = perpY * 1.2 - normPlayerDy * 0.4;
        break;

      case 'DEFEND':
        // Circle around player at safe spacing
        desiredDirX = perpX * 0.9 - normPlayerDx * 0.2;
        desiredDirY = perpY * 0.9 - normPlayerDy * 0.2;
        break;

      case 'REPOSITION':
        // Circular repositioning or stepping back
        desiredDirX = perpX * 0.85 - normPlayerDx * 0.35;
        desiredDirY = perpY * 0.85 - normPlayerDy * 0.35;
        break;

      case 'WAIT':
        // Micro-step in place, observing player
        desiredDirX = perpX * 0.25;
        desiredDirY = perpY * 0.25;
        break;

      case 'DASH':
        // Burst forward into striking range
        desiredDirX = normPlayerDx;
        desiredDirY = normPlayerDy;
        break;

      case 'COLLECT_POWERUP': {
        const targetPowerUp = this.evaluatePowerUps(self, powerUps, hazards, collapsingPlatforms);
        if (targetPowerUp) {
          const pdx = targetPowerUp.x - self.x;
          const pdy = targetPowerUp.y - self.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist > 0.001) {
            desiredDirX = pdx / pdist;
            desiredDirY = pdy / pdist;
          }
        } else {
          desiredDirX = normPlayerDx;
          desiredDirY = normPlayerDy;
        }
        break;
      }
    }

    // 3. Environmental Repulsion & Hazard Avoidance Forces
    let repelX = 0;
    let repelY = 0;

    if (this.config.hazardAwareness > 0.1) {
      // Avoid Electric Nodes
      for (const node of hazards) {
        if (node.state === 'WARNING' || node.state === 'ACTIVE') {
          const hdx = self.x - node.x;
          const hdy = self.y - node.y;
          const hdist = Math.hypot(hdx, hdy);
          const safeDist = node.radius + 40;
          if (hdist < safeDist && hdist > 0.001) {
            const dangerMultiplier = node.state === 'ACTIVE' ? 3.5 : 2.0;
            const urgency = (1 - hdist / safeDist) * dangerMultiplier * this.config.hazardAwareness;
            repelX += (hdx / hdist) * urgency;
            repelY += (hdy / hdist) * urgency;
          }
        }
      }

      // Avoid Collapsing Platforms
      for (const plat of collapsingPlatforms) {
        if (plat.state === 'WARNING' || plat.state === 'COLLAPSED') {
          const platCenterX = plat.x + plat.width / 2;
          const platCenterY = plat.y + plat.height / 2;
          const pdx = self.x - platCenterX;
          const pdy = self.y - platCenterY;
          const pdist = Math.hypot(pdx, pdy);
          const safeDist = Math.hypot(plat.width / 2, plat.height / 2) + 32;
          if (pdist < safeDist && pdist > 0.001) {
            const urgency = (1 - pdist / safeDist) * 3.2 * this.config.hazardAwareness;
            repelX += (pdx / pdist) * urgency;
            repelY += (pdy / pdist) * urgency;
          }
        }
      }

      // Avoid Moving Laser Barriers
      for (const bar of barriers) {
        let bDist = 999;
        let bRepelX = 0;
        let bRepelY = 0;
        if (bar.axis === 'X') {
          bDist = Math.abs(self.x - bar.currentPos);
          if (bDist < 60 && self.y >= bar.y1 - 25 && self.y <= bar.y2 + 25) {
            bRepelX = (self.x > bar.currentPos ? 1 : -1) * (1 - bDist / 60) * 3.5;
          }
        } else {
          bDist = Math.abs(self.y - bar.currentPos);
          if (bDist < 60 && self.x >= bar.x1 - 25 && self.x <= bar.x2 + 25) {
            bRepelY = (self.y > bar.currentPos ? 1 : -1) * (1 - bDist / 60) * 3.5;
          }
        }
        repelX += bRepelX * this.config.hazardAwareness;
        repelY += bRepelY * this.config.hazardAwareness;
      }

      // Arena Wall Containment (Prevent corner trapping)
      const wallMargin = 55;
      if (self.x < wallMargin) repelX += ((wallMargin - self.x) / wallMargin) * 2.2;
      if (self.x > ARENA_WIDTH - wallMargin) repelX -= ((self.x - (ARENA_WIDTH - wallMargin)) / wallMargin) * 2.2;
      if (self.y < wallMargin) repelY += ((wallMargin - self.y) / wallMargin) * 2.2;
      if (self.y > ARENA_HEIGHT - wallMargin) repelY -= ((self.y - (ARENA_HEIGHT - wallMargin)) / wallMargin) * 2.2;
    }

    // 4. Obstacle Navigation & Tangent Sliding
    for (const obs of obstacles) {
      const obsCenterX = obs.x + obs.width / 2;
      const obsCenterY = obs.y + obs.height / 2;
      const odx = self.x - obsCenterX;
      const ody = self.y - obsCenterY;
      const odist = Math.hypot(odx, ody);
      const avoidDist = Math.max(obs.width, obs.height) + 32;

      if (odist < avoidDist && odist > 0.001) {
        const force = (1 - odist / avoidDist) * 2.0;
        repelX += (odx / odist) * force;
        repelY += (ody / odist) * force;
      }
    }

    // 5. Synthesize Final Movement Vector
    const finalVx = desiredDirX + repelX;
    const finalVy = desiredDirY + repelY;
    const finalMag = Math.hypot(finalVx, finalVy);

    if (finalMag > 0.05) {
      this.currentMoveDir = {
        x: finalVx / finalMag,
        y: finalVy / finalMag,
      };
    } else {
      this.currentMoveDir = { x: 0, y: 0 };
    }
  }

  /**
   * Evaluates active power-ups and returns the most strategically valuable and reachable power-up
   */
  private evaluatePowerUps(
    self: MechState,
    powerUps: PowerUp[],
    hazards: HazardNode[],
    collapsingPlatforms: CollapsingPlatform[]
  ): PowerUp | null {
    if (powerUps.length === 0) return null;

    let bestScore = -1;
    let selectedPowerUp: PowerUp | null = null;

    for (const p of powerUps) {
      // 1. Safety check: reject power-ups that are inside active hazard zones
      let isHazardous = false;
      for (const node of hazards) {
        if ((node.state === 'WARNING' || node.state === 'ACTIVE') && Math.hypot(p.x - node.x, p.y - node.y) < node.radius + 15) {
          isHazardous = true;
          break;
        }
      }
      if (isHazardous) continue;

      for (const plat of collapsingPlatforms) {
        if ((plat.state === 'WARNING' || plat.state === 'COLLAPSED') &&
            p.x >= plat.x && p.x <= plat.x + plat.width &&
            p.y >= plat.y && p.y <= plat.y + plat.height) {
          isHazardous = true;
          break;
        }
      }
      if (isHazardous) continue;

      // 2. Tactical desirability
      const dist = Math.hypot(p.x - self.x, p.y - self.y);
      let score = 800 - dist;

      if (p.type === 'HEAL') {
        if (self.hp < 40) score += 1200;
        else if (self.hp < 70) score += 500;
      } else if (p.type === 'SHIELD') {
        if (!self.hasShield) score += 400;
      } else if (p.type === 'POWER_ATTACK') {
        if (!self.hasPowerAttack) score += 320;
      } else if (p.type === 'SPEED_BOOST') {
        if (self.speedBoostTimer <= 0) score += 200;
      }

      if (score > bestScore) {
        bestScore = score;
        selectedPowerUp = p;
      }
    }

    return selectedPowerUp;
  }

  /**
   * Preferred engagement distance according to personality
   */
  private getPreferredDistance(personality: AIPersonality): number {
    switch (personality) {
      case 'BRAWLER':
        return 56;
      case 'FLANKER':
        return 115;
      case 'KITER':
        return 96;
      case 'DEFENSIVE':
        return 88;
      case 'APEX':
      case 'BALANCED':
      default:
        return 72;
    }
  }

  /**
   * Angle difference normalization between -PI and PI
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  /**
   * Smooth angular interpolation
   */
  private smoothAngle(current: number, target: number, speed: number): number {
    const diff = this.normalizeAngle(target - current);
    return current + diff * Math.min(1, speed);
  }
}
