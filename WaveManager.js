import { Enemy } from "./Enemy.js";
import { SpawnWarning } from "./SpawnWarning.js";

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
    this.waveDelay = 180;
    this.delayCounter = 0;
    this.totalEnemiesKilled = 0;

    // this.isBossWave = false;
    // this.bossSpawned = false;

    // ⭐ THÊM: Lưu gold từ frame hiện tại
    this.goldThisFrame = 0;
    this.totalGoldEarned = 0;
    this.enemyBullets = [];

    this.maxWaves = 10;
    this.isCompleted = false;
  }

  startNextWave(playerX, playerY) {
    this.currentWave++;
    this.waveActive = true;
    this.delayCounter = 0;

    // ⭐ Phát âm thanh wave start
    this.soundManager.playWaveStart();
    // this.isBossWave =
    //   this.levelConfig.bossWaves &&
    //   this.levelConfig.bossWaves.includes(this.currentWave);
    // this.bossSpawned = false;

    // if (this.isBossWave) {
    //   this.spawnBossWave(playerX, playerY);
    // } else {
    //   this.spawnNormalWave(playerX, playerY);
    // }
    this.spawnNormalWave(playerX, playerY);
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

    const bossPos = this.getSpawnPosition(playerX, playerY);
    const bossWarning = new SpawnWarning(bossPos.x, bossPos.y, 150);
    this.spawnWarnings.push(bossWarning);

    this.pendingSpawns.push({
      x: bossPos.x,
      y: bossPos.y,
      type: this.levelConfig.bossType,
      warning: bossWarning,
    });

    const minionCount = 5 + Math.floor(this.currentWave / 5);
    for (let i = 0; i < minionCount; i++) {
      const angle = ((Math.PI * 2) / minionCount) * i;
      const distance = 150;
      const minionX = bossPos.x + Math.cos(angle) * distance;
      const minionY = bossPos.y + Math.sin(angle) * distance;

      const minionWarning = new SpawnWarning(minionX, minionY, 90);
      this.spawnWarnings.push(minionWarning);

      this.pendingSpawns.push({
        x: minionX,
        y: minionY,
        type: this.getEnemyTypeFromPool(),
        warning: minionWarning,
      });
    }
  }

  getEnemyTypeFromPool() {
    if (
      !this.levelConfig.enemyPool ||
      this.levelConfig.enemyPool.length === 0
    ) {
      return "zombie";
    }

    const totalWeight = this.levelConfig.enemyPool.reduce(
      (sum, enemy) => sum + enemy.weight,
      0,
    );
    let random = Math.random() * totalWeight;

    for (const enemy of this.levelConfig.enemyPool) {
      random -= enemy.weight;
      if (random <= 0) {
        return enemy.type;
      }
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

        if (distance >= 300) {
          return spawnPos;
        }
        attempts++;
      } while (attempts < maxAttempts);

      return spawnPos;
    }

    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 50;

    switch (side) {
      case 0:
        x = Math.random() * this.canvasWidth;
        y = -margin;
        break;
      case 1:
        x = this.canvasWidth + margin;
        y = Math.random() * this.canvasHeight;
        break;
      case 2:
        x = Math.random() * this.canvasWidth;
        y = this.canvasHeight + margin;
        break;
      case 3:
        x = -margin;
        y = Math.random() * this.canvasHeight;
        break;
    }
    return { x, y };
  }

  update(playerX, playerY, soundManager = null, player = null) {
    if (soundManager) this.soundManager = soundManager;

    // ⭐ Reset gold counter mỗi frame
    this.goldThisFrame = 0;

    this.spawnWarnings.forEach((warning) => warning.update());
    this.spawnWarnings = this.spawnWarnings.filter((w) => w.active);

    this.pendingSpawns = this.pendingSpawns.filter((spawn) => {
      if (spawn.warning.isComplete()) {
        const enemy = new Enemy(spawn.x, spawn.y, spawn.type);
        enemy.speed *= this.levelConfig.speedMultiplier;
        this.enemies.push(enemy);

        // if (enemy.isBoss) {
        //   this.bossSpawned = true;
        // }

        return false;
      }
      return true;
    });

    if (
      this.enemies.length === 0 &&
      this.pendingSpawns.length === 0 &&
      !this.waveActive
    ) {
      this.delayCounter++;

      if (this.delayCounter >= this.waveDelay) {
        if (this.currentWave >= this.maxWaves) {
          this.isCompleted = true; // ⭐ Đã qua wave 10 → báo hoàn thành
        } else {
          this.startNextWave(playerX, playerY, soundManager);
        }
      }
    }

    this.enemies.forEach((enemy) => enemy.update(playerX, playerY, player));

    const newBullets = [];
    this.enemies.forEach((e) => {
      const b = e.getAndClearBullets();
      if (b.length) newBullets.push(...b);
    });
    this.enemyBullets.push(...newBullets);

    // ⭐ Update đạn (wraith nổ → sinh thêm đạn con)
    const explosionBullets = [];
    this.enemyBullets.forEach((b) => {
      const spawned = b.update();
      if (spawned.length) explosionBullets.push(...spawned);
    });
    this.enemyBullets.push(...explosionBullets);

    // ⭐ Xóa đạn hết hiệu lực hoặc ra ngoài màn
    this.enemyBullets = this.enemyBullets.filter(
      (b) => b.active && !b.isOffScreen(this.canvasWidth, this.canvasHeight),
    );

    // ⭐ CRITICAL: Lưu gold TRƯỚC KHI xóa enemies
    let killedCount = 0;
    const activeEnemies = [];

    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        activeEnemies.push(enemy);
      } else {
        // ⭐ Enemy đã chết (active = false)
        killedCount++;
        this.totalEnemiesKilled++;

        // ⭐ Lấy gold từ enemy này
        const goldDropped = enemy.getGoldDrop();
        this.goldThisFrame += goldDropped;
        this.totalGoldEarned += goldDropped;

        console.log(
          `💰 ${enemy.type} dropped ${goldDropped} gold (Total: ${this.totalGoldEarned})`,
        );

        // Drop item (20% chance)
        if (Math.random() < 0.1) {
          const item = this.inventory.generateRandomItem();
          this.inventory.addItem(item);
        }
      }
    });

    // Cập nhật array enemies
    this.enemies = activeEnemies;

    if (
      this.enemies.length === 0 &&
      this.pendingSpawns.length === 0 &&
      this.waveActive
    ) {
      this.waveActive = false;

      // if (this.isBossWave) {
      //   console.log("🎉 Boss defeated!");
      // }
    }

    return killedCount;
  }

  draw(ctx) {
    this.spawnWarnings.forEach((warning) => {
      warning.draw(ctx);
    });

    this.enemies.forEach((enemy) => {
      enemy.draw(ctx);
    });

    this.enemyBullets.forEach((b) => b.draw(ctx));

    // if (
    //   this.isBossWave &&
    //   (this.enemies.length > 0 || this.pendingSpawns.length > 0)
    // ) {
    //   this.drawBossWaveIndicator(ctx);
    // }
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
    bullets.forEach((bullet) => {
      if (!bullet.active) return;

      this.enemies.forEach((enemy) => {
        if (enemy.active && enemy.collidesWith(bullet)) {
          enemy.takeDamage(bullet.damage);
          bullet.active = false;
        }
      });
    });

    let playerHit = false;
    let totalDamage = 0;

    this.enemies.forEach((enemy) => {
      if (enemy.active && enemy.collidesWithPlayer(player)) {
        playerHit = true;
        totalDamage = Math.max(totalDamage, enemy.getDamage());
      }
    });

    this.enemyBullets.forEach((bullet) => {
      if (!bullet.active) return;
      if (bullet.hitPlayer(player)) {
        // Wraith nổ khi chạm player
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

  getWaveProgress() {
    const totalEnemies = this.enemies.length + this.pendingSpawns.length;

    if (this.waveActive || totalEnemies > 0) {
      // const waveType = this.isBossWave ? "👑 BOSS" : "";
      return `Đợt ${this.currentWave}/${this.maxWaves} - Còn: ${totalEnemies} quái`;
    } else {
      const timeLeft = Math.ceil((this.waveDelay - this.delayCounter) / 60);
      return `Đợt tiếp theo trong: ${timeLeft}s`;
    }
  }

  // ⭐ METHOD ĐÃ SỬA - Trả về gold từ frame hiện tại
  getTotalGoldFromKills() {
    return this.goldThisFrame;
  }
}
