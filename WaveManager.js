import { Enemy } from "./Enemy.js";
import { SpawnWarning } from "./SpawnWarning.js";
import { Boss } from "./Boss.js";
import { Boss2 } from "./Boss2.js";

export class WaveManager {
  constructor(
    canvasWidth,
    canvasHeight,
    inventory,
    levelConfig = null,
    map = null,
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.inventory = inventory;
    this.map = map;
    this.soundManager = null;
    this.levelConfig = levelConfig || {
      id: 1,
      name: "Làng Khởi Đầu",
      enemiesMultiplier: 1,
      speedMultiplier: 1,
      enemyPool: [{ type: "zombie", weight: 100 }],
      bossWaves: [10],
      bossType: "boss_necromancer",
    };

    this.currentWave = 0;
    this.enemiesPerWave = 5;
    this.enemies = [];
    this.spawnWarnings = [];
    this.pendingSpawns = [];
    this.waveActive = false;
    this.waveDelay = 120;
    this.delayCounter = 0;
    this.totalEnemiesKilled = 0;

    this.boss = null;
    this.bossDefeated = false;

    this.goldThisFrame = 0;
    this.totalGoldEarned = 0;
    this.enemyBullets = [];

    this.maxWaves = 10;
    this.isCompleted = false;

    this._newBulletsBuf     = [];
this._explosionBuf      = [];
  }

  startNextWave(playerX, playerY) {
    this.currentWave++;
    this.waveActive = true;
    this.delayCounter = 0;

    // Guard: chỉ phát nếu soundManager đã được set
    if (this.soundManager) this.soundManager.playWaveStart();

    this.isBossWave = this.levelConfig.bossWaves?.includes(this.currentWave) ?? false;

    if (this.isBossWave) this.spawnBossWave(playerX, playerY);
    else this.spawnNormalWave(playerX, playerY);
  }

  spawnNormalWave(playerX, playerY) {
    const baseEnemies = this.enemiesPerWave + Math.floor(this.currentWave / 3);
    const enemiesToSpawn = Math.floor(
      baseEnemies * this.levelConfig.enemiesMultiplier,
    );

    for (let i = 0; i < enemiesToSpawn; i++) {
      const spawnPos = this.getSpawnPosition(playerX, playerY);
      const enemyType = this.getEnemyTypeFromPool();

      const warning = new SpawnWarning(spawnPos.x, spawnPos.y, 90);
      this.spawnWarnings.push(warning);

      this.pendingSpawns.push({
        x: spawnPos.x,
        y: spawnPos.y,
        type: enemyType,
        warning: warning,
      });
    }
  }

  spawnBossWave(playerX, playerY) {
  console.log(`🔥 BOSS WAVE ${this.currentWave}! 🔥`);
  // Spawn cố định ở giữa map
  const pos = this.map
    ? { x: this.map.getMapWidth() / 2, y: this.map.getMapHeight() / 2 }
    : { x: this.canvasWidth / 2,  y: this.canvasHeight / 2 };

  const bossType = this.levelConfig.id;
  if (bossType == 6) {
    this.boss = new Boss2(pos.x, pos.y, this.soundManager); // ← thêm soundManager
    this.boss.mapW = this.canvasWidth; this.boss.mapH = this.canvasHeight;
  } else {
    this.boss = new Boss(pos.x, pos.y, this.soundManager); // ← thêm soundManager
  }
}

  getEnemyTypeFromPool() {
    if (!this.levelConfig.enemyPool || this.levelConfig.enemyPool.length === 0) {
      return "zombie";
    }

    const totalWeight = this.levelConfig.enemyPool.reduce(
      (sum, enemy) => sum + enemy.weight, 0,
    );
    let random = Math.random() * totalWeight;

    for (const enemy of this.levelConfig.enemyPool) {
      random -= enemy.weight;
      if (random <= 0) return enemy.type;
    }

    return this.levelConfig.enemyPool[0].type;
  }

  getSpawnPosition(playerX, playerY) {
    if (this.map) {
      let spawnPos;
      let attempts = 0;
      const maxAttempts = 50;

      do {
        spawnPos = this.map.getRandomSpawnPosition(100);
        const dx = spawnPos.x - playerX;
        const dy = spawnPos.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= 300) return spawnPos;
        attempts++;
      } while (attempts < maxAttempts);

      return spawnPos;
    }

    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 50;

    switch (side) {
      case 0: x = Math.random() * this.canvasWidth;  y = -margin; break;
      case 1: x = this.canvasWidth + margin;          y = Math.random() * this.canvasHeight; break;
      case 2: x = Math.random() * this.canvasWidth;  y = this.canvasHeight + margin; break;
      case 3: x = -margin;                            y = Math.random() * this.canvasHeight; break;
    }
    return { x, y };
  }

  update(playerX, playerY, soundManager = null, player = null) {
    if (soundManager) this.soundManager = soundManager;

    this.goldThisFrame = 0;

    this.spawnWarnings.forEach(w => w.update());
    this.spawnWarnings = this.spawnWarnings.filter(w => w.active);

    this.pendingSpawns = this.pendingSpawns.filter(spawn => {
      if (spawn.warning.isComplete()) {
        const enemy = new Enemy(spawn.x, spawn.y, spawn.type);
        enemy.speed *= this.levelConfig.speedMultiplier;
        this.enemies.push(enemy);
        return false;
      }
      return true;
    });

    if (
      this.enemies.length === 0 &&
      this.pendingSpawns.length === 0 &&
      this.boss === null &&
      this.waveActive
    ) {
      this.delayCounter++;
      if (this.delayCounter >= this.waveDelay) {
        this.waveActive = false;   // ← reset ở đây, sau khi đếm xong
        this.delayCounter = 0;
        if (this.currentWave >= this.maxWaves || this.bossDefeated) {
          this.isCompleted = true;
        } else {
          this.startNextWave(playerX, playerY);
        }
      }
    }

    this.enemies.forEach(enemy => enemy.update(playerX, playerY, player));

    if (this.boss) {
      this.boss.update(playerX, playerY, player);

      const bb = this.boss.getAndClearBullets();
      if (bb.length) this.enemyBullets.push(...bb);

      const minions = this.boss.getAndClearMinions();
      if (minions.length) this.enemies.push(...minions);

      if (!this.boss.active) {
        const gold = this.boss.getGoldDrop();
        this.goldThisFrame += gold;
        this.totalGoldEarned += gold;
        this.totalEnemiesKilled++;
        this.boss = null;
        this.bossDefeated = true;
      }
    }

    this._newBulletsBuf.length = 0;  // clear không tạo mới
this.enemies.forEach(e => {
  const b = e.getAndClearBullets();
  if (b.length) this._newBulletsBuf.push(...b);
});
this.enemyBullets.push(...this._newBulletsBuf);

    this._explosionBuf.length = 0;
this.enemyBullets.forEach(b => {
  const spawned = b.update();
  if (spawned.length) this._explosionBuf.push(...spawned);
});
this.enemyBullets.push(...this._explosionBuf);

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
  const b = this.enemyBullets[i];
  if (!b.active || b.isOffScreen(this.canvasWidth, this.canvasHeight)) {
    b.active = false;
    this.enemyBullets.splice(i, 1);
  }
}

    let killedCount = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
  const enemy = this.enemies[i];
  if (!enemy.active) {
    // xử lý gold/item drop
    this.totalEnemiesKilled++;
    const goldDropped = enemy.getGoldDrop();
    this.goldThisFrame  += goldDropped;
    this.totalGoldEarned += goldDropped;
    if (Math.random() < 0.1) {
      this.inventory.addItem(this.inventory.generateRandomItem());
    }
    this.enemies.splice(i, 1); // ← xóa tại chỗ
  }
}
    return killedCount;
  }

  draw(ctx, camera) { // ← thêm tham số camera
  this.spawnWarnings.forEach(w => w.draw(ctx));

  this.enemies.forEach(e => {
    // ← THÊM: skip enemy ngoài viewport
    if (camera) {
      if (e.x + e.width  < camera.x || e.x - e.width  > camera.x + camera.width)  return;
      if (e.y + e.height < camera.y || e.y - e.height > camera.y + camera.height) return;
    }
    e.draw(ctx);
  });

  if (this.boss) this.boss.draw(ctx);

  this.enemyBullets.forEach(b => {
    // ← THÊM: skip bullet ngoài viewport
    if (camera) {
      if (b.x < camera.x - 50 || b.x > camera.x + camera.width  + 50) return;
      if (b.y < camera.y - 50 || b.y > camera.y + camera.height + 50) return;
    }
    b.draw(ctx);
  });
}

  drawBossWaveIndicator(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(0, 0, ctx.canvas.width, 60);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    const text = "👑 BOSS WAVE 👑";
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 1;
    ctx.save();
    ctx.translate(ctx.canvas.width / 2, 35);
    ctx.scale(pulse, pulse);
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  checkCollisions(bullets, player) {
    for (let bi = 0; bi < bullets.length; bi++) {
  const bullet = bullets[bi];
  if (!bullet.active) continue;
  for (let ei = 0; ei < this.enemies.length; ei++) {
    const enemy = this.enemies[ei];
    if (!enemy.active) continue;
    if (enemy.collidesWith(bullet)) {
      enemy.takeDamage(bullet.damage);
      bullet.active = false;
      break; // ← QUAN TRỌNG: 1 bullet chỉ trúng 1 enemy, thoát sớm
    }
  }
}
    let playerHit = false;
    let totalDamage = 0;

    this.enemies.forEach(enemy => {
      if (enemy.active && enemy.collidesWithPlayer(player)) {
        playerHit = true;
        totalDamage = Math.max(totalDamage, enemy.getDamage());
      }
    });

    if (this.boss) {
      bullets.forEach(b => {
        if (b.active && this.boss.collidesWith(b)) {
          this.boss.takeDamage(b.damage);
          b.active = false;
        }
      });
      if (this.boss.collidesWithPlayer(player)) {
        playerHit = true;
        totalDamage = Math.max(totalDamage, this.boss.getDamage());
      }

      if (typeof this.boss.checkMeteorHit === "function") {
        const mDmg = this.boss.checkMeteorHit(player);
        if (mDmg > 0) { playerHit = true; totalDamage = Math.max(totalDamage, mDmg); }
      }

      // ✅ FIX: checkSpecialHit (Boss2 orbit + damage zones) chuyển vào đây
      if (typeof this.boss.checkSpecialHit === "function") {
        const specialDmg = this.boss.checkSpecialHit(player);
        if (specialDmg > 0) {
          playerHit = true;
          totalDamage = Math.max(totalDamage, specialDmg);
        }
      }
    }

    this.enemyBullets.forEach(bullet => {
      if (!bullet.active) return;
      if (bullet.hitPlayer(player)) {
        if (bullet.type === "wraith") {
          const exploded = bullet.explode();
          this.enemyBullets.push(...exploded);
        }
        bullet.active = false;
        playerHit = true;
        totalDamage = Math.max(totalDamage, bullet.damage);
      }
    });

    return { hit: playerHit, damage: totalDamage };
  }

  checkMeteorHit(player) {
    for (const z of this._meteorZones) {
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;
      const dx = player.x - z.x, dy = player.y - z.y;
      if (dx*dx + dy*dy < (z.radius + player.width*0.3)**2) return z.damage;
    }
    return 0;
  }

  getWaveProgress() {
    const totalEnemies = this.enemies.length + this.pendingSpawns.length;

  if (this.boss !== null) {
    return `Đợt ${this.currentWave}/${this.maxWaves} - 👑 BOSS`;
  }
  if (totalEnemies > 0) {
    return `Đợt ${this.currentWave}/${this.maxWaves} - Còn: ${totalEnemies} quái`;
  }
  // Không còn quái → đang đếm ngược
  const timeLeft = Math.ceil((this.waveDelay - this.delayCounter) / 60);
  return `Đợt tiếp theo trong: ${timeLeft}s`;
  }

  drawBossHP(ctx, cW) {
  if (!this.boss || this.boss.isDead) return;

  const barW   = 420;
  const barH   = 22;
  const x      = (cW - barW) / 2;
  const y      = 36;          // cách top 36px
  const ratio  = Math.max(0, this.boss.hp / this.boss.maxHp);
  const isP2   = this.boss._phase2 ?? false;

  // Nền mờ phía sau cả cụm
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(x - 12, y - 22, barW + 24, barH + 36, 10);
  ctx.fill();

  // Tên boss
  ctx.fillStyle = isP2 ? "#FF1744" : "#FFD700";
  ctx.font      = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
  const bossName = this.boss.type === "boss2" ? "Giant Frog" : "Giant Slime";
  ctx.fillText(bossName + (isP2 ? "" : ""), x + barW / 2, y - 6);
  ctx.shadowBlur = 0;

  // Track (nền thanh)
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 5); ctx.fill();

  // Thanh HP – đổi màu theo pha
  const hpColor = isP2
    ? `hsl(${10 + ratio * 20}, 90%, 50%)`   // đỏ-cam phase 2
    : `hsl(${ratio * 110}, 70%, 45%)`;       // xanh → vàng → đỏ phase 1
  ctx.fillStyle = hpColor;
  ctx.shadowColor = hpColor;
  ctx.beginPath(); ctx.roundRect(x, y, barW * ratio, barH, 5); ctx.fill();

  // Viền
  ctx.strokeStyle = isP2 ? "#FF1744" : "rgba(255,215,0,0.6)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 5); ctx.stroke();

  // Text HP số
  ctx.fillStyle  = "#fff";
  ctx.font       = "bold 12px Arial";
  ctx.textAlign  = "center";
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
  ctx.fillText(`${this.boss.hp.toLocaleString()} / ${this.boss.maxHp.toLocaleString()}`, x + barW / 2, y + barH / 2 + 4);
  ctx.shadowBlur = 0;

  ctx.restore();
}

  getTotalGoldFromKills() {
    return this.goldThisFrame;
  }
}