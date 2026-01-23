import { useState, useEffect, useMemo } from 'react';
import { apiCall } from '../api';

export const useOrderForm = (orderDraft, setOrderDraft, settings, isEditing, onSaveSuccess) => {
    // Начальное состояние
    const defaultDraft = { 
        cart: [], 
        clientPhone: '', clientName: '', clientCity: '', clientNote: '', selectedClient: null, 
        prepayment: '', paymentCurrency: 'USD', lumpDiscount: '' 
    };

    // Локальный стейт, если черновик не передан извне
    const [localDraft, setLocalDraft] = useState(() => {
        const saved = localStorage.getItem('orderDraft');
        return saved ? JSON.parse(saved) : defaultDraft;
    });

    const draft = orderDraft?.id ? orderDraft : localDraft;
    const setDraft = orderDraft?.id ? setOrderDraft : setLocalDraft;
    
    // Данные
    const [clients, setClients] = useState([]);
    const [models, setModels] = useState([]);
    const [nextOrderId, setNextOrderId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Сохранение черновика
    useEffect(() => {
        if (!draft.id) localStorage.setItem('orderDraft', JSON.stringify(draft));
    }, [draft]);

    // Загрузка данных при старте
    useEffect(() => {
        const loadData = async () => {
            try {
                const [c, m, o] = await Promise.all([
                    apiCall('/clients'),
                    apiCall('/data').then(d => d.models || []), // Или отдельный роут /models
                    apiCall('/data').then(d => d.orders || [])
                ]);
                setClients(c || []);
                setModels(m || []);
                
                // Вычисление следующего ID
                if (o.length > 0) {
                    const maxId = o.reduce((max, order) => Math.max(max, parseInt(order.orderId || order.id) || 0), 0);
                    setNextOrderId(maxId + 1);
                } else {
                    setNextOrderId(1);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // --- ЛОГИКА КОРЗИНЫ ---
    const addToCart = (model, sizes, boxCounts, boxTemplates) => {
        const cleanSizes = {}; 
        let qty = 0;
        
        // 1. Собираем размеры из инпутов
        Object.entries(sizes).forEach(([s, q]) => { 
            const val = parseInt(q, 10); 
            if (val > 0) { cleanSizes[s] = val; qty += val; }
        });

        // 2. Собираем размеры из коробов
        if (boxTemplates) {
            Object.entries(boxCounts).forEach(([pairsInBox, count]) => {
                if (count > 0 && boxTemplates[pairsInBox]) {
                    const template = boxTemplates[pairsInBox];
                    Object.entries(template).forEach(([size, amount]) => {
                        cleanSizes[size] = (cleanSizes[size] || 0) + (amount * count);
                        qty += (amount * count);
                    });
                }
            });
        }

        if (qty === 0) throw new Error('Выберите количество пар');

        const newItem = {
            ...model,
            modelId: model.id,
            id: Date.now(),
            qty,
            sizes: cleanSizes,
            note: Object.entries(cleanSizes).map(([s, q]) => `${s}(${q})`).join(', '),
            discountPerPair: 0,
            price: model.price,
            total: model.price * qty
        };

        setDraft(prev => ({ ...prev, cart: [...prev.cart, newItem] }));
    };

    const removeFromCart = (index) => {
        const newCart = [...draft.cart];
        newCart.splice(index, 1);
        setDraft(prev => ({ ...prev, cart: newCart }));
    };

    const updateCartItem = (index, updatedItem) => {
        const newCart = [...draft.cart];
        newCart[index] = updatedItem;
        setDraft(prev => ({ ...prev, cart: newCart }));
    };

    // --- РАСЧЕТЫ ---
    const totals = useMemo(() => {
        const subTotal = draft.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const discount = draft.cart.reduce((sum, item) => sum + ((item.discountPerPair || 0) * item.qty), 0) + (parseFloat(draft.lumpDiscount) || 0);
        const total = Math.max(0, subTotal - discount);
        const qty = draft.cart.reduce((sum, item) => sum + item.qty, 0);
        
        return { subTotal, discount, total, qty };
    }, [draft.cart, draft.lumpDiscount]);

    // --- СОХРАНЕНИЕ ---
    const saveOrder = async () => {
        if (!draft.clientName) throw new Error('Введите имя клиента');
        if (draft.cart.length === 0) throw new Error('Корзина пуста');

        let clientId = draft.selectedClient?.id;

        // 1. Создаем/Обновляем клиента
        const clientData = { 
            name: draft.clientName, 
            phone: draft.clientPhone, 
            city: draft.clientCity 
        };

        if (clientId) {
            // Если данные изменились, обновляем
            await apiCall(`/clients/${clientId}`, 'PUT', clientData); // Нужно добавить PUT на сервере, либо просто игнорировать
        } else {
            const newClient = await apiCall('/clients', 'POST', clientData);
            clientId = newClient.id;
        }

        // 2. Создаем заказ
        const orderData = {
            ...draft,
            clientId,
            items: draft.cart,
            total: totals.total,
            lumpDiscount: parseFloat(draft.lumpDiscount) || 0,
            date: isEditing ? draft.date : new Date().toISOString(),
            orderId: draft.orderId || nextOrderId
        };

        if (isEditing) {
            await apiCall(`/orders/${draft.id}`, 'PUT', orderData);
        } else {
            await apiCall('/orders', 'POST', orderData);
        }

        if (onSaveSuccess) onSaveSuccess();
        localStorage.removeItem('orderDraft');
        return true;
    };

    return {
        draft,
        setDraft,
        clients,
        models,
        loading,
        nextOrderId,
        addToCart,
        removeFromCart,
        updateCartItem,
        totals,
        saveOrder
    };
};