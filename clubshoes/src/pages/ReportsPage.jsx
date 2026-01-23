import React, { useState, useMemo } from 'react';
import { FileText, Download, Search, Package, Trash2, Edit } from 'lucide-react';
import { ensureXLSX } from '../utils';
import { Button } from '../components/UI';
import { apiCall } from '../api';

const ReportsPage = ({ orders = [], clients = [], settings, onEditOrder, onReload }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // --- 1. АНАЛИЗ ДАННЫХ ---
    const { clientsData, uniqueModels } = useMemo(() => {
        const clientMap = {};
        const modelsMap = {}; 

        orders.forEach(order => {
            // Определение ID клиента
            let groupingId = order.clientId;
            const cleanPhone = order.clientPhone ? order.clientPhone.replace(/\D/g, '') : '';
            if (!groupingId && cleanPhone) groupingId = cleanPhone;
            if (!groupingId) groupingId = `unknown-${order.id}`;

            // Данные клиента
            const dbClient = clients.find(c => c.id === order.clientId) || {};
            const name = dbClient.name || order.clientName || 'Неизвестный';
            const phone = dbClient.phone || order.clientPhone || '';
            const city = dbClient.city || order.clientCity || '';
            const note = order.note || '';

            if (!clientMap[groupingId]) {
                clientMap[groupingId] = {
                    id: groupingId,
                    orderIds: [], 
                    name, phone, city, note,
                    totalQty: 0,
                    lumpDiscount: 0,
                    prepayment: 0,
                    totalSum: 0,
                    currency: settings?.mainCurrency || 'USD',
                    items: {}
                };
            }

            const client = clientMap[groupingId];
            client.orderIds.push(order.id);
            if (client.name === 'Неизвестный' && name !== 'Неизвестный') client.name = name;
            
            // --- ИСПРАВЛЕНИЕ СКИДКИ ---
            // Очищаем строку от всего, кроме цифр, минуса и точки
            let rawDiscount = order.lumpDiscount;
            if (typeof rawDiscount !== 'number') {
                rawDiscount = String(rawDiscount || '0').replace(/[^\d.-]/g, '');
            }
            const discountVal = parseFloat(rawDiscount) || 0;
            client.lumpDiscount += Math.abs(discountVal);
            
            // Предоплата
            let prep = 0;
            if (order.payment) {
                if (order.payment.prepaymentInUSD) prep = order.payment.prepaymentInUSD;
                else if (order.payment.originalCurrency === settings?.mainCurrency) prep = parseFloat(order.payment.originalAmount || 0);
            }
            client.prepayment += prep;
            
            // Сумма
            client.totalSum += parseFloat(order.total || 0);

            // Товары
            (order.items || []).forEach(item => {
                client.totalQty += item.qty;
                const modelKey = `${item.sku}::${item.color || ''}`;
                
                if (!modelsMap[modelKey]) {
                    modelsMap[modelKey] = { 
                        key: modelKey,
                        sku: item.sku, 
                        color: item.color, 
                        sizes: new Set() 
                    };
                }

                if (!client.items[modelKey]) client.items[modelKey] = {};
                
                Object.entries(item.sizes || {}).forEach(([size, qty]) => {
                    const q = parseInt(qty);
                    if (q > 0) {
                        modelsMap[modelKey].sizes.add(size);
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
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.phone.includes(searchTerm) || 
            c.city.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => b.totalQty - a.totalQty);

        return { clientsData: filteredClients, uniqueModels: sortedModels };
    }, [orders, clients, searchTerm, settings]);

    // --- ДЕЙСТВИЯ ---
    const handleDeleteRow = async (client) => {
        if (!window.confirm(`Удалить все заказы клиента ${client.name}?`)) return;
        try {
            await Promise.all(client.orderIds.map(id => apiCall(`/orders/${id}`, 'DELETE')));
            if (onReload) onReload();
        } catch (e) {
            alert('Ошибка удаления: ' + e.message);
        }
    };

    const handleEditRow = (client) => {
        const lastOrderId = client.orderIds[client.orderIds.length - 1];
        const orderToEdit = orders.find(o => o.id === lastOrderId);
        if (orderToEdit && onEditOrder) {
            onEditOrder(orderToEdit);
        }
    };

    const handleDownloadRow = async (client) => {
        try {
            const XLSX = await ensureXLSX();
            const wb = XLSX.utils.book_new();
            
            const rows = [
                ["Клиент", client.name],
                ["Телефон", client.phone],
                ["Город", client.city],
                ["Примечание", client.note],
                [],
                ["Модель", "Цвет", "Размер", "Кол-во"]
            ];

            Object.keys(client.items).forEach(modelKey => {
                const [sku, color] = modelKey.split('::');
                Object.entries(client.items[modelKey]).forEach(([size, qty]) => {
                    rows.push([sku, color, size, qty]);
                });
            });

            rows.push([], ["Итого пар:", client.totalQty]);
            rows.push(["Скидка:", client.lumpDiscount]);
            rows.push(["Предоплата:", client.prepayment]);
            rows.push(["Сумма к оплате:", client.totalSum + " " + client.currency]);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, "Заказ");
            XLSX.writeFile(wb, `${client.name}_заказ.xlsx`);
        } catch (e) {
            alert("Ошибка: " + e.message);
        }
    };

    const handleExport = async () => {
        try {
            const XLSX = await ensureXLSX();
            const headerRow1 = ["ФИО", "Телефон", "Город", "Примечание", "Кол-во", "Скидка", "Предоплата", "Сумма"];
            const headerRow2 = ["", "", "", "", "", "", "", ""];

            uniqueModels.forEach(model => {
                headerRow1.push(`${model.sku} ${model.color ? `(${model.color})` : ''}`);
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
                    c.lumpDiscount,
                    c.prepayment,
                    c.totalSum
                ];
                uniqueModels.forEach(model => {
                    model.sortedSizes.forEach(size => {
                        const qty = c.items[model.key]?.[size];
                        row.push(qty ? qty : "");
                    });
                });
                return row;
            });

            const wsData = [headerRow1, headerRow2, ...bodyRows];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            const merges = [];
            let colIndex = 8;
            uniqueModels.forEach(model => {
                const sizeCount = model.sortedSizes.length;
                if (sizeCount > 1) merges.push({ s: { r: 0, c: colIndex }, e: { r: 0, c: colIndex + sizeCount - 1 } });
                colIndex += sizeCount;
            });
            ws['!merges'] = merges;

            XLSX.utils.book_append_sheet(wb, ws, "Отчет Matrix");
            XLSX.writeFile(wb, `Matrix_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (e) {
            alert("Ошибка: " + e.message);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 overflow-hidden">
            <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={24} /></div>
                    <h1 className="text-2xl font-bold text-gray-900">Матричный отчет</h1>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Поиск..." className="pl-10 pr-4 h-10 w-64 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Button onClick={handleExport} variant="success" icon={Download}>Excel</Button>
                </div>
            </div>

            <div className="flex-1 bg-white border border-gray-200 shadow-sm overflow-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                    <thead className="bg-gray-50 z-20 shadow-sm">
                        <tr>
                            {/* --- ЗАКРЕПЛЕННЫЕ ЗАГОЛОВКИ --- */}
                            <th className="p-3 border-b border-r border-gray-200 min-w-[100px] sticky left-0 z-30 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>Действия</th>
                            <th className="p-3 border-b border-r border-gray-200 min-w-[200px] sticky left-[100px] z-30 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>ФИО</th>
                            
                            <th className="p-3 border-b border-gray-200 min-w-[120px]" rowSpan={2}>Телефон</th>
                            <th className="p-3 border-b border-gray-200 min-w-[100px]" rowSpan={2}>Город</th>
                            <th className="p-3 border-b border-gray-200 min-w-[150px]" rowSpan={2}>Примечание</th>
                            <th className="p-3 border-b border-gray-200 text-center" rowSpan={2}>Кол-во</th>
                            <th className="p-3 border-b border-gray-200 text-center" rowSpan={2}>Скидка</th>
                            <th className="p-3 border-b border-gray-200 text-center" rowSpan={2}>Предоплата</th>
                            <th className="p-3 border-b border-r border-gray-200 text-right min-w-[100px]" rowSpan={2}>Сумма</th>
                            {uniqueModels.map((model) => (
                                <th key={model.key} colSpan={model.sortedSizes.length} className="p-2 border-b border-r border-gray-300 text-center bg-blue-50 text-blue-800 font-bold">
                                    {model.sku} <span className="font-normal text-xs text-blue-600">{model.color}</span>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {uniqueModels.map(model => model.sortedSizes.map(size => (
                                <th key={`${model.key}-${size}`} className="p-1 border-b border-r border-gray-200 text-center text-xs text-gray-500 min-w-[35px] bg-slate-50">{size}</th>
                            )))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {clientsData.map(client => (
                            <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                                {/* --- ЗАКРЕПЛЕННЫЕ КОЛОНКИ СТРОК --- */}
                                <td className="p-2 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-slate-50 z-10 flex gap-1 justify-center items-center h-full shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <button onClick={() => handleDownloadRow(client)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Скачать"><Download size={16}/></button>
                                    <button onClick={() => handleEditRow(client)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Редактировать"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteRow(client)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить"><Trash2 size={16}/></button>
                                </td>
                                <td className="p-3 border-r border-gray-100 font-bold text-gray-800 sticky left-[100px] bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {client.name}
                                </td>

                                <td className="p-3 border-r border-gray-100 text-gray-600 font-mono text-xs">{client.phone}</td>
                                <td className="p-3 border-r border-gray-100 text-gray-600">{client.city}</td>
                                <td className="p-3 border-r border-gray-100 text-gray-500 italic text-xs truncate max-w-[150px]" title={client.note}>{client.note}</td>
                                <td className="p-3 border-r border-gray-100 text-center font-bold">{client.totalQty}</td>
                                <td className="p-3 border-r border-gray-100 text-center text-red-500 font-bold">{client.lumpDiscount > 0 ? client.lumpDiscount : ''}</td>
                                <td className="p-3 border-r border-gray-100 text-center text-blue-600">{client.prepayment > 0 ? client.prepayment : '-'}</td>
                                <td className="p-3 border-r border-gray-200 text-right font-bold text-green-700">{client.totalSum.toLocaleString()}</td>
                                {uniqueModels.map(model => model.sortedSizes.map(size => {
                                    const qty = client.items[model.key]?.[size];
                                    return <td key={`${client.id}-${model.key}-${size}`} className={`p-1 border-r border-gray-100 text-center text-sm ${qty ? 'bg-green-100 font-bold text-green-900' : ''}`}>{qty || ''}</td>
                                }))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReportsPage;