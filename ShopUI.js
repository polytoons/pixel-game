export class ShopUI {
  constructor(shop, currency, inventory, player) {
    this.shop = shop;
    this.currency = currency;
    this.inventory = inventory;
    this.player = player;
    this.isOpen = false;
    this.hoveredIndex = -1;

    /* ══════════════════════════════════════════════════════════
       🎨 BACKGROUND ASSETS - Thay đổi đường dẫn ở đây
    ══════════════════════════════════════════════════════════ */

    // Panel ngoài (background chính của shop)
    this.bgOuter = {
      img: this._loadImg("assets/ui/panel_outer_bg.png"),
      sliceSize: 5,
      scale: 4,
    };

    // Panel trong (background của mỗi item row)
    this.bgItemRow = {
      img: this._loadImg("assets/ui/panel_bg.png"),
      sliceSize: 5,
      scale: 3,
    };

    // Button backgrounds (BUY, REFRESH)
    this.bgButton = {
      img: this._loadImg("assets/ui/button_bg.png"),
      sliceSize: 3,
      scale: 3,
    };

    // Icon slot background (ô chứa icon item)
    this.bgIconSlot = {
      img: this._loadImg("assets/ui/grid_slot_bg.png"),
      sliceSize: 4,
      scale: 3,
    };

    // Close button image
    this.closeButton = this._loadImg("assets/ui/close_button.png");
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
  }
  toggle() {
    this.isOpen = !this.isOpen;
  }

  /* ══════════════════════════════════════════════════════════
     9-SLICE DRAWING
  ══════════════════════════════════════════════════════════ */
  _roundRect(ctx, x, y, w, h, r) {
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

  _shadow(ctx, blur = 16, color = "rgba(0,0,0,0.45)") {
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
  }

  _noShadow(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  /* ══════════════════════════════════════════════════════════
     LAYOUT - Tăng padding 2 bên
  ══════════════════════════════════════════════════════════ */
  _layout(canvasWidth, canvasHeight) {
    const MAX_SLOTS = 6;
    const ITEM_H = 85;
    const GAP = 10;
    const HEADER_H = 80;
    const PADDING = 28;
    const SIDE_PADDING = 32; // ⭐ Tăng padding 2 bên (trước là 12)

    const panelW = 480; // Tăng width một chút
    const panelH = HEADER_H + MAX_SLOTS * (ITEM_H + GAP) + PADDING;
    const panelX = (canvasWidth - panelW) / 2;
    const panelY = (canvasHeight - panelH) / 2;

    return {
      MAX_SLOTS,
      ITEM_H,
      GAP,
      HEADER_H,
      PADDING,
      SIDE_PADDING,
      panelW,
      panelH,
      panelX,
      panelY,
    };
  }

  /* ══════════════════════════════════════════════════════════
     MAIN DRAW
  ══════════════════════════════════════════════════════════ */
  draw(ctx, canvasWidth, canvasHeight) {
    if (!this.isOpen) return;

    const L = this._layout(canvasWidth, canvasHeight);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    this._shadow(ctx, 32, "rgba(0,0,0,0.6)");
    this._draw9Slice(
      ctx,
      this.bgOuter,
      L.panelX,
      L.panelY,
      L.panelW,
      L.panelH,
      12,
    );
    this._noShadow(ctx);

    this._drawHeader(ctx, L);
    this._drawItemSlots(ctx, L);
    this._drawCloseButton(ctx, L);

    ctx.textAlign = "left";
  }

  _drawHeader(ctx, L) {
    const { panelX, panelY } = L;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText("SHOP", panelX + 32, panelY + 60);
    ctx.shadowBlur = 0;

    const rBtnX = panelX + 140;
    const rBtnY = panelY + 30;
    const rBtnW = 130;
    const rBtnH = 36;
    const canRefresh = this.currency.canAfford(this.shop.refreshCost);

    this._shadow(ctx, canRefresh ? 8 : 2, "rgba(0,0,0,0.3)");

    if (this.bgButton?.img?.complete) {
      this._draw9Slice(ctx, this.bgButton, rBtnX, rBtnY, rBtnW, rBtnH, 8);
      if (!canRefresh) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        this._roundRect(ctx, rBtnX, rBtnY, rBtnW, rBtnH, 8);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = canRefresh ? "#29b6f6" : "#78909c";
      this._roundRect(ctx, rBtnX, rBtnY, rBtnW, rBtnH, 8);
      ctx.fill();
    }
    this._noShadow(ctx);

    ctx.fillStyle = canRefresh ? "#222" : "#999";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `REFRESH (${this.shop.refreshCost}💰)`,
      rBtnX + rBtnW / 2,
      rBtnY + rBtnH / 2 + 5,
    );

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
    ctx.fillText(
      `💰 ${this.currency.getGold()}`,
      panelX + L.panelW - 32,
      panelY + 60,
    );
    ctx.shadowBlur = 0;
  }

  _drawItemSlots(ctx, L) {
    const {
      MAX_SLOTS,
      ITEM_H,
      GAP,
      HEADER_H,
      panelX,
      panelY,
      panelW,
      SIDE_PADDING,
    } = L;
    const startY = panelY + HEADER_H;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const iy = startY + i * (ITEM_H + GAP);
      const item = this.shop.items[i] || null;
      this._drawItemSlot(
        ctx,
        item,
        i,
        panelX + SIDE_PADDING,
        iy,
        panelW - SIDE_PADDING * 2,
        ITEM_H,
      );
    }
  }

  _drawItemSlot(ctx, item, index, x, y, w, h) {
    const hovered = this.hoveredIndex === index;
    const canAfford = item ? this.currency.canAfford(item.price) : false;

    this._shadow(ctx, 6, "rgba(0,0,0,0.2)");

    if (this.bgItemRow?.img?.complete) {
      this._draw9Slice(ctx, this.bgItemRow, x, y, w, h, 10);
      if (hovered && item) {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        this._roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = hovered && item ? "#e8e8e8" : "#d0d0d0";
      this._roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
    }
    this._noShadow(ctx);

    if (!item) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "italic 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("--- SOLD ---", x + w / 2, y + h / 2 + 5);
      return;
    }

    const iconSize = 58;
    const iconX = x + 10;
    const iconY = y + (h - iconSize) / 2;

    if (this.bgIconSlot?.img?.complete) {
      this._draw9Slice(
        ctx,
        this.bgIconSlot,
        iconX,
        iconY,
        iconSize,
        iconSize,
        8,
      );
      ctx.fillStyle = item.getColor();
      ctx.globalAlpha = 0.3;
      this._roundRect(ctx, iconX + 2, iconY + 2, iconSize - 4, iconSize - 4, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = item.getColor();
      ctx.globalAlpha = 0.85;
      this._roundRect(ctx, iconX, iconY, iconSize, iconSize, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    item.drawSprite(
      ctx,
      iconX + iconSize / 2,
      iconY + iconSize / 2,
      iconSize * 0.6,
    );

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 2;
    ctx.fillText(item.getName(), x + 82, y + h / 2 - 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = canAfford ? "#FFD700" : "#999";
    ctx.font = "bold 15px Arial";
    ctx.fillText(`💰 ${item.price}`, x + 82, y + h / 2 + 18);

    const btnW = 80;
    const btnH = 40;
    const btnX = x + w - btnW - 10;
    const btnY = y + (h - btnH) / 2;

    this._shadow(ctx, canAfford ? 8 : 2, "rgba(0,0,0,0.3)");

    if (this.bgButton?.img?.complete) {
      this._draw9Slice(ctx, this.bgButton, btnX, btnY, btnW, btnH, 8);
      if (!canAfford) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        this._roundRect(ctx, btnX, btnY, btnW, btnH, 8);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = canAfford ? "#4CAF50" : "#9e9e9e";
      this._roundRect(ctx, btnX, btnY, btnW, btnH, 8);
      ctx.fill();
    }
    this._noShadow(ctx);

    if (hovered && canAfford) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      this._roundRect(ctx, btnX, btnY, btnW, btnH, 8);
      ctx.stroke();
    }

    ctx.fillStyle = canAfford ? "#fff" : "#666";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BUY", btnX + btnW / 2, btnY + btnH / 2 + 5);
  }

  /* ══════════════════════════════════════════════════════════
     CLOSE BUTTON - Image
  ══════════════════════════════════════════════════════════ */
  _drawCloseButton(ctx, L) {
    const btnSize = 44; // Kích thước nút close
    const cx = L.panelX + L.panelW + 6;
    const cy = L.panelY - 6;
    const btnX = cx - btnSize / 2;
    const btnY = cy - btnSize / 2;

    if (this.closeButton && this.closeButton.complete) {
      // Vẽ image
      const oldSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      this._shadow(ctx, 12, "rgba(0,0,0,0.5)");
      ctx.drawImage(this.closeButton, btnX, btnY, btnSize, btnSize);
      this._noShadow(ctx);

      ctx.imageSmoothingEnabled = oldSmoothing;
    } else {
      // Fallback
      this._shadow(ctx, 12, "rgba(0,0,0,0.5)");
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      this._noShadow(ctx);

      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✕", cx, cy + 6);
    }
  }

  /* ══════════════════════════════════════════════════════════
     INTERACTION
  ══════════════════════════════════════════════════════════ */
  handleClick(mouseX, mouseY, canvasWidth, canvasHeight) {
    if (!this.isOpen) return false;

    const L = this._layout(canvasWidth, canvasHeight);

    const cx = L.panelX + L.panelW + 6;
    const cy = L.panelY - 6;
    if (Math.hypot(mouseX - cx, mouseY - cy) <= 22) {
      if (this.soundManager) this.soundManager.playUIClick();
      this.close();
      return true;
    }

    const rBtnX = L.panelX + 140;
    const rBtnY = L.panelY + 30;
    const rBtnW = 130;
    const rBtnH = 36;

    if (
      mouseX >= rBtnX &&
      mouseX <= rBtnX + rBtnW &&
      mouseY >= rBtnY &&
      mouseY <= rBtnY + rBtnH
    ) {
      if (this.currency.spend(this.shop.refreshCost)) {
        this.shop.refresh();
        if (this.soundManager) this.soundManager.playUIClick();
      }
      return true;
    }

    const startY = L.panelY + L.HEADER_H;

    for (let i = 0; i < L.MAX_SLOTS; i++) {
      const item = this.shop.items[i];
      if (!item) continue;

      const iy = startY + i * (L.ITEM_H + L.GAP);
      const x = L.panelX + L.SIDE_PADDING;
      const w = L.panelW - L.SIDE_PADDING * 2;

      const btnW = 80;
      const btnH = 40;
      const btnX = x + w - btnW - 10;
      const btnY = iy + (L.ITEM_H - btnH) / 2;

      if (
        mouseX >= btnX &&
        mouseX <= btnX + btnW &&
        mouseY >= btnY &&
        mouseY <= btnY + btnH
      ) {
        if (
          this.currency.canAfford(item.price) &&
          this.currency.spend(item.price)
        ) {
          const bought = this.shop.buyItem(i);
          if (bought) {
            this.inventory.addItem(bought);
            if (this.soundManager) this.soundManager.playUIClick();
          }
        }
        return true;
      }
    }

    return true;
  }

  handleMouseMove(mouseX, mouseY, canvasWidth, canvasHeight) {
    if (!this.isOpen) {
      this.hoveredIndex = -1;
      return;
    }

    const L = this._layout(canvasWidth, canvasHeight);
    const startY = L.panelY + L.HEADER_H;

    this.hoveredIndex = -1;

    for (let i = 0; i < L.MAX_SLOTS; i++) {
      const iy = startY + i * (L.ITEM_H + L.GAP);
      const x = L.panelX + L.SIDE_PADDING;
      const w = L.panelW - L.SIDE_PADDING * 2;

      if (
        mouseX >= x &&
        mouseX <= x + w &&
        mouseY >= iy &&
        mouseY <= iy + L.ITEM_H
      ) {
        this.hoveredIndex = i;
        break;
      }
    }
  }
}
