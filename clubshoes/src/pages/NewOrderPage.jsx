import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Save, ArrowLeft, ShoppingBag, Wallet, Phone, User, MapPin, FileText, Tag, X, Box, Minus, Check, AlertTriangle, Edit, Printer } from 'lucide-react';
import { convertPrice } from '../utils';
import { apiCall } from '../api';
import { Button } from '../components/UI';
import InvoicePreview from '../components/InvoicePreview';

// --- PORTALS ---
const ModalPortal = ({ children }) => createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">{children}</div>,
    document.body
);

// ПОРТАЛ ДЛЯ ПЕЧАТИ (Рендерится отдельно, чтобы не ломать верстку)
const PrintPortal = ({ children }) => createPortal(
    <div id="print-mount-point">{children}</div>,
    document.body
);

const ToastContainer = ({ toasts, removeToast }) => createPortal(
    <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right min-w-[300px] backdrop-blur-md ${toast.type==='delete'||toast.type==='error'?'bg-red-50 border-red-200 text-red-700':'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className={`p-1.5 rounded-full shrink-0 ${toast.type==='delete'||toast.type==='error'?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'}`}>{toast.type==='delete'?<Trash2 size={16}/>:toast.type==='error'?<AlertTriangle size={16}/>:<Check size={16}/>}</div>
          <div className="flex-1 text-sm font-bold">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100"><X size={16}/></button>
        </div>
      ))}
    </div>, document.body
);

// --- MODALS ---

// 1. SUCCESS MODAL (НОВОЕ)
const SuccessSaveModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-up">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Готово!</h3>
                <p className="text-gray-500 mb-8 text-lg">Заказ успешно сохранен.</p>
                <button 
                    onClick={onClose} 
                    className="w-full py-3.5 px-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 text-lg transition-all active:scale-95"
                >
                    ОК
                </button>
            </div>
        </ModalPortal>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-up">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 mb-6">{message}</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">Отмена</button>
                    <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200">Удалить</button>
                </div>
            </div>
        </ModalPortal>
    );
};

const RateEditModal = ({ isOpen, onClose, onSave, label, currentRate }) => {
    const [rate, setRate] = useState(currentRate);
    useEffect(() => { setRate(currentRate); }, [currentRate, isOpen]);
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-up">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                    <h3 className="text-lg font-bold text-gray-800">Изменить курс</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <div className="mb-6">
                    <label className="text-label mb-2 block">{label}</label>
                    <input type="number" className="input-field text-lg font-bold" value={rate} onChange={e => setRate(e.target.value)} autoFocus />
                    <p className="text-xs text-gray-400 mt-2">Курс обновится в настройках и применится ко всем расчетам.</p>
                </div>
                <div className="flex justify-end gap-3">
                    <Button onClick={onClose} variant="secondary">Отмена</Button>
                    <Button onClick={() => onSave(rate)} variant="success">Сохранить</Button>
                </div>
            </div>
        </ModalPortal>
    );
};

const EditCartItemModal = ({ isOpen, onClose, item, onSave, settings }) => {
    const [sizes, setSizes] = useState({});
    const [boxCounts, setBoxCounts] = useState({});

    useEffect(() => {
        if (item && isOpen) {
            const initialSizes = {};
            Object.entries(item.sizes || {}).forEach(([size, qty]) => initialSizes[size] = String(qty));
            setSizes(initialSizes);
            setBoxCounts({});
        }
    }, [item, isOpen]);

    const defaultGridId = settings?.defaultSizeGridId || 1;
    const gridId = item?.gridId || defaultGridId;
    const boxTemplates = settings?.boxTemplates?.[gridId];

    useEffect(() => {
        if (!boxTemplates) return;
        let hasBoxes = false;
        Object.values(boxCounts).forEach(count => { if (count > 0) hasBoxes = true; });
        if (hasBoxes) {
            const newSizes = {};
            Object.entries(boxCounts).forEach(([pairsInBox, count]) => {
                if (count > 0) {
                    const template = boxTemplates[pairsInBox];
                    if (template) Object.entries(template).forEach(([size, qtyPerBox]) => newSizes[size] = String(parseInt(newSizes[size] || 0) + (qtyPerBox * count)));
                }
            });
            setSizes(newSizes);
        }
    }, [boxCounts, boxTemplates]);

    const updateBoxCount = (pc, d) => setBoxCounts(p => ({ ...p, [pc]: Math.max(0, (p[pc]||0) + d) }));

    if (!isOpen || !item) return null;

    const handleSave = () => {
        const cleanSizes = {};
        let totalQty = 0;
        Object.entries(sizes).forEach(([size, qtyStr]) => {
            const q = parseInt(qtyStr, 10);
            if (q > 0) { cleanSizes[size] = q; totalQty += q; }
        });
        if (totalQty === 0) return alert('Количество не может быть пустым');
        const sizeNote = Object.entries(cleanSizes).sort((a,b) => Number(a[0]) - Number(b[0])).map(([s, q]) => `${s}(${q})`).join(', ');
        const itemTotal = (item.price - (item.discountPerPair || 0)) * totalQty;
        onSave({ ...item, qty: totalQty, sizes: cleanSizes, note: sizeNote, total: itemTotal });
    };

    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-scale-up p-0 overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <div><h3 className="text-lg font-bold text-gray-800">Редактировать</h3><p className="text-sm text-gray-500">{item.sku} | {item.color}</p></div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={20}/></button>
                </div>
                <div className="p-6">
                    <label className="text-label mb-3 block">Количество по размерам:</label>
                    <div className="grid grid-cols-6 gap-2 mb-4">
                        {['40','41','42','43','44','45'].map(size => (
                            <div key={size} className="flex flex-col items-center">
                                <span className="text-xs font-bold text-gray-500 mb-1">{size}</span>
                                <input type="number" className="w-full h-10 text-center font-bold bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" value={sizes[size] || ''} onChange={e => { setSizes({...sizes, [size]: e.target.value}); setBoxCounts({}); }}/>
                            </div>
                        ))}
                    </div>
                    {boxTemplates && (
                        <div className="flex gap-2 mb-6">
                            {Object.entries(boxTemplates).map(([pairsCount, templateSizes]) => {
                                const count = boxCounts[pairsCount] || 0;
                                const isActive = count > 0;
                                return (
                                    <div key={pairsCount} className={`flex-1 flex items-center justify-center h-10 rounded-lg transition-all border ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                        {!isActive ? (
                                            <button onClick={() => updateBoxCount(pairsCount, 1)} className="w-full h-full flex items-center justify-center gap-2 text-sm font-bold text-gray-600 hover:text-blue-600"><Box size={16} /> {pairsCount} пар</button>
                                        ) : (
                                            <div className="flex items-center justify-between w-full px-1">
                                                <button onClick={() => updateBoxCount(pairsCount, -1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-100 text-blue-700"><Minus size={16} /></button>
                                                <div className="flex flex-col items-center leading-none"><span className="text-[10px] text-blue-500 font-semibold">{pairsCount} пар</span><span className="font-bold text-blue-900 text-sm">{count} кор</span></div>
                                                <button onClick={() => updateBoxCount(pairsCount, 1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-100 text-blue-700"><Plus size={16} /></button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100"><Button onClick={onClose} variant="secondary">Отмена</Button><Button onClick={handleSave} variant="success" icon={Check}>Сохранить</Button></div>
                </div>
            </div>
        </ModalPortal>
    );
};

const DiscountModal = ({ isOpen, onClose, cart, lumpDiscount, onSave, currency }) => {
    const [activeTab, setActiveTab] = useState('lump'); 
    const [localLump, setLocalLump] = useState(lumpDiscount);
    const [perPair, setPerPair] = useState('');
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [localCart, setLocalCart] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setLocalCart(JSON.parse(JSON.stringify(cart || []))); 
            setLocalLump(lumpDiscount);
            setPerPair('');
            setSelectedIndices((cart || []).map((_, i) => i)); 
            setActiveTab('lump');
        }
    }, [isOpen, cart, lumpDiscount]);

    useEffect(() => {
        const discountValue = parseFloat(perPair) || 0;
        setLocalCart(prev => prev.map((item, idx) => {
            if (selectedIndices.includes(idx)) return { ...item, discountPerPair: discountValue, total: (item.price - discountValue) * item.qty };
            else return { ...item, discountPerPair: 0, total: item.price * item.qty };
        }));
    }, [perPair, selectedIndices]);

    const toggleItem = (index) => setSelectedIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    const toggleAll = () => setSelectedIndices(selectedIndices.length === localCart.length ? [] : localCart.map((_, i) => i));
    const handleSave = () => { onSave(localCart, localLump); onClose(); };

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-scale-up p-0 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Редактирование скидок</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <div className="flex border-b border-gray-100">
                    <button className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'lump' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setActiveTab('lump')}>На весь заказ</button>
                    <button className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'perPair' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setActiveTab('perPair')}>На пару</button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'lump' && (
                        <div className="animate-fade-in">
                            <input type="number" className="input-field text-lg" value={localLump} onChange={e => setLocalLump(e.target.value)} placeholder="Скидка на весь заказ" autoFocus />
                        </div>
                    )}
                    {activeTab === 'perPair' && (
                        <div className="animate-fade-in">
                            <div className="mb-4">
                                <input type="number" className="input-field" value={perPair} onChange={e => setPerPair(e.target.value)} placeholder="Скидка на пару" autoFocus />
                            </div>
                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-medium">
                                        <tr>
                                            <th className="p-3 w-10 text-center">
                                                <div className="relative inline-flex items-center justify-center w-5 h-5 cursor-pointer" onClick={toggleAll}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:bg-transparent checked:border-blue-500 transition-all cursor-pointer"
                                                        checked={selectedIndices.length === localCart.length && localCart.length > 0} 
                                                        readOnly
                                                    />
                                                    <Check className="pointer-events-none absolute text-blue-500 opacity-0 peer-checked:opacity-100 transition-opacity" size={14} strokeWidth={3} />
                                                </div>
                                            </th>
                                            <th className="p-3">Модель</th>
                                            <th className="p-3 text-right">Цена</th>
                                            <th className="p-3 text-right">Скидка</th>
                                            <th className="p-3 text-right">Итог</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {localCart.map((item, idx) => (
                                            <tr key={idx} className={selectedIndices.includes(idx) ? 'bg-blue-50/20' : ''}>
                                                <td className="p-3 text-center">
                                                    <div className="relative inline-flex items-center justify-center w-5 h-5 cursor-pointer" onClick={() => toggleItem(idx)}>
                                                        <input 
                                                            type="checkbox" 
                                                            className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:bg-transparent checked:border-blue-500 transition-all cursor-pointer"
                                                            checked={selectedIndices.includes(idx)} 
                                                            readOnly
                                                        />
                                                        <Check className="pointer-events-none absolute text-blue-500 opacity-0 peer-checked:opacity-100 transition-opacity" size={14} strokeWidth={3} />
                                                    </div>
                                                </td>
                                                <td className="p-3 font-bold text-gray-800">{item.sku} <span className="text-gray-400 font-normal">| {item.color}</span></td>
                                                <td className="p-3 text-right">{item.price} {currency}</td>
                                                <td className="p-3 text-right font-bold text-red-500">{item.discountPerPair > 0 ? `-${item.discountPerPair}` : '-'}</td>
                                                <td className="p-3 text-right font-bold">{item.total} {currency}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50"><Button onClick={onClose} variant="secondary">Отмена</Button><Button onClick={handleSave} variant="success" icon={Check}>Применить</Button></div>
            </div>
        </ModalPortal>
    );
};

const CartItem = ({ item, index, onRemove, onEdit, currency, exchangeRates }) => {
    const totalQty = useMemo(() => item.qty || 0, [item]);
    const priceInMain = convertPrice(item.price, currency, exchangeRates);
    const totalInMain = convertPrice(item.total, currency, exchangeRates);
    const discountText = item.discountPerPair > 0 ? `(Скидка: -${convertPrice(item.discountPerPair, currency, exchangeRates)})` : '';

    return (
        <div className="group relative p-3 mb-2 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all">
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{item.sku}</div>
                    <div className="text-xs text-gray-500 truncate">{item.color}</div>
                    <div className="mt-1 text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded inline-block">{item.note}</div>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-bold text-gray-900 text-sm">{totalQty} пар</div>
                    <div className="text-[10px] text-gray-400 flex flex-col items-end">
                        <span>{priceInMain} {currency}/пара</span>
                        {item.discountPerPair > 0 && <span className="text-red-400 text-[9px]">{discountText}</span>}
                    </div>
                    <div className="font-bold text-green-600 text-sm mt-0.5">{totalInMain} {currency}</div>
                </div>
            </div>
            <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(index, item)} className="bg-white text-blue-500 rounded-full p-1 border border-gray-200 shadow-sm hover:bg-blue-50 transition-colors" title="Редактировать"><Edit size={12}/></button>
                <button onClick={() => onRemove(index, item)} className="bg-white text-red-500 rounded-full p-1 border border-gray-200 shadow-sm hover:bg-red-50 transition-colors" title="Удалить"><Trash2 size={12}/></button>
            </div>
        </div>
    );
};

const NewOrderPage = ({ 
    clients: initialClients = [], 
    models: initialModels = [], 
    settings, 
    onOrderCreated,
    onCancelEdit,        
    onOrderUpdated,
    orderDraft,
    setOrderDraft,
    clearOrderDraft,
    onSettingsChange,
    onNavigateToDashboard 
}) => {
  
  const defaultDraft = { cart: [], clientPhone: '', clientName: '', clientCity: '', clientNote: '', selectedClient: null, prepayment: '', paymentCurrency: 'USD', lumpDiscount: '' };
  
  const [localDraft, setLocalDraft] = useState(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('orderDraft');
          return saved ? JSON.parse(saved) : defaultDraft;
      }
      return defaultDraft;
  });

  const draft = orderDraft?.id ? orderDraft : localDraft;
  const setDraft = orderDraft?.id ? setOrderDraft : setLocalDraft;

  // -- STATE FOR NEXT ID --
  const [nextOrderId, setNextOrderId] = useState(null);
  
  // -- SUCCESS MODAL STATE --
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
      if (!draft.id) localStorage.setItem('orderDraft', JSON.stringify(draft));
  }, [draft]);

  const updateDraft = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const [clients, setClients] = useState(initialClients);
  const [models, setModels] = useState(initialModels);
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [sizes, setSizes] = useState({});
  const [boxCounts, setBoxCounts] = useState({}); 
  const [toasts, setToasts] = useState([]);
  
  const [localExchangeRates, setLocalExchangeRates] = useState(settings?.exchangeRates || { usd: 1, eur: 1 });

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, index: null, item: null });
  const [editModal, setEditModal] = useState({ isOpen: false, index: null, item: null });
  const [discountModal, setDiscountModal] = useState({ isOpen: false });
  const [rateEditModal, setRateEditModal] = useState({ isOpen: false, label: '', rateKey: '', currentRate: 0, type: '' });
  const suggestionsRef = useRef(null);
  const modelSuggestionsRef = useRef(null);
  const mainCurrency = settings?.mainCurrency || 'USD';
  const isEditing = !!draft.id; 

  const addToast = (msg, type='success') => { const id = Date.now(); setToasts(p=>[...p,{id,message:msg,type}]); setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), 3000); };
  const removeToast = (id) => setToasts(p=>p.filter(t=>t.id!==id));

  // Sync settings
  useEffect(() => {
      if(settings?.exchangeRates) setLocalExchangeRates(settings.exchangeRates);
  }, [settings]);

  useEffect(() => {
      const refreshData = async () => {
          try { 
              const [c, m, o] = await Promise.all([apiCall('/clients'), apiCall('/models'), apiCall('/orders')]); 
              if(Array.isArray(c)) setClients(c); 
              if(Array.isArray(m)) setModels(m); 
              
              if (Array.isArray(o) && o.length > 0) {
                  const maxId = o.reduce((max, order) => {
                      const idNum = parseInt(order.orderId || order.id) || 0; 
                      return idNum > max ? idNum : max;
                  }, 0);
                  setNextOrderId(maxId + 1);
              } else {
                  setNextOrderId(1);
              }
          } catch(e){console.error(e)}
      };
      refreshData();
  }, []);

  useEffect(() => {
      const h = (e) => {
          if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) setShowPhoneSuggestions(false);
          if (modelSuggestionsRef.current && !modelSuggestionsRef.current.contains(e.target)) setShowModelSuggestions(false);
      };
      document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const normalize = (str) => String(str || '').replace(/\D/g, '');
  const phoneSuggestions = useMemo(() => {
      if (!draft.clientPhone) return [];
      const s = normalize(draft.clientPhone); if(s.length<2) return[];
      const matches = clients.filter(c => normalize(c.phone).includes(s));
      const seen = new Set(); const unique = [];
      matches.forEach(c => { const p = normalize(c.phone); if(!seen.has(p)){ seen.add(p); unique.push(c); }});
      return unique.slice(0,5);
  }, [draft.clientPhone, clients]);

  const handleSelectClient = (c) => { updateDraft('selectedClient', c); updateDraft('clientPhone', c.phone); updateDraft('clientName', c.name); updateDraft('clientCity', c.city||''); setShowPhoneSuggestions(false); };

  const filteredModels = useMemo(() => {
      if (!modelSearch) return [];
      const s = modelSearch.toLowerCase();
      return models.filter(m => (m.sku||'').toLowerCase().includes(s) || (m.color||'').toLowerCase().includes(s)).slice(0,10);
  }, [modelSearch, models]);

  const boxTemplates = useMemo(() => selectedModel ? settings?.boxTemplates?.[selectedModel.gridId] : null, [selectedModel, settings]);
  useEffect(() => {
      if (!boxTemplates) return;
      const ns = {}; let has = false;
      Object.entries(boxCounts).forEach(([pc, c]) => {
          if (c > 0) { has = true; const t = boxTemplates[pc]; if(t) Object.entries(t).forEach(([sz, q]) => { ns[sz] = String(parseInt(ns[sz]||0) + (q*c)); }); }
      });
      if (has) setSizes(ns);
  }, [boxCounts, boxTemplates]);
  const updateBoxCount = (pc, d) => setBoxCounts(p => ({...p, [pc]: Math.max(0, (p[pc]||0)+d)}));

  const addToCart = () => {
    if (!selectedModel) return;
    const cleanSizes = {}; let addQty = 0;
    Object.entries(sizes).forEach(([s, q]) => { const v = parseInt(q, 10); if(v > 0){ cleanSizes[s] = v; addQty += v; }});
    if (addQty === 0) return addToast('Выберите количество пар', 'error');

    const exIdx = (draft.cart || []).findIndex(i => i.modelId === selectedModel.id);
    if (exIdx !== -1) {
        const newCart = [...draft.cart];
        const item = { ...newCart[exIdx] };
        const mergedSizes = { ...item.sizes };
        Object.entries(cleanSizes).forEach(([s, q]) => mergedSizes[s] = (mergedSizes[s]||0) + q);
        const newTotalQty = Object.values(mergedSizes).reduce((a,b)=>a+b,0);
        const sizeNote = Object.entries(mergedSizes).sort((a,b)=>Number(a[0])-Number(b[0])).map(([s,q])=>`${s}(${q})`).join(', ');
        const itemTotal = (item.price - (item.discountPerPair || 0)) * newTotalQty;
        newCart[exIdx] = { ...item, sizes: mergedSizes, qty: newTotalQty, note: sizeNote, total: itemTotal };
        updateDraft('cart', newCart);
        addToast('Количество обновлено');
    } else {
        const sizeNote = Object.entries(cleanSizes).sort((a,b)=>Number(a[0])-Number(b[0])).map(([s,q])=>`${s}(${q})`).join(', ');
        const itemTotal = selectedModel.price * addQty;
        const newItem = { ...selectedModel, modelId: selectedModel.id, id: Date.now(), qty: addQty, sizes: cleanSizes, note: sizeNote, discountPerPair: 0, price: selectedModel.price, total: itemTotal };
        updateDraft('cart', [...(draft.cart || []), newItem]);
        addToast('Товар добавлен');
    }
    setSelectedModel(null); setSizes({}); setBoxCounts({}); setModelSearch(''); setShowModelSuggestions(false);
  };

  const handleRequestDelete = (index, item) => setDeleteModal({ isOpen: true, index, item });
  const confirmDelete = () => { const nc = [...(draft.cart || [])]; nc.splice(deleteModal.index, 1); updateDraft('cart', nc); setDeleteModal({ isOpen: false, index: null, item: null }); addToast('Позиция удалена', 'delete'); };
  const handleRequestEdit = (index, item) => setEditModal({ isOpen: true, index, item });
  const saveEditedItem = (u) => { const nc = [...(draft.cart || [])]; nc[editModal.index] = u; updateDraft('cart', nc); setEditModal({ isOpen: false, index: null, item: null }); addToast('Позиция обновлена'); };
  const handleDiscountsSave = (uc, ul) => { updateDraft('cart', uc); updateDraft('lumpDiscount', ul); addToast('Скидки применены'); };

  // CALC TOTALS
  const safeCart = draft.cart || [];
  const rawSubTotal = safeCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalPerPairDiscount = safeCart.reduce((sum, item) => sum + ((item.discountPerPair || 0) * item.qty), 0);
  const currentLumpDiscount = parseFloat(draft.lumpDiscount) || 0;
  const totalDiscount = totalPerPairDiscount + currentLumpDiscount;
  const finalTotal = Math.max(0, rawSubTotal - totalDiscount);
  const totalOrderQty = safeCart.reduce((sum, item) => sum + (item.qty || 0), 0);

  // LOGIC RATES & TOTALS
  const paymentCurr = draft.paymentCurrency;
  const rates = localExchangeRates || { usd: 1, eur: 1 };

  const getRateToUAH = (curr) => {
      if (curr === 'UAH') return 1;
      if (curr === 'USD') return rates.usd;
      if (curr === 'EUR') return rates.eur;
      return 1;
  };

  const getFullPriceInCurrency = (targetCurr) => {
      const priceInUAH = finalTotal * getRateToUAH(mainCurrency);
      const targetRate = getRateToUAH(targetCurr);
      if (!targetRate) return 0;
      return priceInUAH / targetRate;
  };

  const getPrepaymentInMain = () => {
      const val = parseFloat(draft.prepayment) || 0;
      if (val === 0) return 0;
      const valInUAH = val * getRateToUAH(paymentCurr);
      const mainRate = getRateToUAH(mainCurrency);
      if (!mainRate) return 0;
      return valInUAH / mainRate;
  };

  const remainingTotal = Math.max(0, finalTotal - getPrepaymentInMain());

  const getRemainingInPaymentCurrency = () => {
      const remInUAH = remainingTotal * getRateToUAH(mainCurrency);
      const payRate = getRateToUAH(paymentCurr);
      if (!payRate) return 0;
      return remInUAH / payRate;
  };

  const formatMoney = (val, curr) => convertPrice(val, curr, rates);

  const isFullPayment = (amountStr, curr) => {
      const val = parseFloat(amountStr) || 0;
      const full = getFullPriceInCurrency(curr);
      return Math.abs(val - full) < 0.1;
  };

  const handleTotalClick = (targetCurr) => {
      const val = getFullPriceInCurrency(targetCurr);
      updateDraft('prepayment', val.toFixed(2));
      updateDraft('paymentCurrency', targetCurr);
  };

  const handlePaymentCurrencyChange = (e) => {
      const newCurr = e.target.value;
      const oldCurr = draft.paymentCurrency;
      const currentVal = draft.prepayment;

      if (isFullPayment(currentVal, oldCurr)) {
          const newVal = getFullPriceInCurrency(newCurr);
          updateDraft('prepayment', newVal.toFixed(2));
      }
      updateDraft('paymentCurrency', newCurr);
  };

  const getRatesToDisplay = () => {
      const list = [];
      const { usd, eur } = rates;
      const safeUsd = usd || 1; const safeEur = eur || 1;

      if ((mainCurrency === 'USD' && paymentCurr === 'EUR') || (mainCurrency === 'EUR' && paymentCurr === 'USD')) {
          if (mainCurrency === 'USD') { 
              const cross = safeEur / safeUsd;
              list.push({ text: `Курс: 1 EUR = ${cross.toFixed(2)} USD`, val: cross.toFixed(2), key: 'eur', type: 'cross_eur_usd' });
          } else { 
              const cross = safeUsd / safeEur;
              list.push({ text: `Курс: 1 USD = ${cross.toFixed(2)} EUR`, val: cross.toFixed(2), key: 'usd', type: 'cross_usd_eur' });
          }
          const payRate = paymentCurr === 'USD' ? safeUsd : safeEur;
          list.push({ text: `Курс: 1 ${paymentCurr} = ${payRate.toFixed(2)} UAH`, val: payRate, key: paymentCurr.toLowerCase(), type: 'direct' });
      } else {
          if (paymentCurr !== 'UAH') {
              const rate = paymentCurr === 'USD' ? safeUsd : safeEur;
              list.push({ text: `Курс: 1 ${paymentCurr} = ${rate.toFixed(2)} UAH`, val: rate, key: paymentCurr.toLowerCase(), type: 'direct' });
          } else {
              if (mainCurrency !== 'UAH') {
                  const rate = mainCurrency === 'USD' ? safeUsd : safeEur;
                  list.push({ text: `Курс: 1 ${mainCurrency} = ${rate.toFixed(2)} UAH`, val: rate, key: mainCurrency.toLowerCase(), type: 'direct' });
              }
          }
      }
      return list;
  };
  const ratesList = getRatesToDisplay();

  const handleRateClick = (r) => {
      const labelText = r.text.includes(':') ? r.text.split(':')[1].trim() : r.text;
      setRateEditModal({ isOpen: true, label: labelText, rateKey: r.key, currentRate: r.val, type: r.type });
  };

  const saveNewRate = async (newVal) => {
      const val = parseFloat(newVal);
      if (!val || val <= 0) return alert('Некорректный курс');
      let newRates = { ...rates };
      
      if (rateEditModal.type === 'direct') newRates[rateEditModal.rateKey] = val;
      else if (rateEditModal.type === 'cross_eur_usd') newRates.eur = val * newRates.usd;
      else if (rateEditModal.type === 'cross_usd_eur') newRates.usd = val * newRates.eur;
      
      setLocalExchangeRates(newRates);
      setRateEditModal({ ...rateEditModal, isOpen: false });
      
      if (onSettingsChange) onSettingsChange({ ...settings, exchangeRates: newRates });
      
      try { await apiCall('/settings', 'POST', { exchangeRates: newRates }); addToast('Курс обновлен'); } catch (e) { addToast('Ошибка', 'error'); }
  };

  const handleSaveOrder = async () => {
      if (!draft.clientName.trim()) return addToast('Введите имя клиента', 'error');
      if (safeCart.length === 0) return addToast('Корзина пуста', 'error');
      let finalClientId = draft.selectedClient?.id;
      try {
          const clientData = { name: draft.clientName, phone: draft.clientPhone, city: draft.clientCity };
          if (finalClientId) {
              const hasCh = draft.selectedClient.name !== draft.clientName || draft.selectedClient.phone !== draft.clientPhone || (draft.selectedClient.city||'') !== draft.clientCity;
              if (hasCh) await apiCall(`/clients/${finalClientId}`, 'PUT', clientData);
          } else {
              const created = await apiCall('/clients', 'POST', clientData);
              finalClientId = created.id;
          }
          const pVal = parseFloat(draft.prepayment) || 0;
          const prepUSD = getFullPriceInCurrency('USD') * (pVal / getFullPriceInCurrency(draft.paymentCurrency) || 0);

          const orderData = {
              clientId: finalClientId, items: safeCart, total: finalTotal, lumpDiscount: currentLumpDiscount,
              date: isEditing ? draft.date : new Date().toISOString(), note: draft.clientNote,
              payment: { originalAmount: pVal, originalCurrency: draft.paymentCurrency, rateAtMoment: 1, prepaymentInUSD: prepUSD }
          };
          
          if (isEditing) { 
              await apiCall(`/orders/${draft.id}`, 'PUT', orderData); 
              if (onOrderUpdated) await onOrderUpdated(); 
          } 
          else { 
              await apiCall('/orders', 'POST', orderData); 
              if (onOrderCreated) await onOrderCreated();
          }
          
          // Открываем модальное окно успеха вместо перезагрузки
          setShowSuccessModal(true);

      } catch (e) { addToast('Ошибка: ' + e.message, 'error'); }
  };

  // Метод, который вызывается при нажатии ОК в модальном окне успеха
  const handleSuccessConfirm = () => {
      setShowSuccessModal(false);
      localStorage.removeItem('orderDraft');
      window.location.reload(); 
  };

  const handlePrint = () => {
      window.print();
  };

  const showSecondaryTotal = paymentCurr !== mainCurrency;

  return (
    <div className="page-container h-full flex flex-col p-6 gap-6 overflow-hidden bg-slate-50">
        
        {/* PRINT PORTAL */}
        <PrintPortal>
            <style>
    {`
        @media print {
            @page { 
                margin: 0; 
                size: auto; 
            }
            
            body, html {
                margin: 0;
                padding: 0;
                background: white !important; 
                visibility: hidden;
                height: 100%;
            }
            
            /* Скрываем всё, кроме портала для печати */
            body > *:not(#print-mount-point) { display: none !important; }
            
            #print-mount-point { 
                visibility: visible;
                display: block !important;
                position: static !important; /* Убираем наложение */
                width: 100%;
            }
            
            /* Каждая копия накладной */
            .invoice-copy { 
                display: block !important;
                width: 100%;
                min-height: 297mm; /* Высота листа A4 */
                
                /* Принудительный разрыв страницы */
                page-break-after: always !important; 
                break-after: page !important;
                
                overflow: hidden; 
            }

            /* Убираем разрыв после последней копии, чтобы не было пустого листа */
            .invoice-copy:last-of-type {
                page-break-after: auto !important;
                break-after: auto !important;
                min-height: auto;
            }
        }
    `}
</style>
            <div>
                {Array.from({ length: Math.max(1, parseInt(settings?.defaultPrintCopies) || 1) }).map((_, i) => (
                    <div key={i} className="invoice-copy">
                        <InvoicePreview 
                            order={{
                                ...draft, 
                                id: draft.id || nextOrderId,
                                orderId: draft.orderId || (draft.id ? draft.id : nextOrderId),
                                items: safeCart, 
                                total: finalTotal, 
                                lumpDiscount: currentLumpDiscount,
                                payment: {
                                    originalAmount: draft.prepayment,
                                    originalCurrency: draft.paymentCurrency,
                                    prepaymentInUSD: getPrepaymentInMain()
                                }
                            }} 
                            settings={{...settings, exchangeRates: localExchangeRates}} 
                        />
                    </div>
                ))}
            </div>
        </PrintPortal>

        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* Модалка успеха */}
        <SuccessSaveModal isOpen={showSuccessModal} onClose={handleSuccessConfirm} />

        <ConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={confirmDelete} title="Удалить позицию?" message={`Вы действительно хотите удалить "${deleteModal.item?.sku}" из заказа?`}/>
        <EditCartItemModal isOpen={editModal.isOpen} onClose={() => setEditModal({ isOpen: false })} item={editModal.item} onSave={saveEditedItem} settings={settings}/>
        <DiscountModal isOpen={discountModal.isOpen} onClose={() => setDiscountModal({ isOpen: false })} cart={draft.cart} lumpDiscount={draft.lumpDiscount} onSave={handleDiscountsSave} currency={mainCurrency}/>
        <RateEditModal isOpen={rateEditModal.isOpen} onClose={() => setRateEditModal({...rateEditModal, isOpen: false})} onSave={saveNewRate} label={rateEditModal.label} currentRate={rateEditModal.currentRate} />

        <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-200 shrink-0">
            <div className="flex items-center gap-4">
                {isEditing && <button onClick={onCancelEdit} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft /></button>}
                <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">{isEditing ? `Заказ #${draft.orderId || draft.id}` : 'Новый заказ'}</h1><p className="text-sm text-gray-500 font-medium mt-1">{isEditing ? 'Редактирование заказа' : 'Оформление заказа'}</p></div>
            </div>
            <div className="flex gap-3">{isEditing && <Button onClick={onCancelEdit} variant="secondary">Отмена</Button>}</div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
            <div className="flex-[2] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                <div className="card">
                    <div className="section-header mb-4 border-b border-gray-100 pb-2"><h3 className="section-title">1. Клиент</h3></div>
                    <div className="flex flex-col md:flex-row gap-4 mb-4" ref={suggestionsRef}>
                        <div className="relative w-full md:w-1/3">
                            <Phone className="input-icon" /><input type="text" className="input-with-icon" placeholder="Телефон" value={draft.clientPhone} onChange={e => { updateDraft('clientPhone', e.target.value); setShowPhoneSuggestions(true); }} onFocus={() => setShowPhoneSuggestions(true)} autoComplete="off"/>
                            {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden animate-fade-in">{phoneSuggestions.map(c => (<div key={c.id} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center" onClick={() => handleSelectClient(c)}><span className="font-bold text-gray-800">{c.phone}</span><span className="text-sm text-gray-500">{c.name}</span></div>))}</div>
                            )}
                        </div>
                        <div className="relative flex-1"><User className="input-icon" /><input type="text" className="input-with-icon" placeholder="Имя" value={draft.clientName} onChange={e => updateDraft('clientName', e.target.value)}/></div>
                        <div className="relative w-full md:w-1/4"><MapPin className="input-icon" /><input type="text" className="input-with-icon" placeholder="Город" value={draft.clientCity} onChange={e => updateDraft('clientCity', e.target.value)}/></div>
                    </div>
                    <div className="w-full"><div className="relative"><FileText className="input-icon" /><input type="text" className="input-with-icon" placeholder="Примечание" value={draft.clientNote} onChange={e => updateDraft('clientNote', e.target.value)}/></div></div>
                </div>

                <div className="card flex-1 flex flex-col">
                    <div className="section-header mb-3 border-b border-gray-100 pb-2"><h3 className="section-title">2. Товары</h3></div>
                    <div className="relative mb-4" ref={modelSuggestionsRef}>
                        <Search className="input-icon" /><input type="text" className="input-with-icon" placeholder="Артикул" value={modelSearch} onChange={e => { setModelSearch(e.target.value); setShowModelSuggestions(true); }} onFocus={() => setShowModelSuggestions(true)}/>
                        {showModelSuggestions && modelSearch && filteredModels.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">{filteredModels.map(m => (<div key={m.id} className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0" onClick={() => { setSelectedModel(m); setModelSearch(''); setSizes({}); setBoxCounts({}); setShowModelSuggestions(false); }}><div className="font-bold text-gray-800">{m.sku} <span className="font-normal text-gray-500">| {m.color}</span></div><div className="font-mono text-blue-600">{m.price} {settings?.mainCurrency}</div></div>))}</div>
                        )}
                    </div>
                    {selectedModel && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 animate-fade-in">
                            <div className="flex justify-between mb-3"><span className="font-bold text-lg">{selectedModel.sku} / {selectedModel.color}</span><button onClick={() => setSelectedModel(null)}><X size={18} className="text-gray-400 hover:text-gray-600"/></button></div>
                            <div className="flex items-end gap-2 mb-3">
                                {['40','41','42','43','44','45'].map(size => (<div key={size} className="flex-1 text-center"><div className="text-xs text-gray-500 mb-1">{size}</div><input type="number" className="w-full h-10 border border-gray-300 rounded-lg text-center font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={sizes[size] || ''} onChange={e => { setSizes({...sizes, [size]: e.target.value}); setBoxCounts({}); }}/></div>))}
                                <button onClick={addToCart} className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-md transition-all active:scale-95" title="Добавить"><Plus size={24} /></button>
                            </div>
                            {boxTemplates && (
                                <div className="flex gap-2 mt-2">{Object.entries(boxTemplates).map(([pairsCount, templateSizes]) => { const count = boxCounts[pairsCount] || 0; const isActive = count > 0; return (<div key={pairsCount} className={`flex-1 flex items-center justify-center h-10 rounded-lg transition-all border ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>{!isActive ? (<button onClick={() => updateBoxCount(pairsCount, 1)} className="w-full h-full flex items-center justify-center gap-2 text-sm font-bold text-gray-600 hover:text-blue-600"><Box size={16} /> {pairsCount} пар</button>) : (<div className="flex items-center justify-between w-full px-1"><button onClick={() => updateBoxCount(pairsCount, -1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-100 text-blue-700"><Minus size={16} /></button><div className="flex flex-col items-center leading-none"><span className="text-[10px] text-blue-500 font-semibold">{pairsCount} пар</span><span className="font-bold text-blue-900 text-sm">{count} кор</span></div><button onClick={() => updateBoxCount(pairsCount, 1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-100 text-blue-700"><Plus size={16} /></button></div>)}</div>); })}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-[400px] flex flex-col gap-4 h-full">
                <div className="card flex-1 flex flex-col p-0 overflow-hidden border-0 shadow-lg bg-gray-50 h-full max-h-[50vh]">
                    <div className="p-4 border-b border-gray-200 bg-white"><div className="flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingBag size={18}/> Корзина</h3><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{safeCart.length}</span></div></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {safeCart.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-400"><ShoppingBag size={48} className="mb-2 opacity-20"/><p>Нет товаров</p></div>) : (safeCart.map((item, idx) => (<CartItem key={idx} index={idx} item={item} onRemove={handleRequestDelete} onEdit={handleRequestEdit} currency={mainCurrency} exchangeRates={settings?.exchangeRates} />)))}
                    </div>
                    {/* FOOTER TOTAL PAIRS */}
                    <div className="p-3 bg-white border-t border-gray-200 text-right">
                        <span className="text-sm font-bold text-gray-500">Итого: {totalOrderQty} пар</span>
                    </div>
                </div>

                <div className="card p-5 bg-white border border-gray-200">
                    <div className="mb-4 space-y-3">
                        <div className="flex gap-2">
                            <input type="number" className="flex-1 h-10 rounded-lg px-3 bg-gray-50 border border-gray-200 focus:border-blue-500 outline-none text-sm" value={draft.prepayment} onChange={e => updateDraft('prepayment', e.target.value)} placeholder="Предоплата"/>
                            <select className="h-10 rounded-lg px-2 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 outline-none cursor-pointer" value={draft.paymentCurrency} onChange={handlePaymentCurrencyChange}>
                                <option value="USD">USD</option><option value="EUR">EUR</option><option value="UAH">UAH</option>
                            </select>
                        </div>
                        {ratesList && ratesList.length > 0 && (
                            <div className="flex flex-col gap-1">
                                {ratesList.map((r, i) => (
                                    <div key={i} className="text-xs text-blue-600 font-bold px-1 flex items-center gap-1 cursor-pointer border-b border-dashed border-blue-300 inline-block w-max hover:text-blue-800 hover:border-blue-500" onClick={() => handleRateClick(r)}>
                                        {r.text} <Edit size={10} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 pt-2 border-t border-dashed border-gray-200">
                        <div className="flex justify-between text-sm text-gray-500"><span>Сумма:</span> <span>{formatMoney(rawSubTotal, mainCurrency)} {mainCurrency}</span></div>
                        {totalDiscount > 0 && <div className="flex justify-between text-sm text-red-500"><span>Скидка:</span> <span>-{formatMoney(totalDiscount, mainCurrency)}</span></div>}
                        
                        <div className="flex justify-between items-end mt-3 cursor-pointer group" onClick={() => handleTotalClick(mainCurrency)}>
                            <span className="text-base font-bold text-gray-800">К оплате:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-green-600 leading-none group-hover:text-green-700 transition-colors">{formatMoney(remainingTotal, mainCurrency)} <span className="text-sm text-gray-500 font-normal">{mainCurrency}</span></span>
                                <button onClick={(e) => {e.stopPropagation(); setDiscountModal({ isOpen: true })}} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500 transition-colors"><Edit size={16}/></button>
                            </div>
                        </div>

                        {showSecondaryTotal && (
                            <div className="flex justify-end mt-1 cursor-pointer" onClick={() => handleTotalClick(paymentCurr)}>
                                <span className="text-lg font-bold text-gray-500 hover:text-gray-700 transition-colors">
                                    {/* Убрана двойная конвертация: toFixed(2) вместо formatMoney */}
                                    ≈ {getRemainingInPaymentCurrency().toFixed(2)} {paymentCurr}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handlePrint} className="h-12 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"><Printer size={20} /> Печать</button>
                    <button onClick={handleSaveOrder} className="h-12 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all active:scale-95"><Save size={20} /> {isEditing ? 'Сохранить' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default NewOrderPage;