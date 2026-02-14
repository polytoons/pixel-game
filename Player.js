import { SpriteAnimator } from "./SpriteAnimator.js";

export class Player {
  constructor(x, y, soundManager) { // ⭐ THÊM soundManager parameter
    this.x = x;
    this.y = y;
    this.width = 64;
    this.height = 64;

    // ⭐ LÀM soundManager NGAY TRONG CONSTRUCTOR
    this.soundManager = soundManager;

    // Stats
    this.baseSpeed = 1;
    this.baseMaxHp = 25;
    this.baseDamage = 5;
    this.baseArmor = 0;

    this.speed = this.baseSpeed;
    this.maxHp = this.baseMaxHp;
    this.damage = this.baseDamage;
    this.armor = this.baseArmor;

    this.hp = this.maxHp;
    this.velocityX = 0;
    this.velocityY = 0;
    this.invulnerable = false;
    this.invulnerableTime = 0;
    this.invulnerableDuration = 60;

    // Animation system
    this.animator = new SpriteAnimator("assets/player_sprite.png", 16, 16, {
      idle: { row: 0, frames: 1, frameDelay: 10, loop: true },
      run: { row: 1, frames: 3, frameDelay: 6, loop: true },
      attack: {
        row: 4,
        frames: 2,
        frameDelay: 30,
        loop: true,
        customRows: [4, 0],
      },
      dead: { row: 6, frames: 2, frameDelay: 15, loop: false },
    });

    this.isMoving = false;
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.isDead = false;

    this.shootCooldown = 0;
    this.shootCooldownDuration = 35;
  }

  // ⭐ GIỮ LẠI method này để tương thích ngược (nếu cần)
  setSoundManager(soundManager) {
    this.soundManager = soundManager;
  }

  // ⭐ Reset player về trạng thái sống
  reset() {
    this.hp = this.maxHp;
    this.isDead = false;
    this.invulnerable = false;
    this.invulnerableTime = 0;
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.shootCooldown = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isMoving = false;

    // Reset animation về idle
    this.animator.setState("idle");

    console.log("✅ Player reset! HP:", this.hp, "isDead:", this.isDead);
  }

  updateStats(equipmentStats) {
    const oldMaxHp = this.maxHp;

    this.maxHp = this.baseMaxHp + equipmentStats.hp;
    this.armor = this.baseArmor + equipmentStats.armor;
    this.damage = this.baseDamage + equipmentStats.damage;
    this.speed = this.baseSpeed + equipmentStats.speed;

    const hpRatio = this.hp / oldMaxHp;
    this.hp = Math.min(this.maxHp, Math.floor(this.maxHp * hpRatio));
  }

  update(keys, mouseX, mouseY) {
    if (this.isDead) {
      this.animator.update();
      return;
    }

    this.animator.updateDirection(mouseX, mouseY, this.x, this.y);

    this.velocityX = 0;
    this.velocityY = 0;
    this.isMoving = false;

    if (!this.isAttacking) {
      if (keys["w"] || keys["W"]) {
        this.velocityY -= this.speed;
        this.isMoving = true;
      }
      if (keys["s"] || keys["S"]) {
        this.velocityY += this.speed;
        this.isMoving = true;
      }
      if (keys["a"] || keys["A"]) {
        this.velocityX -= this.speed;
        this.isMoving = true;
      }
      if (keys["d"] || keys["D"]) {
        this.velocityX += this.speed;
        this.isMoving = true;
      }

      if (this.velocityX !== 0 && this.velocityY !== 0) {
        const magnitude = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
        this.velocityX = (this.velocityX / magnitude) * this.speed;
        this.velocityY = (this.velocityY / magnitude) * this.speed;
      }
    }

    if (this.isAttacking) {
      this.animator.setState("attack");
      this.attackCooldown--;
      if (this.attackCooldown <= 0) {
        this.isAttacking = false;
      }
    } else if (this.isMoving) {
      this.animator.setState("run");
    } else {
      this.animator.setState("idle");
    }

    this.animator.update();

    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }

    if (this.invulnerable) {
      this.invulnerableTime++;
      if (this.invulnerableTime >= this.invulnerableDuration) {
        this.invulnerable = false;
        this.invulnerableTime = 0;
      }
    }
  }

  constrainToCanvas(canvasWidth, canvasHeight) {
    this.x = Math.max(
      this.width / 2,
      Math.min(canvasWidth - this.width / 2, this.x),
    );
    this.y = Math.max(
      this.height / 2,
      Math.min(canvasHeight - this.height / 2, this.y),
    );
  }

  constrainToMap(map) {
    const nextX = this.x + this.velocityX;
    const nextY = this.y + this.velocityY;

    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    const canMoveX =
      map.checkCollision(nextX - halfWidth, this.y - halfHeight) &&
      map.checkCollision(nextX + halfWidth, this.y - halfHeight) &&
      map.checkCollision(nextX - halfWidth, this.y + halfHeight) &&
      map.checkCollision(nextX + halfWidth, this.y + halfHeight);

    const canMoveY =
      map.checkCollision(this.x - halfWidth, nextY - halfHeight) &&
      map.checkCollision(this.x + halfWidth, nextY - halfHeight) &&
      map.checkCollision(this.x - halfWidth, nextY + halfHeight) &&
      map.checkCollision(this.x + halfWidth, nextY + halfHeight);

    if (canMoveX) {
      this.x = nextX;
    }

    if (canMoveY) {
      this.y = nextY;
    }
  }

  draw(ctx) {
    ctx.save();

    if (
      this.invulnerable &&
      !this.isDead &&
      Math.floor(this.invulnerableTime / 5) % 2 === 0
    ) {
      ctx.globalAlpha = 0.5;
    }

    this.animator.draw(ctx, this.x, this.y, this.width, this.height);

    ctx.restore();

    if (!this.isDead) {
      this.drawHealthBar(ctx);
    }
  }

  drawHealthBar(ctx) {
    const barWidth = 50;
    const barHeight = 6;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.height / 2 - 15;

    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = this.hp / this.maxHp;
    ctx.fillStyle =
      hpPercent > 0.5 ? "#4CAF50" : hpPercent > 0.25 ? "#FFC107" : "#F44336";
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  shoot(mouseX, mouseY) {
    if (this.isDead) return null;

    if (this.shootCooldown > 0) return null;

    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const angle = Math.atan2(dy, dx);

    this.isAttacking = true;
    this.attackCooldown = 10;

    this.shootCooldown = this.shootCooldownDuration;

    return {
      x: this.x + Math.cos(angle) * (this.width / 2 + 10),
      y: this.y + Math.sin(angle) * (this.height / 2 + 10),
      velocityX: Math.cos(angle) * 8,
      velocityY: Math.sin(angle) * 8,
      damage: this.damage,
    };
  }

  takeDamage(baseDamage) {
    if (this.isDead || this.invulnerable) return;

    const damageReduction = Math.min(this.armor * 0.01, 0.75);
    const actualDamage = Math.floor(baseDamage * (1 - damageReduction));

    this.hp -= actualDamage;
    this.invulnerable = true;
    this.invulnerableTime = 0;

    // ⭐ PLAY SOUND - Check existence trước
    if (this.soundManager) {
      this.soundManager.playPlayerHit();
      console.log("🔊 Player hit sound played! Damage:", actualDamage);
    } else {
      console.warn("⚠️ SoundManager not found in Player!");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  die() {
    this.isDead = true;
    this.animator.setState("dead");
    console.log("💀 Player died");
  }

  isAlive() {
    return this.hp > 0 && !this.isDead;
  }
}