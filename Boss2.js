import { EnemyBullet } from "./EnemyBullet.js";
import {
  _bulletImg,
  BULLET_FRAMES,
  BULLET_FW,
  BULLET_FH,
} from "./EnemyBullet.js";

export class Boss2 {
  constructor(x, y, soundManager = null) {
    this.x = x;
    this.y = y;
    this.type = "boss2";
    this.isBoss = true;
    this.active = true;
    this.isDead = false;

    this.frameW = 40;
    this.frameH = 40;
    this.scale = 5;
    this.width = this.frameW * this.scale;
    this.height = this.frameH * this.scale;

    this.maxHp = 4000;
    this.hp = this.maxHp;
    this.damage = 50;
    this.armor = 15;
    this.speed = 1.2;
    this.goldDrop = [250, 450];

    this.img = new Image();
    this.img.src = "assets/boss_2.png";
    this.img.onload = () => console.log("✅ Boss2 sprite loaded");
    this.img.onerror = () =>
      console.warn("⚠️ Boss2 sprite NOT found – fallback");

    this.anims = {
      idle: { row: 0, frames: 5, delay: 9, loop: true },
      attack: { row: 1, frames: 10, delay: 8, loop: false },
      jump: { row: 2, frames: 6, delay: 9, loop: true }, // ← loop: true để anim không đơ
      dead: { row: 3, frames: 3, delay: 12, loop: false },
    };
    this.state = "idle";
    this.frame = 0;
    this.frameTick = 0;

    this._hitFlash = 0;
    this._FLASH_DUR = 10;
    this._flashCanvas = null;

    this._deathTimer = 0;

    this.hitboxW = this.width * 0.65;
    this.hitboxH = this.height * 0.45;
    this.hitboxOffsetY = 10;
    this.debugHitbox = false;

    this.pendingBullets = [];
    this.pendingMinions = [];

    // ── Skill AI ───────────────────────────────────────────────────────────
    this.skillPool = ["jumpLand", "dash", "orbitBullets"];
    this._lastSkill = null;
    this._currentSkill = null;
    this._skillCasted = false;
    this._casting = false;
    this._pendingSkill = null;
    this._pendingSkillArgs = null;
    this._playerRef = null;

    this._skillDelay = 150;
    this._animSpeed = 1.0;
    this._p2SkillDelay = 60;
    this._p2AnimSpeed = 1.6;
    this._phase2 = false;
    this._skillTimer = 0;

    this.mapW = 1280;
    this.mapH = 720;

    // ── Skill 1: Jump & Land ───────────────────────────────────────────────
    this._jumpPhase = 0;
    this._jumpTimer = 0;
    this._jumpRiseDuration = 40;
    this._jumpFallDuration = 20;
    this._jumpStartY = 0;
    this._jumpTargetX = 0;
    this._jumpTargetY = 0;
    this._jumpFallStartY = 0;
    this._jumpWarnX = 0;
    this._jumpWarnY = 0;
    this._jumpWarnActive = false;

    // ── [MỚI] Pause sau khi đáp đất ───────────────────────────────────────
    // Tăng _landPauseDur để boss "đứng im" lâu hơn sau khi đáp.
    this._landPauseTimer = 0;
    this._landPauseDur = 30; // ← ĐIỀU CHỈNH Ở ĐÂY (frames ≈ 0.9s ở 60fps)

    // ── Skill 2: Dash ──────────────────────────────────────────────────────
    this._dashState = null;
    this._dashTimer = 0;
    this._dashWarningDur = 0;
    this._dashActiveDur = 20;
    this._dashPauseDur = 10;
    this._dashCount = 0;
    this._dashMaxCount = 1;
    this._dashStartX = 0;
    this._dashStartY = 0;
    this._dashTargetX = 0;
    this._dashTargetY = 0;
    this._dashZoneEvery = 4;

    // ── Skill 3: Orbit Bullets ─────────────────────────────────────────────
    this._orbitBullets = [];
    this._orbitMaxR = 480;
    // this._orbitFadeR       = 260;
    this._orbitCount = 6;
    this._orbitSpeed = 0.015;
    this._orbitExpand = 1.2;

    // ── Damage Zones ───────────────────────────────────────────────────────
    this._damageZones = [];
    this._trailPool = Array.from({ length: 9 }, () => this._makeTrail());
    this._smokePool = Array.from({ length: 40 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: -0.4,
      frame: 0,
      frameTick: 0,
      frameDelay: 3,
      scale: 1,
      alpha: 1,
    }));
    this._activeDashTrail = null;
    this._particles = []; // particle pool

    this._smokeImg = new Image();
    this._smokeImg.src = "assets/smoke.png"; // ← đường dẫn sprite của bạn
    this._SMOKE_FRAMES = 6;
    this._SMOKE_FW = 32; // frame width
    this._SMOKE_FH = 32; // frame height

    this._dashWarningDurP1 = 40; // phase 1
    this._dashWarningDurP2 = 20; // phase 2 — nhanh hơn gần 2×

    // ── Corner Turrets (phase 2 only) ──────────────────────────────────────
    this._corners = null;
    this._cornerTimer = 0;
    this._cornerInterval = 45; // 60 frame = 1s
    this._lastCornerIdx = -1; // tránh bắn cùng góc 2 lần liên tiếp
    this._cornerShotAngle = 0; // góc lệch tích luỹ mỗi lần bắn

    this._bulletPool = [];
    this._poolNextIdx = 0;

    this.soundManager = soundManager;
  }

  _acquireBullet(x, y, vx, vy, dmg, opts) {
    const len = this._bulletPool.length;
    for (let i = 0; i < len; i++) {
      const idx = (this._poolNextIdx + i) % len;
      const b = this._bulletPool[idx];
      if (!b.active) {
        this._poolNextIdx = (idx + 1) % len;
        return this._resetBullet(b, x, y, vx, vy, dmg, opts);
      }
    }
    if (this._bulletPool.length < 100) {
      const b = new EnemyBullet(x, y, vx, vy, dmg, opts);
      this._bulletPool.push(b);
      this._poolNextIdx = 0;
      return b;
    }
    return null; // cap đạt, bỏ qua bullet này
  }

  _resetBullet(b, x, y, vx, vy, dmg, opts) {
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.damage = dmg;
    b.active = true;
    b.lifetime = 0;
    b.maxLifetime = opts.maxLifetime ?? 180;
    b.radius = opts.radius ?? 8;
    b.color = opts.color ?? "#ffffff";
    b.trail = [];
    b.maxTrail = opts.maxTrail ?? 3; // 6 → 3
    b._trailHead = 0; // ← THÊM
    b._waveLast = 0; // ← THÊM
    b.waveAmplitude = opts.waveAmplitude ?? 0;
    b.waveFrequency = opts.waveFrequency ?? 0.1;
    b.waveOffset = 0;
    b.target = opts.target ?? null;
    b.turnRate = opts.turnRate ?? 0;
    b.targetX = opts.targetX ?? null;
    b.targetY = opts.targetY ?? null;
    if ("exploded" in b) b.exploded = false;
    if ("type" in b) b.type = opts.type ?? "normal";
    b.spriteFrame = 0;
    b.spriteFrameTick = 0;
    if (b.waveAmplitude > 0) {
      const spd = Math.sqrt(vx * vx + vy * vy) || 1;
      b._perpX = -vy / spd;
      b._perpY = vx / spd;
    } else {
      b._perpX = 0;
      b._perpY = 0;
    }
    return b;
  }

  // ── Anim helpers ──────────────────────────────────────────────────────────
  _setState(s) {
    if (this.state !== s && this.anims[s]) {
      this.state = s;
      this.frame = 0;
      this.frameTick = 0;
    }
  }

  // ══ Helper: tạo 1 trail object "rỗng" ════════════════════════════════════
  _makeTrail() {
    return {
      active: false, // false = slot trống, có thể tái dụng
      done: false, // true  = dash xong, đang đếm timer
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      angle: 0,
      halfH: 22,
      timer: 0,
      maxTimer: 500,
      damage: 0,
    };
  }

  // ══ Helper: lấy slot trống từ pool ═══════════════════════════════════════
  _acquireTrail() {
    // Ưu tiên slot inactive
    let slot = this._trailPool.find((t) => !t.active);
    if (!slot) {
      // Pool đầy: tái dụng slot done có timer cao nhất (gần hết nhất)
      slot = this._trailPool
        .filter((t) => t.done)
        .sort((a, b) => b.timer - a.timer)[0];
    }
    return slot || null; // an toàn: không làm gì nếu pool thực sự cạn
  }

  _acquireSmoke() {
    return this._smokePool.find((s) => !s.active) || null;
  }

  _spawnSmoke(x, y, scale = 1.2) {
    const s = this._acquireSmoke();
    if (!s) return;
    s.active = true;
    s.x = x + (Math.random() - 0.5) * 16;
    s.y = y + (Math.random() - 0.5) * 16;
    s.vx = (Math.random() - 0.5) * 0.5; // drift ngang nhẹ
    s.vy = -(0.3 + Math.random() * 0.5); // bay lên
    s.frame = 0;
    s.frameTick = 0;
    s.frameDelay = 3 + Math.floor(Math.random() * 3); // 3–5 tick/frame
    s.scale = scale * (0.8 + Math.random() * 0.4);
    s.alpha = 0.65 + Math.random() * 0.3;
  }

  // Spawn smoke ở damage zone (land) mỗi vài frame
  _spawnZoneSmoke() {
    for (const z of this._damageZones) {
      if (z.type !== "land") continue;
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;

      // Spawn mỗi 4 frame (dày hơn trước)
      if (z.timer % 8 !== 0) continue;

      // 3 smoke mỗi lần: 1 ở tâm, 2 ngẫu nhiên trong vùng
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * z.radius * 0.85;
        this._spawnSmoke(
          z.x + Math.cos(angle) * r,
          z.y + Math.sin(angle) * r,
          1.2 + Math.random() * 0.6, // scale 1.2–1.8
        );
      }
    }
    // Smoke dọc trail: spawn theo từng điểm trên đường thẳng
    for (const tr of this._trailPool) {
      if (!tr.active) continue;

      // Mỗi 3 frame spawn 1 làn smoke dọc trail
      // Dùng timer của trail để điều tiết
      const tick = tr.done
        ? tr.timer
        : Math.floor(Math.sqrt((tr.x2 - tr.x1) ** 2 + (tr.y2 - tr.y1) ** 2));
      if (tick % 3 !== 0) continue;

      const dx = tr.x2 - tr.x1,
        dy = tr.y2 - tr.y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // Chọn ngẫu nhiên 1 điểm trên đường trail
      const t = Math.random();
      const px = tr.x1 + dx * t;
      const py = tr.y1 + dy * t;
      // Lệch ngang so với hướng dash
      const nx = -dy / len,
        ny = dx / len; // pháp tuyến
      const off = (Math.random() - 0.5) * tr.halfH * 1.5;
      this._spawnSmoke(px + nx * off, py + ny * off, 0.85);
    }
  }

  _tickAnim() {
    const cfg = this.anims[this.state];
    if (!cfg) return this.frame;
    const prev = this.frame;
    if (++this.frameTick >= Math.ceil(cfg.delay / this._animSpeed)) {
      this.frameTick = 0;
      if (++this.frame >= cfg.frames)
        this.frame = cfg.loop ? 0 : cfg.frames - 1;
    }
    return prev;
  }

  _pickNextSkill() {
    const pool = this.skillPool.filter((s) => s !== this._lastSkill);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this._lastSkill = this._currentSkill = pick;
    return pick;
  }

  // ── Main update ───────────────────────────────────────────────────────────
  update(playerX, playerY, player = null) {
    if (player) this._playerRef = player;

    if (!this._corners && this._phase2) {
      const m = 80;
      this._corners = [
        { x: m, y: m },
        { x: this.mapW - m, y: m },
        { x: this.mapW - m, y: this.mapH - m },
        { x: m, y: this.mapH - m },
      ];
    }

    if (this.isDead) {
      this._tickAnim();
      if (this.frame >= this.anims.dead.frames - 1) {
        if (++this._deathTimer >= 30) this.active = false;
      }
      return;
    }

    // [MỚI] Land pause – coi là "bận" để skill cycle không kích hoạt sớm
    if (this._landPauseTimer > 0) {
      this._landPauseTimer--;
      if (this._landPauseTimer === 0) {
        this._casting = false; // chỉ mở casting SAU khi hết pause
        this._setState("idle");
      }
    }

    const isBusy =
      this._jumpPhase !== 0 ||
      this._dashState !== null ||
      this._landPauseTimer > 0; // ← thêm điều kiện land pause

    this._updateJump();
    this._updateDash();
    this._updateOrbitBullets();
    this._updateDamageZones();
    this._updateParticles();
    if (this._phase2) this._updateCornerTurrets();

    if (!isBusy) this._runSkillCycle(playerX, playerY);

    this._tickAnim();
    if (this._hitFlash > 0) this._hitFlash--;
  }

  // ── Skill cycle ───────────────────────────────────────────────────────────
  _runSkillCycle(px, py) {
    this._skillTimer++;
    if (!this._casting && this._skillTimer >= this._skillDelay) {
      this._skillTimer = 0;
      this._casting = true;
      this._skillCasted = false;
      this._pendingSkill = this._pickNextSkill();
      this._pendingSkillArgs = { px, py };
      console.log(`🎲 Boss2 picked: ${this._pendingSkill}`);

      if (this._pendingSkill === "jumpLand" || this._pendingSkill === "dash") {
        this._skillCasted = true;
        if (this._pendingSkill === "jumpLand") this._setState("jump");
        this._castSkill(this._pendingSkill, px, py);
        return;
      }
      this._setState("attack");
    }

    if (
      this._casting &&
      this.state === "attack" &&
      !this._skillCasted &&
      this.frame === 7
    ) {
      this._skillCasted = true;
      this._castSkill(
        this._pendingSkill,
        this._pendingSkillArgs.px,
        this._pendingSkillArgs.py,
      );
    }

    if (
      this._casting &&
      this._jumpPhase === 0 &&
      this._dashState === null &&
      this._landPauseTimer === 0 &&
      this.state === "attack" &&
      this.frame >= this.anims.attack.frames - 1
    ) {
      this._casting = false;
      this._setState("idle");
    }
  }

  _castSkill(name, px, py) {
    switch (name) {
      case "jumpLand":
        this._skill_jumpLand(px, py);
        break;
      case "dash":
        this._skill_dash(px, py);
        break;
      case "orbitBullets":
        this._skill_orbitBullets();
        break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SKILL 1 – Jump & Land
  // ══════════════════════════════════════════════════════════════════════════
  _skill_jumpLand(px, py) {
    this._jumpPhase = 1;
    this._jumpTimer = 0;
    this._jumpStartY = this.y;
    this._jumpWarnX = px;
    this._jumpWarnY = py;
    this._jumpWarnActive = true;
    this._jumpTargetX = px;
    this._jumpTargetY = py;
    console.log("🦘 Boss2 rising!");
  }

  _updateJump() {
    if (this._jumpPhase === 0) return;
    this._setState("jump");
    this._jumpTimer++;

    if (this._jumpPhase === 1) {
      const t = this._jumpTimer / this._jumpRiseDuration;
      const ease = 1 - (1 - t) * (1 - t);
      this.y = this._jumpStartY - ease * 700;

      if (this._jumpTimer >= this._jumpRiseDuration) {
        this.x = this._jumpTargetX;
        this.y = this._jumpTargetY - 520;
        this._jumpFallStartY = this.y;
        this._jumpPhase = 2;
        this._jumpTimer = 0;
        console.log("⬇️ Boss2 falling!");
      }
    } else if (this._jumpPhase === 2) {
      const t = this._jumpTimer / this._jumpFallDuration;
      const ease = t * t;
      this.x = this._jumpTargetX;
      this.y =
        this._jumpFallStartY +
        (this._jumpTargetY - this._jumpFallStartY) * ease;

      if (this._jumpTimer >= this._jumpFallDuration) {
        this.x = this._jumpTargetX;
        this.y = this._jumpTargetY;
        this._jumpPhase = 0;
        this._jumpWarnActive = false;
        this._onLand();
      }
    }
  }

  _onLand() {
    console.log("💥 Boss2 landed!");
    // Dọn zone land cũ đã hết nguy hiểm → không cần cap cứng
    this._damageZones = this._damageZones.filter(
      (z) => !(z.type === "land" && z.timer / z.maxTimer >= z.dangerRatio),
    );
    this._damageZones.push({
      x: this.x,
      y: this.y,
      radius: this._phase2 ? 155 : 115,
      timer: 0,
      maxTimer: 500,
      dangerRatio: 0.7,
      damage: this.damage * (this._phase2 ? 1.8 : 1.3),
      type: "land",
    });
    this._landPauseTimer = this._landPauseDur;
    this._setState("idle");
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SKILL 2 – Dash
  // ══════════════════════════════════════════════════════════════════════════
  _skill_dash(px, py) {
    this._dashMaxCount = this._phase2 ? 3 : 1;
    this._dashCount = 0;
    this._dashState = "warning";
    this._dashTimer = 0;
    this._dashTargetX = px;
    this._dashTargetY = py;
    this._dashWarningDur = this._phase2
      ? this._dashWarningDurP2
      : this._dashWarningDurP1;
    const dx = px - this.x,
      dy = py - this.y;
    this._dashAngle = Math.atan2(dy, dx);
  }

  _updateDash() {
    if (this._dashState === null) return;
    this._dashState === "active"
      ? this._setState("jump")
      : this._setState("idle");
    this._dashTimer++;

    if (this._dashState === "warning") {
      if (this._dashTimer >= this._dashWarningDur) {
        this._dashStartX = this.x;
        this._dashStartY = this.y;
        // Tái sử dụng trail object cho lần dash này
        if (this._phase2) {
          const slot = this._acquireTrail();
          if (slot) {
            // Reset slot và ghi dữ liệu mới — không tạo object mới
            slot.active = true;
            slot.done = false;
            slot.x1 = this.x;
            slot.y1 = this.y;
            slot.x2 = this.x;
            slot.y2 = this.y;
            slot.angle = this._dashAngle;
            slot.halfH = 22;
            slot.timer = 0;
            slot.maxTimer = 500;
            slot.damage = this.damage * 0.5;
            this._activeDashTrail = slot;
          }
        }
        this._dashState = "active";
        this._dashTimer = 0;
        this._setState("jump");
      }
    } else if (this._dashState === "active") {
      const t = this._dashTimer / this._dashActiveDur;
      this.x = this._dashStartX + (this._dashTargetX - this._dashStartX) * t;
      this.y = this._dashStartY + (this._dashTargetY - this._dashStartY) * t;

      // Cập nhật điểm đầu trail theo vị trí boss
      if (this._activeDashTrail) {
        this._activeDashTrail.x2 = this.x;
        this._activeDashTrail.y2 = this.y;
      }

      // Spawn particle dọc trail (nhẹ hơn nhiều so với zone)
      if (this._phase2 && this._dashTimer % 3 === 0) {
        this._spawnDashParticles(this.x, this.y);
      }

      if (this._dashTimer >= this._dashActiveDur) {
        this.x = this._dashTargetX;
        this.y = this._dashTargetY;
        if (this._activeDashTrail) {
          this._activeDashTrail.x2 = this.x;
          this._activeDashTrail.y2 = this.y;
          this._activeDashTrail.done = true; // đã xong, bắt đầu đếm timer
          this._activeDashTrail = null;
        }
        this._dashCount++;

        if (this._dashCount < this._dashMaxCount) {
          this._dashState = "pause";
          this._dashTimer = 0;
          this.frame = 0;
          this.frameTick = 0;
        } else {
          this._dashState = null;
          this._casting = false;
          this._setState("idle");
        }
      }
    } else if (this._dashState === "pause") {
      if (this._dashTimer >= this._dashPauseDur) {
        if (this._playerRef) {
          this._dashTargetX = this._playerRef.x;
          this._dashTargetY = this._playerRef.y;
        }
        const dx = this._dashTargetX - this.x,
          dy = this._dashTargetY - this.y;
        this._dashAngle = Math.atan2(dy, dx);
        this._dashState = "warning";
        this._dashTimer = 0;
      }
    }
  }

  _spawnDashParticles(x, y) {
    // // Giới hạn tổng particle để tránh lag
    // if (this._particles.length > 80) return;
    // const count = 4;
    // for (let i = 0; i < count; i++) {
    //   const a = this._dashAngle + Math.PI + (Math.random() - 0.5) * 1.2;
    //   const spd = 1.5 + Math.random() * 2.5;
    //   this._particles.push({
    //     x, y,
    //     vx: Math.cos(a) * spd,
    //     vy: Math.sin(a) * spd,
    //     life: 18 + Math.floor(Math.random() * 14),
    //     maxLife: 32,
    //     size: 2 + Math.random() * 3,
    //   });
    // }
    if (!this._phase2) return;
    const activeCount = this._smokePool.filter((s) => s.active).length;
    if (activeCount >= 36) return;
    for (let i = 0; i < 2; i++) this._spawnSmoke(x, y, 0.9);
  }

  _updateParticles() {
    for (const s of this._smokePool) {
      if (!s.active) continue;
      s.x += s.vx ?? 0;
      s.y += s.vy ?? -0.4;
      s.frameTick++;
      if (s.frameTick >= s.frameDelay) {
        s.frameTick = 0;
        s.frame++;
        if (s.frame >= this._SMOKE_FRAMES) {
          s.active = false;
          continue;
        }
      }
    }
    this._spawnZoneSmoke();
  }

  _drawParticles(ctx) {
    if (!this._smokeImg.complete || !this._smokeImg.naturalWidth) return;
    const fw = this._SMOKE_FW,
      fh = this._SMOKE_FH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const s of this._smokePool) {
      if (!s.active) continue;
      const drawW = fw * s.scale;
      const drawH = fh * s.scale;
      ctx.globalAlpha = s.alpha * (1 - s.frame / this._SMOKE_FRAMES);
      ctx.drawImage(
        this._smokeImg,
        s.frame * fw,
        0,
        fw,
        fh,
        s.x - drawW / 2,
        s.y - drawH / 2,
        drawW,
        drawH,
      );
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SKILL 3 – Orbit Bullets
  // ══════════════════════════════════════════════════════════════════════════
  _skill_orbitBullets() {
    const cx = this.x,
      cy = this.y;
    const n = this._orbitCount;

    for (let i = 0; i < n; i++) {
      this._orbitBullets.push({
        angle: ((Math.PI * 2) / n) * i,
        radius: 80,
        vAngle: this._orbitSpeed,
        vRadius: this._orbitExpand,
        reverse: false,
        frozen: true,
        freezeTimer: 60,
        centerX: cx,
        centerY: cy,
        alpha: 1.0,
      });
    }

    if (this._phase2) {
      for (let i = 0; i < n; i++) {
        this._orbitBullets.push({
          angle: ((Math.PI * 2) / n) * i + Math.PI / n,
          radius: 80,
          vAngle: -this._orbitSpeed,
          vRadius: this._orbitExpand,
          reverse: true,
          frozen: true,
          freezeTimer: 120,
          centerX: cx,
          centerY: cy,
          alpha: 1.0,
        });
      }
    }
    console.log(
      `🌀 Orbit cast tại (${Math.round(cx)},${Math.round(cy)}), tổng đạn: ${this._orbitBullets.length}`,
    );
  }

  _updateOrbitBullets() {
    const rem = [];
    this._orbitBullets.forEach((ob, i) => {
      if (ob.frozen) {
        if (--ob.freezeTimer <= 0) {
          ob.frozen = false;
          console.log("🌀 Orbit bullet unfrozen");
        }
      }
      if (!ob.frozen) {
        ob.angle += ob.vAngle;
        ob.radius += ob.vRadius;
      }
      ob.x = ob.centerX + Math.cos(ob.angle) * ob.radius;
      ob.y = ob.centerY + Math.sin(ob.angle) * ob.radius;
      if (ob.radius >= this._orbitMaxR) rem.push(i); // xoá ngay, không cần fade
    });
    for (let i = rem.length - 1; i >= 0; i--)
      this._orbitBullets.splice(rem[i], 1);
  }

  // ── Damage Zones ──────────────────────────────────────────────────────────
  _updateDamageZones() {
    this._damageZones = this._damageZones.filter((z) => ++z.timer < z.maxTimer);

    for (const tr of this._trailPool) {
      if (!tr.active || !tr.done) continue;
      if (++tr.timer >= tr.maxTimer) {
        tr.active = false; // trả về pool, không xoá object
        tr.done = false;
      }
    }
  }

  // ── Corner Turrets (phase 2 only) ─────────────────────────────────────────
  _updateCornerTurrets() {
    if (!this._corners) return;
    if (++this._cornerTimer < this._cornerInterval) return;
    this._cornerTimer = 0;

    let idx;
    do {
      idx = Math.floor(Math.random() * 4);
    } while (idx === this._lastCornerIdx);
    this._lastCornerIdx = idx;

    const c = this._corners[idx];
    const count = 12;
    this._cornerShotAngle += Math.PI / count;

    for (let i = 0; i < count; i++) {
      const a = this._cornerShotAngle + ((Math.PI * 2) / count) * i;
      const b = this._acquireBullet(
        // ← dùng pool thay vì new
        c.x,
        c.y,
        Math.cos(a) * 4.5,
        Math.sin(a) * 4.5,
        Math.floor(this.damage * 0.25),
        { radius: 8, color: "#ffea00", maxLifetime: 360, maxTrail: 3 },
      );
      if (b) this.pendingBullets.push(b); // ← chỉ push nếu không null
    }
  }

  // ── Collision helpers ──────────────────────────────────────────────────────
  collidesWith(bullet) {
    if (this.isDead || this._jumpPhase === 1) return false;
    const hcy = this.y + this.hitboxOffsetY;
    const hw = this.hitboxW / 2,
      hh = this.hitboxH / 2;
    const dx = Math.abs(bullet.x - this.x),
      dy = Math.abs(bullet.y - hcy);
    if (dx > hw + bullet.radius || dy > hh + bullet.radius) return false;
    if (dx <= hw || dy <= hh) return true;
    const cx = dx - hw,
      cy = dy - hh;
    return cx * cx + cy * cy <= bullet.radius * bullet.radius;
  }

  collidesWithPlayer(player) {
    if (this.isDead) return false;
    if (this._jumpPhase !== 0) return false; // ← THÊM: tắt hoàn toàn khi đang nhảy

    const hcy = this.y + this.hitboxOffsetY;
    const phcx = player.x + (player.hitboxOffsetX ?? 0);
    const phcy = player.y + (player.hitboxOffsetY ?? 0);
    const pw = (player.hitboxW ?? player.width) / 2;
    const ph = (player.hitboxH ?? player.height) / 2;
    return (
      Math.abs(this.x - phcx) < this.hitboxW / 2 + pw &&
      Math.abs(hcy - phcy) < this.hitboxH / 2 + ph
    );
  }

  checkSpecialHit(player) {
    if (this.isDead) return 0;

    for (const ob of this._orbitBullets) {
      if (ob.x === undefined) continue;
      const dx = ob.x - player.x,
        dy = ob.y - player.y;
      if (dx * dx + dy * dy < (20 + player.width * 0.35) ** 2)
        // ← 13 → 20
        return Math.floor(this.damage * 0.4);
    }

    for (const z of this._damageZones) {
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;
      const dx = player.x - z.x,
        dy = player.y - z.y;
      if (dx * dx + dy * dy < (z.radius + player.width * 0.3) ** 2)
        return z.damage;
    }

    for (const tr of this._trailPool) {
      if (!tr.active) continue;
      const dx = tr.x2 - tr.x1,
        dy = tr.y2 - tr.y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const cx = (tr.x1 + tr.x2) / 2,
        cy = (tr.y1 + tr.y2) / 2;
      const pdx = player.x - cx,
        pdy = player.y - cy;
      const cos = Math.cos(-tr.angle),
        sin = Math.sin(-tr.angle);
      const lx = cos * pdx - sin * pdy;
      const ly = sin * pdx + cos * pdy;
      const hw = len / 2 + player.width * 0.3;
      const hh = tr.halfH + player.width * 0.3;
      if (Math.abs(lx) < hw && Math.abs(ly) < hh) return tr.damage;
    }
    return 0;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  draw(ctx) {
    this._drawDamageZones(ctx);
    this._drawCornerIndicators(ctx);

    if (this._jumpWarnActive) this._drawJumpWarning(ctx);
    if (this._dashState === "warning") this._drawDashWarning(ctx);

    const hidden = this._jumpPhase === 1 && this.y < -this.height;
    if (!hidden) {
      ctx.save();
      if (this._jumpPhase === 1) {
        const t = this._jumpTimer / this._jumpRiseDuration;
        ctx.globalAlpha = Math.max(0, 1 - t * 1.2);
      }
      if (this._jumpPhase === 2 && this._jumpTimer <= 6) {
        ctx.globalAlpha = 0.3 + 0.7 * (this._jumpTimer / 6);
      }

      if (this.img.complete && this.img.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        const cfg = this.anims[this.state];
        const dx = Math.floor(this.x - this.width / 2);
        const dy = Math.floor(this.y - this.height / 2);
        ctx.drawImage(
          this.img,
          this.frame * this.frameW,
          cfg.row * this.frameH,
          this.frameW,
          this.frameH,
          dx,
          dy,
          this.width,
          this.height,
        );
        if (this._hitFlash > 0) {
          ctx.globalAlpha = this._hitFlash / this._FLASH_DUR;
          ctx.drawImage(this._buildFlashCanvas(cfg), dx, dy);
          ctx.globalAlpha = 1;
        }
      } else {
        const fc =
          this._hitFlash > 0 ? "#fff" : this._phase2 ? "#ff6d00" : "#7c4dff";
        ctx.fillStyle = fc;
        ctx.shadowColor = fc;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(
          this.x,
          this.y,
          this.width / 2,
          this.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`[${this.state}] f${this.frame}`, this.x, this.y + 5);
      }
      ctx.restore();
    }

    this._drawOrbitBullets(ctx);
    this._drawParticles(ctx);
    this._drawSkillLabel(ctx);
    if (this.debugHitbox && !hidden) this._drawDebugHitbox(ctx);
  }

  _drawJumpWarning(ctx) {
    const totalDur = this._jumpRiseDuration + this._jumpFallDuration;
    const elapsed =
      this._jumpPhase === 1
        ? this._jumpTimer
        : this._jumpRiseDuration + this._jumpTimer;
    const t = Math.min(elapsed / totalDur, 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 8);
    const r = 40 + 50 * Math.min(t * 2, 1);

    ctx.save();
    ctx.fillStyle = `rgba(80,0,180,${0.12 + 0.18 * t})`;
    ctx.beginPath();
    ctx.ellipse(
      this._jumpWarnX,
      this._jumpWarnY,
      45 + 80 * t,
      14 + 22 * t,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle = `rgba(200,50,255,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 3 + 2 * pulse;
    ctx.beginPath();
    ctx.arc(this._jumpWarnX, this._jumpWarnY, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.3 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this._jumpWarnX, this._jumpWarnY, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    const s = 12;
    ctx.strokeStyle = `rgba(255,80,255,${0.7 + 0.3 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this._jumpWarnX - s, this._jumpWarnY - s);
    ctx.lineTo(this._jumpWarnX + s, this._jumpWarnY + s);
    ctx.moveTo(this._jumpWarnX + s, this._jumpWarnY - s);
    ctx.lineTo(this._jumpWarnX - s, this._jumpWarnY + s);
    ctx.stroke();
    ctx.restore();
  }

  _drawDashWarning(ctx) {
    const t = Math.min(this._dashTimer / this._dashWarningDur, 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 10);

    const tx = this._dashTargetX,
      ty = this._dashTargetY;
    const dx = tx - this.x,
      dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist,
      ny = dy / dist;

    ctx.save();
    ctx.strokeStyle = `rgba(255,80,0,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 3 + 2 * pulse;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    const aw = 18 + 6 * pulse;
    const ax = tx - nx * aw,
      ay = ty - ny * aw;
    const px1 = ny * aw * 0.5,
      py1 = -nx * aw * 0.5;
    ctx.fillStyle = `rgba(255,100,0,${0.5 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ax + px1, ay + py1);
    ctx.lineTo(ax - px1, ay - py1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,100,0,${(0.5 + 0.4 * pulse) * 0.8})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 28 + 16 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    if (this._dashMaxCount > 1) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`×${this._dashMaxCount - this._dashCount}`, tx, ty + 6);
    }
    ctx.restore();
  }
  _drawDamageZones(ctx) {
    // Zone tròn (land)
    for (const z of this._damageZones) {
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;
      // Chỉ vẽ icon ⚠ ở tâm để player biết vị trí nguy hiểm
      ctx.save();
      ctx.strokeStyle = "#ee00ff";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]); // nét đứt dễ nhìn hơn nét liền
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `bold ${Math.round(z.radius * 0.28)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚠", z.x, z.y);
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    }

    // Viền vệt trail (hình chữ nhật xoay)
    for (const tr of this._trailPool) {
      if (!tr.active) continue;
      const dx = tr.x2 - tr.x1,
        dy = tr.y2 - tr.y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      if (len < 2) continue;
      const cx = (tr.x1 + tr.x2) / 2,
        cy = (tr.y1 + tr.y2) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tr.angle);

      // Viền nét đứt
      ctx.strokeStyle = "#ffab00";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(-len / 2, -tr.halfH, len, tr.halfH * 2);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // // Vẽ trail liền mạch (1 rect duy nhất)
    // if (!this._dashTrail) return;
    // const tr = this._dashTrail;
    // const cx = (tr.x1 + tr.x2) / 2, cy = (tr.y1 + tr.y2) / 2;
    // const dx = tr.x2 - tr.x1, dy = tr.y2 - tr.y1;
    // const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // // Fade out sau khi dash xong
    // const fadeRatio = this._dashState !== "active"
    //   ? 1 - tr.timer / tr.maxTimer
    //   : 1;
    // if (fadeRatio <= 0.05) return;

    // ctx.save();
    // ctx.globalAlpha = fadeRatio;
    // ctx.translate(cx, cy);
    // ctx.rotate(tr.angle);
    // ctx.fillStyle   = "rgba(255,140,0,0.40)";
    // ctx.strokeStyle = "#ffab00"; ctx.lineWidth = 2;
    // ctx.fillRect  (-len / 2, -tr.halfH, len, tr.halfH * 2);
    // ctx.strokeRect(-len / 2, -tr.halfH, len, tr.halfH * 2);
    // ctx.globalAlpha = 1;
    // ctx.restore();
  }

  _drawOrbitBullets(ctx) {
    if (this._orbitBullets.length === 0) return;
    if (!_bulletImg.complete || !_bulletImg.naturalWidth) {
      // Fallback arc nếu sprite chưa load
      this._orbitBullets.forEach((ob) => {
        if (ob.x === undefined) return;
        const color = ob.frozen
          ? "#888888"
          : ob.reverse
            ? "#ff6d00"
            : "#7c4dff";
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      return;
    }

    // Tick frame animation orbit (dùng chung 1 frame counter cho tất cả)
    if (!this._orbitSpriteFrame) this._orbitSpriteFrame = 0;
    if (!this._orbitSpriteTick) this._orbitSpriteTick = 0;
    if (++this._orbitSpriteTick >= 4) {
      this._orbitSpriteTick = 0;
      this._orbitSpriteFrame = (this._orbitSpriteFrame + 1) % BULLET_FRAMES;
    }

    const fw = BULLET_FW,
      fh = BULLET_FH;
    const scale = 48 / fw; // 40px hiển thị (đổi số này để to/nhỏ hơn)
    const dw = fw * scale,
      dh = fh * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this._orbitBullets.forEach((ob) => {
      if (ob.x === undefined) return;
      // Frozen: mờ hơn để phân biệt trạng thái
      ctx.globalAlpha = ob.frozen ? 0.4 : 1.0;
      ctx.drawImage(
        _bulletImg,
        this._orbitSpriteFrame * fw,
        0,
        fw,
        fh,
        ob.x - dw / 2,
        ob.y - dh / 2,
        dw,
        dh,
      );
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawCornerIndicators(ctx) {
    if (!this._corners || !this._phase2) return;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
    const progress = this._cornerTimer / this._cornerInterval;
    this._corners.forEach((c) => {
      ctx.save();
      // ctx.fillStyle = `rgba(255,234,0,${0.15 + 0.1 * pulse})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
      ctx.fill();
      // ctx.fillStyle = `rgba(255,234,0,${0.75 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,234,0,0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        c.x,
        c.y,
        18,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      ctx.stroke();
      ctx.restore();
    });
  }

  _drawSkillLabel(ctx) {
    // const names = { jumpLand: "🦘 JUMP & LAND", dash: "💨 DASH", orbitBullets: "🌀 ORBIT BULLETS" };
    // const busy  = this._casting || this._jumpPhase !== 0 || this._dashState !== null || this._landPauseTimer > 0;
    // if (!busy) return;
    // let label = names[this._currentSkill] || "";
    // if (this._phase2 && this._dashMaxCount > 1 && this._dashState !== null)
    //   label += ` [${this._dashCount + 1}/${this._dashMaxCount}]`;
    // if (this._phase2) label += " ⚡";
    // const lx = this._jumpPhase === 1 ? this._jumpWarnX : this.x;
    // const ly = this._jumpPhase === 1 ? this._jumpWarnY - 80 : this.y - this.height / 2 - 40;
    // ctx.save();
    // ctx.fillStyle = this._phase2 ? "#FF6D00" : "#FFD700";
    // ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
    // ctx.fillText(label, lx, ly);
    // ctx.restore();
  }

  _drawDebugHitbox(ctx) {
    const hcy = this.y + this.hitboxOffsetY;
    const hw = this.hitboxW / 2,
      hh = this.hitboxH / 2;
    ctx.save();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - hw, hcy - hh, this.hitboxW, this.hitboxH);
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(this.x, hcy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height,
    );
    ctx.setLineDash([]);
    ctx.restore();
  }

  getGoldDrop() {
    const [mn, mx] = this.goldDrop;
    return Math.floor(Math.random() * (mx - mn + 1)) + mn;
  }

  _buildFlashCanvas(cfg) {
    const cacheKey = `${this.state}_${this.frame}`;
    if (this._flashCacheKey === cacheKey && this._flashCanvas)
      return this._flashCanvas;
    this._flashCacheKey = cacheKey;
    if (!this._flashCanvas) {
      this._flashCanvas = document.createElement("canvas");
      this._flashCanvas.width = this.width;
      this._flashCanvas.height = this.height;
    }
    const fc = this._flashCanvas,
      fctx = fc.getContext("2d");
    fctx.clearRect(0, 0, fc.width, fc.height);
    fctx.drawImage(
      this.img,
      this.frame * this.frameW,
      cfg.row * this.frameH,
      this.frameW,
      this.frameH,
      0,
      0,
      fc.width,
      fc.height,
    );
    fctx.globalCompositeOperation = "source-in";
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, fc.width, fc.height);
    fctx.globalCompositeOperation = "source-over";
    return fc;
  }

  takeDamage(dmg) {
    if (this.isDead) return;
    const actual = Math.floor(dmg * (1 - Math.min(this.armor * 0.01, 0.75)));
    this.hp -= actual;
    this._hitFlash = this._FLASH_DUR;

    if (this.soundManager) this.soundManager.playBossHit();

    if (!this._phase2 && this.hp / this.maxHp < 0.5) {
      this._phase2 = true;
      this._skillDelay = this._p2SkillDelay;
      this._animSpeed = this._p2AnimSpeed;
      this._skillTimer = Math.min(this._skillTimer, this._p2SkillDelay - 1);
      console.log("🔴 BOSS2 PHASE 2 ACTIVATED!");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this._hitFlash = 0;
      // XÓA: this.active = false;
      this._orbitBullets = [];
      this._damageZones = [];
      this._jumpPhase = 0;
      this._dashState = null;
      this._landPauseTimer = 0;
      this._trailPool.forEach((t) => {
        t.active = false;
        t.done = false;
      });
      this._activeDashTrail = null;
      this._setState("dead");
      console.log("💀 BOSS2 defeated!");
    }
  }

  getDamage() {
    return this.damage;
  }
  getAndClearBullets() {
    const b = this.pendingBullets;
    this.pendingBullets = [];
    return b;
  }
  getAndClearMinions() {
    return [];
  }
}
