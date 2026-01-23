import React, { useState, useMemo } from 'react';
import { Search, Plus, Save, Printer, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useOrderForm } from '../hooks/useOrderForm';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import InvoicePreview from '../components/InvoicePreview';
import { createPortal } from 'react-dom';

// Портал для печати (можно вынести в components/ui/PrintPortal.jsx)
const PrintPortal = ({ children }) => createPortal(
    <div id="print-mount-point">{children}</div>, document.body
);

const NewOrderPage = ({ settings, orderDraft, setOrderDraft, onCancelEdit, onOrderCreated }) => {
    // Подключаем наш хук
    const { 
        draft, setDraft, clients, models, totals, 
        addToCart, removeFromCart, saveOrder, nextOrderId 
    } = useOrderForm(orderDraft, setOrderDraft, settings, !!orderDraft?.id, onOrderCreated);

    // Локальное состояние UI (поиск, модалки)
    const [modelSearch, setModelSearch] = useState('');
    const [selectedModel, setSelectedModel] = useState(null);
    const [sizes, setSizes] = useState({});
    
    // Фильтрация моделей
    const filteredModels = useMemo(() => {
        if (!modelSearch) return [];
        const s = modelSearch.toLowerCase();
        return models.filter(m => m.sku.toLowerCase().includes(s)).slice(0, 10);
    }, [modelSearch, models]);

    const handleAddToCart = () => {
        try {
            addToCart(selectedModel, sizes, {}, {}); // Здесь можно добавить логику коробов
            setSelectedModel(null);
            setSizes({});
            setModelSearch('');
        } catch (e) {
            alert(e.message);
        }
    };

    const handleSave = async () => {
        try {
            await saveOrder();
            alert('Заказ сохранен!');
            if (!orderDraft?.id) window.location.reload();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="flex h-full gap-6 p-6 bg-slate-50">
            {/* ЛЕВАЯ КОЛОНКА: ВВОД ДАННЫХ */}
            <div className="flex-[2] flex flex-col gap-6 overflow-y-auto">
                
                {/* КЛИЕНТ */}
                <div className="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold mb-4 text-gray-800">1. Клиент</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <Input 
                            label="Телефон" 
                            value={draft.clientPhone} 
                            onChange={e => setDraft(p => ({...p, clientPhone: e.target.value}))}
                            list="phones" // Можно подключить datalist для подсказок
                        />
                        <Input label="Имя" value={draft.clientName} onChange={e => setDraft(p => ({...p, clientName: e.target.value}))} />
                        <Input label="Город" value={draft.clientCity} onChange={e => setDraft(p => ({...p, clientCity: e.target.value}))} />
                    </div>
                    <Input label="Примечание" value={draft.clientNote} onChange={e => setDraft(p => ({...p, clientNote: e.target.value}))} />
                </div>

                {/* ТОВАРЫ */}
                <div className="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[300px]">
                    <h3 className="font-bold mb-4 text-gray-800">2. Товары</h3>
                    
                    {/* Поиск */}
                    <div className="relative mb-6">
                        <Input 
                            placeholder="Найти модель (Артикул)..." 
                            icon={Search} 
                            value={modelSearch} 
                            onChange={e => setModelSearch(e.target.value)} 
                        />
                        {modelSearch && filteredModels.length > 0 && (
                            <div className="absolute w-full bg-white shadow-xl rounded-xl border mt-1 z-10 overflow-hidden">
                                {filteredModels.map(m => (
                                    <div key={m.id} onClick={() => { setSelectedModel(m); setModelSearch(''); }} className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between border-b last:border-0">
                                        <span className="font-bold">{m.sku}</span>
                                        <span className="text-blue-600">{m.price} {settings?.mainCurrency}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Выбор размеров */}
                    {selectedModel && (
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 animate-fade-in">
                            <div className="flex justify-between mb-4">
                                <h4 className="font-bold text-lg">{selectedModel.sku} <span className="text-gray-500 font-normal">| {selectedModel.color}</span></h4>
                                <button onClick={() => setSelectedModel(null)} className="text-gray-400 hover:text-red-500">✕</button>
                            </div>
                            
                            <div className="flex gap-2 items-end">
                                {['40','41','42','43','44','45'].map(size => (
                                    <div key={size} className="flex-1">
                                        <div className="text-xs text-center text-gray-500 mb-1">{size}</div>
                                        <input 
                                            type="number" 
                                            className="w-full h-12 text-center text-lg font-bold border rounded-lg"
                                            value={sizes[size] || ''}
                                            onChange={e => setSizes({...sizes, [size]: e.target.value})}
                                        />
                                    </div>
                                ))}
                                <Button onClick={handleAddToCart} variant="success" className="h-12 w-14" icon={Plus} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА: КОРЗИНА И ИТОГ */}
            <div className="w-[400px] flex flex-col gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><ShoppingBag size={18}/> Корзина</h3>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold border">{draft.cart.length}</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {draft.cart.map((item, idx) => (
                            <div key={idx} className="p-3 border rounded-xl flex justify-between group hover:border-blue-300 transition-colors bg-white">
                                <div>
                                    <div className="font-bold text-sm">{item.sku}</div>
                                    <div className="text-xs text-gray-500">{item.note}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{item.total} {settings?.mainCurrency}</div>
                                    <div className="text-xs text-red-500 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => removeFromCart(idx)}>Удалить</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Блок итогов */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-gray-500"><span>Сумма:</span> <span>{totals.subTotal} {settings?.mainCurrency}</span></div>
                        <div className="flex justify-between text-red-500"><span>Скидка:</span> <span>-{totals.discount}</span></div>
                        <div className="pt-3 border-t flex justify-between items-end">
                            <span className="font-bold text-xl">Итого:</span>
                            <span className="font-bold text-2xl text-green-600">{totals.total} {settings?.mainCurrency}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="secondary" onClick={() => window.print()} icon={Printer}>Печать</Button>
                        <Button variant="success" onClick={handleSave} icon={Save}>Сохранить</Button>
                    </div>
                </div>
            </div>

            {/* ПЕЧАТЬ (СКРЫТА) */}
            <PrintPortal>
                <style>{`@media print { body > *:not(#print-mount-point) { display: none !important; } .invoice-copy { page-break-after: always; } }`}</style>
                {Array.from({ length: settings?.defaultPrintCopies || 1 }).map((_, i) => (
                    <div key={i} className="invoice-copy">
                         <InvoicePreview order={{ ...draft, id: draft.id || nextOrderId, total: totals.total }} settings={settings} />
                    </div>
                ))}
            </PrintPortal>
        </div>
    );
};

export default NewOrderPage;