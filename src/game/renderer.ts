import {
  ArenaColorTheme,
  CollapsingPlatform,
  FloatingText,
  HazardNode,
  MechState,
  MovingBarrier,
  Obstacle,
  Particle,
  PowerUp,
} from '../types/game';
import { ARENA_HEIGHT, ARENA_WIDTH } from './constants';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private animTime: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(
    dt: number,
    vex: MechState,
    nova: MechState,
    powerUps: PowerUp[],
    obstacles: Obstacle[],
    hazards: HazardNode[],
    collapsingPlatforms: CollapsingPlatform[],
    barriers: MovingBarrier[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    screenShake: { x: number; y: number },
    theme: ArenaColorTheme = 'CYAN_MATRIX'
  ) {
    this.animTime += dt;
    const ctx = this.ctx;

    ctx.save();
    // Apply screen shake
    ctx.translate(screenShake.x, screenShake.y);

    // 1. Draw Arena Floor & Cyber Grid
    this.drawArenaFloor(theme);

    // 2. Draw Collapsing Platforms
    this.drawCollapsingPlatforms(collapsingPlatforms);

    // 3. Draw Hazards (Electric nodes, barriers)
    this.drawHazards(hazards, barriers);

    // 4. Draw Obstacles (Pillars, covers)
    this.drawObstacles(obstacles);

    // 5. Draw Power-Ups
    this.drawPowerUps(powerUps);

    // 6. Draw Particles (under mechs)
    this.drawParticles(particles, false);

    // 7. Draw Mechs (VEX and NOVA)
    this.drawMech(vex, 'VEX');
    this.drawMech(nova, 'NOVA');

    // 8. Draw Attacks & Slashing Effects
    this.drawAttackEffect(vex, '#06b6d4', '#67e8f9');
    this.drawAttackEffect(nova, '#ef4444', '#fca5a5');

    // 9. Draw Particles (over mechs - sparks, debris)
    this.drawParticles(particles, true);

    // 10. Draw Floating Damage Numbers & Combat Text
    this.drawFloatingTexts(floatingTexts);

    // 11. Draw Arena Outer Glowing Borders & Frame
    this.drawArenaBorders(theme);

    ctx.restore();
  }

  private drawArenaFloor(theme: string) {
    const ctx = this.ctx;
    let gridColor = 'rgba(6, 182, 212, 0.05)';
    let floorBg = '#07090e';
    if (theme === 'CRIMSON_FORGE') {
      gridColor = 'rgba(239, 68, 68, 0.06)';
      floorBg = '#0d0708';
    } else if (theme === 'NEON_PURPLE') {
      gridColor = 'rgba(168, 85, 247, 0.06)';
      floorBg = '#090710';
    } else if (theme === 'EMERALD_NEXUS') {
      gridColor = 'rgba(16, 185, 129, 0.06)';
      floorBg = '#050c09';
    } else if (theme === 'GOLD_CORE') {
      gridColor = 'rgba(234, 179, 8, 0.06)';
      floorBg = '#0c0a05';
    } else if (theme === 'OBSIDIAN_VOID') {
      gridColor = 'rgba(129, 140, 248, 0.06)';
      floorBg = '#050508';
    }

    ctx.fillStyle = floorBg;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    ctx.strokeStyle = gridColor;
    const gridSize = 40;

    for (let x = 0; x <= ARENA_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }

    // Center Arena Emblem / Ring
    const centerX = ARENA_WIDTH / 2;
    const centerY = ARENA_HEIGHT / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 130, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Center crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX - 160, centerY);
    ctx.lineTo(centerX + 160, centerY);
    ctx.moveTo(centerX, centerY - 160);
    ctx.lineTo(centerX, centerY + 160);
    ctx.stroke();
  }

  private drawCollapsingPlatforms(platforms: CollapsingPlatform[]) {
    const ctx = this.ctx;
    for (const plat of platforms) {
      ctx.save();
      const cx = plat.x;
      const cy = plat.y;
      const w = plat.width;
      const h = plat.height;

      if (plat.state === 'SOLID') {
        // High-tech reinforced platform tile
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(cx, cy, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, w, h);

        // Pattern inside
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.strokeRect(cx + 8, cy + 8, w - 16, h - 16);
      } else if (plat.state === 'WARNING') {
        // Pulsing warning orange/red tile
        const pulse = (Math.sin(this.animTime * 12) + 1) / 2;
        ctx.fillStyle = `rgba(245, 158, 11, ${0.15 + pulse * 0.25})`;
        ctx.fillRect(cx, cy, w, h);

        ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx, cy, w, h);

        // Hazard stripes / warning text
        ctx.fillStyle = `rgba(245, 158, 11, ${0.8 + pulse * 0.2})`;
        ctx.font = '10px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('! COLLAPSING !', cx + w / 2, cy + h / 2 + 3);
      } else if (plat.state === 'COLLAPSED') {
        // Bottomless glowing void pit
        ctx.fillStyle = '#020408';
        ctx.fillRect(cx, cy, w, h);

        // Abyss depth gradient
        const grad = ctx.createRadialGradient(
          cx + w / 2,
          cy + h / 2,
          5,
          cx + w / 2,
          cy + h / 2,
          w / 2
        );
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx, cy, w, h);

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx, cy, w, h);
        ctx.setLineDash([]);
      } else if (plat.state === 'RESTORING') {
        // Digital materialization wireframe
        ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.fillRect(cx, cy, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(cx, cy, w, h);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }

  private drawHazards(hazards: HazardNode[], barriers: MovingBarrier[]) {
    const ctx = this.ctx;

    // 1. Electric Nodes
    for (const h of hazards) {
      ctx.save();
      // Metallic base ring
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (h.state === 'WARNING') {
        // Pulsing warning aura
        const pulse = (Math.sin(this.animTime * 14) + 1) / 2;
        ctx.strokeStyle = `rgba(234, 179, 8, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (0.4 + pulse * 0.6), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.state === 'ACTIVE') {
        // High voltage electric discharge
        const grad = ctx.createRadialGradient(h.x, h.y, 6, h.x, h.y, h.radius);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        grad.addColorStop(0.5, 'rgba(147, 51, 234, 0.4)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        // Crackling lightning bolts
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
          const endDist = h.radius * (0.7 + Math.random() * 0.3);
          const midDist = endDist * 0.5;
          const midAngle = angle + (Math.random() - 0.5) * 0.6;

          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(
            h.x + Math.cos(midAngle) * midDist,
            h.y + Math.sin(midAngle) * midDist
          );
          ctx.lineTo(
            h.x + Math.cos(angle) * endDist,
            h.y + Math.sin(angle) * endDist
          );
          ctx.stroke();
        }
      } else {
        // Idle dormant state
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Moving Laser Barriers
    for (const bar of barriers) {
      ctx.save();
      const isX = bar.axis === 'X';
      const pos = bar.currentPos;

      // Glow laser line
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ef4444';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = bar.thickness;

      ctx.beginPath();
      if (isX) {
        ctx.moveTo(pos, bar.y1);
        ctx.lineTo(pos, bar.y2);
      } else {
        ctx.moveTo(bar.x1, pos);
        ctx.lineTo(bar.x2, pos);
      }
      ctx.stroke();

      // Core hot laser
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = bar.thickness * 0.4;
      ctx.stroke();

      // Emitter heads at ends
      ctx.fillStyle = '#7f1d1d';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      if (isX) {
        ctx.fillRect(pos - 6, bar.y1 - 6, 12, 12);
        ctx.strokeRect(pos - 6, bar.y1 - 6, 12, 12);
        ctx.fillRect(pos - 6, bar.y2 - 6, 12, 12);
        ctx.strokeRect(pos - 6, bar.y2 - 6, 12, 12);
      } else {
        ctx.fillRect(bar.x1 - 6, pos - 6, 12, 12);
        ctx.strokeRect(bar.x1 - 6, pos - 6, 12, 12);
        ctx.fillRect(bar.x2 - 6, pos - 6, 12, 12);
        ctx.strokeRect(bar.x2 - 6, pos - 6, 12, 12);
      }

      ctx.restore();
    }
  }

  private drawObstacles(obstacles: Obstacle[]) {
    const ctx = this.ctx;
    for (const obs of obstacles) {
      ctx.save();
      const x = obs.x;
      const y = obs.y;
      const w = obs.width;
      const h = obs.height;

      // Pillar base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, h);

      // Bevel & border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Core reactor strip inside pillar
      const pulse = (Math.sin(this.animTime * 4 + x) + 1) / 2;
      ctx.fillStyle = `rgba(6, 182, 212, ${0.4 + pulse * 0.5})`;
      if (w > h) {
        ctx.fillRect(x + 6, y + h / 2 - 2, w - 12, 4);
      } else {
        ctx.fillRect(x + w / 2 - 2, y + 6, 4, h - 12);
      }

      // Tech screws in corners
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 1.5, 0, Math.PI * 2);
      ctx.arc(x + w - 4, y + 4, 1.5, 0, Math.PI * 2);
      ctx.arc(x + 4, y + h - 4, 1.5, 0, Math.PI * 2);
      ctx.arc(x + w - 4, y + h - 4, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawPowerUps(powerUps: PowerUp[]) {
    const ctx = this.ctx;
    for (const p of powerUps) {
      ctx.save();
      const bounce = Math.sin(this.animTime * 5 + p.x) * 3;
      const py = p.y + bounce;
      const pulse = (Math.sin(this.animTime * 8) + 1) / 2;

      let color = '#06b6d4';
      let icon = '⚡';
      let label = 'SPEED';

      if (p.type === 'SHIELD') {
        color = '#3b82f6';
        icon = '🛡';
        label = 'SHIELD';
      } else if (p.type === 'POWER_ATTACK') {
        color = '#ef4444';
        icon = '⚔';
        label = 'POWER';
      } else if (p.type === 'HEAL') {
        color = '#10b981';
        icon = '✚';
        label = 'HEAL';
      } else if (p.type === 'ENERGY') {
        color = '#f59e0b';
        icon = '🔋';
        label = 'DASH';
      }

      // Outer glowing ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10 + pulse * 6;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(p.x, py, p.radius + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      // Power-up container sphere
      const grad = ctx.createRadialGradient(p.x, py, 2, p.x, py, p.radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, py, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Icon / Symbol inside
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, p.x, py);

      // Label below
      ctx.font = '9px Orbitron, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(label, p.x, py + p.radius + 12);

      ctx.restore();
    }
  }

  /** Renders Original Mecha Silhouette for VEX and NOVA */
  private drawMech(mech: MechState, type: 'VEX' | 'NOVA') {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(mech.x, mech.y);
    ctx.rotate(mech.angle);

    const isVex = type === 'VEX';
    const isHit = mech.hitStunTimer > 0;
    const isDefeated = mech.isDefeated;

    // Boss Aura & Underglow
    if (mech.isBoss) {
      ctx.save();
      const auraPulse = Math.sin(this.animTime * 4) * 4;
      ctx.shadowBlur = 18 + auraPulse;
      ctx.shadowColor = mech.bossTier === 'FINAL_BOSS' ? '#f59e0b' : '#ef4444';
      ctx.strokeStyle = mech.bossTier === 'FINAL_BOSS' ? '#fbbf24' : '#f87171';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, mech.radius + 8 + auraPulse, 0, Math.PI * 2);
      ctx.stroke();

      // Boss decorative outer spikes
      for (let i = 0; i < 4; i++) {
        const sa = (i * Math.PI) / 2 + this.animTime * 1.5;
        const sx = Math.cos(sa) * (mech.radius + 12);
        const sy = Math.sin(sa) * (mech.radius + 12);
        ctx.fillStyle = mech.bossTier === 'FINAL_BOSS' ? '#fbbf24' : '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Movement leg piston animation
    const legOffset = Math.sin(mech.walkCycle) * 4;

    // Colors
    const primaryColor = isVex ? '#06b6d4' : '#ef4444';
    const armorDark = isVex ? '#0f172a' : '#18181b';
    const armorMid = isVex ? '#1e293b' : '#27272a';
    const armorPlate = isVex ? '#334155' : '#3f3f46';
    const glowColor = isVex ? '#22d3ee' : '#f87171';

    // 1. Dash Trails / Ghost Echoes
    if (mech.isDashing) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(-14, 0, mech.radius * 0.9, 0, Math.PI * 2);
      ctx.arc(-26, 0, mech.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Thruster flame effects when moving or dashing
    const speed = Math.hypot(mech.vx, mech.vy);
    if (speed > 20 || mech.isDashing) {
      ctx.save();
      const flameLen = mech.isDashing ? 28 : 12 + Math.random() * 6;
      ctx.fillStyle = isVex ? '#38bdf8' : '#fb923c';
      ctx.shadowBlur = 10;
      ctx.shadowColor = primaryColor;

      if (isVex) {
        // Dual shoulder thrusters
        ctx.beginPath();
        ctx.moveTo(-18, -12);
        ctx.lineTo(-18 - flameLen, -12);
        ctx.lineTo(-15, -7);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-18, 12);
        ctx.lineTo(-18 - flameLen, 12);
        ctx.lineTo(-15, 7);
        ctx.closePath();
        ctx.fill();
      } else {
        // NOVA central rocket nozzle & fins
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-18 - flameLen * 1.2, 0);
        ctx.lineTo(-14, -8);
        ctx.lineTo(-14, 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Legs / Tread Pistons (underneath chassis)
    ctx.fillStyle = armorDark;
    ctx.strokeStyle = armorPlate;
    ctx.lineWidth = 1.5;

    // Left leg
    ctx.fillRect(-10 + legOffset, -18, 12, 6);
    ctx.strokeRect(-10 + legOffset, -18, 12, 6);

    // Right leg
    ctx.fillRect(-10 - legOffset, 12, 12, 6);
    ctx.strokeRect(-10 - legOffset, 12, 12, 6);

    // 4. Main Torso / Chassis
    if (isHit) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = armorMid;
    }

    if (isVex) {
      // VEX: Sleek, aerodynamic angular mecha chassis with shoulder pauldrons
      ctx.beginPath();
      ctx.moveTo(18, 0); // nose/chest
      ctx.lineTo(8, -16);
      ctx.lineTo(-14, -18);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-18, 10);
      ctx.lineTo(-14, 18);
      ctx.lineTo(8, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isHit ? '#ffffff' : primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front Plasma Blade Mount / Right Arm
      ctx.fillStyle = armorPlate;
      ctx.fillRect(8, 12, 14, 6);
      ctx.strokeRect(8, 12, 14, 6);

      // Shoulder Armor Guards
      ctx.fillStyle = primaryColor;
      ctx.fillRect(-12, -18, 10, 4);
      ctx.fillRect(-12, 14, 10, 4);

      // Glowing Reactor Core (Chest)
      const corePulse = (Math.sin(this.animTime * 6) + 1) / 2;
      ctx.fillStyle = glowColor;
      ctx.shadowBlur = 12;
      ctx.shadowColor = glowColor;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Visor / Optics
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, -5, 4, 10);
      ctx.shadowBlur = 0;
    } else {
      // NOVA: Heavy, horned, brutalist quad-fin war mech
      ctx.beginPath();
      ctx.moveTo(16, -10);
      ctx.lineTo(22, 0); // pointed beak
      ctx.lineTo(16, 10);
      ctx.lineTo(4, 20); // horned right fin
      ctx.lineTo(-16, 16);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-16, -16);
      ctx.lineTo(4, -20); // horned left fin
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isHit ? '#ffffff' : primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heavy Horn Spikes
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.moveTo(2, -18);
      ctx.lineTo(10, -24);
      ctx.lineTo(8, -16);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(2, 18);
      ctx.lineTo(10, 24);
      ctx.lineTo(8, 16);
      ctx.closePath();
      ctx.fill();

      // NOVA Cyclops Optical Eye / Red Core
      const eyeOffset = Math.sin(this.animTime * 3) * 2;
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(4, -8, 8, 16);

      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(8, eyeOffset, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heavy Dual Gauntlets
      ctx.fillStyle = armorDark;
      ctx.fillRect(10, -16, 12, 6);
      ctx.strokeRect(10, -16, 12, 6);
      ctx.fillRect(10, 10, 12, 6);
      ctx.strokeRect(10, 10, 12, 6);
    }

    // 5. Active Power Attack Surging Glow
    if (mech.hasPowerAttack) {
      ctx.strokeStyle = isVex ? '#a855f7' : '#f97316';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = isVex ? '#a855f7' : '#f97316';
      ctx.beginPath();
      ctx.arc(0, 0, mech.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 6. Shield Energy Bubble
    if (mech.hasShield) {
      ctx.save();
      const sAngle = this.animTime * 2;
      ctx.rotate(sAngle);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#0284c7';

      // Hexagonal shield perimeter
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const hx = Math.cos(a) * (mech.radius + 12);
        const hy = Math.sin(a) * (mech.radius + 12);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fill();
      ctx.restore();
    }

    // 7. Defeat Sparks & Smoke if HP <= 0
    if (isDefeated) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Draw Energy Attack Slash Arc */
  private drawAttackEffect(
    mech: MechState,
    color: string,
    glowColor: string
  ) {
    if (!mech.isAttacking) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(mech.x, mech.y);
    ctx.rotate(mech.angle);

    const progress = 1 - mech.attackTimer / 0.16; // 0 to 1
    const startAngle = -mech.attackArc / 2 + progress * (mech.attackArc * 0.4);
    const endAngle = startAngle + mech.attackArc * 0.6;

    ctx.shadowBlur = 16;
    ctx.shadowColor = glowColor;

    // Glowing energy slash arc
    ctx.strokeStyle = color;
    ctx.lineWidth = 14 * (1 - progress);
    ctx.beginPath();
    ctx.arc(0, 0, mech.attackRadius, startAngle, endAngle);
    ctx.stroke();

    // Hot inner core arc
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4 * (1 - progress);
    ctx.beginPath();
    ctx.arc(0, 0, mech.attackRadius, startAngle, endAngle);
    ctx.stroke();

    ctx.restore();
  }

  private drawParticles(particles: Particle[], drawOver: boolean) {
    const ctx = this.ctx;
    const prevAlpha = ctx.globalAlpha;

    for (const p of particles) {
      const isOver = p.type === 'SPARK' || p.type === 'SHOCKWAVE';
      if (isOver !== drawOver) continue;

      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'SHOCKWAVE') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  private drawFloatingTexts(floatingTexts: FloatingText[]) {
    if (floatingTexts.length === 0) return;
    const ctx = this.ctx;
    const prevAlpha = ctx.globalAlpha;
    const prevAlign = ctx.textAlign;

    ctx.textAlign = 'center';

    for (const t of floatingTexts) {
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.font = `bold ${Math.floor(14 * t.scale)}px Orbitron, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = prevAlpha;
    ctx.textAlign = prevAlign;
  }

  private drawArenaBorders(theme: string) {
    const ctx = this.ctx;
    ctx.save();
    let borderColor = '#06b6d4';
    if (theme === 'CRIMSON_FORGE') borderColor = '#ef4444';
    if (theme === 'NEON_PURPLE') borderColor = '#a855f7';
    if (theme === 'EMERALD_NEXUS') borderColor = '#10b981';
    if (theme === 'GOLD_CORE') borderColor = '#eab308';
    if (theme === 'OBSIDIAN_VOID') borderColor = '#818cf8';

    // Outer boundary line with cyber glow
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.shadowColor = borderColor;
    ctx.strokeRect(4, 4, ARENA_WIDTH - 8, ARENA_HEIGHT - 8);

    // Corner brackets
    const cLen = 30;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';

    // Top-left
    ctx.beginPath();
    ctx.moveTo(4, 4 + cLen);
    ctx.lineTo(4, 4);
    ctx.lineTo(4 + cLen, 4);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH - 4 - cLen, 4);
    ctx.lineTo(ARENA_WIDTH - 4, 4);
    ctx.lineTo(ARENA_WIDTH - 4, 4 + cLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(4, ARENA_HEIGHT - 4 - cLen);
    ctx.lineTo(4, ARENA_HEIGHT - 4);
    ctx.lineTo(4 + cLen, ARENA_HEIGHT - 4);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH - 4 - cLen, ARENA_HEIGHT - 4);
    ctx.lineTo(ARENA_WIDTH - 4, ARENA_HEIGHT - 4);
    ctx.lineTo(ARENA_WIDTH - 4, ARENA_HEIGHT - 4 - cLen);
    ctx.stroke();

    ctx.restore();
  }
}
