/* storage.js — localStorage 读写封装 */

var SW = window.SW || {};

SW.Store = (function () {
  /* 生成唯一 ID */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* 读取并 parse */
  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /* 序列化并写入 */
  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      alert('存储空间不足，请清理旧数据。');
    }
  }

  /* 获取全部 */
  function getAll(key) {
    return load(key);
  }

  /* 按 id 获取一条 */
  function getById(key, id) {
    var list = load(key);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* 新增一条，自动生成 id */
  function create(key, item) {
    var list = load(key);
    item.id = generateId();
    item.createdAt = item.createdAt || new Date().toISOString();
    list.push(item);
    save(key, list);
    return item;
  }

  /* 按 id 更新 */
  function update(key, id, updates) {
    var list = load(key);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in updates) {
          if (updates.hasOwnProperty(k)) list[i][k] = updates[k];
        }
        save(key, list);
        return list[i];
      }
    }
    return null;
  }

  /* 按 id 删除 */
  function remove(key, id) {
    var list = load(key);
    var filtered = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) filtered.push(list[i]);
    }
    if (filtered.length < list.length) {
      save(key, filtered);
      return true;
    }
    return false;
  }

  return {
    generateId: generateId,
    load: load,
    save: save,
    getAll: getAll,
    getById: getById,
    create: create,
    update: update,
    delete: remove
  };
})();
