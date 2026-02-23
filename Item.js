export class Item {
  constructor(type, rarity = "common", variant = 0) {
    this.type = type; // 'helmet', 'armor', 'boots', 'gloves'
    this.rarity = rarity; // 'common', 'rare', 'epic', 'legendary'
    this.variant = variant; // 0, 1, 2 (3 biến thể)
    this.id = Date.now() + Math.random();

    this.stats = {
      hp: 0,
      armor: 0,
      damage: 0,
      speed: 0,
    };

    this.generateStats();

    // ⭐ Sprite sheet setup - THAY ĐỔI ĐƯỜNG DẪN Ở ĐÂY
    this.spriteSheet = this._loadImage("assets/items_spritesheet.png");
    this.spriteSize = 16; // Kích thước mỗi sprite trong sheet
  }

  _loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  generateStats() {
    const rarityMultiplier = {
      common: 1,
      rare: 1.5,
      epic: 2,
      legendary: 3,
    };

    const multiplier = rarityMultiplier[this.rarity];

    // ⭐ Variant multiplier: mỗi variant tăng 50%
    const variantMultiplier = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75][this.variant] ?? 1.0;

    // Tổng multiplier
    const totalMultiplier = multiplier * variantMultiplier;

    // Mỗi loại trang bị có chỉ số chính
    switch (this.type) {
      case "helmet":
        this.stats.hp = Math.floor(10 * totalMultiplier);
        this.stats.armor = Math.floor(1 * totalMultiplier);
        break;
      case "armor":
        this.stats.armor = Math.floor(3 * totalMultiplier);
        this.stats.hp = Math.floor(6 * totalMultiplier);
        break;
      case "gloves":
        this.stats.hp = Math.floor(5 * totalMultiplier);
        this.stats.damage = Math.floor(9 * totalMultiplier);
        break;
      case "boots":
        this.stats.speed = Math.floor(1 * totalMultiplier);
        this.stats.armor = Math.floor(2 * totalMultiplier);
        break;
    }
  }

  getName() {
    const typeNames = {
      helmet: "HELMET",
      armor: "ARMOR",
      gloves: "GOLOVES",
      boots: "BOOST",
    };

    const rarityNames = {
      common: "COMMON",
      rare: "RARE",
      epic: "EPIC",
      legendary: "LEGENDARY",
    };

    // ⭐ Thêm tên variant
    const variantNames = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]; // hoặc ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    return `${typeNames[this.type]} ${rarityNames[this.rarity]} ${variantNames[this.variant]}`;
  }

  getColor() {
    const colors = {
      common: "#9E9E9E",
      rare: "#2196F3",
      epic: "#9C27B0",
      legendary: "#FF9800",
    };
    return colors[this.rarity];
  }

  // ⭐ Giữ emoji fallback cho compatibility
  getIcon() {
    const icons = {
      helmet: "⛑️",
      armor: "🛡️",
      gloves: "🧤",
      boots: "👢",
    };
    return icons[this.type];
  }

  // ⭐ THÊM: Lấy tọa độ sprite trong sheet
  getSpriteCoords() {
    // Map type -> row trong sprite sheet
    const typeToRow = {
      helmet: 0, // Hàng 1 = row 0
      armor: 1, // Hàng 2 = row 1
      boots: 3, // Hàng 4 = row 3
      gloves: 4, // Hàng 5 = row 4
    };

    const row = typeToRow[this.type] || 0;
    const col = this.variant; // Variant 0, 1, 2 = cột 0, 1, 2

    return {
      x: col * this.spriteSize,
      y: row * this.spriteSize,
      width: this.spriteSize,
      height: this.spriteSize,
    };
  }

  // ⭐ THÊM: Vẽ sprite thay vì emoji
  drawSprite(ctx, x, y, size) {
    if (
      !this.spriteSheet ||
      !this.spriteSheet.complete ||
      this.spriteSheet.naturalWidth === 0
    ) {
      // Fallback: vẽ emoji nếu sprite chưa load
      ctx.font = `${size * 0.5}px Arial`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(this.getIcon(), x, y);
      return;
    }

    const coords = this.getSpriteCoords();

    const oldSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;

    // Vẽ sprite - căn giữa tại (x, y)
    ctx.drawImage(
      this.spriteSheet,
      coords.x,
      coords.y,
      coords.width,
      coords.height, // Source
      x - size / 2,
      y - size / 2,
      size,
      size, // Destination
    );

    ctx.imageSmoothingEnabled = oldSmoothing;
  }

  clone() {
    const item = new Item(this.type, this.rarity, this.variant);
    item.stats = { ...this.stats };
    return item;
  }
}
