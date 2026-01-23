import React, { useState, useMemo } from 'react';
import { Search, Download, Trash2, Edit, FileText, AlertTriangle, Check, X } from 'lucide-react';
import { apiCall } from '../api';
import { ensureXLSX, convertPrice as utilsConvertPrice } from '../utils';
import { createPortal } from 'react-dom';

// --- БЕЗОПАСНЫЕ ФУНКЦИИ ---
const safeFormatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('ru-RU');
    } catch (e) {
        return dateString;
    }
};

const safeConvertPrice = (price, currency, rates) => {
    try {
        if (typeof utilsConvertPrice === 'function') {
            return utilsConvertPrice(price, currency, rates);
        }
        return price;
    } catch (e) {
        return price;
    }
};

// --- ПОРТАЛЫ ---
const ModalPortal = ({ children }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">{children}</div>,
        document.body
    );
};

// Уведомления в правом верхнем углу
const ToastContainer = ({ toasts, removeToast }) => createPortal(
    <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right min-w-[300px] backdrop-blur-md ${toast.type==='delete'||toast.type==='error'?'bg-red-50 border-red-200 text-red-700':'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className={`p-1.5 rounded-full shrink-0 ${toast.type==='delete'||toast.type==='error'?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'}`}>
            {toast.type==='delete'?<Trash2 size={16}/>:toast.type==='error'?<AlertTriangle size={16}/>:<Check size={16}/>}
          </div>
          <div className="flex-1 text-sm font-bold">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100"><X size={16}/></button>
        </div>
      ))}
    </div>, document.body
);

// --- МОДАЛКИ ---
const ReportModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-up border border-gray-100">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Отчет уже сформирован</h3>
                <p className="text-gray-500 mb-8">Ваш отчет был сформирован автоматически, проверьте вкладнку "Отчеты".</p>
                <button onClick={onClose} className="w-full py-3 px-4 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all active:scale-95">Понятно</button>
            </div>
        </ModalPortal>
    );
};

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, orderId }) => {
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-up">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Удалить заказ #{orderId}?</h3>
                <p className="text-gray-500 mb-6">Это действие нельзя отменить.</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">Отмена</button>
                    <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200">Удалить</button>
                </div>
            </div>
        </ModalPortal>
    );
};

const OrdersPage = ({ orders = [], setOrders, clients = [], settings, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, order: null });
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type='success') => { 
    const id = Date.now(); 
    setToasts(p=>[...p,{id,message:msg,type}]); 
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), 3000); 
  };

  const removeToast = (id) => setToasts(p=>p.filter(t=>t.id!==id));

  const currency = settings?.mainCurrency || 'USD';

  const confirmDelete = async () => {
      const { order } = deleteModal;
      if (!order) return;
      try {
          await apiCall(`/orders/${order.id}`, 'DELETE');
          if (setOrders) setOrders(prev => prev.filter(o => o.id !== order.id));
          addToast('Заказ удален', 'delete');
      } catch (e) {
          addToast('Ошибка удаления', 'error');
      } finally {
          setDeleteModal({ isOpen: false, order: null });
      }
  };

  const handleDownload = async (order) => {
      try {
          const XLSX = await ensureXLSX();
          const client = (Array.isArray(clients) ? clients.find(c => c.id === order.clientId) : null) || {};
          const items = Array.isArray(order.items) ? order.items : [];
          const totalQty = items.reduce((acc, i) => acc + (i.qty || 0), 0);
          
          const data = [
              ['ClubShoes', '', '', '', '', '', '', `Заказ №${order.orderId || order.id}`],
              [settings?.brandPhone || '', '', '', '', '', '', '', safeFormatDate(order.date)],
              [],
              ['КЛИЕНТ', '', '', '', '', '', '', 'ДЕТАЛИ'],
              [client.name || 'Гость', '', '', '', '', '', '', 'Позиций:', items.length],
              [client.city || '', '', '', '', '', '', '', 'Всего пар:', totalQty],
              [client.phone || '', '', '', '', '', '', '', '', ''],
              [],
              ['Модель / Цвет', 'Размерная сетка', 'Кол-во', `Цена (${currency})`, `Сумма (${currency})`],
          ];

          items.forEach(item => {
              data.push([`${item.sku} / ${item.color}`, item.note || '', item.qty, item.price, item.total]);
          });

          data.push([], ['', '', '', 'ИТОГО:', `${order.total} ${currency}`]);

          const ws = XLSX.utils.aoa_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Заказ");
          
          const safeName = (client.name || 'client').replace(/[^a-zа-яё0-9]/gi, '_');
          XLSX.writeFile(wb, `Заказ_${order.orderId || order.id}_${safeName}.xlsx`);
          addToast('Файл накладной скачан');
      } catch (e) {
          addToast('Ошибка скачивания', 'error');
      }
  };

  const filteredOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    if (!searchTerm) return safeOrders;
    const lower = searchTerm.toLowerCase();
    return safeOrders.filter(o => {
      const client = (Array.isArray(clients) ? clients.find(c => c.id === o.clientId) : null);
      return (client?.name?.toLowerCase() || '').includes(lower) || String(o.orderId || o.id).includes(lower);
    });
  }, [orders, searchTerm, clients]);

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-50 overflow-hidden">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
        <DeleteConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, order: null })} onConfirm={confirmDelete} orderId={deleteModal.order?.orderId || deleteModal.order?.id} />

        <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-200 shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">История заказов</h1>
                <p className="text-sm text-gray-500 font-medium mt-1">Всего заказов: {filteredOrders.length}</p>
            </div>
            {/* КНОПКА ОТЧЕТ: СИНИЙ ФОН (bg-blue-600) И СВЕТЛЫЙ ТЕКСТ (text-blue-50) */}
            <button 
                onClick={() => setShowReportModal(true)} 
                className="flex items-center gap-2 bg-blue-600 text-blue-50 px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
                <FileText size={20} /> Отчет
            </button>
        </div>

        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 shrink-0">
            <div className="relative w-full">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input type="text" className="w-full h-12 pl-12 pr-4 bg-gray-50 border-none rounded-lg text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-base" placeholder="Поиск по номеру заказа или имени клиента..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Дата</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Клиент</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-24">Пар</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-36">Сумма</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-48">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredOrders.map((order) => {
                            const client = (Array.isArray(clients) ? clients.find(c => c.id === order.clientId) : null);
                            const totalPairs = (order.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
                            return (
                                <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-sm text-gray-600 font-bold">#{order.orderId || order.id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">{safeFormatDate(order.date)}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 text-sm">{client?.name || 'Удален'}</div>
                                        {client?.phone && <div className="text-xs text-gray-400 font-mono mt-0.5">{client.phone}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-bold">{totalPairs}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-gray-900 text-sm">{safeConvertPrice(order.total, currency, settings?.exchangeRates)} {currency}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDownload(order)} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-100"><Download size={18} /></button>
                                            <button onClick={() => onEdit && onEdit(order)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-100"><Edit size={18} /></button>
                                            <button onClick={() => setDeleteModal({ isOpen: true, order })} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default OrdersPage;