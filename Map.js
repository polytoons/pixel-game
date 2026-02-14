export class Map {
  constructor() {
    this.mapData = null;
    this.tilesets = [];
    this.layers = [];
    this.tileSize = 32;
    this.scale = 1;
    this.scaledTileSize = this.tileSize * this.scale;
    this.collisionPolygons = [];
    this.images = {};
  }

  async load(mapPath) {
    try {
      const response = await fetch(mapPath);
      this.mapData = await response.json();

      await this.loadTilesets();
      this.extractCollisionData();

      return true;
    } catch (error) {
      console.error("Error loading map:", error);
      return false;
    }
  }

  async loadTilesets() {
    const loadPromises = this.mapData.tilesets.map(async (tileset) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.images[tileset.name] = img;
          resolve();
        };
        img.onerror = reject;
        img.src = tileset.image;
      });
    });

    await Promise.all(loadPromises);
  }

  extractCollisionData() {
    this.walkablePolygons = [];
    this.obstaclePolygons = [];

    for (const layer of this.mapData.layers) {
      if (layer.type === "objectgroup" && layer.name === "Collision") {
        const layerType =
          layer.properties?.find((p) => p.name === "type")?.value || "walkable";
        for (const obj of layer.objects) {
          if (obj.polygon && obj.polygon.length > 0) {
            const poly = {
              id: obj.id,
              x: obj.x * this.scale,
              y: obj.y * this.scale,
              points: obj.polygon.map((p) => ({
                x: p.x * this.scale,
                y: p.y * this.scale,
              })),
              type: layerType,
            };

            if (layerType === "obstacle") {
              this.obstaclePolygons.push(poly);
            } else {
              this.walkablePolygons.push(poly);
            }
          }
        }
      }
    }

    console.log(
      `✅ Walkable: ${this.walkablePolygons.length}, Obstacles: ${this.obstaclePolygons.length}`,
    );
  }

  draw(ctx, camera) {
    this.mapData.layers.forEach((layer) => {
      if (layer.type === "tilelayer" && layer.visible) {
        this.drawTileLayer(ctx, layer, camera);
      } else if (
        layer.type === "objectgroup" &&
        layer.visible &&
        layer.name !== "Collision"
      ) {
        this.drawObjectLayer(ctx, layer, camera);
      }
    });
  }

  drawTileLayer(ctx, layer, camera) {
    const data = layer.data;
    const width = layer.width;
    const height = layer.height;

    const startCol = Math.floor(camera.x / this.scaledTileSize);
    const endCol = Math.ceil((camera.x + camera.width) / this.scaledTileSize);
    const startRow = Math.floor(camera.y / this.scaledTileSize);
    const endRow = Math.ceil((camera.y + camera.height) / this.scaledTileSize);

    // ⭐ Tắt antialiasing để pixel art không bị mờ/nhoè
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;

    for (
      let row = Math.max(0, startRow);
      row < Math.min(height, endRow);
      row++
    ) {
      for (
        let col = Math.max(0, startCol);
        col < Math.min(width, endCol);
        col++
      ) {
        const tileIndex = row * width + col;
        const gid = data[tileIndex];
        if (gid === 0) continue;

        const tilesetInfo = this.getTilesetForGid(gid);
        if (!tilesetInfo) continue;

        const localId = gid - tilesetInfo.firstgid;
        const tilesetCols = tilesetInfo.columns;

        const srcX = (localId % tilesetCols) * this.tileSize;
        const srcY = Math.floor(localId / tilesetCols) * this.tileSize;

        // ⭐ Math.floor để loại bỏ số thập phân → không còn khe hở giữa các tile
        const destX = Math.floor(col * this.scaledTileSize - camera.x);
        const destY = Math.floor(row * this.scaledTileSize - camera.y);

        // ⭐ +1px để lấp kín khe hở ngay cả khi camera.x/y là số lẻ
        const drawW = Math.ceil(this.scaledTileSize) + 1;
        const drawH = Math.ceil(this.scaledTileSize) + 1;

        const img = this.images[tilesetInfo.name];
        if (img) {
          ctx.drawImage(
            img,
            srcX,
            srcY,
            this.tileSize,
            this.tileSize,
            destX,
            destY,
            drawW,
            drawH,
          );
        }
      }
    }

    ctx.imageSmoothingEnabled = prevSmoothing;
  }

  // ⭐ FIXED: Sort objects theo Y position trước khi vẽ
  drawObjectLayer(ctx, layer, camera) {
    // Bỏ qua polygon objects (dùng cho collision)
    const renderableObjects = layer.objects.filter(
      (obj) => !obj.polygon && obj.gid,
    );

    // ⭐ SORT theo Y position (bottom edge) - càng ở dưới càng vẽ sau
    renderableObjects.sort((a, b) => {
      // Tính Y position của BOTTOM edge của object
      const aBottom = a.y * this.scale;
      const bBottom = b.y * this.scale;
      return aBottom - bBottom;
    });

    // Vẽ theo thứ tự đã sort
    renderableObjects.forEach((obj) => {
      const tilesetInfo = this.getTilesetForGid(obj.gid);
      if (!tilesetInfo) return;

      const localId = obj.gid - tilesetInfo.firstgid;
      const tilesetCols = tilesetInfo.columns;

      // Lấy kích thước tile từ tileset
      const tileWidth = tilesetInfo.tilewidth || this.tileSize;
      const tileHeight = tilesetInfo.tileheight || this.tileSize;

      // Tính vị trí trong tileset
      const srcX = (localId % tilesetCols) * tileWidth;
      const srcY = Math.floor(localId / tilesetCols) * tileHeight;

      // Scale vị trí VÀ kích thước
      const destX = obj.x * this.scale - camera.x;
      // object trong Tiled có anchor ở bottom-left
      const destY = (obj.y - obj.height) * this.scale - camera.y;

      const scaledWidth = obj.width * this.scale;
      const scaledHeight = obj.height * this.scale;

      const img = this.images[tilesetInfo.name];
      if (img) {
        ctx.drawImage(
          img,
          srcX,
          srcY,
          tileWidth,
          tileHeight,
          destX,
          destY,
          scaledWidth,
          scaledHeight,
        );
      }
    });
  }

  getTilesetForGid(gid) {
    for (let i = this.mapData.tilesets.length - 1; i >= 0; i--) {
      if (gid >= this.mapData.tilesets[i].firstgid) {
        return this.mapData.tilesets[i];
      }
    }
    return null;
  }

  checkCollision(x, y) {
    // Kiểm tra có trong walkable area không
    let inWalkable = false;
    for (const poly of this.walkablePolygons) {
      if (this.pointInPolygon(x, y, poly)) {
        inWalkable = true;
        break;
      }
    }

    if (!inWalkable) return false;

    // Kiểm tra có trong obstacle không
    for (const poly of this.obstaclePolygons) {
      if (this.pointInPolygon(x, y, poly)) {
        return false; // ❌ Trong obstacle = không đi được
      }
    }

    return true; // ✅ Trong walkable VÀ không trong obstacle
  }

  pointInPolygon(x, y, poly) {
    let inside = false;
    const points = poly.points;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = poly.x + points[i].x;
      const yi = poly.y + points[i].y;
      const xj = poly.x + points[j].x;
      const yj = poly.y + points[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  getCollisionBounds() {
    if (this.collisionPolygons.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: this.getMapWidth(),
        maxY: this.getMapHeight(),
      };
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    this.collisionPolygons.forEach((poly) => {
      poly.points.forEach((point) => {
        const x = poly.x + point.x;
        const y = poly.y + point.y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    return { minX, minY, maxX, maxY };
  }

  getRandomSpawnPosition(margin = 100) {
    const bounds = this.getCollisionBounds();
    if (!bounds) return { x: 0, y: 0 };

    let x, y;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      x =
        bounds.minX +
        margin +
        Math.random() * (bounds.maxX - bounds.minX - margin * 2);
      y =
        bounds.minY +
        margin +
        Math.random() * (bounds.maxY - bounds.minY - margin * 2);
      attempts++;
    } while (!this.checkCollision(x, y) && attempts < maxAttempts);

    return { x, y };
  }

  getMapWidth() {
    return this.mapData.width * this.scaledTileSize;
  }

  getMapHeight() {
    return this.mapData.height * this.scaledTileSize;
  }

  getSpawnPosition() {
    if (this.walkablePolygons.length === 0) {
      return {
        x: this.getMapWidth() / 2,
        y: this.getMapHeight() / 2,
      };
    }

    const walkablePoly = this.walkablePolygons[0];

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    walkablePoly.points.forEach((point) => {
      const worldX = walkablePoly.x + point.x;
      const worldY = walkablePoly.y + point.y;
      minX = Math.min(minX, worldX);
      minY = Math.min(minY, worldY);
      maxX = Math.max(maxX, worldX);
      maxY = Math.max(maxY, worldY);
    });

    let x, y;
    let attempts = 0;
    const maxAttempts = 100;
    const margin = 50;

    do {
      x = minX + margin + Math.random() * (maxX - minX - margin * 2);
      y = minY + margin + Math.random() * (maxY - minY - margin * 2);

      attempts++;

      if (this.checkCollision(x, y)) {
        console.log(
          `✅ Found valid spawn position at (${x.toFixed(0)}, ${y.toFixed(0)}) after ${attempts} attempts`,
        );
        return { x, y };
      }
    } while (attempts < maxAttempts);

    console.warn(
      "⚠️ Could not find valid spawn, using center of walkable area",
    );
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }

  testPolygon(polygonIndex, testX, testY) {
    if (polygonIndex >= this.collisionPolygons.length) {
      console.error(`Polygon ${polygonIndex} không tồn tại!`);
      return;
    }

    const poly = this.collisionPolygons[polygonIndex];
    const inside = this.pointInPolygon(testX, testY, poly);

    console.log(`🎯 Test polygon ${polygonIndex + 1}:`, {
      testPoint: { x: testX, y: testY },
      polygonOrigin: { x: poly.x, y: poly.y },
      result: inside ? "✅ INSIDE" : "❌ OUTSIDE",
    });

    console.log("Testing polygon corners:");
    poly.points.forEach((p, i) => {
      const worldX = poly.x + p.x;
      const worldY = poly.y + p.y;
      const cornerInside = this.pointInPolygon(worldX, worldY, poly);
      console.log(
        `  Corner ${i}: (${worldX.toFixed(0)}, ${worldY.toFixed(0)}) -> ${cornerInside ? "✅" : "❌"}`,
      );
    });

    return inside;
  }

  drawCollisionDebug(ctx, camera) {
    if (this.collisionPolygons.length === 0) return;

    ctx.save();

    this.collisionPolygons.forEach((poly, index) => {
      const colors = [
        { fill: "rgba(255, 0, 0, 0.2)", stroke: "rgba(255, 0, 0, 0.8)" },
        { fill: "rgba(0, 255, 0, 0.2)", stroke: "rgba(0, 255, 0, 0.8)" },
        { fill: "rgba(0, 0, 255, 0.2)", stroke: "rgba(0, 0, 255, 0.8)" },
      ];
      const color = colors[index % colors.length];

      ctx.fillStyle = color.fill;
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 3;

      ctx.beginPath();
      poly.points.forEach((point, i) => {
        const x = poly.x + point.x - camera.x;
        const y = poly.y + point.y - camera.y;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const originX = poly.x - camera.x;
      const originY = poly.y - camera.y;
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(originX, originY, 8, 0, Math.PI * 2);
      ctx.fill();

      poly.points.forEach((point, i) => {
        const x = poly.x + point.x - camera.x;
        const y = poly.y + point.y - camera.y;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = "bold 12px Arial";
        ctx.fillText(i, x + 8, y - 8);
      });

      const centerX =
        poly.x +
        poly.points.reduce((sum, p) => sum + p.x, 0) / poly.points.length -
        camera.x;
      const centerY =
        poly.y +
        poly.points.reduce((sum, p) => sum + p.y, 0) / poly.points.length -
        camera.y;

      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.strokeText(`Collision ${index + 1}`, centerX, centerY);
      ctx.fillText(`Collision ${index + 1}`, centerX, centerY);
    });

    ctx.restore();
  }
}
