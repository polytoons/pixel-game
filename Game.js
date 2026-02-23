import { Player } from "./Player.js";
import { Bullet } from "./Bullet.js";
import { InputHandler } from "./InputHandler.js";
import { WaveManager } from "./WaveManager.js";
import { Inventory } from "./Inventory.js";
import { Currency } from "./Currency.js";
import { Shop } from "./Shop.js";
import { GameState } from "./GameState.js";
import { LobbyUI } from "./LobbyUI.js";
import { Map } from "./Map.js";
import { Camera } from "./Camera.js";
import { SoundManager } from "./SoundManager.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.soundManager = new SoundManager();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.gameState = new GameState();

    this.inventory = new Inventory();
    this.currency = new Currency();
    this.shop = new Shop();

    this.player = new Player(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.soundManager,
    );

    this.lobbyUI = new LobbyUI(
      this.inventory,
      this.currency,
      this.shop,
      this.player,
      this.soundManager, // Thêm param
    );

    this.bullets = [];
    this.inputHandler = new InputHandler();
    this.inputHandler.init(canvas);

    // ⭐ Flag để ngăn click liên tục khi chuyển scene
    this.isTransitioning = false;

    this.inputHandler.onMouseClick = (x, y) => {
      // ⭐ Không xử lý click khi đang chuyển scene
      if (this.isTransitioning) return;

      if (this.gameState.getState() === "lobby") {
        const result = this.lobbyUI.handleClick(
          x,
          y,
          this.canvas.width,
          this.canvas.height,
        );
        if (result && result.action === "startGame") {
          this.startGame(result.level);
        }
      }
    };

    this.inputHandler.onMouseMove = (x, y) => {
      if (this.gameState.getState() === "lobby") {
        this.lobbyUI.handleMouseMove(
          x,
          y,
          this.canvas.width,
          this.canvas.height,
        );
      }
    };

    this.inputHandler.onEscapePress = () => {
      if (this.gameState.getState() === "playing") {
        this.returnToLobby();
      }
    };

    this.waveManager = null;

    // Map system
    this.maps = {};
    this.currentMap = null;
    this.camera = null;
    this.scale = 1.5;

    // ⭐ Game over button tracking
    this.gameOverButtonClicked = false;

    this.player.updateStats(this.inventory.getTotalStats());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.camera) {
      this.camera.update(this.canvas.width, this.canvas.height);
    }

    if (
      this.player &&
      this.gameState &&
      this.gameState.getState() === "lobby"
    ) {
      this.player.x = this.canvas.width / 2;
      this.player.y = this.canvas.height / 2;
    }
  }

  async startGame(levelId) {
  const levelConfig = this.lobbyUI.getSelectedLevel(levelId);  // truyền id trực tiếp
  if (!levelConfig) {
    console.error("❌ Không tìm thấy level config cho id:", levelId);
    return;
  }

    // Load map nếu level có map
    if (levelConfig.hasMap) {
      if (!this.maps[levelConfig.mapFile]) {
        this.maps[levelConfig.mapFile] = new Map();
        const loaded = await this.maps[levelConfig.mapFile].load(
          levelConfig.mapFile,
        );

        if (!loaded) {
          console.error("Failed to load map:", levelConfig.mapFile);
          return;
        }
      }

      this.currentMap = this.maps[levelConfig.mapFile];

      this.camera = new Camera(
        this.canvas.width,
        this.canvas.height,
        this.currentMap.getMapWidth(),
        this.currentMap.getMapHeight(),
      );

      const spawnPos = this.currentMap.getSpawnPosition();
      this.player.x = spawnPos.x;
      this.player.y = spawnPos.y;

      const isBossLevel = levelConfig.bossWaves?.includes(1) ?? false;
if (isBossLevel) {
  this.player.x = 160;
  this.player.y = 160;
} else {
  this.player.x = spawnPos.x;
  this.player.y = spawnPos.y;
}

      this.waveManager = new WaveManager(
        this.currentMap.getMapWidth(),
        this.currentMap.getMapHeight(),
        this.inventory,
        levelConfig,
        this.currentMap,
      );
      this.waveManager.soundManager = this.soundManager;
    } else {
      this.currentMap = null;
      this.camera = null;
      this.player.x = this.canvas.width / 2;
      this.player.y = this.canvas.height / 2;

      this.waveManager = new WaveManager(
        this.canvas.width,
        this.canvas.height,
        this.inventory,
        levelConfig,
        null,
      );
      this.waveManager.soundManager = this.soundManager;
    }
    
    // ⭐ Reset player state đầy đủ
    this.player.reset();
    this.bullets = [];
    this.gameOverButtonClicked = false;
    
    const isBossLevel = levelConfig.bossWaves?.includes(1) ?? false;
    this.soundManager.playBgm(isBossLevel ? "boss" : "normal");
    
    this.gameState.setState("playing");
    this.waveManager.startNextWave(this.player.x, this.player.y);
  }

  returnToLobby() {
    // ⭐ Bật flag chuyển scene
    this.isTransitioning = true;
    this.soundManager.stopBgm();
    
    // ⭐ Reset game state
    this.gameState.setState("lobby");
    this.waveManager = null;
    this.bullets = [];
    this.currentMap = null;
    this.camera = null;
    this.gameOverButtonClicked = false;

    // ⭐ Reset player về trạng thái ban đầu
    this.player.reset();
    this.player.x = this.canvas.width / 2;
    this.player.y = this.canvas.height / 2;
    this.player.hp = this.player.maxHp;

    // ⭐ Force reset mouse state để tránh click xuyên qua
    this.inputHandler.mouseDown = false;

    // ⭐ Tắt flag sau 100ms (đủ thời gian để người dùng thả chuột)
    setTimeout(() => {
      this.isTransitioning = false;
    }, 100);
  }

  update() {
    if (this.gameState.getState() !== "playing") return;
    if (!this.waveManager) return;

    // Convert mouse coordinates
    let worldMouseX = this.inputHandler.mouseX;
    let worldMouseY = this.inputHandler.mouseY;

    if (this.camera) {
      const worldPos = this.camera.screenToWorld(
        this.inputHandler.mouseX,
        this.inputHandler.mouseY,
      );
      worldMouseX = worldPos.x;
      worldMouseY = worldPos.y;
    }

    this.player.update(this.inputHandler.keys, worldMouseX, worldMouseY);

    // Apply collision
    if (this.currentMap) {
      this.player.constrainToMap(this.currentMap);
    } else {
      this.player.constrainToCanvas(this.canvas.width, this.canvas.height);
    }

    // Update camera
    if (this.camera) {
      this.camera.follow(this.player);
    }

    if (this.inputHandler.mouseDown) {
      const bulletData = this.player.shoot(worldMouseX, worldMouseY);

      if (bulletData !== null) {
        this.bullets.push(
          new Bullet(
            bulletData.x,
            bulletData.y,
            bulletData.velocityX,
            bulletData.velocityY,
            bulletData.damage,
            this.scale,
          ),
        );
        this.soundManager.playShoot();
      }
    }

    this.bullets.forEach((bullet) => bullet.update());

    const mapWidth = this.currentMap
      ? this.currentMap.getMapWidth()
      : this.canvas.width;
    const mapHeight = this.currentMap
      ? this.currentMap.getMapHeight()
      : this.canvas.height;

    this.bullets = this.bullets.filter(
      (bullet) => bullet.active && !bullet.isOffScreen(mapWidth, mapHeight),
    );

    const killedCount = this.waveManager.update(
  this.player.x, this.player.y, this.soundManager, this.player
);
const goldEarned = this.waveManager.getTotalGoldFromKills();
if (goldEarned > 0) {
  this.currency.add(goldEarned);
}

    const collisionResult = this.waveManager.checkCollisions(
      this.bullets,
      this.player,
    );
    if (collisionResult.hit) {
      this.player.takeDamage(collisionResult.damage);
    }

    if (!this.player.isAlive()) {
      this.gameState.setState("gameover");
      // ⭐ Reset flag khi vào game over
      this.gameOverButtonClicked = false;
      this.soundManager.playGameOver();
    }

    if (this.waveManager && this.waveManager.isCompleted) {
      this.gameState.setState("victory");
      this.gameOverButtonClicked = false;
    }
  }

  draw() {
    if (this.gameState.getState() === "lobby") {
      this.lobbyUI.draw(this.ctx, this.canvas.width, this.canvas.height);
      return;
    }

    // Background
    this.ctx.fillStyle = "#2a2a3e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw map or grid
    if (this.currentMap && this.camera) {
      this.currentMap.draw(this.ctx, this.camera);
    } else {
      this.drawGrid();
    }

    // Apply camera transform
    this.ctx.save();

    if (this.camera) {
      this.ctx.translate(-this.camera.x, -this.camera.y);
    }

    // Draw world objects
    if (this.waveManager) {
      this.waveManager.draw(this.ctx, this.camera);
    }

    this.bullets.forEach((bullet) => bullet.draw(this.ctx));
    this.player.draw(this.ctx);

    this.ctx.restore();

    // Draw UI
    this.drawUI();
    if (this.waveManager) this.waveManager.drawBossHP(this.ctx, this.canvas.width);

    if (this.gameState.getState() === "gameover") {
      this.drawGameOver();
    }

    if (this.gameState.getState() === "victory") {
      this.drawVictory();
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    this.ctx.lineWidth = 1;

    for (let x = 0; x < this.canvas.width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawUI() {
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 16px Arial";

    if (this.waveManager) {
      this.ctx.fillText(this.waveManager.getWaveProgress(), 10, 25);
      this.ctx.fillText(
        `Tiêu diệt: ${this.waveManager.totalEnemiesKilled}`,
        10,
        50,
      );
    }

    this.ctx.fillText(`HP: ${this.player.hp}/${this.player.maxHp}`, 10, 75);

    this.ctx.font = "20px Arial";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(`💰 ${this.currency.getGold()}`, 10, 100);

    const stats = this.inventory.getTotalStats();
    this.ctx.font = "20px Arial";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(`⚔️ ${this.player.damage}`, 10, 125);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(`🛡️ ${this.player.armor}`, 10, 145);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(`⚡ ${this.player.speed.toFixed(1)}`, 10, 165);

    if (this.waveManager && this.waveManager.levelConfig) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 14px Arial";
      this.ctx.textAlign = "right";
      this.ctx.fillText(
        `📍 ${this.waveManager.levelConfig.name}`,
        this.canvas.width - 10,
        25,
      );
      this.ctx.textAlign = "left";
    }
  }

  drawGameOver() {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 48px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "GAME OVER",
      this.canvas.width / 2,
      this.canvas.height / 2 - 80,
    );

    this.ctx.font = "24px Arial";
    if (this.waveManager) {
      this.ctx.fillText(
        `Đạt đến đợt: ${this.waveManager.currentWave}`,
        this.canvas.width / 2,
        this.canvas.height / 2 - 30,
      );
      this.ctx.fillText(
        `Tiêu diệt: ${this.waveManager.totalEnemiesKilled} quái`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 10,
      );
    }
    this.ctx.fillText(
      `Vàng: ${this.currency.getGold()}💰`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 50,
    );

    const btnWidth = 250;
    const btnHeight = 50;
    const btnX = (this.canvas.width - btnWidth) / 2;
    const btnY = this.canvas.height / 2 + 90;

    this.ctx.fillStyle = "#4CAF50";
    this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

    this.ctx.strokeStyle = "#2E7D32";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 20px Arial";
    this.ctx.fillText("QUAY LẠI", this.canvas.width / 2, btnY + 33);

    // ⭐ Chỉ xử lý click nếu chưa được click và đang ở game over state
    if (
      !this.gameOverButtonClicked &&
      this.gameState.getState() === "gameover" &&
      this.inputHandler.mouseDown
    ) {
      const mouseX = this.inputHandler.mouseX;
      const mouseY = this.inputHandler.mouseY;

      if (
        mouseX >= btnX &&
        mouseX <= btnX + btnWidth &&
        mouseY >= btnY &&
        mouseY <= btnY + btnHeight
      ) {
        // ⭐ Đánh dấu đã click để tránh click nhiều lần
        this.gameOverButtonClicked = true;

        // ⭐ Đợi người dùng thả chuột trước khi quay về lobby
        const checkMouseRelease = () => {
          if (!this.inputHandler.mouseDown) {
            this.returnToLobby();
          } else {
            requestAnimationFrame(checkMouseRelease);
          }
        };
        requestAnimationFrame(checkMouseRelease);
      }
    }

    this.ctx.textAlign = "left";
  }

  drawVictory() {
    // Nền mờ
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Tiêu đề
    this.ctx.fillStyle = "#FFD700";
    this.ctx.font = "bold 48px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "CHIẾN THẮNG! 🏆",
      this.canvas.width / 2,
      this.canvas.height / 2 - 80,
    );

    // Thống kê
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "24px Arial";
    if (this.waveManager) {
      this.ctx.fillText(
        `Hoàn thành ${this.waveManager.maxWaves} đợt!`,
        this.canvas.width / 2,
        this.canvas.height / 2 - 20,
      );
      this.ctx.fillText(
        `Tiêu diệt: ${this.waveManager.totalEnemiesKilled} quái`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 20,
      );
    }
    this.ctx.fillStyle = "#FFD700";
    this.ctx.fillText(
      `Vàng: ${this.currency.getGold()} 💰`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 60,
    );

    // Nút quay lại
    const btnWidth = 250,
      btnHeight = 50;
    const btnX = (this.canvas.width - btnWidth) / 2;
    const btnY = this.canvas.height / 2 + 100;

    this.ctx.fillStyle = "#FFD700";
    this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    this.ctx.strokeStyle = "#b8860b";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    this.ctx.fillStyle = "#000";
    this.ctx.font = "bold 20px Arial";
    this.ctx.fillText("QUAY LẠI", this.canvas.width / 2, btnY + 33);

    // Xử lý click nút
    if (
      !this.gameOverButtonClicked &&
      this.gameState.getState() === "victory" &&
      this.inputHandler.mouseDown
    ) {
      const mouseX = this.inputHandler.mouseX;
      const mouseY = this.inputHandler.mouseY;

      if (
        mouseX >= btnX &&
        mouseX <= btnX + btnWidth &&
        mouseY >= btnY &&
        mouseY <= btnY + btnHeight
      ) {
        this.gameOverButtonClicked = true;
        const checkMouseRelease = () => {
          if (!this.inputHandler.mouseDown) {
            this.returnToLobby();
          } else {
            requestAnimationFrame(checkMouseRelease);
          }
        };
        requestAnimationFrame(checkMouseRelease);
      }
    }

    this.ctx.textAlign = "left";
  }

  gameLoop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  start() {
    this.gameLoop();
  }
}
