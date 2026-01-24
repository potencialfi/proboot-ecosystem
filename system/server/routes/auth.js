import express from 'express';
import { getMasterDB, getCompanyDB } from '../services/db.js';

const router = express.Router();

router.post('/login', (req, res) => {
    const { login, password } = req.body;
    
    console.log(`[LOGIN ATTEMPT] User: "${login}"`);

    if (!login || !password) {
        return res.status(400).json({ message: "Введите логин и пароль" });
    }

    // 1. Получаем мастер-базу
    const master = getMasterDB();
    if (!master) {
        return res.status(500).json({ message: "Ошибка сервера: Master DB не найдена" });
    }

    // 2. Ищем пользователя в массиве usersDirectory
    // В новой структуре usersDirectory — это МАССИВ объектов
    const userRecord = (master.usersDirectory || []).find(u => u.login === login);

    if (!userRecord) {
        console.log('[LOGIN FAILED] User not found');
        return res.status(401).json({ message: "Пользователь не найден" });
    }

    // 3. Проверяем пароль
    // В новой структуре пароль хранится прямо в объекте пользователя
    if (userRecord.password !== password) {
        console.log('[LOGIN FAILED] Wrong password');
        return res.status(401).json({ message: "Неверный пароль" });
    }

    // 4. Сценарий для СУПЕР-АДМИНА
    if (userRecord.role === 'superadmin') {
        console.log('[LOGIN SUCCESS] Superadmin logged in');
        return res.json({ 
            success: true,
            role: 'superadmin', 
            token: 'SUPER_ADMIN_TOKEN', 
            name: 'Root Admin' 
        });
    }

    // 5. Сценарий для ОБЫЧНОГО АДМИНА КОМПАНИИ
    const companyId = userRecord.companyId;
    if (!companyId) {
        return res.status(400).json({ message: "Пользователь не привязан к компании" });
    }

    // Находим название компании для красоты
    const companyInfo = (master.companies || []).find(c => c.id === companyId);

    console.log(`[LOGIN SUCCESS] User "${login}" -> Company "${companyId}"`);

    res.json({ 
        success: true,
        role: userRecord.role || 'user', 
        companyId: companyId,
        companyName: companyInfo ? companyInfo.name : companyId,
        user: { name: login, login: login } 
    });
});

export default router;