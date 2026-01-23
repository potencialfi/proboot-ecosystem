import express from 'express';
import { getMasterDB, getCompanyDB } from '../services/db.js';

const router = express.Router();

router.post('/login', (req, res) => {
    const { login, password } = req.body;
    
    console.log(`[LOGIN ATTEMPT] User: "${login}" | Pass: "${password}"`); // Лог в консоль

    if (!login || !password) {
        return res.status(400).json({ message: "Введите логин и пароль" });
    }

    const master = getMasterDB();
    
    // --- ПРОВЕРКА НА ROOT (СУПЕР-АДМИНА) ---
    // Проверяем хардкодом + из файла для надежности
    if (login === 'root') {
        const rootPass = master.admin?.password || '123';
        
        console.log(`[ROOT CHECK] Expected: "${rootPass}"`); // Лог

        if (password === rootPass) {
        console.log('[LOGIN SUCCESS] Welcome Root');
        return res.json({ 
            success: true,           // <--- ВОТ ЭТА СТРОКА САМАЯ ВАЖНАЯ!
            role: 'superadmin', 
            token: 'SUPER_ADMIN_TOKEN', 
            name: 'System Admin' 
        });
    } else {
            console.log('[LOGIN FAILED] Wrong root password');
            return res.status(401).json({ message: "Неверный пароль администратора" });
        }
    }

    // --- ПРОВЕРКА ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ ---
    const companyId = master.usersDirectory[login];

    if (!companyId) {
        console.log('[LOGIN FAILED] User not found in directory');
        return res.status(401).json({ message: "Пользователь не найден" });
    }

    const db = getCompanyDB(companyId);
    if (!db) return res.status(404).json({ message: "База компании не найдена" });

    const user = (db.users || []).find(u => u.login === login && u.password === password);

    if (user) {
        console.log(`[LOGIN SUCCESS] User "${login}" for company "${companyId}"`);
        const companyInfo = master.companies.find(c => c.id === companyId);
        
        res.json({ 
            success: true,
            role: 'user', 
            companyId: companyId,
            companyName: companyInfo ? companyInfo.name : companyId,
            user: { name: user.name, login: user.login } 
        });
    } else {
        console.log('[LOGIN FAILED] Wrong user password');
        res.status(401).json({ message: "Неверный пароль" });
    }
});

export default router;