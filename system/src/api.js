// src/api.js

// 1. Определяем адреса сервера
// Если мы на локальном компьютере (localhost), стучимся на порт 3005
// Если на боевом сервере — используем относительный путь через Nginx
export const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3005/api' 
    : '/system/api';

export const IMG_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3005/images' 
    : '/system/images';

// 2. Функция для получения заголовков (кто мы и какая компания)
export const getAuthHeaders = () => {
    const userStr = localStorage.getItem('proboot_user');
    // Если не залогинены, возвращаем просто тип контента
    if (!userStr) return { 'Content-Type': 'application/json' };
    
    const user = JSON.parse(userStr);
    return {
        'Content-Type': 'application/json',
        'X-Company-ID': user.companyId || '', // Важно: ID компании для сервера
        'X-Role': user.role || 'user'         // Важно: Роль для админки
    };
};

// 3. Главная функция для запросов к серверу
export const apiCall = async (endpoint, method = 'GET', body = null) => {
    const headers = getAuthHeaders();
    
    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        
        // Если сервер ответил 401 (не авторизован) — выкидываем на логин
        if (response.status === 401) {
            localStorage.removeItem('proboot_user');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
            throw new Error('Unauthorized');
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error');
        
        return data;
    } catch (e) {
        console.error("API Error:", e);
        throw e;
    }
};

// 4. Специальная функция для загрузки логотипа (используется в SettingsPage)
export const uploadBrandLogo = async (image, brandName) => {
    return apiCall('/upload-logo', 'POST', { image, brandName });
};