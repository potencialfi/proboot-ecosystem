import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Search, Eraser, Trash2, Edit } from 'lucide-react';
import { ensureXLSX } from '../utils';
import { Button } from '../components/UI';
import { apiCall } from '../api';

// --- ПОРТАЛ И МОДАЛЬНОЕ ОКНО ---
const ModalPortal = ({ children }) => createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">{children}</div>,
    document.body
);

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => !isOpen ? null : (
    <ModalPortal>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up ring-1 ring-gray-200 p-6 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28}/></div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">Отмена</button>
            <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200">Да, выполнить</button>
        </div>
      </div>
    </ModalPortal>
);

const ReportsPage = ({ orders = [], clients = [], settings, onEditOrder, onReload }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [draftValues, setDraftValues] = useState({});
    
    const [confirmModal, setConfirmModal] = useState({ 
        isOpen: false, 
        type: null, 
        payload: null, 
        title: '', 
        message: '' 
    });

    // --- 1. АНАЛИЗ ДАННЫХ ---
    const { clientsData, uniqueModels, grandTotalPairs, totalOrdersCount } = useMemo(() => {
        const clientMap = {};
        const modelsMap = {}; 

        (orders || []).forEach(order => {
            if (!order) return;

            let groupingId = order.clientId;
            const cleanPhone = order.clientPhone ? String(order.clientPhone).replace(/\D/g, '') : '';
            if (!groupingId && cleanPhone) groupingId = cleanPhone;
            if (!groupingId) groupingId = `unknown-${order.id}`;

            const dbClient = (clients || []).find(c => c.id === order.clientId) || {};
            const name = dbClient.name || order.clientName || 'Неизвестный';
            const phone = dbClient.phone || order.clientPhone || '';
            const city = dbClient.city || order.clientCity || '';
            const note = order.note || '';

            if (!clientMap[groupingId]) {
                clientMap[groupingId] = {
                    id: groupingId,
                    orderIds: [], // Массив ID заказов этого клиента
                    name, phone, city, note,
                    totalQty: 0,
                    totalDiscount: 0,
                    prepayment: 0,
                    totalSum: 0,
                    currency: settings?.mainCurrency || 'USD',
                    items: {}
                };
            }

            const client = clientMap[groupingId];
            client.orderIds.push(order.id);
            if (client.name === 'Неизвестный' && name !== 'Неизвестный') client.name = name;
            
            // Финансы
            const rawLump = String(order.lumpDiscount || 0).replace(/[^\d.-]/g, '');
            const lumpVal = Math.abs(parseFloat(rawLump) || 0);

            let itemsDiscount = 0;
            (order.items || []).forEach(item => {
                const q = Number(item.qty) || 0;
                const discRaw = String(item.discountPerPair || 0).replace(/[^\d.-]/g, '');
                itemsDiscount += (Math.abs(parseFloat(discRaw) || 0) * q);
            });

            client.totalDiscount += (lumpVal + itemsDiscount);
            
            let prep = 0;
            if (order.payment) {
                if (order.payment.prepaymentInUSD) prep = Number(order.payment.prepaymentInUSD) || 0;
                else if (order.payment.originalCurrency === settings?.mainCurrency) prep = parseFloat(order.payment.originalAmount || 0);
            }
            client.prepayment += prep;
            client.totalSum += parseFloat(order.total || 0);

            // Товары
            (order.items || []).forEach(item => {
                if (!item) return;
                const itemQty = parseInt(item.qty || 0);
                client.totalQty += itemQty;

                const sku = item.sku || 'NoSKU';
                const color = item.color || '';
                const modelKey = `${sku}::${color}`;
                
                if (!modelsMap[modelKey]) {
                    modelsMap[modelKey] = { 
                        key: modelKey,
                        sku: sku, 
                        color: color, 
                        sizes: new Set(),
                        totalQty: 0, 
                        sizeTotals: {} 
                    };
                }
                
                modelsMap[modelKey].totalQty += itemQty;
                if (!client.items[modelKey]) client.items[modelKey] = {};
                
                Object.entries(item.sizes || {}).forEach(([size, qty]) => {
                    const q = parseInt(qty);
                    if (q > 0) {
                        modelsMap[modelKey].sizes.add(size);
                        if (!modelsMap[modelKey].sizeTotals[size]) modelsMap[modelKey].sizeTotals[size] = 0;
                        modelsMap[modelKey].sizeTotals[size] += q;
                        client.items[modelKey][size] = (client.items[modelKey][size] || 0) + q;
                    }
                });
            });
        });

        const sortedModels = Object.values(modelsMap).sort((a, b) => a.sku.localeCompare(b.sku)).map(m => ({
            ...m,
            sortedSizes: Array.from(m.sizes).sort((a, b) => Number(a) - Number(b))
        }));

        const filteredClients = Object.values(clientMap).filter(c => 
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (c.phone || '').includes(searchTerm) || 
            (c.city || '').toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => b.totalQty - a.totalQty);

        // --- ИСПРАВЛЕНИЕ ПОДСЧЕТА ---
        // Считаем общее кол-во заказов и пар на основе отфильтрованных клиентов
        const totalOrdersCount = filteredClients.reduce((sum, client) => sum + client.orderIds.length, 0);
        const grandTotalPairs = filteredClients.reduce((sum, client) => sum + client.totalQty, 0);

        return { clientsData: filteredClients, uniqueModels: sortedModels, grandTotalPairs, totalOrdersCount };
    }, [orders, clients, searchTerm, settings]);

    // --- ЛОГИКА ЧЕРНОВИКА ---
    const handleDraftChange = (modelKey, size, val) => {
        const cleanVal = val.replace(/\D/g, '');
        setDraftValues(prev => ({ ...prev, [`${modelKey}-${size}`]: cleanVal }));
    };

    const getDraftTotal = (modelKey) => {
        let sum = 0;
        Object.entries(draftValues).forEach(([k, v]) => {
            if (k.startsWith(`${modelKey}-`) && v) sum += parseInt(v);
        });
        return sum;
    };
    
    const totalDraftSum = Object.values(draftValues).reduce((acc, v) => acc + (parseInt(v) || 0), 0);

    const requestClearDrafts = () => {
        if (Object.keys(draftValues).length === 0) return;
        setConfirmModal({
            isOpen: true,
            type: 'clear_draft',
            title: 'Очистить черновик?',
            message: 'Это удалит все введенные данные из черновика. Продолжить?'
        });
    };

    const requestDeleteRow = (client) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete_row',
            payload: client,
            title: 'Удалить заказ?',
            message: `Вы действительно хотите удалить все заказы клиента ${client.name}?`
        });
    };

    const handleConfirmAction = async () => {
        if (confirmModal.type === 'clear_draft') {
            setDraftValues({});
        } else if (confirmModal.type === 'delete_row') {
            const client = confirmModal.payload;
            try {
                await Promise.all(client.orderIds.map(id => apiCall(`/orders/${id}`, 'DELETE')));
                if (onReload) onReload();
            } catch (e) {
                alert('Ошибка: ' + e.message);
            }
        }
        setConfirmModal({ isOpen: false, type: null, payload: null, title: '', message: '' });
    };

    const handleEditRow = (client) => {
        const lastOrderId = client.orderIds[client.orderIds.length - 1];
        const orderToEdit = orders.find(o => o.id === lastOrderId);
        if (orderToEdit && onEditOrder) onEditOrder(orderToEdit);
    };

    const handleDownloadRow = async (client) => {
        try {
            const XLSX = await ensureXLSX();
            const wb = XLSX.utils.book_new();
            const rows = [["Клиент", client.name], ["Телефон", client.phone], [], ["Модель", "Размер", "Кол-во"]];
            Object.keys(client.items).forEach(k => {
                const [s, c] = k.split('::');
                Object.entries(client.items[k]).forEach(([sz, q]) => rows.push([`${s} ${c}`, sz, q]));
            });
            rows.push(
                [], 
                ["Итого пар:", client.totalQty], 
                ["Скидка:", client.totalDiscount], 
                ["Предоплата:", Number(client.prepayment.toFixed(2))], 
                ["Сумма:", client.totalSum]
            );
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, "Заказ");
            XLSX.writeFile(wb, `${client.name}_заказ.xlsx`);
        } catch(e) { console.error(e); }
    };

    const handleExport = async () => {
        try {
            const XLSX = await ensureXLSX();
            const headerRow1 = ["ФИО", "Телефон", "Город", "Примечание", "Кол-во", "Скидка", "Предоплата", "Сумма"];
            const headerRow2 = ["", "", "", "", "", "", "", ""];
            uniqueModels.forEach(model => {
                headerRow1.push(`${model.sku} ${model.color}`);
                for (let i = 1; i < model.sortedSizes.length; i++) headerRow1.push("");
                model.sortedSizes.forEach(size => headerRow2.push(size));
            });
            const bodyRows = clientsData.map(c => {
                const row = [
                    c.name, 
                    c.phone, 
                    c.city, 
                    c.note, 
                    c.totalQty, 
                    c.totalDiscount, 
                    Number(c.prepayment.toFixed(2)), 
                    c.totalSum
                ];
                uniqueModels.forEach(model => {
                    model.sortedSizes.forEach(size => row.push(c.items[model.key]?.[size] || ""));
                });
                return row;
            });
            const ws = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...bodyRows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Отчет");
            XLSX.writeFile(wb, `Report.xlsx`);
        } catch (e) { alert("Ошибка: " + e.message); }
    };

    return (
        <div className="page-container relative h-full flex flex-col p-6 bg-slate-50 overflow-hidden">
            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                onClose={() => setConfirmModal({...confirmModal, isOpen: false})} 
                onConfirm={handleConfirmAction} 
                title={confirmModal.title} 
                message={confirmModal.message} 
            />

            <div className="page-header-card shrink-0 mb-0">
                <div className="page-header-group">
                    <h1 className="text-h1">Отчет</h1>
                    {/* ТЕПЕРЬ ОТОБРАЖАЕТ РЕАЛЬНОЕ КОЛ-ВО ЗАКАЗОВ */}
                    <p className="text-subtitle">Всего заказов: {totalOrdersCount}</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleExport} variant="secondary" icon={Download}>Экспорт</Button>
                </div>
            </div>

            <div className="w-full shrink-0 mb-4 mt-4">
                <div className="relative w-full">
                    <Search className="input-icon" />
                    <input className="input-with-icon w-full" placeholder="Поиск по клиентам..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </div>

            <div className="table-card flex-1 relative overflow-hidden">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-[60] shadow-md">
                            {/* --- ROW 1: Models --- */}
                            <tr className="h-12 bg-slate-100">
                                <th className="sticky top-0 left-0 z-[70] bg-slate-100 border-b border-r border-gray-300 min-w-[100px] w-[100px]"></th>
                                <th className="sticky top-0 left-[100px] z-[70] bg-slate-100 border-b border-r border-gray-300 min-w-[200px] w-[200px]"></th>
                                <th className="sticky top-0 bg-slate-100 border-b border-gray-300" colSpan={7}></th>
                                {uniqueModels.map((model) => (
                                    <th key={model.key} colSpan={model.sortedSizes.length} className="sticky top-0 p-1 border-b border-r border-gray-300 text-center bg-blue-50 text-blue-900 border-l-2 border-l-gray-300">
                                        <div className="flex flex-col items-center justify-center h-full">
                                            <span className="text-lg font-black">{model.sku} <span className="font-normal text-xs text-blue-600 ml-1">{model.color}</span></span>
                                            <span className="text-[10px] text-blue-500 font-bold">Всего: {model.totalQty}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>

                            {/* --- ROW 2: Draft --- */}
                            <tr className="h-10 bg-yellow-50">
                                <th className="sticky top-12 left-0 z-[70] bg-yellow-100 border-b border-r border-yellow-200"></th>
                                <th className="sticky top-12 left-[100px] z-[70] bg-yellow-100 border-b border-r border-gray-200 text-right px-3 font-bold text-yellow-800 uppercase text-xs">
                                    <div className="flex items-center justify-end gap-3 h-full w-full">
                                        <span>Черновик</span>
                                        {totalDraftSum > 0 && (
                                            <>
                                                <div className="bg-white/60 px-1.5 py-0.5 rounded border border-yellow-300/50">
                                                    <span className="text-yellow-900 font-black">{totalDraftSum}</span>
                                                </div>
                                                <button onClick={requestClearDrafts} className="bg-white hover:bg-red-50 p-1 rounded border border-yellow-300 hover:border-red-200 text-yellow-600 hover:text-red-500 transition-colors shadow-sm"><Eraser size={14}/></button>
                                            </>
                                        )}
                                    </div>
                                </th>
                                <th className="sticky top-12 bg-yellow-50 border-b border-gray-200" colSpan={7}></th>
                                {uniqueModels.map((model) => {
                                    const draftSum = getDraftTotal(model.key);
                                    return model.sortedSizes.map((size, idx) => (
                                        <th key={`draft-${model.key}-${size}`} className={`sticky top-12 p-1 border-b border-r border-gray-200 text-center relative bg-yellow-50 ${idx===0 ? 'border-l-2 border-l-gray-300' : ''}`}>
                                            {idx === 0 && draftSum > 0 && <div className="absolute top-0 left-1.5 text-[9px] text-yellow-600 font-bold">{draftSum}</div>}
                                            <input type="text" value={draftValues[`${model.key}-${size}`] || ''} onChange={(e) => handleDraftChange(model.key, size, e.target.value)} className="w-full h-7 text-center font-bold text-gray-800 bg-white border border-yellow-200 rounded focus:border-yellow-500 outline-none text-xs placeholder-gray-200" placeholder="-" />
                                        </th>
                                    ));
                                })}
                            </tr>

                            {/* --- ROW 3: Totals --- */}
                            <tr className="h-8 bg-gray-100">
                                <th className="sticky top-[88px] left-0 z-[70] bg-gray-200 border-b border-r border-gray-300"></th>
                                <th className="sticky top-[88px] left-[100px] z-[70] bg-gray-200 border-b border-r border-gray-300 text-right px-3 font-bold text-gray-500 uppercase text-[10px]">Всего заказано</th>
                                <th className="sticky top-[88px] bg-gray-100 border-b border-gray-200" colSpan={7}></th>
                                {uniqueModels.map((model, mIdx) => (
                                    model.sortedSizes.map((size, idx) => (
                                        <th key={`total-${model.key}-${size}`} className={`sticky top-[88px] p-1 border-b border-r border-gray-200 text-center text-[10px] text-gray-500 font-bold bg-gray-100 ${idx===0 ? 'border-l-2 border-l-gray-300' : ''}`}>
                                            {model.sizeTotals[size] || 0}
                                        </th>
                                    ))
                                ))}
                            </tr>

                            {/* --- ROW 4: Headers --- */}
                            <tr className="h-10 bg-white">
                                <th className="sticky top-[120px] left-0 z-[70] bg-white border-b border-r border-gray-300 text-center font-bold text-gray-700 shadow-r min-w-[100px]">Действия</th>
                                <th className="sticky top-[120px] left-[100px] z-[70] bg-white border-b border-r border-gray-300 px-3 font-bold text-gray-700 shadow-r min-w-[200px]">ФИО</th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 min-w-[120px] px-3 font-bold text-gray-700">Телефон</th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 min-w-[100px] px-3 font-bold text-gray-700">Город</th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 min-w-[150px] px-3 font-bold text-gray-700">Примечание</th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 text-center min-w-[80px]">
                                    <div className="text-[10px] text-black font-bold">Кол-во</div>
                                    <div className="text-sm font-bold text-indigo-600">{grandTotalPairs}</div>
                                </th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 text-center px-2 font-bold text-gray-700 min-w-[80px]">Скидка</th>
                                <th className="sticky top-[120px] bg-white border-b border-gray-300 text-center px-2 font-bold text-gray-700 min-w-[80px]">Предоплата</th>
                                <th className="sticky top-[120px] bg-white border-b border-r border-gray-300 text-right px-3 font-bold text-gray-700 min-w-[100px]">Сумма</th>
                                
                                {uniqueModels.map((model) => (
                                    model.sortedSizes.map((size, idx) => (
                                        <th key={`size-${model.key}-${size}`} className={`sticky top-[120px] p-1 border-b border-r border-gray-200 text-center text-xs text-gray-600 min-w-[40px] bg-white ${idx===0 ? 'border-l-2 border-l-gray-300' : ''}`}>
                                            {size}
                                        </th>
                                    ))
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {clientsData.map(client => (
                                <tr key={client.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="p-2 border-r border-gray-200 sticky left-0 bg-white group-hover:bg-blue-50 z-30 flex gap-1 justify-center items-center h-full shadow-r">
                                        <button onClick={() => handleDownloadRow(client)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Скачать"><Download size={16}/></button>
                                        <button onClick={() => handleEditRow(client)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Редактировать"><Edit size={16}/></button>
                                        <button onClick={() => requestDeleteRow(client)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить"><Trash2 size={16}/></button>
                                    </td>
                                    <td className="p-3 border-r border-gray-200 font-bold text-gray-800 sticky left-[100px] bg-white group-hover:bg-blue-50 z-30 shadow-r">
                                        {client.name}
                                    </td>
                                    <td className="p-3 border-r border-gray-200 text-gray-600 font-mono text-xs">{client.phone}</td>
                                    <td className="p-3 border-r border-gray-200 text-gray-600">{client.city}</td>
                                    <td className="p-3 border-r border-gray-200 text-gray-500 italic text-xs truncate max-w-[150px]" title={client.note}>{client.note}</td>
                                    <td className="p-3 border-r border-gray-200 text-center font-bold bg-indigo-50/50">{client.totalQty}</td>
                                    <td className="p-3 border-r border-gray-200 text-center text-red-500 font-bold">{client.totalDiscount > 0 ? client.totalDiscount.toFixed(0) : ''}</td>
                                    <td className="p-3 border-r border-gray-200 text-center text-blue-600">{client.prepayment > 0 ? Number(client.prepayment.toFixed(2)) : '-'}</td>
                                    <td className="p-3 border-r border-gray-300 text-right font-bold text-green-700">{client.totalSum.toLocaleString()}</td>
                                    {uniqueModels.map(model => (
                                        model.sortedSizes.map((size, idx) => {
                                            const qty = client.items[model.key]?.[size];
                                            return <td key={`${client.id}-${model.key}-${size}`} className={`p-1 border-r border-gray-200 text-center text-sm ${qty ? 'bg-green-100 font-bold text-green-900' : ''} ${idx===0 ? 'border-l-2 border-l-gray-300' : ''}`}>{qty || ''}</td>
                                        })
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;