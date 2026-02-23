export class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.soundVolume = 0.3;
    this.musicVolume = 0.2;
    this.musicEnabled = true;
    this.soundEnabled = true;
    
    // ⭐ Flag để track user interaction
    this.userInteracted = false;
    this.attemptedAutoplay = false;
    
    this._audioPool = {}; // ← THÊM vào constructor
    this.loadSounds();
    this.loadMusic();
    this.setupVisibilityHandler();
    this.setupCleanup();
    
    // ⭐ Setup autoplay khi user tương tác lần đầu
    this.setupAutoplayOnInteraction();
  }

  loadSounds() {
    const soundFiles = {
      shoot: "assets/sounds/shoot.wav",
      hit: "assets/sounds/hit.wav",
      enemyDie: "assets/sounds/enemy_die.wav",
      playerHit: "assets/sounds/player_hit.wav",
      uiClick: "assets/sounds/ui_click.wav",
      waveStart: "assets/sounds/wave_start.wav",
      bossHit: "assets/sounds/boss_hit.wav",
      gameOver: "assets/sounds/game_over.mp3",
    };
    
    this._poolIdx = {};      // con trỏ round-robin mỗi sound
    
    for (const [name, path] of Object.entries(soundFiles)) {
      this._audioPool[name] = Array.from({ length: 3 }, () => {
      const a = new Audio(path);
      a.volume = this.soundVolume;
      a.preload = "auto";
      return a;
    });
    this._poolIdx[name] = 0;
    }
  }

  loadMusic() {
  // Nhạc màn thường (giữ nguyên file cũ)
  this.musicNormal = new Audio("assets/music/background.ogg");
  this.musicNormal.volume = this.musicVolume;
  this.musicNormal.loop   = true;
  this.musicNormal.preload = "auto";
  this.musicNormal.autoplay = false;

  // Nhạc màn boss (thêm mới)
  this.musicBoss = new Audio("assets/music/fight.ogg"); // ← đổi đường dẫn
  this.musicBoss.volume = this.musicVolume;
  this.musicBoss.loop   = true;
  this.musicBoss.preload = "auto";
  this.musicBoss.autoplay = false;

  // Alias: this.music trỏ vào track đang active (tương thích code cũ)
  this.music = this.musicNormal;
}

playBgm(type = "normal") {
  const next = type === "boss" ? this.musicBoss : this.musicNormal;
  if (this.music === next && !next.paused) return; // đang phát đúng track rồi

  // Dừng track hiện tại
  if (this.music) {
    this.music.pause();
    this.music.currentTime = 0;
  }

  this.music = next; // cập nhật alias

  if (this.musicEnabled && this.userInteracted) {
    this.music.play().catch(e => console.warn("BGM play failed:", e.message));
  }
}

stopBgm() {
  if (this.music) {
    this.music.pause();
    this.music.currentTime = 0;
  }
}

  // ⭐ THÊM: Tự động phát nhạc khi user tương tác lần đầu
  setupAutoplayOnInteraction() {
    const attemptAutoplay = () => {
      if (!this.userInteracted && !this.attemptedAutoplay) {
        this.userInteracted = true;
        this.attemptedAutoplay = true;
        
        if (this.musicEnabled) {
          this.playMusic();
        }
        
        // Remove listeners sau khi đã phát nhạc
        document.removeEventListener('click', attemptAutoplay);
        document.removeEventListener('touchstart', attemptAutoplay);
        document.removeEventListener('keydown', attemptAutoplay);
      }
    };

    // Lắng nghe MỌI loại tương tác
    document.addEventListener('click', attemptAutoplay, { once: true });
    document.addEventListener('touchstart', attemptAutoplay, { once: true });
    document.addEventListener('keydown', attemptAutoplay, { once: true });
  }

  setupVisibilityHandler() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // ⭐ Tab bị ẩn → Pause nhạc
        this.pauseMusic();
        console.log("⏸️ Tab hidden - Music paused");
      } else {
        // ⭐ Tab được focus lại → Resume nhạc
        if (this.musicEnabled && this.userInteracted) {
          this.resumeMusic();
          console.log("▶️ Tab visible - Music resumed");
        }
      }
    });
  }

  setupCleanup() {
    const cleanup = () => {
      this.cleanup();
    };
    
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("unload", cleanup);
    window.addEventListener("pagehide", cleanup);
  }

  cleanup() {
  for (const bgm of [this.musicNormal, this.musicBoss]) {
    if (bgm) {
      bgm.pause();
      bgm.currentTime = 0;
      bgm.src = "";
      bgm.load();
    }
  }
  // SỬA: duyệt _audioPool thay vì this.sounds
  for (const pool of Object.values(this._audioPool)) {
    for (const audio of pool) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audio.load();
    }
  }
  console.log("🔇 Audio cleaned up");
}

  play(soundName) {
    if (!this.soundEnabled) return;
  const pool = this._audioPool[soundName];
  if (!pool) return;

  // Lấy slot theo round-robin
  const idx   = this._poolIdx[soundName];
  const audio = pool[idx];
  this._poolIdx[soundName] = (idx + 1) % pool.length;

  audio.currentTime = 0;
  audio.volume      = this.soundVolume;
  audio.play().catch(() => {});
  }

  // Gameplay sounds
  playShoot() { this.play("shoot"); }
  playHit() { this.play("hit"); }
  playEnemyDie() { this.play("enemyDie"); }
  playPlayerHit() { this.play("playerHit"); }
  playBossHit() { this.play("bossHit"); }
  playUIClick() { this.play("uiClick"); }
  playWaveStart() { this.play("waveStart"); }
  // playBossSpawn() { this.play("bossSpawn"); }
  playGameOver() { this.play("gameOver"); }

  // Music control
  playMusic() {
    if (!this.musicEnabled || !this.music) return;
    
    this.music.play().catch((err) => {
      console.warn("Failed to play music:", err.message);
      
      // Nếu fail do autoplay policy, đợi user interact
      if (err.name === 'NotAllowedError') {
        console.log("⏳ Waiting for user interaction to play music...");
      }
    });
  }

  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
  }

  pauseMusic() {
    if (this.music && !this.music.paused) {
      this.music.pause();
    }
  }

  resumeMusic() {
    if (this.musicEnabled && this.music && this.music.paused) {
      this.music.play().catch((err) => {
        console.warn("Failed to resume music:", err.message);
      });
    }
  }

  setSoundVolume(volume) {
  this.soundVolume = Math.max(0, Math.min(1, volume));
  for (const pool of Object.values(this._audioPool)) {
    for (const audio of pool) {
      audio.volume = this.soundVolume;
    }
  }
}

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
  if (this.musicNormal) this.musicNormal.volume = this.musicVolume;
  if (this.musicBoss)   this.musicBoss.volume   = this.musicVolume;
}

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled && this.userInteracted) {
      this.playMusic();
    } else {
      this.stopMusic();
    }
    return this.musicEnabled;
  }
}