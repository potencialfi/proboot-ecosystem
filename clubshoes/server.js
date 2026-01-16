import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const DB_FILE = path.join(__dirname, 'database.json');
const DIST_DIR = path.join(__dirname, 'dist');
const IMAGES_DIR = path.join(__dirname, 'images');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(DIST_DIR));
app.use('/images', express.static(IMAGES_DIR));

const DEFAULT_DATA = {
  users: [{ id: 1, login: 'admin', password: '123', name: 'Администратор' }],
  clients: [],
  models: [],
  orders: [],
  settings: { 
    sizeGrids: [{ id: 1, name: 'Стандарт', min: '40', max: '45', isDefault: true }],
    defaultSizeGridId: 1,
    boxTemplates: { '1': { 6: {40:1, 41:1, 42:2, 43:1, 44:1} } }, 
    exchangeRates: { usd: 0, eur: 0, isManual: false },
    mainCurrency: 'USD',
    defaultPrintCopies: 1,
    brandName: 'SHOES',
    brandPhones: [],
    brandLogo: null 
  }
};

const readDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Database read error:", e);
    return null;
  }
};

const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const initDB = () => {
  let db = readDB();
  if (!db) { writeDB(DEFAULT_DATA); db = DEFAULT_DATA; }
  let changed = false;
  if (!db.settings) { db.settings = DEFAULT_DATA.settings; changed = true; }
  
  if (db.settings && db.settings.sizeGrid && !db.settings.sizeGrids) {
       db.settings.sizeGrids = [{ id: 1, name: 'Основная', min: db.settings.sizeGrid.min || '40', max: db.settings.sizeGrid.max || '45', isDefault: true }];
       db.settings.defaultSizeGridId = 1;
       delete db.settings.sizeGrid; 
       changed = true;
  }
  if (db.settings && !db.settings.boxTemplates) {
       db.settings.boxTemplates = DEFAULT_DATA.settings.boxTemplates;
       changed = true;
  }
  if (db.orders && db.orders.length > 0) {
      const missingIds = db.orders.some(o => !o.orderId);
      if (missingIds) {
          const sortedOrders = [...db.orders].sort((a, b) => a.id - b.id);
          sortedOrders.forEach((order, index) => { order.orderId = index + 1; });
          db.orders = sortedOrders.reverse();
          changed = true;
      }
  }
  if (db.models && db.models.length > 0) {
      const missingGrid = db.models.some(m => m.gridId === undefined);
      if (missingGrid) {
          db.models = db.models.map(m => ({ ...m, gridId: m.gridId !== undefined ? m.gridId : 1 }));
          changed = true;
      }
  }
  if (changed) writeDB(db);
};

initDB();

const normalizePhone = (phone) => String(phone).replace(/\D/g, '');
const isValidPhone = (phone) => {
  const clean = normalizePhone(phone);
  if (!clean) return false;
  if (clean.startsWith('0')) return clean.length === 10;
  if (clean.startsWith('38')) return clean.length === 12;
  return clean.length >= 6;
};
const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  let clean = digits;
  if (digits.length === 10 && digits.startsWith('0')) clean = '38' + digits;
  if (clean.length === 12 && clean.startsWith('380')) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10, 12)}`;
  }
  return value; 
};

// Хелпер для цвета (С большой буквы)
const capitalize = (str) => {
    if (!str) return '';
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
};

// --- API ROUTES ---

app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  const db = readDB() || DEFAULT_DATA;
console.log("ПОПЫТКА ВХОДА:");
  console.log("Введено:", login, "| В базе есть:", db.users.map(u => u.login));
  const user = (db.users || []).find(u => u.login === login && u.password === password);
  if (user) { res.json({ success: true, user: { name: user.name, login: user.login } }); } 
  else { res.status(401).json({ success: false, message: 'Неверный логин или пароль' }); }
});

app.get('/api/data', (req, res) => {
  const db = readDB();
  const safeSettings = { ...DEFAULT_DATA.settings, ...(db ? db.settings : {}) };
  const { users, settings, ...rest } = db || DEFAULT_DATA;
  res.json({ ...rest, settings: safeSettings });
});

app.post('/api/upload-logo', (req, res) => {
    try {
        const { image, brandName } = req.body;
        if (!image) return res.status(400).json({ message: "Нет изображения" });
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${brandName ? brandName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'brand'}_${Date.now()}.png`;
        const filePath = path.join(IMAGES_DIR, fileName);
        fs.writeFileSync(filePath, buffer);
        const db = readDB();
        if (db.settings.brandLogo) {
             const oldPath = path.join(IMAGES_DIR, db.settings.brandLogo);
             if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        db.settings.brandLogo = fileName;
        writeDB(db);
        res.json({ success: true, fileName });
    } catch (e) { res.status(500).json({ message: "Ошибка сохранения файла" }); }
});

app.get('/api/nbu-rates', async (req, res) => {
    try {
        const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
        const data = await response.json();
        const usd = data.find(c => c.cc === 'USD')?.rate || 0;
        const eur = data.find(c => c.cc === 'EUR')?.rate || 0;
        res.json({ usd, eur });
    } catch (e) { res.status(500).json({ error: "Failed to fetch rates" }); }
});

app.post('/api/settings', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const oldCurrency = (db.settings.mainCurrency || 'USD').trim().toUpperCase();
  const newCurrency = (req.body.mainCurrency || oldCurrency).trim().toUpperCase();
  const rates = req.body.exchangeRates || db.settings.exchangeRates || {};
  const usdRate = Number(rates.usd) || 0;
  const eurRate = Number(rates.eur) || 0;

  if (newCurrency !== oldCurrency) {
      const getRateToUAH = (code) => {
          if (code === 'UAH') return 1;
          if (code === 'USD') return usdRate;
          if (code === 'EUR') return eurRate;
          return 0;
      };
      const oldRate = getRateToUAH(oldCurrency);
      const newRate = getRateToUAH(newCurrency);
      if (oldRate > 0 && newRate > 0) {
          const ratio = oldRate / newRate;
          const recalc = (val) => Number((val * ratio).toFixed(2));
          if (db.models) db.models.forEach(m => { if (m.price) m.price = recalc(m.price); });
          if (db.orders) {
              db.orders.forEach(o => {
                  if (o.total) o.total = recalc(o.total);
                  if (o.lumpDiscount) o.lumpDiscount = recalc(o.lumpDiscount);
                  if (o.items) {
                      o.items.forEach(i => {
                          if (i.price) i.price = recalc(i.price);
                          if (i.total) i.total = recalc(i.total);
                          if (i.discountPerPair) i.discountPerPair = recalc(i.discountPerPair);
                      });
                  }
                  if (o.payment && o.payment.prepaymentInUSD !== undefined) {
                      o.payment.prepaymentInUSD = recalc(o.payment.prepaymentInUSD);
                  }
              });
          }
      }
  }
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// ================= CLIENTS =================

app.get('/api/clients', (req, res) => { const db = readDB() || DEFAULT_DATA; res.json(db.clients || []); });

// Удалить всех клиентов
app.delete('/api/clients', (req, res) => { 
    const db = readDB() || DEFAULT_DATA; 
    db.clients = []; 
    writeDB(db); 
    res.json({ success: true, message: 'Все клиенты удалены' }); 
});

app.post('/api/clients', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const { name, phone, city } = req.body;
  if (!name) return res.status(400).json({ message: "Имя обязательно" });
  
  const formattedPhone = formatPhoneNumber(phone);
  const rawPhone = normalizePhone(formattedPhone);

  if (rawPhone && rawPhone.length > 5) {
      const exists = db.clients.find(c => normalizePhone(c.phone) === rawPhone);
      if (exists) return res.status(400).json({ message: `Клиент с телефоном ${formattedPhone} уже существует: ${exists.name}` });
  }

  const newClient = { id: Date.now(), name, city: city || "", phone: formattedPhone, date: new Date().toISOString() };
  db.clients.push(newClient);
  writeDB(db);
  res.json(newClient);
});

app.put('/api/clients/:id', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const id = Number(req.params.id);
  const index = db.clients.findIndex(c => c.id === id);
  if (index !== -1) {
    let updatedData = { ...req.body };
    if (updatedData.phone) {
        const formattedPhone = formatPhoneNumber(updatedData.phone);
        const rawPhone = normalizePhone(formattedPhone);
        if (rawPhone && rawPhone.length > 5) {
            const exists = db.clients.find(c => c.id !== id && normalizePhone(c.phone) === rawPhone);
            if (exists) return res.status(400).json({ message: `Телефон ${formattedPhone} уже занят: ${exists.name}` });
        }
        updatedData.phone = formattedPhone;
    }
    db.clients[index] = { ...db.clients[index], ...updatedData };
    writeDB(db);
    res.json(db.clients[index]);
  } else { res.status(404).json({ message: "Клиент не найден" }); }
});

app.delete('/api/clients/:id', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  db.clients = db.clients.filter(c => c.id !== Number(req.params.id));
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/clients/import', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const importList = req.body;
  let added = 0; let skipped = 0;
  importList.forEach((c) => {
      const formattedPhone = formatPhoneNumber(c.phone);
      const rawPhone = normalizePhone(formattedPhone);
      let exists = false;
      if (rawPhone && rawPhone.length > 5) exists = db.clients.some(existing => normalizePhone(existing.phone) === rawPhone);
      if (!exists) {
          db.clients.push({ ...c, phone: formattedPhone, id: Date.now() + Math.random(), date: new Date().toISOString() });
          added++;
      } else skipped++;
  });
  writeDB(db);
  res.json({ added, skipped, message: `Импорт: Добавлено ${added}, Пропущено (дубли): ${skipped}` });
});

// ================= MODELS (ИСПРАВЛЕНО: SKU+COLOR) =================

app.get('/api/models', (req, res) => { const db = readDB() || DEFAULT_DATA; res.json(db.models || []); });

// 1. Удалить все модели
app.delete('/api/models', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  db.models = [];
  writeDB(db);
  res.json({ success: true, message: 'Все модели удалены' });
});

// 2. Создать (Дубликат по SKU+Color)
app.post('/api/models', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  let { sku, color } = req.body;
  if (!sku) return res.status(400).json({ message: "Артикул обязателен" });

  if (color) color = capitalize(color);

  // Проверка дублей (Артикул + Цвет)
  const exists = db.models.find(m => 
      m.sku.toLowerCase() === sku.toLowerCase() && 
      (m.color || '').toLowerCase() === (color || '').toLowerCase()
  );
  
  if (exists) return res.status(400).json({ message: `Модель "${sku} ${color}" уже существует` });

  const newModel = { ...req.body, sku, color, id: Date.now() };
  db.models.push(newModel);
  writeDB(db);
  res.json(newModel);
});

// 3. Обновить (Дубликат по SKU+Color)
app.put('/api/models/:id', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const id = Number(req.params.id);
  const index = db.models.findIndex(m => m.id === id);
  if (index !== -1) {
    let updatedData = { ...req.body };
    if (updatedData.color) updatedData.color = capitalize(updatedData.color);

    const checkSku = (updatedData.sku || db.models[index].sku).toLowerCase();
    const checkColor = (updatedData.color || db.models[index].color || '').toLowerCase();

    // Проверка дублей
    if (updatedData.sku || updatedData.color) {
         const exists = db.models.find(m => 
             m.id !== id && 
             m.sku.toLowerCase() === checkSku && 
             (m.color || '').toLowerCase() === checkColor
         );
         if (exists) return res.status(400).json({ message: `Модель "${checkSku} ${checkColor}" уже существует` });
    }

    db.models[index] = { ...db.models[index], ...updatedData };
    writeDB(db);
    res.json(db.models[index]);
  } else { res.status(404).json({ error: "Not found" }); }
});

app.delete('/api/models/:id', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  db.models = db.models.filter(m => m.id !== Number(req.params.id));
  writeDB(db);
  res.json({ success: true });
});

// 4. Импорт (Пропуск дублей SKU+Color)
app.post('/api/models/import', (req, res) => {
  const db = readDB() || DEFAULT_DATA;
  const importedData = req.body;
  let added = 0; 
  let skipped = 0;
  const errors = [];

  importedData.forEach((item, idx) => {
    const sku = item.sku || item.Артикул;
    let color = item.color || item.Цвет;
    const price = item.price !== undefined ? item.price : item.Цена;
    
    if (!sku || !color || price === undefined) { errors.push(`Строка ${idx + 2}: Нет полей`); return; }
    
    color = capitalize(color);

    // Пропуск дублей
    const exists = db.models.find(m => 
        m.sku.toLowerCase() === String(sku).toLowerCase() && 
        (m.color || '').toLowerCase() === String(color).toLowerCase()
    );
    
    if (exists) {
        skipped++;
        return;
    }

    db.models.push({ id: Date.now() + idx, sku, color, price: Number(price), gridId: 1 });
    added++;
  });
  
  writeDB(db);
  res.json({ added, skipped, errors, message: `Импорт: Добавлено ${added}, Пропущено (дубли): ${skipped}` });
});

// ORDERS
app.get('/api/orders', (req, res) => { const db = readDB() || DEFAULT_DATA; res.json(db.orders || []); });
app.post('/api/orders', (req, res) => { const db = readDB() || DEFAULT_DATA; const maxOrderId = db.orders.reduce((max, o) => Math.max(max, o.orderId || 0), 0); const nextId = maxOrderId + 1; const newOrder = { ...req.body, id: Date.now(), orderId: nextId }; db.orders.unshift(newOrder); writeDB(db); res.json(newOrder); });
app.put('/api/orders/:id', (req, res) => { const db = readDB() || DEFAULT_DATA; const id = Number(req.params.id); const index = db.orders.findIndex(o => o.id === id); if (index !== -1) { const existing = db.orders[index]; db.orders[index] = { ...req.body, id: id, orderId: existing.orderId }; writeDB(db); res.json(db.orders[index]); } else { res.status(404).json({ message: "Заказ не найден" }); } });
app.delete('/api/orders/:id', (req, res) => { const db = readDB() || DEFAULT_DATA; const id = Number(req.params.id); db.orders = db.orders.filter(o => o.id !== id); writeDB(db); res.json({ success: true }); });

app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send('API Server is running! Frontend is not built yet.');
});

app.listen(PORT, (err) => {
  if (err) console.error("Error starting server:", err);
  console.log(`SERVER RUNNING ON http://localhost:${PORT}`);
});