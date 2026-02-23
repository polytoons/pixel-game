export const _bulletImg    = new Image();
export const BULLET_FRAMES = 5;
export const BULLET_FW     = 16;
export const BULLET_FH     = 16;
_bulletImg.src = "assets/CanonBall.png";
_bulletImg.onload  = () => console.log("✅ bullet sprite loaded");
_bulletImg.onerror = () => console.warn("⚠️ bullet sprite NOT found");

export class EnemyBullet {
  constructor(x, y, vx, vy, damage, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.active = true;
    this.radius = options.radius ?? 6;
    this.color = options.color ?? "#ff6666";
    this.type = options.type ?? "normal";
    this.maxLifetime = options.maxLifetime ?? 240;
    this.lifetime = 0;
    this.trail      = [];
this.maxTrail   = options.maxTrail ?? 3;
this._trailHead = 0;
    this.target = options.target ?? null;
    this.turnRate = options.turnRate ?? 0;

    this.targetX = options.targetX ?? null;
    this.targetY = options.targetY ?? null;

    // ── Wave motion (dao động sin vuông góc hướng bay) ──────────────────
    // waveAmplitude : biên độ dao động (px/frame) — thử 1.5–3.0
    // waveFrequency : tần số dao động (rad/frame) — thử 0.08–0.15
    this.waveAmplitude = options.waveAmplitude ?? 0;
    this.waveFrequency = options.waveFrequency ?? 0.10;
    this._waveLast     = 0; // tránh NaN ở frame đầu với đạn wave

    this.spriteFrame     = 0;
    this.spriteFrameTick = 0;
    this.spriteFrameDelay = 4;

    if (this.waveAmplitude > 0) {
      // Véc-tơ vuông góc với hướng bay ban đầu (không đổi theo thời gian)
      const spd = Math.sqrt(vx * vx + vy * vy) || 1;
      this._perpX = -vy / spd;   // xoay 90° trái
      this._perpY =  vx / spd;
    }
  }

  update() {
    if (!this.active) return [];
    this.lifetime++;

    if (++this.spriteFrameTick >= this.spriteFrameDelay) {
      this.spriteFrameTick = 0;
      this.spriteFrame = (this.spriteFrame + 1) % BULLET_FRAMES;
    }

    if (this.trail.length < this.maxTrail) {
  this.trail.push({ x: this.x, y: this.y });
} else {
  this.trail[this._trailHead].x = this.x;
  this.trail[this._trailHead].y = this.y;
  this._trailHead = (this._trailHead + 1) % this.maxTrail;
}

    // Homing
    if (this.target && this.turnRate > 0) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const targetAngle = Math.atan2(dy, dx);
      const currentAngle = Math.atan2(this.vy, this.vx);

      let diff = targetAngle - currentAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const rotation = Math.max(-this.turnRate, Math.min(this.turnRate, diff));
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const newAngle = currentAngle + rotation;
      this.vx = Math.cos(newAngle) * speed;
      this.vy = Math.sin(newAngle) * speed;
    }

    // ── Di chuyển: tiến thẳng + dao động sin vuông góc ──────────────────
    if (this.waveAmplitude > 0) {
  if (this.lifetime % 2 === 0) // cache mỗi 2 frame
    this._waveLast = Math.sin(this.lifetime * this.waveFrequency) * this.waveAmplitude;
  const wave = Number.isFinite(this._waveLast) ? this._waveLast : 0;
  this.x += this.vx + this._perpX * wave;
  this.y += this.vy + this._perpY * wave;
} else {
  this.x += this.vx;   // ← THÊM LẠI
  this.y += this.vy;   // ← THÊM LẠI
    }

    // Wraith: phát nổ khi đến vị trí mục tiêu
    if (this.type === "wraith" && this.targetX !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      if (dx * dx + dy * dy < 20 * 20) {
        this.active = false;
        return this.explode();
      }
    }

    if (this.lifetime >= this.maxLifetime) {
      this.active = false;
      return this.type === "wraith" ? this.explode() : [];
    }

    return [];
  }

  explode() {
    const bullets = [];
    for (let i = 0; i < 8; i++) {
      const a = ((Math.PI * 2) / 8) * i;
      bullets.push(
        new EnemyBullet(
          this.x, this.y,
          Math.cos(a) * 4.5,
          Math.sin(a) * 4.5,
          Math.floor(this.damage * 0.5),
          { radius: 8, color: "#cc44ff", maxLifetime: 150, maxTrail: 5 },
        ),
      );
    }
    return bullets;
  }

  hitPlayer(player) {
    if (!this.active) return false;
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + player.width * 0.35;
  }

  isOffScreen(w, h) {
    return this.x < -200 || this.x > w + 200 || this.y < -200 || this.y > h + 200;
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();

  const tLen = this.trail.length;
for (let j = 0; j < tLen; j++) {
  const i     = (this._trailHead + j) % tLen;
  const alpha = (j / tLen) * 0.25;
  if (alpha < 0.06) continue;
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = this.color;
  ctx.beginPath();
  ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}
    ctx.globalAlpha = 1;

    if (_bulletImg.complete && _bulletImg.naturalWidth) {
      const scale = (this.radius * 2) / BULLET_FW;
      const dw    = BULLET_FW * scale;
      const dh    = BULLET_FH * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        _bulletImg,
        this.spriteFrame * BULLET_FW, 0, BULLET_FW, BULLET_FH,
        this.x - dw / 2, this.y - dh / 2, dw, dh,
      );
    } else {
      // Fallback arc
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    // ← viền tím wraith đã xoá hoàn toàn

    ctx.restore();
  }
}