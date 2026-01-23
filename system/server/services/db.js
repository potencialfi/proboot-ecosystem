import fs from 'fs';
import path from 'path';
import { DATA_DIR, MASTER_FILE } from '../config/paths.js';

// Кэш, чтобы не читать диск при каждом клике
const cache = { master: null, companies: {} };

// Чтение главного реестра (master.json)
export const getMasterDB = () => {
    if (cache.master) return cache.master;
    try {
        if (!fs.existsSync(MASTER_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
        cache.master = data;
        return data;
    } catch (e) {
        console.error("Error reading Master DB:", e);
        return null;
    }
};

// Чтение базы конкретной компании (bumer.json, clubshoes.json...)
export const getCompanyDB = (companyId) => {
    if (cache.companies[companyId]) return cache.companies[companyId];
    try {
        const dbPath = path.join(DATA_DIR, `${companyId}.json`);
        if (!fs.existsSync(dbPath)) return null;
        
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        cache.companies[companyId] = data; // Сохраняем в память
        return data;
    } catch (e) {
        console.error(`Error reading DB ${companyId}:`, e);
        return null;
    }
};

// Сохранение базы компании
export const saveCompanyDB = (companyId, data) => {
    cache.companies[companyId] = data; // Обновляем кэш мгновенно
    
    // Пишем на диск асинхронно (фоном)
    const dbPath = path.join(DATA_DIR, `${companyId}.json`);
    fs.writeFile(dbPath, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error(`Error saving DB ${companyId}:`, err);
    });
};

// Сохранение реестра
export const saveMasterDB = (data) => {
    cache.master = data;
    fs.writeFile(MASTER_FILE, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error("Error saving Master DB:", err);
    });
};