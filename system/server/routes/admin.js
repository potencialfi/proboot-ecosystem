import express from 'express';
import { getMasterDB, saveMasterDB, saveCompanyDB, getCompanyDB } from '../services/db.js';

const router = express.Router();

// --- MIDDLEWARE: ТОЛЬКО СУПЕР-АДМИН ---
const onlySuperAdmin = (req, res, next) => {
    // В продакшене здесь должна быть проверка JWT токена
    // Пока проверяем заголовок, который присылает фронтенд
    if (req.headers['x-role'] !== 'superadmin') {
        return res.status(403).json({ message: "Access denied: Super Admin only" });
    }
    next();
};

router.use(onlySuperAdmin);

// ==========================================
// 1. УПРАВЛЕНИЕ КОМПАНИЯМИ
// ==========================================

// Получить список всех компаний
router.get('/companies', (req, res) => {
    const master = getMasterDB();
    res.json(master.companies || []);
});

// Создать новую компанию
router.post('/companies', (req, res) => {
    const { id, name, ownerLogin, ownerPassword } = req.body;
    const master = getMasterDB();

    // Валидация
    if (!id || !name) {
        return res.status(400).json({ message: "Ошибка данных: нет ID или Названия" });
    }

    // Проверка уникальности ID компании
    if (master.companies.find(c => c.id === id)) {
        return res.status(400).json({ message: "Компания с таким ID уже существует" });
    }

    // Проверка уникальности логина Владельца (глобально)
    const firstUserLogin = ownerLogin || 'admin';
    if (master.usersDirectory[firstUserLogin]) {
        return res.status(400).json({ message: `Логин '${firstUserLogin}' уже занят в системе` });
    }

    // 1. Добавляем компанию в Master DB
    master.companies.push({ 
        id, 
        name, 
        isActive: true, 
        created: new Date().toISOString() 
    });

    // 2. Регистрируем владельца в глобальной директории
    master.usersDirectory[firstUserLogin] = id;
    saveMasterDB(master);

    // 3. Создаем файл базы данных компании (.json)
    const newDB = {
        users: [{ 
            id: 1, 
            login: firstUserLogin, 
            password: ownerPassword || '123', 
            name: 'Администратор', 
            role: 'admin',
            permissions: ['all'] // Полный доступ
        }],
        clients: [],
        models: [],
        orders: [],
        notifications: [],
        settings: { 
            mainCurrency: 'USD', 
            defaultPrintCopies: 1, 
            brandName: name, 
            exchangeRates: { usd: 1, eur: 1 }
        }
    };
    
    // Сохраняем физический файл
    saveCompanyDB(id, newDB);

    res.json({ success: true, company: master.companies[master.companies.length - 1] });
});

// Блокировка / Разблокировка компании
router.put('/companies/:id/toggle', (req, res) => {
    const master = getMasterDB();
    const company = master.companies.find(c => c.id === req.params.id);
    
    if (company) {
        company.isActive = !company.isActive;
        saveMasterDB(master);
        res.json({ success: true, isActive: company.isActive });
    } else {
        res.status(404).json({ message: "Компания не найдена" });
    }
});

// ==========================================
// 2. УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ КОМПАНИИ
// ==========================================

// Получить список сотрудников конкретной компании
router.get('/companies/:id/users', (req, res) => {
    const db = getCompanyDB(req.params.id);
    if (!db) return res.status(404).json({ message: "База данных компании не найдена" });
    res.json(db.users || []);
});

// Добавить нового сотрудника
router.post('/companies/:id/users', (req, res) => {
    const companyId = req.params.id;
    const { login, password, name, role, permissions } = req.body;
    
    const master = getMasterDB();
    
    // Проверка уникальности логина во всей системе
    if (master.usersDirectory[login]) {
        return res.status(400).json({ message: "Этот логин уже занят другим пользователем" });
    }

    const db = getCompanyDB(companyId);
    if (!db) return res.status(404).json({ message: "База не найдена" });

    const newUser = {
        id: Date.now(),
        login,
        password,
        name: name || 'Сотрудник',
        role: role || 'manager',
        permissions: permissions || [] // Массив прав доступа
    };

    // Сохраняем в базе компании
    db.users.push(newUser);
    saveCompanyDB(companyId, db);

    // Сохраняем в глобальной директории
    master.usersDirectory[login] = companyId;
    saveMasterDB(master);

    res.json(newUser);
});

// Редактировать сотрудника (Смена пароля, прав, имени)
router.put('/companies/:companyId/users/:userId', (req, res) => {
    const { companyId, userId } = req.params;
    const { password, name, role, permissions } = req.body;
    
    const db = getCompanyDB(companyId);
    if (!db) return res.status(404).json({ message: "База не найдена" });

    const userIndex = db.users.findIndex(u => u.id == userId);
    if (userIndex === -1) return res.status(404).json({ message: "Пользователь не найден" });

    // Обновляем данные
    db.users[userIndex].name = name;
    db.users[userIndex].role = role;
    db.users[userIndex].permissions = permissions;

    // Если прислали пароль, меняем его. Если пустая строка — оставляем старый.
    if (password && password.trim() !== "") {
        db.users[userIndex].password = password;
    }

    saveCompanyDB(companyId, db);
    res.json(db.users[userIndex]);
});

// Удалить сотрудника
router.delete('/companies/:companyId/users/:userId', (req, res) => {
    const { companyId, userId } = req.params;
    
    const db = getCompanyDB(companyId);
    const master = getMasterDB();

    const userIndex = db.users.findIndex(u => u.id == userId);
    if (userIndex === -1) return res.status(404).json({ message: "Пользователь не найден" });

    const loginToDelete = db.users[userIndex].login;

    // Удаляем из базы компании
    db.users.splice(userIndex, 1);
    saveCompanyDB(companyId, db);

    // Удаляем из глобальной директории (освобождаем логин)
    if (master.usersDirectory[loginToDelete]) {
        delete master.usersDirectory[loginToDelete];
        saveMasterDB(master);
    }

    res.json({ success: true });
});

// ==========================================
// 3. ГЛОБАЛЬНЫЕ УВЕДОМЛЕНИЯ
// ==========================================

router.post('/notify', (req, res) => {
    const { message, targetCompanyId } = req.body;
    const master = getMasterDB();
    
    let targets = [];

    // Если указан ID компании — шлем только ей, иначе — всем
    if (targetCompanyId) {
        targets = [targetCompanyId];
    } else {
        targets = master.companies.map(c => c.id);
    }

    targets.forEach(cid => {
        const db = getCompanyDB(cid);
        if (db) {
            if (!db.notifications) db.notifications = [];
            db.notifications.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                message,
                read: false
            });
            saveCompanyDB(cid, db);
        }
    });

    res.json({ success: true, count: targets.length });
});

export default router;