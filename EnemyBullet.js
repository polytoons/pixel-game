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
    this.trail = [];
    this.maxTrail = options.maxTrail ?? 5;
    this.target = options.target ?? null;
    this.turnRate = options.turnRate ?? 0;

    // Wraith: tọa độ đích để tự nổ khi đến nơi
    this.targetX = options.targetX ?? null;
    this.targetY = options.targetY ?? null;
  }

  update() {
    if (!this.active) return [];
    this.lifetime++;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();

    if (this.target && this.turnRate > 0) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const targetAngle = Math.atan2(dy, dx);
      const currentAngle = Math.atan2(this.vy, this.vx);

      let diff = targetAngle - currentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const rotation = Math.max(-this.turnRate, Math.min(this.turnRate, diff));
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const newAngle = currentAngle + rotation;
      this.vx = Math.cos(newAngle) * speed;
      this.vy = Math.sin(newAngle) * speed;
    }

    this.x += this.vx;
    this.y += this.vy;

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

  // Phát nổ → 8 viên đạn xung quanh
  explode() {
    const bullets = [];
    for (let i = 0; i < 8; i++) {
      const a = ((Math.PI * 2) / 8) * i;
      bullets.push(
        new EnemyBullet(
          this.x,
          this.y,
          Math.cos(a) * 4.5,
          Math.sin(a) * 4.5, // ⭐ tốc độ 2.5 → 4.5
          Math.floor(this.damage * 0.5),
          { radius: 5, color: "#cc44ff", maxLifetime: 150, maxTrail: 5 }, // ⭐ lifetime 70 → 150
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
    return (
      this.x < -200 || this.x > w + 200 || this.y < -200 || this.y > h + 200
    );
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      ctx.globalAlpha = (i / this.trail.length) * 0.3;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(
        this.trail[i].x,
        this.trail[i].y,
        this.radius * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glow + viên đạn
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Viền ngoài đặc trưng của wraith
    if (this.type === "wraith") {
      ctx.strokeStyle = "rgba(200,80,255,0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
