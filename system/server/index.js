import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PORT, IMAGES_DIR, DIST_DIR, DATA_DIR } from './config/paths.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import adminRoutes from './routes/admin.js'; // Не забудь импорт админки

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- ИСПРАВЛЕНИЕ ДЛЯ БЕЛОГО ЭКРАНА ---
// Раздаем статику и от корня, И по пути /system (чтобы работало и через Nginx, и напрямую)
app.use(express.static(DIST_DIR));
app.use('/system', express.static(DIST_DIR)); 
app.use('/images', express.static(IMAGES_DIR));
app.use('/system/images', express.static(IMAGES_DIR)); // И картинки тоже

// API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', dataRoutes);

// SPA Fallback (для React Router)
app.use((req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('PROBOOT SYSTEM IS RUNNING. Frontend not built yet.');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 SYSTEM RUNNING ON http://localhost:${PORT}`);
});