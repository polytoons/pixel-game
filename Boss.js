import { EnemyBullet } from "./EnemyBullet.js";
import { Enemy } from "./Enemy.js";

export class Boss {
  constructor(x, y, soundManager = null) {
    this.x = x;
    this.y = y;
    this.type = "eye_boss";
    this.isBoss = true;
    this.active = true;
    this.isDead = false;

    this.frameW = 62;
    this.frameH = 52;
    this.scale  = 5;
    this.width  = this.frameW * this.scale;
    this.height = this.frameH * this.scale;

    this.maxHp  = 3500;
    this.hp     = this.maxHp;
    this.damage = 35;
    this.armor  = 10;
    this.speed  = 1.0;
    this.goldDrop = [200, 400];

    // Sprite
    this.img = new Image();
    this.img.src = "assets/boss_demo.png";
    this.img.onload  = () => console.log("✅ Boss sprite loaded");
    this.img.onerror = () => console.warn("⚠️ Boss sprite NOT found – fallback circle");

    // ── Animations ─────────────────────────────────────────────────────
    this.anims = {
      idle:   { row: 0, frames: 5,  delay: 9, loop: true  },
      attack: { row: 1, frames: 13, delay: 7, loop: false },
      dead:   { row: 2, frames: 5,  delay: 9, loop: false },
    };
    this.state     = "idle";
    this.frame     = 0;
    this.frameTick = 0;

    // ── Hit flash (white, chỉ pixel có màu) ────────────────────────────
    this._hitFlash   = 0;
    this._FLASH_DUR  = 10;
    this._flashCanvas = null; // offscreen canvas, khởi tạo lazy

    // ── Hitbox ──────────────────────────────────────────────────────────
    // Chỉnh 3 con số này để căn hitbox:
    this.hitboxW       = this.width  * 0.6;  // chiều ngang  (0.0 → 1.0 × sprite width)
    this.hitboxH       = this.height * 0.4;  // chiều dọc    (0.0 → 1.0 × sprite height)
    this.hitboxOffsetY = 40;                 // dịch tâm xuống dưới (px)

    this._deathTimer = 0;

    // Đổi thành false khi căn chỉnh xong
    this.debugHitbox = false;

    // Bullets & minions
    this.pendingBullets = [];
    this.pendingMinions = [];
    this.delayedBombs   = [];
    this.delayedSpread  = [];

    // ── Skill AI ────────────────────────────────────────────────────────
    this.skillPool     = ["spreadShot", "bombField", "meteorStrike", "spawnMinions"];
    this._lastSkill    = null;
    this._currentSkill = null;
    this._skillCasted  = false;
    this._casting      = false;
    this._pendingSkill     = null;
    this._pendingSkillArgs = null;
    this._playerRef    = null;

    // ── Tunable stats — Phase 1 / Phase 2 ──────────────────────────────
    // Thay đổi các giá trị ở đây là đủ, không cần sửa chỗ nào khác.
    this._skillDelay   = 120;   // frame chờ giữa 2 skill   (phase 1 ~3s)
    this._moveDuration = 240;   // frame chase sau skill     (phase 1 ~2.5s)
    this._moveSpeed    = this.speed * 2; // tốc độ chase   (phase 1)
    this._animSpeed    = 1.0;   // nhân tốc độ animation     (phase 1)

    this._p2SkillDelay   = 60;            // phase 2 ~1.5s
    this._p2MoveDuration = 300;           // phase 2 ~4s
    this._p2MoveSpeed    = this.speed * 2.75; // phase 2 nhanh hơn hẳn
    this._p2AnimSpeed    = 1.8;           // phase 2 animation nhanh hơn 1.8×

    this._phase2     = false;
    this._p2FreezeTimer   = 0;       // ← THÊM
this._P2_FREEZE_DUR   = 45;      // ← THÊM: ~1.1s ở 60fps (chỉnh 40–80 tuỳ ý)
    this._skillTimer = 0;

    // ── Post-skill dash ─────────────────────────────────────────────────
    this._moving        = false;
    this._moveTimer     = 0;
    this._dashWaveCount = 0;

    // Map bounds (WaveManager ghi đè nếu cần)
    this.mapW = 1280;
    this.mapH = 720;

    this._bulletPool    = [];
    this._poolNextIdx   = 0;   // con trỏ vòng tròn thay vì find() linear

    this._meteorZones = [];

    this._smokePool = Array.from({ length: 30 }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: -0.4,
      frame: 0, frameTick: 0, frameDelay: 3, scale: 1, alpha: 1,
    }));

    this._smokeImg       = new Image();
    this._smokeImg.src   = "assets/smoke.png";
    this._SMOKE_FRAMES   = 6;
    this._SMOKE_FW       = 32;
    this._SMOKE_FH       = 32;

    // ── Meteor sprite (4 frame 16×16px nằm ngang) ───────────────────────
    this._meteorImg      = new Image();
    this._meteorImg.src  = "assets/meteor.png"; // ← đường dẫn sprite bạn cung cấp
    this._METEOR_FRAMES  = 4;
    this._METEOR_FW      = 16;
    this._METEOR_FH      = 16;
    this._meteorFrame    = 0;
    this._meteorTick     = 0;
    this._meteorImg.onload  = () => console.log("✅ meteor sprite loaded");
    this._meteorImg.onerror = () => console.warn("⚠️ meteor sprite NOT found");

    this.soundManager = soundManager; 
  }

  // ══ BULLET POOL HELPERS ══════════════════════════════════════════════════
  /** Lấy 1 bullet từ pool (tái sử dụng) hoặc tạo mới nếu pool trống */
  _acquireBullet(x, y, vx, vy, dmg, opts) {
  const len = this._bulletPool.length;
  for (let i = 0; i < len; i++) {
    const idx = (this._poolNextIdx + i) % len;
    const b   = this._bulletPool[idx];
    if (!b.active) {
      this._poolNextIdx = (idx + 1) % len;
      return this._resetBullet(b, x, y, vx, vy, dmg, opts);
    }
  }

  // ← Thêm: giới hạn pool tối đa 150 object
  if (this._bulletPool.length < 150) {
    const b = new EnemyBullet(x, y, vx, vy, dmg, opts);
    this._bulletPool.push(b);
    this._poolNextIdx = 0;
    return b;
  }
  return null;
}

  _resetBullet(b, x, y, vx, vy, dmg, opts) {
    b.x           = x;      b.y           = y;
    b.vx          = vx;     b.vy          = vy;
    b.damage      = dmg;
    b.active      = true;
    b.lifetime    = 0;
    b.maxLifetime = opts.maxLifetime ?? 180;
    b.radius      = opts.radius      ?? 8;
    b.color       = opts.color       ?? "#ffffff";
    b.trail       = [];
    b.maxTrail    = opts.maxTrail    ?? 3;   // ← SỬA: 6 → 3
    b._trailHead  = 0;                       // ← THÊM: reset circular buffer pointer
    b._waveLast   = 0;                       // ← THÊM: reset wave cache
    b.waveAmplitude = opts.waveAmplitude ?? 0;
    b.waveFrequency = opts.waveFrequency ?? 0.10;
    b.waveOffset    = 0;
    b.target        = opts.target   ?? null;
    b.turnRate      = opts.turnRate ?? 0;
    b.targetX       = opts.targetX  ?? null;
    b.targetY       = opts.targetY  ?? null;
    if ("exploded" in b) b.exploded = false;
    if ("type"     in b) b.type     = opts.type ?? "normal";

    b.spriteFrame      = 0;
    b.spriteFrameTick  = 0;

    if (b.waveAmplitude > 0) {
      const spd = Math.sqrt(vx * vx + vy * vy) || 1;
      b._perpX  = -vy / spd;
      b._perpY  =  vx / spd;
    } else {
      b._perpX = 0;
      b._perpY = 0;
    }
    return b;
  }

  /** WaveManager gọi hàm này; ta giữ reference để tái dụng về sau */
  getAndClearBullets() {
    const b = this.pendingBullets;
    this.pendingBullets = [];
    return b;
  }

  // ── Anim helpers ──────────────────────────────────────────────────────

  _setState(s) {
    if (this.state !== s && this.anims[s]) {
      this.state = s; this.frame = 0; this.frameTick = 0;
    }
  }

  /** Tick animation. Trả về frame TRƯỚC khi advance (dùng để detect frame transition). */
  _tickAnim() {
    const cfg = this.anims[this.state];
    if (!cfg) return this.frame;
    const prev = this.frame;
    // _animSpeed làm giảm delay → animation chạy nhanh hơn ở phase 2
    if (++this.frameTick >= Math.ceil(cfg.delay / this._animSpeed)) {
      this.frameTick = 0;
      if (++this.frame >= cfg.frames) {
        if (cfg.loop || this._moving) {
          this.frame = 0;
        } else {
          this.frame = cfg.frames - 1;
          // "dead" giữ frame cuối – WaveManager dọn boss
        }
      }
    }
    return prev;
  }

  // ── Random skill AI ───────────────────────────────────────────────────

  _pickNextSkill() {
    const pool = this.skillPool.filter(s => s !== this._lastSkill);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this._lastSkill = this._currentSkill = pick;
    return pick;
  }

  // ── Main update ───────────────────────────────────────────────────────

  update(playerX, playerY, player = null) {
  if (player) this._playerRef = player;

  // ── Death sequence: chạy anim xong mới deactivate ──────────
  if (this.isDead) {
    this._tickAnim();
    if (this.frame >= this.anims.dead.frames - 1) {
      if (++this._deathTimer >= 30) this.active = false; // ~0.5s sau khi anim xong
    }
    return;
  }

  this._runSkillCycle(playerX, playerY);
  this._updateBombs();
  this._updateSpreadShots();
  this._updateMeteorZones();
  this._updateSmoke();

  const prevFrame = this._tickAnim();
  if (this._moving && this._phase2 && prevFrame !== 8 && this.frame === 8)
    this._fireDashSpread();
  if (this._hitFlash > 0) this._hitFlash--;
}

  _runSkillCycle(px, py) {
  // ── Freeze sau khi vào phase 2 ──────────────────────────────────────
  if (this._p2FreezeTimer > 0) {
    this._p2FreezeTimer--;
    this._setState("idle");   // boss đứng im
    return;                   // không dash, không cast
  }

  // ── Pha dash ─────────────────────────────────────────────────────────
  if (this._moving) {
    this._moveTimer++;
    const dx = px - this.x, dy = py - this.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    this.x += (dx / d) * this._moveSpeed;
    this.y += (dy / d) * this._moveSpeed;

    if (this.state !== "attack") this._setState("attack");

    if (this._moveTimer >= this._moveDuration) {
      this._moving = false;
      this._setState("idle");
    }
    return;
  }

  // ── Đợi đến lượt cast ────────────────────────────────────────────────
  this._skillTimer++;
  if (!this._casting && this._skillTimer >= this._skillDelay) {
    this._skillTimer  = 0;
    this._casting     = true;
    this._skillCasted = false;
    this._pendingSkill     = this._pickNextSkill();
    this._pendingSkillArgs = { px, py };
    console.log(`🎲 Boss picked: ${this._pendingSkill}`);
    this._setState("attack");
  }

  // Frame 8 → cast
  if (this._casting && this.state === "attack" && !this._skillCasted && this.frame === 8) {
    this._skillCasted = true;
    this._castSkill(this._pendingSkill, this._pendingSkillArgs.px, this._pendingSkillArgs.py);
  }

  // Attack anim kết thúc → bắt đầu dash
  if (this._casting && this.state === "attack" && this.frame >= this.anims.attack.frames - 1) {
    this._casting       = false;
    this._pendingSkill  = null;
    this._moving        = true;
    this._moveTimer     = 0;
    this._dashWaveCount = 0;
    this._setState("attack");
    console.log("🏃 Boss dashing!");
  }
}

  _castSkill(name, px, py) {
    console.log(`🔮 Casting: ${name}`);
    switch (name) {
      case "spreadShot":   this._skill_spreadShot();         break;
      case "bombField":    this._skill_bombField();          break;
      case "meteorStrike": this._skill_meteorStrike(px, py); break;
      case "spawnMinions": this._skill_spawnMinions();       break;
    }
  }

  // ── SKILL 1: Spread Shot ──────────────────────────────────────────────

  _skill_spreadShot() {
    this.delayedSpread.push({ timer: -15, waveIndex: 0 });
  }

  _updateSpreadShots() {
    const rem = [];
    this.delayedSpread.forEach((w, i) => {
      if (++w.timer === 0) {
        this._fireSpread(this.x, this.y, 32, 5, w.waveIndex, this.damage * 0.3);
        rem.push(i);
      }
    });
    for (let i = rem.length - 1; i >= 0; i--) this.delayedSpread.splice(rem[i], 1);
  }

  /** Bắn count đạn 360° từ (ox, oy). **/
  _fireSpread(ox, oy, count, spd, waveIndex, dmg) {
  const offset = (Math.PI / count) * waveIndex;
  for (let i = 0; i < count; i++) {
    const a    = (Math.PI * 2 / count) * i + offset;
    const opts = this._phase2
      ? { radius: 8, color: "#ff1744", maxLifetime: 240, maxTrail: 3,
          waveAmplitude: 3.0, waveFrequency: 0.15 }
      : { radius: 8, color: "#00e5ff", maxLifetime: 240, maxTrail: 3 };
    const b = this._acquireBullet(ox, oy, Math.cos(a)*spd, Math.sin(a)*spd, Math.floor(dmg), opts);
    if (b) this.pendingBullets.push(b); // ← chỉ push nếu không null
  }
}

  /**
   * Đạn toả khi dash (phase 2), đồng bộ frame 8.
   * Mỗi đợt lệch góc (PI/16) × waveIndex → tạo hiệu ứng xoáy.
   **/
  _fireDashSpread() {
    const w = this._dashWaveCount++;
    this._fireSpread(this.x, this.y, 10, 4, w, this.damage * 0.2);
    console.log(`💫 Dash wave ${w}, pool: ${this._bulletPool.length}`);
  }

  // ── SKILL 2: Bomb Field ───────────────────────────────────────────────

  _skill_bombField() {
    const margin = 60;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 450;
      this.delayedBombs.push({
        type: "bomb",
        x: Math.max(margin, Math.min(this.mapW - margin, this.x + Math.cos(a) * r)),
        y: Math.max(margin, Math.min(this.mapH - margin, this.y + Math.sin(a) * r)),
        timer: 0, maxTimer: 120, radius: 16, phase: 0,
      });
    }
  }

  // ── SKILL 4: Meteor Strike ────────────────────────────────────────────

  _skill_meteorStrike() {
    for (let i = 0; i < 3; i++) {
      this.delayedBombs.push({
        type: "meteor", x: null, y: null, startY: null, currentY: null,
        timer: -(15 + i * 30), maxTimer: 60, radius: 16, phase: 0,
        playerRef: this._playerRef,
      });
    }
  }

  _updateBombs() {
    const rem = [];
    this.delayedBombs.forEach((b, idx) => {
      b.timer++;
      if (b.type === "meteor" && b.timer === 0 && b.x === null && b.playerRef) {
        b.x = b.playerRef.x + (Math.random() - 0.5) * 80;
        b.y = b.playerRef.y + (Math.random() - 0.5) * 80;
        b.startY   = b.y - 400;
        b.currentY = b.startY;
      }
      if (b.timer < 0) return;
      if (b.type === "meteor" && b.phase === 0 && b.x !== null) {
        b.currentY = b.startY + (b.y - b.startY) * (b.timer / b.maxTimer);
      }
      if (b.timer >= b.maxTimer && b.phase === 0) {
        b.phase = 1;
        b.type === "meteor" ? this._explodeMeteor(b) : this._explodeBomb(b);
        rem.push(idx);
      }
    });
    for (let i = rem.length - 1; i >= 0; i--) this.delayedBombs.splice(rem[i], 1);
  }

  _explodeBomb(b) {
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i;
    const bullet = this._acquireBullet(
      b.x, b.y, Math.cos(a)*4, Math.sin(a)*4,
      Math.floor(this.damage * 0.4),
      { radius: 8, color: "#ff7043", maxLifetime: 240, maxTrail: 3 }
    );
    if (bullet) this.pendingBullets.push(bullet);
  }
}

  _explodeMeteor(m) {
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 / 12) * i;
    const bullet = this._acquireBullet(
      m.x, m.y, Math.cos(a)*5, Math.sin(a)*5,
      Math.floor(this.damage * 0.35),
      { radius: 8, color: "#ffa726", maxLifetime: 240, maxTrail: 3 }
    );
    if (bullet) this.pendingBullets.push(bullet);
  }
  this._meteorZones.push({
    x: m.x, y: m.y,
    radius:     this._phase2 ? 90 : 60,
    timer: 0,   maxTimer: 300,
    dangerRatio: 0.75,
    damage:     this.damage * (this._phase2 ? 1.5 : 1.0),
  });
}

  // ══ METEOR ZONE: update + draw + smoke ══════════════════════════════════
  _updateMeteorZones() {
    // Tick timer, xoá khi hết hạn
    this._meteorZones = this._meteorZones.filter(z => ++z.timer < z.maxTimer);

    // Spawn smoke bên trong vùng còn nguy hiểm
    for (const z of this._meteorZones) {
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;
      if (z.timer % 8 !== 0) continue;
      for (let i = 0; i < 1; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = Math.random() * z.radius * 0.8;
        this._spawnSmoke(z.x + Math.cos(angle)*r, z.y + Math.sin(angle)*r, 1.3);
      }
    }
  }

  _drawMeteorZones(ctx) {
    for (const z of this._meteorZones) {
      if (z.timer / z.maxTimer >= z.dangerRatio) continue;
      ctx.save();
      // Fill mờ
      ctx.fillStyle = "rgba(255,100,0,0.12)";
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill();
      // Viền nét đứt
      ctx.strokeStyle = "#ffa726";
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Icon
      ctx.fillStyle    = "rgba(255,255,255,0.9)";
      ctx.font         = `bold ${Math.round(z.radius * 0.32)}px Arial`;
      ctx.textAlign    = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🔥", z.x, z.y);
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    }
  }

  _drawMeteor(ctx, m) {
    if (m.timer < 0 || m.x === null) return;
    const p = m.timer / m.maxTimer;

    // Cảnh báo shadow bên dưới
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.35 * p})`;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 20 + 40*p, (20 + 40*p)*0.4, 0, 0, Math.PI*2);
    ctx.fill();

    // Vòng cảnh báo nét đứt
    ctx.strokeStyle = `rgba(255,150,0,${0.6*(1-p)})`;
    ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(m.x, m.y, 40 + 30*Math.sin(p*Math.PI*6), 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Tick frame animation meteor sprite
    if (++this._meteorTick >= 4) { this._meteorTick = 0; this._meteorFrame = (this._meteorFrame + 1) % this._METEOR_FRAMES; }

    const scale = 4 + p * 2;   // to dần khi gần đất (4× → 6×)
    const dw = this._METEOR_FW * scale, dh = this._METEOR_FH * scale;

    if (this._meteorImg.complete && this._meteorImg.naturalWidth) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Xoay sprite theo hướng rơi
      ctx.translate(m.x, m.currentY);
      ctx.rotate(Math.PI / 4);  // nghiêng 45° cho trông đang rơi
      ctx.drawImage(this._meteorImg,
        this._meteorFrame * this._METEOR_FW, 0, this._METEOR_FW, this._METEOR_FH,
        -dw/2, -dh/2, dw, dh);
      ctx.restore();
    } else {
      // Fallback hình tròn cam nếu chưa load
      ctx.save();
      ctx.fillStyle = "#ff6d00";
      ctx.beginPath(); ctx.arc(m.x, m.currentY, this._METEOR_FW * scale * 0.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ══ SMOKE HELPERS (giống Boss2) ══════════════════════════════════════════
  _acquireSmoke() { return this._smokePool.find(s => !s.active) || null; }

  _spawnSmoke(x, y, scale = 1.2) {
    const s = this._acquireSmoke(); if (!s) return;
    s.active     = true;
    s.x          = x + (Math.random() - 0.5) * 16;
    s.y          = y + (Math.random() - 0.5) * 16;
    s.vx         = (Math.random() - 0.5) * 0.5;
    s.vy         = -(0.3 + Math.random() * 0.5);
    s.frame      = 0; s.frameTick = 0;
    s.frameDelay = 3 + Math.floor(Math.random() * 3);
    s.scale      = scale * (0.8 + Math.random() * 0.4);
    s.alpha      = 0.65 + Math.random() * 0.3;
  }

  _updateSmoke() {
    for (const s of this._smokePool) {
      if (!s.active) continue;
      s.x += s.vx; s.y += s.vy;
      if (++s.frameTick >= s.frameDelay) {
        s.frameTick = 0;
        if (++s.frame >= this._SMOKE_FRAMES) s.active = false;
      }
    }
  }

  _drawSmoke(ctx) {
    if (!this._smokeImg.complete || !this._smokeImg.naturalWidth) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const s of this._smokePool) {
      if (!s.active) continue;
      const dw = this._SMOKE_FW * s.scale, dh = this._SMOKE_FH * s.scale;
      ctx.globalAlpha = s.alpha * (1 - s.frame / this._SMOKE_FRAMES);
      ctx.drawImage(this._smokeImg, s.frame * this._SMOKE_FW, 0,
        this._SMOKE_FW, this._SMOKE_FH, s.x - dw/2, s.y - dh/2, dw, dh);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── SKILL 3: Spawn Minions ────────────────────────────────────────────

  _skill_spawnMinions() {
    const types = ["zombie", "skeleton"], r = 120;
    for (let i = 0; i < 2; i++) {
      const a = (Math.PI * 2 / 2) * i;
      this.pendingMinions.push(new Enemy(
        this.x + Math.cos(a) * r, this.y + Math.sin(a) * r,
        types[Math.floor(Math.random() * types.length)]
      ));
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────

  draw(ctx) {
    this._drawMeteorZones(ctx);  // ← thêm (vẽ trước boss)
    this.delayedBombs.forEach(b => b.type === "meteor"
      ? this._drawMeteor(ctx, b) : this._drawBomb(ctx, b));
    this._drawSmoke(ctx);        // ← thêm (vẽ sau zone, trước boss)

    ctx.save();
    if (this.img.complete && this.img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      const cfg = this.anims[this.state];
      const dx  = Math.floor(this.x - this.width  / 2);
      const dy  = Math.floor(this.y - this.height / 2);

      ctx.drawImage(
        this.img,
        this.frame * this.frameW, cfg.row * this.frameH, this.frameW, this.frameH,
        dx, dy, this.width, this.height
      );

      // White flash: dùng offscreen canvas + source-in → chỉ pixel có màu mới trắng
      if (this._hitFlash > 0) {
        ctx.globalAlpha = this._hitFlash / this._FLASH_DUR;
        ctx.drawImage(this._buildFlashCanvas(cfg), dx, dy);
        ctx.globalAlpha = 1;
      }
    } else {
      // Fallback
      const fc = this._hitFlash > 0 ? "#ffffff" : (this._phase2 ? "#ff1744" : "#00bcd4");
      ctx.fillStyle = fc; ctx.shadowColor = fc; ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.width/2, this.height/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
      ctx.fillText(`[${this.state}] f${this.frame}`, this.x, this.y + 5);
    }
    ctx.restore();

    this._drawSkillLabel(ctx);
    if (this.debugHitbox) this._drawDebugHitbox(ctx);
  }

  _drawDebugHitbox(ctx) {
    const hcy = this.y + this.hitboxOffsetY;
    const hw  = this.hitboxW / 2;
    const hh  = this.hitboxH / 2;

    ctx.save();

    // Hitbox thực tế (xanh lá)
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth   = 2;
    ctx.strokeRect(this.x - hw, hcy - hh, this.hitboxW, this.hitboxH);
    ctx.fillStyle = "#00ff00";
    ctx.beginPath(); ctx.arc(this.x, hcy, 5, 0, Math.PI * 2); ctx.fill();

    // Bounding box sprite gốc (đỏ đứt nét)
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ff0000";
    ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();

    // Label
    ctx.font = "bold 13px monospace"; ctx.fillStyle = "#ffff00"; ctx.textAlign = "center";
    ctx.fillText(
      `W:${this.hitboxW} H:${this.hitboxH} offsetY:${this.hitboxOffsetY}`,
      this.x, hcy + hh + 16
    );
    ctx.restore();
  }

  _drawBomb(ctx, b) {
    const p = b.timer / b.maxTimer, pulse = 0.7 + 0.3 * Math.sin(p * Math.PI * 8), r = b.radius * pulse;
    ctx.save();
    ctx.strokeStyle = `rgba(255,100,0,${0.6*(1-p)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, r*4*p+10, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(255,${Math.floor(200*(1-p))},0,${0.5+0.5*p})`;
    ctx.shadowColor = "#ff5722"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
    ctx.fillText(Math.ceil((b.maxTimer - b.timer) / 60) || "!", b.x, b.y + 5);
    ctx.restore();
  }

  _drawSkillLabel(ctx) {
    // const names = {
    //   spreadShot: "💫 SPREAD SHOT", bombField: "💣 BOMB FIELD",
    //   meteorStrike: "☄️ METEOR STRIKE", spawnMinions: "👾 SPAWN MINIONS",
    // };
    // if (!this._casting && !this._moving) return;
    // const label  = names[this._currentSkill] || this._currentSkill || "";
    // const suffix = this._moving ? (this._phase2 ? " 🔴 ENRAGE DASH" : " → DASH!") : "";
    // ctx.save();
    // ctx.fillStyle   = this._moving && this._phase2 ? "#FF1744" : this._moving ? "#FF6B35" : "#FFD700";
    // ctx.font        = "bold 20px Arial"; ctx.textAlign = "center";
    // ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;
    // ctx.fillText(label + suffix, this.x, this.y - this.height/2 - 40);
    // ctx.restore();
  }

  // ── Helpers for WaveManager ───────────────────────────────────────────

  getGoldDrop() {
    const [mn, mx] = this.goldDrop;
    return Math.floor(Math.random() * (mx - mn + 1)) + mn;
  }

  /** Tạo/tái sử dụng offscreen canvas chứa sprite hiện tại tô full trắng (chỉ pixel có màu). */
  _buildFlashCanvas(cfg) {
    const cacheKey = `${this.state}_${this.frame}`;      // ← THÊM cache key
  if (this._flashCacheKey === cacheKey && this._flashCanvas) return this._flashCanvas; // ← THÊM
  this._flashCacheKey = cacheKey;                       // ← THÊM

  if (!this._flashCanvas) {
    this._flashCanvas = document.createElement("canvas");
    this._flashCanvas.width  = this.width;
    this._flashCanvas.height = this.height;
  }
  const fc  = this._flashCanvas;
  const fctx = fc.getContext("2d");
  fctx.clearRect(0, 0, fc.width, fc.height);
  fctx.drawImage(
    this.img,
    this.frame * this.frameW, cfg.row * this.frameH, this.frameW, this.frameH,
    0, 0, fc.width, fc.height
  );
  fctx.globalCompositeOperation = "source-in";
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, fc.width, fc.height);
  fctx.globalCompositeOperation = "source-over";
  return fc;
  }

  collidesWith(bullet) {
    if (this.isDead) return false;
    const hcy = this.y + this.hitboxOffsetY;
    const hw  = this.hitboxW / 2, hh = this.hitboxH / 2;
    const dx  = Math.abs(bullet.x - this.x);
    const dy  = Math.abs(bullet.y - hcy);
    if (dx > hw + bullet.radius) return false;
    if (dy > hh + bullet.radius) return false;
    if (dx <= hw || dy <= hh) return true;
    const cx = dx - hw, cy = dy - hh;
    return cx*cx + cy*cy <= bullet.radius * bullet.radius;
  }

  collidesWithPlayer(player) {
    if (this.isDead) return false;
  const hcy = this.y + this.hitboxOffsetY;              // boss hitbox center Y
  const phcx = player.x + (player.hitboxOffsetX ?? 0); // player hitbox center X
  const phcy = player.y + (player.hitboxOffsetY ?? 0); // player hitbox center Y
  const pw = (player.hitboxW ?? player.width)  / 2;
  const ph = (player.hitboxH ?? player.height) / 2;
  return (
    Math.abs(this.x - phcx) < (this.hitboxW / 2 + pw) &&
    Math.abs(hcy  - phcy)   < (this.hitboxH / 2 + ph)
  );
}

takeDamage(dmg) {
  if (this.isDead) return;
  const actual = Math.floor(dmg * (1 - Math.min(this.armor * 0.01, 0.75)));
  this.hp -= actual;
  this._hitFlash = this._FLASH_DUR;

  if (this.soundManager) this.soundManager.playBossHit();

  if (!this._phase2 && this.hp / this.maxHp < 0.5) {
    this._phase2       = true;
    this._skillDelay   = this._p2SkillDelay;
    this._moveDuration = this._p2MoveDuration;
    this._moveSpeed    = this._p2MoveSpeed;
    this._animSpeed    = this._p2AnimSpeed;

    // Xóa pending chưa gửi, KHÔNG deactivate pool
    this.pendingBullets = [];

    // Dừng toàn bộ hành động hiện tại
    this._casting       = false;
    this._skillCasted   = false;
    this._pendingSkill  = null;
    this._moving        = false;
    this._moveTimer     = 0;
    this._dashWaveCount = 0;

    // Bật freeze: boss đứng idle _P2_FREEZE_DUR frame
    this._p2FreezeTimer = this._P2_FREEZE_DUR;
    this._skillTimer    = 0;   // sau freeze xong sẽ chờ skillDelay rồi mới cast

    this._setState("idle");
    console.log("🔴 PHASE 2 ACTIVATED – freeze started!");
  }

  if (this.hp <= 0) {
    this.hp        = 0;
    this.isDead    = true;
    this._hitFlash = 0;
    this._moving   = false;
    this._setState("dead");
    console.log("💀 BOSS defeated!");
  }
}
  getDamage() { return this.damage; }

  getAndClearMinions() {
    const m = this.pendingMinions; this.pendingMinions = []; return m;
  }
}