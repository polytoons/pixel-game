import { ShopUI } from "./ShopUI.js";
import { InventoryUI } from "./InventoryUI.js";

export class LobbyUI {
  constructor(inventory, currency, shop, player, soundManager = null) {
    this.inventory = inventory;
    this.currency = currency;
    this.shop = shop;
    this.player = player;
    this.soundManager = soundManager;

    this.shopUI = new ShopUI(shop, currency, inventory, player);
    // ⭐ THÊM currency vào InventoryUI
    this.inventoryUI = new InventoryUI(
      inventory,
      player,
      soundManager,
      currency,
    );

    this.showLevelSelect = false;
    this.selectedLevel = 1;
    this.hoveredMainBtn = -1;
    this.hoveredLevel = -1;
    this.showBossSelect = false;
    this.hoveredBoss    = -1;

    this.levels = [
      {
        id: 1, name: "LEVEL 1", difficulty: "EASY",
        enemiesMultiplier: 1, speedMultiplier: 1,
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_lvl.json",
        enemyPool: [{ type: "zombie", weight: 60 }, { type: "skeleton", weight: 40 }],
      },
      {
        id: 2, name: "LEVEL 2", difficulty: "NORMAL",
        enemiesMultiplier: 1.3, speedMultiplier: 1.2,
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_lvl2.json",
        enemyPool: [{ type: "goblin", weight: 40 }, { type: "orc", weight: 35 }, { type: "darkwolf", weight: 25 }],
      },
      {
        id: 3, name: "LEVEL 3", difficulty: "HARD",
        enemiesMultiplier: 1.6, speedMultiplier: 1.4,
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_lvl3.json",
        enemyPool: [{ type: "demon", weight: 35 }, { type: "wraith", weight: 35 }, { type: "golem", weight: 30 }],
      },
      {
        id: 4, name: "LEVEL 4", difficulty: "VERY HARD",
        enemiesMultiplier: 2, speedMultiplier: 1.6,
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_lvl4.json",
        enemyPool: [{ type: "dragon", weight: 35 }, { type: "lich", weight: 35 }, { type: "titan", weight: 30 }],
      },
    ];

    // ── Màn Boss ──────────────────────────────────────────────────
    this.bossLevels = [
      {
        id: 5, name: "Giant Slime", difficulty: "Normal",
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_boss.json",
        enemyPool: [{ type: "zombie", weight: 60 }, { type: "skeleton", weight: 40 }],
        bossWaves: [1],
        enemiesMultiplier: 1, speedMultiplier: 1,
        bossName: "Giant Slime", bossIcon: "🐌",
        bossStats: "",
      },
      {
        id: 6, name: "Giant Frog", difficulty: "Normal",
        description: "",
        unlocked: true, hasMap: true, mapFile: "map_boss.json",
        enemyPool: [{ type: "zombie", weight: 60 }, { type: "skeleton", weight: 40 }],
        bossWaves: [1],
        enemiesMultiplier: 1, speedMultiplier: 1,
        bossName: "Giant Frog", bossIcon: "🐸",
        bossStats: "",
      },
    ];

    /* ══════════════════════════════════════════════════════════
       🎨 BACKGROUND ASSETS - Thay đổi đường dẫn ở đây
    ══════════════════════════════════════════════════════════ */

    this.bgButton     = { img: this._loadImg("assets/ui/button_bg.png"),      sliceSize: 3, scale: 3 };
    this.bgLevelPanel = { img: this._loadImg("assets/ui/panel_outer_bg.png"), sliceSize: 5, scale: 4 };
    this.bgLevelRow   = { img: this._loadImg("assets/ui/panel_bg.png"),       sliceSize: 5, scale: 3 };
    this.closeButton  = this._loadImg("assets/ui/close_button.png");
  }

  _loadImg(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  /* ══════════════════════════════════════════════════════════
     9-SLICE DRAWING
  ══════════════════════════════════════════════════════════ */
  _roundRect(ctx, x, y, w, h, r = 10) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _draw9Slice(ctx, bgConfig, x, y, w, h, r = 10) {
    const img = bgConfig.img;
    const slice = bgConfig.sliceSize * bgConfig.scale;

    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);

    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = "#888888";
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      return;
    }

    const oldSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const s = slice / bgConfig.scale;

    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = Math.floor(x + slice);
    const y2 = Math.floor(y + slice);
    const x3 = Math.floor(x + w - slice);
    const y3 = Math.floor(y + h - slice);
    const x4 = Math.floor(x + w);
    const y4 = Math.floor(y + h);

    ctx.drawImage(img, 0, 0, s, s, x1, y1, x2 - x1, y2 - y1);
    ctx.drawImage(img, imgW - s, 0, s, s, x3, y1, x4 - x3, y2 - y1);
    ctx.drawImage(img, 0, imgH - s, s, s, x1, y3, x2 - x1, y4 - y3);
    ctx.drawImage(img, imgW - s, imgH - s, s, s, x3, y3, x4 - x3, y4 - y3);

    ctx.drawImage(img, s, 0, imgW - s * 2, s, x2, y1, x3 - x2, y2 - y1);
    ctx.drawImage(img, s, imgH - s, imgW - s * 2, s, x2, y3, x3 - x2, y4 - y3);
    ctx.drawImage(img, 0, s, s, imgH - s * 2, x1, y2, x2 - x1, y3 - y2);
    ctx.drawImage(img, imgW - s, s, s, imgH - s * 2, x3, y2, x4 - x3, y3 - y2);

    ctx.drawImage(
      img,
      s,
      s,
      imgW - s * 2,
      imgH - s * 2,
      x2,
      y2,
      x3 - x2,
      y3 - y2,
    );

    ctx.restore();
    ctx.imageSmoothingEnabled = oldSmoothing;
  }

  _shadow(ctx, blur = 18, color = "rgba(0,0,0,0.45)") {
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
  }

  _noShadow(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  /* ══════════════════════════════════════════════════════════
     LAYOUT
  ══════════════════════════════════════════════════════════ */
  _mainBtns(cW, cH) {
    const btnW=220, btnH=58, gap=16;
    const bx=(cW-btnW)/2, startY=cH*0.45;
    return [
      { label:"⚔️ PLAY",  x:bx, y:startY,               w:btnW, h:btnH, action:"play"      },
      { label:"👑 BOSS BATTLE", x:bx, y:startY+(btnH+gap),    w:btnW, h:btnH, action:"boss"      },
      { label:"🎒 ITEMS",     x:bx, y:startY+(btnH+gap)*2,  w:btnW, h:btnH, action:"inventory" },
      { label:"🛒 SHOP",   x:bx, y:startY+(btnH+gap)*3,  w:btnW, h:btnH, action:"shop"      },
    ];
  }

  _levelLayout(cW, cH) {
    const lvlW = 500,
      lvlH = 76,
      gap = 14;
    const sidePad = 32; // Padding 2 bên
    const totalH = this.levels.length * (lvlH + gap) - gap + 28;
    const panelW = lvlW + sidePad * 2;
    const panelH = totalH + 90; // Thêm padding trên/dưới
    const panelX = (cW - panelW) / 2;
    const panelY = (cH - panelH) / 2;
    return { lvlW, lvlH, gap, sidePad, panelW, panelH, panelX, panelY };
  }

  _bossLayout(cW, cH) {
  const cardW = 460, cardH = 130, gap = 20, sidePad = 36;
  const totalH = this.bossLevels.length * (cardH + gap) - gap;
  const panelW = cardW + sidePad * 2;
  const panelH = totalH + 125; // ← tăng lên 200 để đảm bảo đủ chỗ
  return {
    cardW, cardH, gap, sidePad, panelW, panelH,
    panelX: (cW - panelW) / 2,
    panelY: (cH - panelH) / 2,
  };
}

  /* ══════════════════════════════════════════════════════════
     DRAW - MAIN ENTRY
  ══════════════════════════════════════════════════════════ */
  draw(ctx, cW, cH) {
    /* background gradient */
    const grad = ctx.createLinearGradient(0, 0, cW, cH);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#16213e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cW, cH);

    this._drawTitle(ctx, cW, cH);
    this._drawMainButtons(ctx, cW, cH);

    if (this.showLevelSelect) this._drawLevelSelect(ctx, cW, cH);
    if (this.showBossSelect)  this._drawBossSelect(ctx, cW, cH);
    this.inventoryUI.draw(ctx, cW, cH);
    this.shopUI.draw(ctx, cW, cH);
  }

  _drawTitle(ctx, cW, cH) {
    ctx.textAlign = "center";
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#FFD700";
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 62px Arial";
    ctx.fillText("⚔️ PIXEL GAME", cW / 2, cH * 0.2);
    ctx.shadowBlur = 0;

    ctx.textAlign = "left";
  }

  _drawMainButtons(ctx, cW, cH) {
    const btns = this._mainBtns(cW, cH);

    btns.forEach((btn, i) => {
      const hov = this.hoveredMainBtn === i;

      this._shadow(ctx, hov ? 16 : 8, "rgba(0,0,0,0.5)");

      if (this.bgButton?.img?.complete) {
        this._draw9Slice(ctx, this.bgButton, btn.x, btn.y, btn.w, btn.h, 12);

        // Highlight khi hover
        if (hov) {
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
          ctx.fill();
        }
      } else {
        // Fallback
        ctx.fillStyle = hov
          ? "rgba(200,200,210,0.97)"
          : "rgba(160,160,175,0.90)";
        this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
        ctx.fill();
      }
      this._noShadow(ctx);

      if (hov) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
        ctx.stroke();
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6);
      ctx.shadowBlur = 0;
    });
    ctx.textAlign = "left";
  }

  _drawLevelSelect(ctx, cW, cH) {
    const { lvlW, lvlH, gap, sidePad, panelW, panelH, panelX, panelY } =
      this._levelLayout(cW, cH);

    /* Dim */
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, cW, cH);

    /* Panel background với 9-slice */
    this._shadow(ctx, 32, "rgba(0,0,0,0.6)");
    this._draw9Slice(
      ctx,
      this.bgLevelPanel,
      panelX,
      panelY,
      panelW,
      panelH,
      14,
    );
    this._noShadow(ctx);

    /* Title */
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText("LEVEL", panelX + panelW / 2, panelY + 60);
    ctx.shadowBlur = 0;

    const lvlX = panelX + sidePad;
    let lvlY = panelY + 75;

    const diffColor = {
      Dễ: "#43a047",
      "Trung Bình": "#fb8c00",
      Khó: "#e53935",
      "Cực Khó": "#7b1fa2",
    };

    this.levels.forEach((lvl, i) => {
      const sel = this.selectedLevel === lvl.id;
      const hov = this.hoveredLevel === i;

      this._shadow(ctx, 6, "rgba(0,0,0,0.25)");

      if (this.bgLevelRow?.img?.complete) {
        this._draw9Slice(ctx, this.bgLevelRow, lvlX, lvlY, lvlW, lvlH, 10);

        // Highlight
        if (sel) {
          ctx.fillStyle = "rgba(76,175,80,0.2)";
          this._roundRect(ctx, lvlX, lvlY, lvlW, lvlH, 10);
          ctx.fill();
        } else if (hov) {
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          this._roundRect(ctx, lvlX, lvlY, lvlW, lvlH, 10);
          ctx.fill();
        }
      } else {
        // Fallback
        ctx.fillStyle = sel ? "#e8f5e9" : hov ? "#f5f5f5" : "#fafafa";
        this._roundRect(ctx, lvlX, lvlY, lvlW, lvlH, 10);
        ctx.fill();
      }
      this._noShadow(ctx);

      if (sel) {
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 3;
        this._roundRect(ctx, lvlX, lvlY, lvlW, lvlH, 10);
        ctx.stroke();
      }

      /* Level name */
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 2;
      ctx.fillText(`${lvl.id}. ${lvl.name}`, lvlX + 20, lvlY + lvlH / 2 - 6);
      ctx.shadowBlur = 0;

      /* Difficulty badge */
      const dc = diffColor[lvl.difficulty] || "#555";
      ctx.fillStyle = dc;
      ctx.font = "bold 13px Arial";
      ctx.fillText(`[${lvl.difficulty}]`, lvlX + 20, lvlY + lvlH / 2 + 14);

      /* Multipliers */
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(
        `👾×${lvl.enemiesMultiplier}  ⚡×${lvl.speedMultiplier}`,
        lvlX + lvlW - 14,
        lvlY + lvlH / 2 + 14,
      );

      lvlY += lvlH + gap;
    });

    /* Close button với image */
    this._drawCloseButton(ctx, panelX, panelY, panelW);

    ctx.textAlign = "left";
  }

  // ── Boss Select ───────────────────────────────────────────────
  _drawBossSelect(ctx, cW, cH) {
  const { cardW, cardH, gap, sidePad, panelW, panelH, panelX, panelY } = this._bossLayout(cW, cH);

  ctx.save(); // ← bọc toàn bộ để không rò shadow/state ra ngoài

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, cW, cH);

  this._shadow(ctx, 32, "rgba(180,0,0,0.4)");
  this._draw9Slice(ctx, this.bgLevelPanel, panelX, panelY, panelW, panelH, 14);
  this._noShadow(ctx); // ← reset ngay sau panel

  // Tiêu đề
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 30px Arial";
  ctx.shadowColor = "#FF1744"; ctx.shadowBlur = 20;
  ctx.fillText("👑 BOSS BATTLE", panelX + panelW / 2, panelY + 55);
  ctx.shadowBlur = 0; // ← FIX: reset shadowBlur ngay sau title

  const diffColor = { "Dễ": "#43a047", "Trung Bình": "#fb8c00", "Khó": "#e53935", "Cực Khó": "#7b1fa2", "Normal": "#fb8c00", "Easy": "#43a047", "Hard": "#e53935" };
  const cardX = panelX + sidePad;
  let cardY   = panelY + 90; // ← đủ xa dưới title

  this.bossLevels.forEach((lvl, i) => {
    const hov = this.hoveredBoss === i;

    this._shadow(ctx, hov ? 14 : 6, hov ? "rgba(255,100,0,0.4)" : "rgba(0,0,0,0.3)");
    if (this.bgLevelRow?.img?.complete) {
      this._draw9Slice(ctx, this.bgLevelRow, cardX, cardY, cardW, cardH, 12);
    } else {
      ctx.fillStyle = "#2a1a1a";
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 12); ctx.fill();
    }
    this._noShadow(ctx);

    if (hov) {
      ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2.5;
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 12); ctx.stroke();
      ctx.fillStyle = "rgba(255,215,0,0.08)";
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 12); ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255,100,0,0.35)"; ctx.lineWidth = 1.5;
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 12); ctx.stroke();
    }

    // Icon boss
    ctx.font = `${cardH * 0.55}px Arial`; ctx.textAlign = "center";
    ctx.fillText(lvl.bossIcon, cardX + 60, cardY + cardH / 2 + 18);

    // Tên boss
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 22px Arial"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3;
    ctx.fillText(lvl.name, cardX + 110, cardY + 34);
    ctx.shadowBlur = 0;

    // Độ khó
    ctx.fillStyle = diffColor[lvl.difficulty] || "#aaa"; ctx.font = "bold 13px Arial";
    ctx.fillText(`[${lvl.difficulty}]`, cardX + 110, cardY + 56);

    // Stats
    ctx.fillStyle = "rgba(200,200,200,0.75)"; ctx.font = "12px Arial";
    ctx.fillText(lvl.bossStats, cardX + 110, cardY + 76);

    // Mô tả
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "italic 12px Arial";
    ctx.fillText(lvl.description, cardX + 110, cardY + cardH - 14);

    // Nút FIGHT – 9-slice
    const btnW = 90, btnH = 34;
    const btnX = cardX + cardW - btnW - 14;
    const btnY = cardY + cardH / 2 - btnH / 2;

    this._shadow(ctx, hov ? 12 : 6, "rgba(0,0,0,0.4)");
    this._draw9Slice(ctx, this.bgButton, btnX, btnY, btnW, btnH, 8);
    this._noShadow(ctx);

    if (hov) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      this._roundRect(ctx, btnX, btnY, btnW, btnH, 8); ctx.fill();
      ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.5;
      this._roundRect(ctx, btnX, btnY, btnW, btnH, 8); ctx.stroke();
    }

    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 3;
    ctx.fillText("FIGHT", btnX + btnW / 2, btnY + btnH / 2 + 5);
    ctx.shadowBlur = 0;

    cardY += cardH + gap;
  });

  this._drawCloseButton(ctx, panelX, panelY, panelW);
  ctx.textAlign = "left";
  ctx.restore(); // ← kết thúc save
}

  _drawCloseButton(ctx, panelX, panelY, panelW) {
    const btnSize = 44;
    const cx = panelX + panelW + 6;
    const cy = panelY - 6;
    const btnX = cx - btnSize / 2;
    const btnY = cy - btnSize / 2;

    if (this.closeButton && this.closeButton.complete) {
      const oldSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      this._shadow(ctx, 12, "rgba(0,0,0,0.5)");
      ctx.drawImage(this.closeButton, btnX, btnY, btnSize, btnSize);
      this._noShadow(ctx);

      ctx.imageSmoothingEnabled = oldSmoothing;
    } else {
      // Fallback
      this._shadow(ctx, 10, "rgba(0,0,0,0.4)");
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      this._noShadow(ctx);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✕", cx, cy + 6);
    }
  }

  /* ══════════════════════════════════════════════════════════
     INTERACTION
  ══════════════════════════════════════════════════════════ */
  handleClick(mx, my, cW, cH) {
  if (this.inventoryUI.isOpen) { this.inventoryUI.handleClick(mx, my, cW, cH); return null; }
  if (this.shopUI.isOpen)      { this.shopUI.handleClick(mx, my, cW, cH);      return null; }
  if (this.showLevelSelect)    { return this._handleLevelSelectClick(mx, my, cW, cH); }
  if (this.showBossSelect)     { return this._handleBossSelectClick(mx, my, cW, cH); }  // ← check sớm, trước main btns

  const btns = this._mainBtns(cW, cH);
  for (const btn of btns) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (this.soundManager) this.soundManager.playUIClick();
      if (btn.action === "play")      this.showLevelSelect = true;
      if (btn.action === "boss")      this.showBossSelect  = true;
      if (btn.action === "inventory") this.inventoryUI.open();
      if (btn.action === "shop")      this.shopUI.open();
      return null;
    }
  }
  return null;
}

  _handleLevelSelectClick(mx, my, cW, cH) {
    const { lvlW, lvlH, gap, sidePad, panelW, panelH, panelX, panelY } =
      this._levelLayout(cW, cH);

    /* Close button */
    const cx = panelX + panelW + 6,
      cy = panelY - 6;
    if (Math.hypot(mx - cx, my - cy) <= 22) {
      this.showLevelSelect = false;
      return null;
    }

    const lvlX = panelX + sidePad;
    let lvlY = panelY + 60;

    for (const lvl of this.levels) {
      if (
        lvl.unlocked &&
        mx >= lvlX &&
        mx <= lvlX + lvlW &&
        my >= lvlY &&
        my <= lvlY + lvlH
      ) {
        if (this.soundManager) this.soundManager.playUIClick();
        this.selectedLevel = lvl.id;
        this.showLevelSelect = false;
        return { action: "startGame", level: lvl.id };
      }
      lvlY += lvlH + gap;
    }
    return null;
  }

  _handleBossSelectClick(mx, my, cW, cH) {
  const { cardW, cardH, gap, sidePad, panelW, panelH, panelX, panelY } = this._bossLayout(cW, cH);

  // Nút close
  const cx = panelX + panelW + 6, cy = panelY - 6;
  if (Math.hypot(mx - cx, my - cy) <= 22) { this.showBossSelect = false; return null; }

  const cardX = panelX + sidePad;
  let cardY   = panelY + 90; // ← PHẢI KHỚP với giá trị trong _drawBossSelect

  for (const lvl of this.bossLevels) {
    const btnW = 90, btnH = 34;
    const btnX = cardX + cardW - btnW - 14;
    const btnY = cardY + cardH / 2 - btnH / 2;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      if (this.soundManager) this.soundManager.playUIClick();
      this.selectedLevel = lvl.id;
      this.showBossSelect = false;
      return { action: "startGame", level: lvl.id };
    }
    cardY += cardH + gap; // ← advance đúng thứ tự
  }
  return null;
}

  handleMouseMove(mx, my, cW, cH) {
  if (this.inventoryUI.isOpen) { this.inventoryUI.handleMouseMove(mx, my, cW, cH); return; }
  if (this.shopUI.isOpen)      { this.shopUI.handleMouseMove(mx, my, cW, cH);      return; }
  if (this.showLevelSelect)    { this._updateLevelHover(mx, my, cW, cH);           return; }
  if (this.showBossSelect)     { this._updateBossHover(mx, my, cW, cH);            return; } // ← thêm dòng này

  this.hoveredMainBtn = -1;
  this._mainBtns(cW, cH).forEach((btn, i) => {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h)
      this.hoveredMainBtn = i;
  });
}

  _updateLevelHover(mx, my, cW, cH) {
    const { lvlW, lvlH, gap, sidePad, panelX, panelY } = this._levelLayout(
      cW,
      cH,
    );
    const lvlX = panelX + sidePad;
    let lvlY = panelY + 60;

    this.hoveredLevel = -1;
    this.levels.forEach((lvl, i) => {
      if (mx >= lvlX && mx <= lvlX + lvlW && my >= lvlY && my <= lvlY + lvlH)
        this.hoveredLevel = i;
      lvlY += lvlH + gap;
    });
  }

  _updateBossHover(mx, my, cW, cH) {
  const { cardW, cardH, gap, sidePad, panelX, panelY } = this._bossLayout(cW, cH);
  const cardX = panelX + sidePad;
  let cardY   = panelY + 90; // ← KHỚP
  this.hoveredBoss = -1;
  this.bossLevels.forEach((lvl, i) => {
    if (mx >= cardX && mx <= cardX + cardW && my >= cardY && my <= cardY + cardH)
      this.hoveredBoss = i;
    cardY += cardH + gap;
  });
}

  getSelectedLevel(id = null) {
  const sid = id ?? this.selectedLevel;
  return (
    this.levels.find(l => l.id === sid) ||
    this.bossLevels.find(l => l.id === sid)
  );
}
}
