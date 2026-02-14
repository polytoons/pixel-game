import { Item } from "./Item.js";

export class InventoryUI {
  constructor(inventory, player, soundManager = null, currency = null) {
    this.inventory = inventory;
    this.player = player;
    this.isOpen = false;
    this.activeTab = "inventory";
    this.hoveredItem = null;
    this.selectedForMerge = [];
    this.soundManager = soundManager;
    this.itemToSell = null; // { item, slotIndex }
    this.currency = currency;

    /* ── 9-Slice Background Config ────────────────────
     * Đặt đường dẫn ảnh background 16x16 (hoặc lớn hơn)
     * sliceSize: kích thước góc/viền (px) để giữ nguyên
     * Ví dụ: ảnh 16x16 thì slice 5px, ảnh 32x32 thì slice 8-10px
     ───────────────────────────────────────────────── */
    this.bgOuter = {
      img: this._loadImg("assets/UI/panel_outer_bg.png"),
      sliceSize: 5,
      scale: 4,
    };
    this.bgPanel = {
      img: this._loadImg("assets/UI/panel_bg.png"),
      sliceSize: 5,
      scale: 6,
    };
    // Button background - dùng chung cho tabs và buttons
    this.bgButton = {
      img: this._loadImg("assets/UI/button_bg.png"),
      sliceSize: 3,
      scale: 3,
    };
    // Grid background - dùng cho tất cả các ô item
    this.bgGrid = {
      img: this._loadImg("assets/UI/grid_slot_bg.png"),
      sliceSize: 4,
      scale: 3,
    };

    this.playerSprite = this._loadImg("assets/player_sprite.png");
  }

  _loadImg(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  open() {
    this.isOpen = true;
  }
  close() {
    this.isOpen = false;
    this.selectedForMerge = [];
    this.hoveredItem = null;
  }
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /* ═══════════════════════════════════════════════
     GEOMETRY HELPERS
  ═══════════════════════════════════════════════ */
  _rr(ctx, x, y, w, h, r = 10) {
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

  /**
   * 9-SLICE SCALING - Kỹ thuật chuẩn cho pixel art UI
   * Chia ảnh thành 9 vùng:
   *  ┌─────┬─────────┬─────┐
   *  │ TL  │   Top   │  TR │  ← Góc trên (fixed size)
   *  ├─────┼─────────┼─────┤
   *  │Left │ Center  │Right│  ← Cạnh (scale 1 chiều)
   *  ├─────┼─────────┼─────┤
   *  │ BL  │ Bottom  │  BR │  ← Góc dưới (fixed size)
   *  └─────┴─────────┴─────┘
   */
  _draw9Slice(ctx, bgConfig, x, y, w, h, r = 10) {
    const img = bgConfig.img;
    const slice = bgConfig.sliceSize * bgConfig.scale;

    // Làm tròn tọa độ để tránh đường kẻ anti-aliasing
    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);

    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = "#666666";
      this._rr(ctx, x, y, w, h, r);
      ctx.fill();
      return;
    }

    const oldSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    ctx.save();

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const s = slice / bgConfig.scale;

    // Tọa độ làm tròn chính xác để tránh gaps
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = Math.floor(x + slice);
    const y2 = Math.floor(y + slice);
    const x3 = Math.floor(x + w - slice);
    const y3 = Math.floor(y + h - slice);
    const x4 = Math.floor(x + w);
    const y4 = Math.floor(y + h);

    // ═══ 4 GÓC ═══
    ctx.drawImage(img, 0, 0, s, s, x1, y1, x2 - x1, y2 - y1);
    ctx.drawImage(img, imgW - s, 0, s, s, x3, y1, x4 - x3, y2 - y1);
    ctx.drawImage(img, 0, imgH - s, s, s, x1, y3, x2 - x1, y4 - y3);
    ctx.drawImage(img, imgW - s, imgH - s, s, s, x3, y3, x4 - x3, y4 - y3);

    // ═══ 4 CẠNH ═══
    ctx.drawImage(img, s, 0, imgW - s * 2, s, x2, y1, x3 - x2, y2 - y1);
    ctx.drawImage(img, s, imgH - s, imgW - s * 2, s, x2, y3, x3 - x2, y4 - y3);
    ctx.drawImage(img, 0, s, s, imgH - s * 2, x1, y2, x2 - x1, y3 - y2);
    ctx.drawImage(img, imgW - s, s, s, imgH - s * 2, x3, y2, x4 - x3, y3 - y2);

    // ═══ CENTER ═══
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

  _shadow(ctx, b = 16, c = "rgba(0,0,0,0.45)") {
    ctx.shadowBlur = b;
    ctx.shadowColor = c;
  }
  _ns(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  /* ── Layout: tất cả toạ độ tính từ đây ─────────── */
  _layout(cW, cH) {
    const OUTER_W = Math.min(750, cW - 40);
    const TAB_H = 32; // Giảm chiều cao tab một chút cho gọn

    const OUTER_PAD = 32; // Giảm padding ngoài để đỡ chiếm chỗ
    const INNER_PAD = 5;
    const PANEL_GAP = 10; // Khoảng cách giữa 2 panel trái phải

    // Chia không gian
    const availableW = OUTER_W - OUTER_PAD * 2 - PANEL_GAP;
    const leftW = Math.floor(availableW * 0.45); // Bên trái chiếm 45%
    const rightW = availableW - leftW; // Bên phải chiếm phần còn lại

    /* --- GRID CONFIG --- */
    const SS = 60; // Kích thước slot
    const G = 4; // Khoảng cách slot
    const usableRightW = rightW - INNER_PAD * 2;

    let COLS = Math.floor((usableRightW + G) / (SS + G));
    if (COLS < 1) COLS = 1;

    const actualGridW = COLS * SS + (COLS - 1) * G;
    const gridOffsetX = (usableRightW - actualGridW) / 2;

    /* --- HEIGHT CALCULATION --- */
    const GRID_ROWS = Math.max(4, Math.ceil(this.inventory.maxSlots / COLS)); // Tối thiểu 4 dòng để panel không bị ngắn quá

    // Chiều cao nội dung bên trái (ước lượng các khối)
    // Char(160) + Gap(20) + Stats(60) + Gap(20) + Passive(36)
    const leftContentEst = 160 + 20 + 60 + 20 + 36;

    // Chiều cao nội dung bên phải (Header + Grid)
    const gridHeaderH = 30;
    const rightContentH = gridHeaderH + GRID_ROWS * (SS + G) + 10;

    // Lấy chiều cao lớn nhất để 2 panel bằng nhau
    const contentH = Math.max(leftContentEst, rightContentH) + INNER_PAD * 2;
    const OUTER_H = TAB_H + contentH + OUTER_PAD * 2;

    // Tọa độ gốc (Căn giữa màn hình)
    const panelX = Math.floor((cW - OUTER_W) / 2);
    const panelY = Math.floor((cH - OUTER_H) / 2);

    // Tọa độ Panel con (Đặt ngay bên dưới Tab)
    // Tab sẽ nằm từ panelY + OUTER_PAD đến + TAB_H
    const bodyY = panelY + OUTER_PAD + TAB_H;

    const lx = panelX + OUTER_PAD;
    const ly = bodyY; // Panel trái bắt đầu ngay dưới tab
    const rx = lx + leftW + PANEL_GAP;
    const ry = bodyY - TAB_H; // Panel phải ngang hàng Panel trái
    const rightPanelH = contentH + TAB_H;

    return {
      OUTER_W,
      OUTER_H,
      TAB_H,
      OUTER_PAD,
      INNER_PAD,
      PANEL_GAP,
      panelX,
      panelY,
      leftW,
      rightW,
      contentH,
      lx,
      ly,
      rx,
      ry,
      rightPanelH,
      COLS,
      SS,
      G,
      gridOffsetX,
      gridHeaderH,
      gridRows: GRID_ROWS,
    };
  }

  /* ═══════════════════════════════════════════════
     MAIN DRAW
  ═══════════════════════════════════════════════ */
  draw(ctx, cW, cH) {
    if (!this.isOpen) return;

    const L = this._layout(cW, cH);

    /* dim */
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, cW, cH);

    /* outer panel - 9-slice */
    this._shadow(ctx, 32, "rgba(0, 0, 0, 0.6)");
    this._draw9Slice(
      ctx,
      this.bgOuter,
      L.panelX,
      L.panelY,
      L.OUTER_W,
      L.OUTER_H,
      8,
    );
    this._ns(ctx);

    /* tab bar */
    this._drawTabs(ctx, L);

    /* left sub-panel - 9-slice */
    this._shadow(ctx, 8, "rgba(0,0,0,0.3)");
    this._draw9Slice(ctx, this.bgPanel, L.lx, L.ly, L.leftW, L.contentH, 10);
    this._ns(ctx);

    /* right sub-panel - 9-slice */
    this._shadow(ctx, 8, "rgba(0,0,0,0.3)");
    this._draw9Slice(
      ctx,
      this.bgPanel,
      L.rx,
      L.ry,
      L.rightW,
      L.rightPanelH,
      10,
    );
    this._ns(ctx);

    /* content */
    if (this.activeTab === "inventory") {
      this._drawEquipArea(ctx, L);
    } else {
      this._drawMergeArea(ctx, L);
    }
    this._drawItemGrid(ctx, L);

    /* close button */
    this._drawCloseBtn(ctx, L);
  }

  /* ── Tabs: Vẽ dính liền với Panel trái ──────────────── */
  _drawTabs(ctx, L) {
    const tabs = ["INVENTORY", "MERGE"];
    // Tab rộng bằng một nửa panel trái hoặc cố định
    const tabW = 150;
    const tabH = L.TAB_H;

    // Tab nằm ngay trên đầu của Panel (ly - tabH)
    // Cộng thêm 2px đè nhẹ xuống để che đường viền nối nếu cần
    const y = L.ly - tabH - 5;
    const startX = L.lx; // Canh lề trái theo Panel trái

    tabs.forEach((tab, i) => {
      const tx = startX + i * (tabW + 4); // +4 khoảng cách giữa các tab
      const act = tab.toLowerCase() === this.activeTab;

      // Nếu active thì vẽ sáng hơn và che shadow
      this._shadow(ctx, act ? 6 : 2, "rgba(0,0,0,0.3)");

      if (this.bgButton && this.bgButton.img && this.bgButton.img.complete) {
        this._draw9Slice(ctx, this.bgButton, tx, y, tabW, tabH, 8);
      } else {
        ctx.fillStyle = act ? "#d0d0d0" : "#666";
        this._rr(ctx, tx, y, tabW, tabH, 8);
        ctx.fill();
      }
      this._ns(ctx);

      // Highlight viền nếu active
      if (act) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        this._rr(ctx, tx, y, tabW, tabH, 8);
        ctx.stroke();
      } else {
        // Làm tối tab không active
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        this._rr(ctx, tx, y, tabW, tabH, 8);
        ctx.fill();
      }

      ctx.fillStyle = act ? "#222" : "#ccc";
      ctx.font = `bold ${act ? 15 : 14}px Arial`;
      ctx.textAlign = "center";
      // Căn chỉnh text vào giữa tab
      ctx.fillText(tab, tx + tabW / 2, y + tabH / 2 + 5);
    });
    ctx.textAlign = "left";
  }
  /* ── Close button ─────────────────────────────── */
  _drawCloseBtn(ctx, L) {
    const bx = L.panelX + L.OUTER_W + 6;
    const by = L.panelY - 6;
    this._shadow(ctx, 10, "rgba(0,0,0,0.5)");
    ctx.fillStyle = "#ef5350";
    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.fill();
    this._ns(ctx);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✕", bx, by + 6);
    ctx.textAlign = "left";
  }

  /* ═══════════════════════════════════════════════
     LEFT PANEL — INVENTORY TAB (CĂN GIỮA DỌC)
  ═══════════════════════════════════════════════ */
  _drawEquipArea(ctx, L) {
    const { lx, ly, leftW, contentH, INNER_PAD } = L;

    // 1. Định nghĩa kích thước các khối
    const CHAR_W = 120; // Thu nhỏ xíu cho cân đối
    const CHAR_H = 150;
    const SLOT_SIZE = 54;

    // Khối Stats cao khoảng 70px
    const STATS_H = 70;
    // Khối Passive cao 36px
    const PASSIVE_H = 36;

    // 2. Tính toán không gian khả dụng để căn giữa (Vertical Center)
    const totalContentH = CHAR_H + 20 + STATS_H + 20 + PASSIVE_H;
    const availableH = contentH - INNER_PAD * 2;

    // Offset Y để đẩy toàn bộ nội dung ra giữa panel theo chiều dọc
    let startY = ly + INNER_PAD;
    if (availableH > totalContentH) {
      startY += (availableH - totalContentH) / 2 - 10; // -10 để ưu tiên đẩy lên trên chút cho đẹp
    }

    // --- A. VẼ KHỐI CHARACTER & SLOT ---
    const blockCenterX = lx + leftW / 2;
    const charY = startY;
    const charX = blockCenterX - CHAR_W / 2;

    // Vẽ nền nhân vật
    this._shadow(ctx, 10, "rgba(41,182,246,0.4)");
    ctx.fillStyle = "#29b5f600";
    this._rr(ctx, charX, charY, CHAR_W, CHAR_H, 12);
    ctx.fill();
    this._ns(ctx);

    if (this.playerSprite && this.playerSprite.complete) {
      // Cấu hình sprite sheet của bạn
      const FRAME_WIDTH = 16; // Chiều rộng 1 frame (điều chỉnh theo sprite của bạn)
      const FRAME_HEIGHT = 16; // Chiều cao 1 frame (điều chỉnh theo sprite của bạn)
      const FRAME_X = 0; // Vị trí X của frame đầu tiên (thường là 0)
      const FRAME_Y = 0; // Vị trí Y của frame đầu tiên (thường là 0)

      // Scale sprite để vừa với vùng character (giữ tỷ lệ)
      const scale = Math.min(CHAR_W / FRAME_WIDTH, CHAR_H / FRAME_HEIGHT);
      const drawW = FRAME_WIDTH * scale;
      const drawH = FRAME_HEIGHT * scale;

      // Căn giữa sprite trong vùng character
      const spriteX = charX + (CHAR_W - drawW) / 2;
      const spriteY = charY + (CHAR_H - drawH) / 2;

      // Tắt image smoothing để giữ pixel art sắc nét
      const oldSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        this.playerSprite,
        FRAME_X,
        FRAME_Y,
        FRAME_WIDTH,
        FRAME_HEIGHT, // Source: lấy frame từ sprite sheet
        spriteX,
        spriteY,
        drawW,
        drawH, // Destination: vẽ lên canvas
      );

      ctx.imageSmoothingEnabled = oldSmoothing;
    }

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";

    // Tính tọa độ Slots bám theo Character
    const slotGap = 12; // Khoảng cách slot tới nhân vật
    // Slot bên trái: Helmet (trên), Shield (dưới)
    const leftSlotX = charX - slotGap - SLOT_SIZE;
    // Slot bên phải: Armor (trên), Boots (dưới)
    const rightSlotX = charX + CHAR_W + slotGap;

    const topSlotY = charY + 10;
    const botSlotY = charY + CHAR_H - 10 - SLOT_SIZE;

    const slotDefs = [
      { type: "helmet", x: leftSlotX, y: topSlotY },
      { type: "armor", x: rightSlotX, y: topSlotY },
      { type: "gloves", x: leftSlotX, y: botSlotY },
      { type: "boots", x: rightSlotX, y: botSlotY },
    ];
    const typeIcon = { helmet: "⛑️", armor: "🛡️", gloves: "🧤", boots: "👢" };

    slotDefs.forEach((sd) => {
      const item = this.inventory.equipped[sd.type];

      // Vẽ Slot Background
      if (this.bgGrid?.img?.complete) {
        this._draw9Slice(ctx, this.bgGrid, sd.x, sd.y, SLOT_SIZE, SLOT_SIZE, 8);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        this._rr(ctx, sd.x, sd.y, SLOT_SIZE, SLOT_SIZE, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        this._rr(ctx, sd.x, sd.y, SLOT_SIZE, SLOT_SIZE, 8);
        ctx.stroke();
      }

      // Vẽ Item hoặc Icon mặc định
      if (item) {
        ctx.fillStyle = item.getColor();
        ctx.globalAlpha = 0.3;
        this._rr(ctx, sd.x + 2, sd.y + 2, SLOT_SIZE - 4, SLOT_SIZE - 4, 6);
        ctx.fill();
        ctx.globalAlpha = 1;

        item.drawSprite(
          ctx,
          sd.x + SLOT_SIZE / 2,
          sd.y + SLOT_SIZE / 2,
          SLOT_SIZE * 0.6,
        );

        // Viền rarity
        ctx.strokeStyle = item.getColor();
        ctx.lineWidth = 2;
        this._rr(ctx, sd.x, sd.y, SLOT_SIZE, SLOT_SIZE, 8);
        ctx.stroke();
      } else {
        ctx.font = "24px Arial";
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillText(
          typeIcon[sd.type],
          sd.x + SLOT_SIZE / 2,
          sd.y + SLOT_SIZE / 2 + 8,
        );
      }
    });

    // --- B. VẼ STATS ---
    // Tự động cách Character một khoảng, tối thiểu 45px
    const statsY = charY + CHAR_H + 45;

    const stats = this.inventory.getTotalStats();
    // Chia làm 2 cột
    const col1X = lx + INNER_PAD + 10;
    const col2X = lx + leftW / 2 + 10;

    const statRows = [
      [
        { label: `❤️ HP: +${stats.hp}`, c: "#ff6b6b" },
        { label: `🛡️ Giáp: +${stats.armor}`, c: "#74c0fc" },
      ],
      [
        { label: `⚔️ ST: +${stats.damage}`, c: "#ffa94d" },
        { label: `⚡ Tốc: +${stats.speed}`, c: "#ffe066" },
      ],
    ];

    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    statRows.forEach((row, idx) => {
      const ry = statsY + idx * 36; // Dòng cách dòng 24px

      ctx.fillStyle = row[0].c;
      ctx.fillText(row[0].label, col1X, ry);

      ctx.fillStyle = row[1].c;
      ctx.fillText(row[1].label, col2X, ry);
    });

    // --- C. VẼ PASSIVE ---
    // Nằm dưới Stats một khoảng
    const passY = statsY + statRows.length * 24 + 15;
    const passW = leftW - INNER_PAD * 2;
    const passX = lx + INNER_PAD;

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    this._rr(ctx, passX, passY, passW, PASSIVE_H, 6);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    this._rr(ctx, passX, passY, passW, PASSIVE_H, 6);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "italic 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Đánh bại quái có tỉ lệ nhận trang bị", passX + passW / 2, passY + PASSIVE_H / 2 + 4);

    // --- D. HINT (Luôn ở đáy) ---
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Click để trang bị / tháo đồ",
      blockCenterX,
      ly + contentH - 8,
    );
    ctx.textAlign = "left";
  }

  /* ═══════════════════════════════════════════════
     LEFT PANEL — MERGE TAB
  ═══════════════════════════════════════════════ */
  _drawMergeArea(ctx, L) {
    const { lx, ly, leftW, contentH, INNER_PAD } = L;

    ctx.fillStyle = "#e0e0e0";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Chọn 3 item cùng loại & độ hiếm để ghép",
      lx + leftW / 2,
      ly + INNER_PAD + 16,
    );

    const SS = 72;
    const plusGap = 30;
    const rowW = SS * 3 + plusGap * 2;
    const rowX = lx + (leftW - rowW) / 2;
    const rowY = ly + INNER_PAD + 48;

    for (let i = 0; i < 3; i++) {
      const sx = rowX + i * (SS + plusGap);

      // Vẽ slot background với 9-slice
      if (this.bgGrid && this.bgGrid.img && this.bgGrid.img.complete) {
        this._draw9Slice(ctx, this.bgGrid, sx, rowY, SS, SS, 9);
      } else {
        // Fallback
        ctx.fillStyle = "rgba(200,200,200,0.25)";
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        this._rr(ctx, sx, rowY, SS, SS, 9);
        ctx.fill();
        this._rr(ctx, sx, rowY, SS, SS, 9);
        ctx.stroke();
      }

      if (i < this.selectedForMerge.length) {
        const item = this.inventory.items.find(
          (it) => it.id === this.selectedForMerge[i],
        );
        if (item) {
          // Nền màu rarity
          ctx.fillStyle = item.getColor();
          ctx.globalAlpha = 0.4;
          this._rr(ctx, sx + 3, rowY + 3, SS - 6, SS - 6, 7);
          ctx.fill();
          ctx.globalAlpha = 1;

          item.drawSprite(ctx, sx + SS / 2, rowY + SS / 2, SS * 0.5);
        }
      } else {
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.font = "28px Arial";
        ctx.textAlign = "center";
        ctx.fillText("?", sx + SS / 2, rowY + SS / 2 + 10);
      }

      if (i < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "bold 22px Arial";
        ctx.fillText("+", sx + SS + plusGap / 2, rowY + SS / 2 + 8);
      }
    }

    const arrowY = rowY + SS + 8;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⬇️", lx + leftW / 2, arrowY + 24);

    const resY = arrowY + 38;
    const rsx = lx + (leftW - SS) / 2;

    const canMerge =
      this.selectedForMerge.length === 3 &&
      this.inventory.canCombine(...this.selectedForMerge);

    let previewItem = null;
    if (canMerge) {
      const baseItem = this.inventory.items.find(
        (it) => it.id === this.selectedForMerge[0],
      );

      if (baseItem) {
        const rarityUpgrade = {
          common: "rare",
          rare: "epic",
          epic: "legendary",
          legendary: "legendary", // Max rarity
        };
        const nextRarity = rarityUpgrade[baseItem.rarity];

        // ⭐ Import Item class ở đầu file nếu chưa có
        // import { Item } from "./Item.js";
        previewItem = new Item(baseItem.type, nextRarity, baseItem.variant);
      }
    }

    // Vẽ result slot background
    if (this.bgGrid && this.bgGrid.img && this.bgGrid.img.complete) {
      this._draw9Slice(ctx, this.bgGrid, rsx, resY, SS, SS, 9);
    } else {
      // Fallback
      ctx.fillStyle = "rgba(200,200,200,0.2)";
      this._rr(ctx, rsx, resY, SS, SS, 9);
      ctx.fill();
    }

    // Nền màu rarity nâng cấp
    if (canMerge && previewItem) {
      // Lấy màu TRỰC TIẾP từ previewItem (đã có rarity mới)
      ctx.fillStyle = previewItem.getColor();
      ctx.globalAlpha = 0.5;
      this._rr(ctx, rsx + 3, resY + 3, SS - 6, SS - 6, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = canMerge
      ? "rgba(255,215,0,0.7)"
      : "rgba(255,255,255,0.2)";
    ctx.lineWidth = canMerge ? 2.5 : 1.5;
    this._rr(ctx, rsx, resY, SS, SS, 9);
    ctx.stroke();

    ctx.textAlign = "center";
    if (canMerge && previewItem) {
      previewItem.drawSprite(ctx, rsx + SS / 2, resY + SS / 2, SS * 0.5);
    } else {
      ctx.fillStyle = "rgba(200,200,200,0.5)";
      ctx.font = "28px Arial";
      ctx.fillText("?", rsx + SS / 2, resY + SS / 2 + 10);
    }

    // ═══ MERGE BUTTON với 9-slice ═══
    const btnW = 180,
      btnH = 46;
    const btnX = lx + (leftW - btnW) / 2;
    const btnY = resY + SS + 14;

    // Vẽ button background bằng 9-slice (hoặc fallback nếu không có ảnh)
    if (this.bgButton && this.bgButton.img && this.bgButton.img.complete) {
      this._shadow(
        ctx,
        canMerge ? 16 : 4,
        canMerge ? "rgba(76,175,80,0.5)" : "rgba(0,0,0,0.2)",
      );

      // Tạm tắt shadow cho 9-slice để tránh shadow lồng
      const tmpShadow = ctx.shadowBlur;
      this._ns(ctx);

      this._draw9Slice(ctx, this.bgButton, btnX, btnY, btnW, btnH, 8);

      // Bật lại shadow cho viền
      ctx.shadowBlur = tmpShadow;
    } else {
      // Fallback: vẽ button thông thường
      this._shadow(
        ctx,
        canMerge ? 16 : 4,
        canMerge ? "rgba(76,175,80,0.5)" : "rgba(0,0,0,0.2)",
      );
      ctx.fillStyle = canMerge ? "#c8e6c9" : "#bdbdbd";
      this._rr(ctx, btnX, btnY, btnW, btnH, 10);
      ctx.fill();
    }
    this._ns(ctx);

    if (canMerge) {
      ctx.strokeStyle = "#4CAF50";
      ctx.lineWidth = 2.5;
      this._rr(ctx, btnX, btnY, btnW, btnH, 10);
      ctx.stroke();
    }

    ctx.fillStyle = canMerge ? "#1b5e20" : "#757575";
    ctx.font = `bold ${canMerge ? 17 : 16}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("MERGE", btnX + btnW / 2, btnY + btnH / 2 + 6);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "15px Arial";
    ctx.fillText(
      "Click item bên phải để chọn",
      lx + leftW / 2,
      ly + contentH - INNER_PAD - 4,
    );
    ctx.textAlign = "left";
  }

  /* ═══════════════════════════════════════════════
     RIGHT PANEL — ITEM GRID
  ═══════════════════════════════════════════════ */
  _drawItemGrid(ctx, L) {
    // Lấy thêm gridOffsetX từ L
    const { rx, ry, rightW, contentH, SS, G, COLS, INNER_PAD, gridOffsetX } = L;

    // Tính toạ độ bắt đầu Grid có cộng thêm Offset để căn giữa
    const gridX = rx + INNER_PAD + gridOffsetX;
    const gridY = ry + INNER_PAD + L.TAB_H; // Cộng thêm INNER_PAD vào Y để header không sát viền trên

    // // Vẽ Header text
    // ctx.fillStyle = "#e0e0e0";
    // ctx.font = "bold 13px Arial";
    // ctx.textAlign = "center";
    // // Header nằm giữa khoảng pad trên
    // ctx.fillText(
    //   `Túi Đồ  ${this.inventory.items.length} / ${this.inventory.maxSlots}`,
    //   rx + rightW / 2,
    //   ry + INNER_PAD + 10,
    // );

    for (let i = 0; i < this.inventory.maxSlots; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const sx = gridX + col * (SS + G);
      const sy = gridY + row * (SS + G);

      // Check bounds drawing (đảm bảo không vẽ chòi ra ngoài panel)
      if (sy + SS > ry + contentH - INNER_PAD + 5) break;

      // ... (Phần vẽ Slot và Item giữ nguyên như cũ) ...
      // Copy đoạn logic vẽ slot background và item từ code cũ vào đây
      // Vẫn giữ logic fallback và draw9Slice như cũ

      // [START] COPY TỪ CODE CŨ (Đã rút gọn để dễ nhìn)
      if (this.bgGrid && this.bgGrid.img && this.bgGrid.img.complete) {
        this._draw9Slice(ctx, this.bgGrid, sx, sy, SS, SS, 8);
      } else {
        ctx.fillStyle = "rgba(150,150,150,0.5)";
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        this._rr(ctx, sx, sy, SS, SS, 8);
        ctx.fill();
        this._rr(ctx, sx, sy, SS, SS, 8);
        ctx.stroke();
      }

      if (i < this.inventory.items.length) {
        const item = this.inventory.items[i];
        const isMerged = this.selectedForMerge.includes(item.id);
        const isHover = this.hoveredItem === item;

        ctx.fillStyle = item.getColor();
        ctx.globalAlpha = 0.35;
        this._rr(ctx, sx + 2, sy + 2, SS - 4, SS - 4, 7);
        ctx.fill();
        ctx.globalAlpha = 1;

        item.drawSprite(ctx, sx + SS / 2, sy + SS / 2, SS * 0.5);

        if (isMerged) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 3;
          this._rr(ctx, sx, sy, SS, SS, 8);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,215,0,0.15)";
          this._rr(ctx, sx, sy, SS, SS, 8);
          ctx.fill();
          ctx.fillStyle = "#FFD700";
          ctx.font = "bold 9px Arial";
          ctx.fillText("✓", sx + SS - 8, sy + 12);
        }

        // ⭐ HOVER EFFECT + SELL BUTTON
        if (isHover && !isMerged) {
          // Viền trắng khi hover
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 2;
          this._rr(ctx, sx, sy, SS, SS, 8);
          ctx.stroke();

          // ⭐ NÚT SELL (góc dưới phải)
          const sellBtnW = 32;
          const sellBtnH = 18;
          const sellBtnX = sx + SS - sellBtnW - 3;
          const sellBtnY = sy + SS - sellBtnH - 3;

          // Background nút sell
          ctx.fillStyle = "rgba(220, 53, 69, 0.9)"; // Màu đỏ
          this._rr(ctx, sellBtnX, sellBtnY, sellBtnW, sellBtnH, 4);
          ctx.fill();

          // Viền nút
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1;
          this._rr(ctx, sellBtnX, sellBtnY, sellBtnW, sellBtnH, 4);
          ctx.stroke();

          // Text "SELL"
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            "BÁN",
            sellBtnX + sellBtnW / 2,
            sellBtnY + sellBtnH / 2 + 3,
          );

          // Hiển thị giá bán
          const sellPrice = this.inventory.getItemSellPrice(item);
          ctx.fillStyle = "#FFD700";
          ctx.font = "bold 12px Arial";
          ctx.fillText(`💰${sellPrice}`, sx + SS / 2, sy + 12);
        }
      }
      // [END] COPY TỪ CODE CŨ
    }
    ctx.textAlign = "left";
  }

  /* ═══════════════════════════════════════════════
     INTERACTION
  ═══════════════════════════════════════════════ */
  _gridItemAt(mx, my, L) {
    const { rx, ry, contentH, SS, G, COLS, INNER_PAD, gridOffsetX } = L;

    // Phải dùng công thức toạ độ y hệt như _drawItemGrid
    const gridX = rx + INNER_PAD + gridOffsetX;
    const gridY = ry + INNER_PAD + L.TAB_H;

    for (let i = 0; i < this.inventory.items.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const sx = gridX + col * (SS + G);
      const sy = gridY + row * (SS + G);

      if (sy + SS > ry + contentH - INNER_PAD + 5) break;

      if (mx >= sx && mx <= sx + SS && my >= sy && my <= sy + SS)
        return this.inventory.items[i];
    }
    return null;
  }

  handleClick(mx, my, cW, cH) {
    if (!this.isOpen) return false;
    const L = this._layout(cW, cH);

    // Close button
    const bx = L.panelX + L.OUTER_W + 6,
      by = L.panelY - 6;
    if (Math.hypot(mx - bx, my - by) <= 20) {
      if (this.soundManager) this.soundManager.playUIClick();
      this.close();
      return true;
    }

    // Tabs
    const tabs = ["inventory", "merge"];
    const tabW = 150;
    const tabH = L.TAB_H;
    const tabY = L.ly - tabH;
    const startX = L.lx;

    tabs.forEach((tab, i) => {
      const tx = startX + i * (tabW + 4);
      if (mx >= tx && mx <= tx + tabW && my >= tabY && my <= tabY + tabH) {
        if (this.soundManager) this.soundManager.playUIClick();
        this.activeTab = tab;
        this.selectedForMerge = [];
      }
    });

    if (this.activeTab === "inventory") {
      // Check equipped slots
      const CHAR_W = 120;
      const CHAR_H = 150;
      const SLOT_SIZE = 54;

      const totalContentH = CHAR_H + 20 + 70 + 20 + 36;
      const availableH = L.contentH - L.INNER_PAD * 2;
      let startY = L.ly + L.INNER_PAD;
      if (availableH > totalContentH) {
        startY += (availableH - totalContentH) / 2 - 10;
      }

      const blockCenterX = L.lx + L.leftW / 2;
      const charY = startY;
      const charX = blockCenterX - CHAR_W / 2;

      const slotGap = 12;
      const leftSlotX = charX - slotGap - SLOT_SIZE;
      const rightSlotX = charX + CHAR_W + slotGap;
      const topSlotY = charY + 10;
      const botSlotY = charY + CHAR_H - 10 - SLOT_SIZE;

      const slotDefs = [
        { type: "helmet", x: leftSlotX, y: topSlotY },
        { type: "armor", x: rightSlotX, y: topSlotY },
        { type: "gloves", x: leftSlotX, y: botSlotY },
        { type: "boots", x: rightSlotX, y: botSlotY },
      ];

      for (const sd of slotDefs) {
        if (
          mx >= sd.x &&
          mx <= sd.x + SLOT_SIZE &&
          my >= sd.y &&
          my <= sd.y + SLOT_SIZE
        ) {
          if (this.inventory.equipped[sd.type]) {
            this.inventory.unequipItem(sd.type);
            this.player.updateStats(this.inventory.getTotalStats());
            if (this.soundManager) this.soundManager.playUIClick();
          }
          return true;
        }
      }

      // ⭐ CHECK SELL BUTTON TRƯỚC item click
      const { rx, ry, SS, G, COLS, INNER_PAD, gridOffsetX } = L;
      const gridX = rx + INNER_PAD + gridOffsetX;
      const gridY = ry + INNER_PAD + L.TAB_H;

      for (let i = 0; i < this.inventory.items.length; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const sx = gridX + col * (SS + G);
        const sy = gridY + row * (SS + G);

        if (sy + SS > ry + L.contentH - INNER_PAD + 5) break;

        const item = this.inventory.items[i];
        const isHover = this.hoveredItem === item;

        if (isHover && mx >= sx && mx <= sx + SS && my >= sy && my <= sy + SS) {
          // ⭐ CHECK NÚT SELL (góc dưới phải)
          const sellBtnW = 32;
          const sellBtnH = 18;
          const sellBtnX = sx + SS - sellBtnW - 3;
          const sellBtnY = sy + SS - sellBtnH - 3;

          if (
            mx >= sellBtnX &&
            mx <= sellBtnX + sellBtnW &&
            my >= sellBtnY &&
            my <= sellBtnY + sellBtnH
          ) {
            // ⭐ CLICK NÚT SELL
            const result = this.inventory.sellItem(item.id, this.currency);
            if (result) {
              if (this.soundManager) this.soundManager.playUIClick();
              console.log(`✅ Sold for ${result.price} gold`);
            }
            return true;
          }
        }
      }

      // Item click (equip)
      const item = this._gridItemAt(mx, my, L);
      if (item) {
        this.inventory.equipItem(item.id);
        this.player.updateStats(this.inventory.getTotalStats());
        if (this.soundManager) this.soundManager.playUIClick();
        return true;
      }
    }

    if (this.activeTab === "merge") {
      const SS = 72;
      const rowY = L.ly + L.INNER_PAD + 32;
      const arrowY = rowY + SS + 8;
      const resY = arrowY + 38;
      const btnW = 180,
        btnH = 46;
      const btnX = L.lx + (L.leftW - btnW) / 2;
      const btnY = resY + SS + 14;

      if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
        if (
          this.selectedForMerge.length === 3 &&
          this.inventory.canCombine(...this.selectedForMerge)
        ) {
          const newItem = this.inventory.combineItems(...this.selectedForMerge);
          if (newItem) {
            this.selectedForMerge = [];
            this.player.updateStats(this.inventory.getTotalStats());
            if (this.soundManager) this.soundManager.playUIClick();
          }
        }
        return true;
      }

      const item = this._gridItemAt(mx, my, L);
      if (item) {
        const idx = this.selectedForMerge.indexOf(item.id);
        if (idx > -1) this.selectedForMerge.splice(idx, 1);
        else if (this.selectedForMerge.length < 3)
          this.selectedForMerge.push(item.id);
        return true;
      }
    }

    return true;
  }

  handleMouseMove(mx, my, cW, cH) {
    if (!this.isOpen) {
      this.hoveredItem = null;
      return;
    }
    const L = this._layout(cW, cH);
    this.hoveredItem = this._gridItemAt(mx, my, L);
  }
}
