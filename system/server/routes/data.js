import express from 'express';
import fs from 'fs';
import path from 'path';
import { getCompanyDB, saveCompanyDB } from '../services/db.js';
import { IMAGES_DIR } from '../config/paths.js'; // Импортируем путь к картинкам

const router = express.Router();

// Middleware
const withCompany = (req, res, next) => {
    const companyId = req.headers['x-company-id'];
    if (!companyId) return res.status(400).json({ error: "No Company ID provided" });

    const db = getCompanyDB(companyId);
    if (!db) return res.status(404).json({ error: "Company DB not found" });

    req.companyId = companyId;
    req.db = db;
    next();
};

router.use(withCompany);

// GET DATA
router.get('/data', (req, res) => res.json(req.db));

// ORDERS
router.post('/orders', (req, res) => {
    const db = req.db;
    const maxOrderId = db.orders.reduce((max, o) => Math.max(max, o.orderId || 0), 0);
    const newOrder = { ...req.body, id: Date.now(), orderId: maxOrderId + 1 };
    db.orders.unshift(newOrder);
    saveCompanyDB(req.companyId, db);
    res.json(newOrder);
});

router.put('/orders/:id', (req, res) => {
    const db = req.db;
    const id = Number(req.params.id);
    const index = db.orders.findIndex(o => o.id === id);
    if (index !== -1) {
        db.orders[index] = { ...db.orders[index], ...req.body };
        saveCompanyDB(req.companyId, db);
        res.json(db.orders[index]);
    } else {
        res.status(404).json({ message: "Not found" });
    }
});

router.delete('/orders/:id', (req, res) => {
    const db = req.db;
    db.orders = db.orders.filter(o => o.id !== Number(req.params.id));
    saveCompanyDB(req.companyId, db);
    res.json({ success: true });
});

// CLIENTS
router.get('/clients', (req, res) => res.json(req.db.clients || []));
router.post('/clients', (req, res) => {
    const newClient = { ...req.body, id: Date.now() };
    req.db.clients.push(newClient);
    saveCompanyDB(req.companyId, req.db);
    res.json(newClient);
});
router.put('/clients/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = req.db.clients.findIndex(c => c.id === id);
    if (idx !== -1) {
        req.db.clients[idx] = { ...req.db.clients[idx], ...req.body };
        saveCompanyDB(req.companyId, req.db);
        res.json(req.db.clients[idx]);
    } else res.status(404).json({message: "Client not found"});
});

// MODELS
router.get('/models', (req, res) => res.json(req.db.models || []));

// SETTINGS
router.post('/settings', (req, res) => {
    req.db.settings = { ...req.db.settings, ...req.body };
    saveCompanyDB(req.companyId, req.db);
    res.json({ success: true });
});

// --- ЗАГРУЗКА ЛОГОТИПА ---
router.post('/upload-logo', (req, res) => {
    try {
        const { image, brandName } = req.body;
        if (!image) return res.status(400).json({ message: "No image provided" });

        // Убираем префикс base64
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Генерируем имя файла
        const fileName = `${brandName ? brandName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'brand'}_${Date.now()}.png`;
        const filePath = path.join(IMAGES_DIR, fileName);
        
        // Сохраняем физический файл
        fs.writeFileSync(filePath, buffer);
        
        // Обновляем ссылку в базе
        req.db.settings.brandLogo = fileName;
        saveCompanyDB(req.companyId, req.db);
        
        res.json({ success: true, fileName });
    } catch (e) {
        console.error("Upload error:", e);
        res.status(500).json({ message: "Ошибка загрузки файла" });
    }
});

export default router;