import { Item } from "./Item.js";

export class Inventory {
  constructor() {
    this.items = [];
    this.equipped = {
      helmet: null,
      armor: null,
      golves: null,
      boots: null,
    };

    this.maxSlots = 25;

    // Tạo một số item ban đầu
    this.generateStarterItems();
  }

  generateStarterItems() {
    // Thêm một số item khởi đầu
    this.addItem(new Item("helmet", "common"));
    this.addItem(new Item("armor", "common"));
    this.addItem(new Item("gloves", "common"));
    this.addItem(new Item("boots", "common"));
  }

  addItem(item) {
    if (this.items.length < this.maxSlots) {
      this.items.push(item);
      return true;
    }
    return false;
  }

  // ⭐ THÊM: Tính giá bán item (50% giá mua)
  getItemSellPrice(item) {
    // Base price theo rarity
    const basePrices = {
      common: 20,
      rare: 50,
      epic: 120,
      legendary: 300,
    };

    const basePrice = basePrices[item.rarity] || 20;

    // Variant bonus: +10% mỗi variant
    const variantBonus = item.variant * 0.1;
    const totalPrice = Math.floor(basePrice * (1 + variantBonus));

    // Bán được 50% giá trị
    return Math.floor(totalPrice * 0.5);
  }

  // ⭐ THÊM: Xóa item và trả vàng
  sellItem(itemId, currency) {
    const itemIndex = this.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) return null;

    const item = this.items[itemIndex];

    // Không cho bán item đang trang bị
    const isEquipped = Object.values(this.equipped).some(
      (equipped) => equipped && equipped.id === item.id,
    );

    if (isEquipped) {
      console.warn("Cannot sell equipped item!");
      return null;
    }

    // Xóa item
    const soldItem = this.items.splice(itemIndex, 1)[0];

    // Tính tiền
    const sellPrice = this.getItemSellPrice(soldItem);
    currency.add(sellPrice);

    console.log(`💰 Sold ${soldItem.getName()} for ${sellPrice} gold`);

    return { item: soldItem, price: sellPrice };
  }

  removeItem(itemId) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  equipItem(itemId) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return false;

    // Nếu đã có item được trang bị ở slot này, tháo ra
    if (this.equipped[item.type]) {
      this.unequipItem(item.type);
    }

    // Trang bị item mới
    this.equipped[item.type] = item;
    this.removeItem(itemId);
    return true;
  }

  unequipItem(slotType) {
    if (this.equipped[slotType]) {
      const item = this.equipped[slotType];
      this.equipped[slotType] = null;
      this.addItem(item);
      return true;
    }
    return false;
  }

  getTotalStats() {
    const stats = {
      hp: 0,
      armor: 0,
      damage: 0,
      speed: 0,
    };

    Object.values(this.equipped).forEach((item) => {
      if (item) {
        stats.hp += item.stats.hp;
        stats.armor += item.stats.armor;
        stats.damage += item.stats.damage;
        stats.speed += item.stats.speed;
      }
    });

    return stats;
  }

  generateRandomItem() {
    const types = ["helmet", "armor", "gloves", "boots"];
    const type = types[Math.floor(Math.random() * types.length)];

    const rarityPool = [
      { rarity: "common", weight: 80 },
      { rarity: "rare", weight: 15 },
      { rarity: "epic", weight: 4 },
      { rarity: "legendary", weight: 1 },
    ];

    const total = rarityPool.reduce((sum, e) => sum + e.weight, 0);
    let rand = Math.random() * total;
    let rarity = "common";
    for (const entry of rarityPool) {
      rand -= entry.weight;
      if (rand <= 0) {
        rarity = entry.rarity;
        break;
      }
    }

    const variant = Math.floor(Math.random() * 3);
    return new Item(type, rarity, variant);
  }

  // HỆ THỐNG GHÉP ĐỒ MỚI
  canCombine(item1Id, item2Id, item3Id) {
    const item1 = this.items.find((i) => i.id === item1Id);
    const item2 = this.items.find((i) => i.id === item2Id);
    const item3 = this.items.find((i) => i.id === item3Id);

    if (!item1 || !item2 || !item3) return false;

    // Kiểm tra cùng loại và cùng độ hiếm
    return (
      item1.type === item2.type &&
      item2.type === item3.type &&
      item1.rarity === item2.rarity &&
      item2.rarity === item3.rarity &&
      item1.rarity !== "legendary"
    ); // Không thể ghép legendary
  }

  combineItems(item1Id, item2Id, item3Id) {
    if (!this.canCombine(item1Id, item2Id, item3Id)) return null;

    const item1 = this.items.find((i) => i.id === item1Id);

    // Xác định độ hiếm mới
    const rarityUpgrade = {
      common: "rare",
      rare: "epic",
      epic: "legendary",
    };

    const newRarity = rarityUpgrade[item1.rarity];

    // Xóa 3 item cũ
    this.removeItem(item1Id);
    this.removeItem(item2Id);
    this.removeItem(item3Id);

    // Tạo item mới
    const newItem = new Item(item1.type, newRarity);
    this.addItem(newItem);

    return newItem;
  }

  getItemsByTypeAndRarity(type, rarity) {
    return this.items.filter(
      (item) => item.type === type && item.rarity === rarity,
    );
  }

  getCombinableGroups() {
    const groups = [];
    const types = ["helmet", "armor", "gloves", "boots"];
    const rarities = ["common", "rare", "epic"];

    types.forEach((type) => {
      rarities.forEach((rarity) => {
        const items = this.getItemsByTypeAndRarity(type, rarity);
        if (items.length >= 3) {
          groups.push({
            type,
            rarity,
            count: items.length,
            items: items.slice(0, 3),
          });
        }
      });
    });

    return groups;
  }
}
