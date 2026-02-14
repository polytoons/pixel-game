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
      // bossSpawn: "assets/sounds/boss_spawn.mp3",
      gameOver: "assets/sounds/game_over.mp3",
    };

    for (const [name, path] of Object.entries(soundFiles)) {
      const audio = new Audio();
      audio.src = path;
      audio.volume = this.soundVolume;
      audio.preload = "auto";
      this.sounds[name] = audio;
    }
  }

  loadMusic() {
    this.music = new Audio("assets/music/background.ogg");
    this.music.volume = this.musicVolume;
    this.music.loop = true;
    this.music.preload = "auto";
    
    // ⭐ KHÔNG dùng autoplay attribute vì sẽ bị chặn có âm thanh
    this.music.autoplay = false;
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
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
      this.music.src = "";
      this.music.load(); // Force unload
    }

    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.pause();
        sound.currentTime = 0;
        sound.src = "";
        sound.load();
      }
    }

    console.log("🔇 Audio cleaned up");
  }

  play(soundName) {
    if (!this.soundEnabled) return;
    
    const sound = this.sounds[soundName];
    if (!sound) return;

    // Clone để có thể phát nhiều sound cùng lúc
    const clone = sound.cloneNode();
    clone.volume = this.soundVolume;
    clone.play().catch(e => {
      console.warn(`Failed to play ${soundName}:`, e.message);
    });
  }

  // Gameplay sounds
  playShoot() { this.play("shoot"); }
  playHit() { this.play("hit"); }
  playEnemyDie() { this.play("enemyDie"); }
  playPlayerHit() { this.play("playerHit"); }
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
    for (const sound of Object.values(this.sounds)) {
      sound.volume = this.soundVolume;
    }
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) {
      this.music.volume = this.musicVolume;
    }
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