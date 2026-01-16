import React, { useState, useEffect, useRef } from 'react';
import { Ruler, Box, Plus, Trash2, CheckSquare, Image as ImageIcon, RefreshCw, AlertTriangle, Globe, Phone, Briefcase, Printer, Check, X } from 'lucide-react';
import { Input, Button, Modal, PageHeader } from '../components/UI';
import { uploadBrandLogo, IMG_URL, apiCall } from '../api'; 
import { formatPhoneNumber } from '../utils';
import { createPortal } from 'react-dom';

// --- ПОРТАЛ ДЛЯ УВЕДОМЛЕНИЙ ---
const ToastContainer = ({ toasts, removeToast }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right min-w-[300px] backdrop-blur-md ${
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <div className={`p-1.5 rounded-full shrink-0 ${
            toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            {toast.type === 'error' ? <AlertTriangle size={16}/> : <Check size={16}/>}
          </div>
          <div className="flex-1 text-sm font-bold">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={16}/>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};

const SettingsPage = ({ apiCall, triggerToast, settings, setSettings, highlightSetting, setHighlightSetting, loadAllData }) => {
  const [activeBoxTab, setActiveBoxTab] = useState(null); 
  const [grids, setGrids] = useState(settings.sizeGrids || []);
  const [activeGridId, setActiveGridId] = useState(settings.defaultSizeGridId || 1);
  const [boxTemplates, setBoxTemplates] = useState(settings.boxTemplates || {});
  
  const [isGridModalOpen, setIsGridModalOpen] = useState(false);
  const [newGridData, setNewGridData] = useState({ name: '', min: '', max: '' });
  const [isDeleteGridModalOpen, setIsDeleteGridModalOpen] = useState(false);
  const [gridToDelete, setGridToDelete] = useState(null);
  
  const [isAddBoxModalOpen, setIsAddBoxModalOpen] = useState(false);
  const [newBoxSize, setNewBoxSize] = useState('');
  const [isDeleteBoxModalOpen, setIsDeleteBoxModalOpen] = useState(false);
  const [boxToDelete, setBoxToDelete] = useState(null);
  
  const [isDeletePhoneModalOpen, setIsDeletePhoneModalOpen] = useState(false);
  const [phoneToDelete, setPhoneToDelete] = useState(null);
  
  const [rates, setRates] = useState(settings.exchangeRates || { usd: 0, eur: 0, isManual: false });
  const [mainCurrency, setMainCurrency] = useState(settings.mainCurrency || 'USD');
  const [brandName, setBrandName] = useState(settings.brandName || '');
  const [phones, setPhones] = useState(settings.brandPhones || []);
  const [newPhone, setNewPhone] = useState('');
  const [defaultPrintCopies, setDefaultPrintCopies] = useState(settings.defaultPrintCopies || 1);
  
  const [toasts, setToasts] = useState([]);

  const fileInputRef = useRef(null);
  const ratesRef = useRef(null);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message: msg, type }]);
    setTimeout(() => removeToast(id), 3000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => { 
      setGrids(settings.sizeGrids || []); 
      setBoxTemplates(settings.boxTemplates || {}); 
      setRates(settings.exchangeRates || {}); 
      setMainCurrency(settings.mainCurrency || 'USD'); 
      setBrandName(settings.brandName || ''); 
      setPhones(settings.brandPhones || []); 
      setDefaultPrintCopies(settings.defaultPrintCopies || 1);
      if (settings.sizeGrids && !settings.sizeGrids.find(g => g.id === activeGridId)) { 
          setActiveGridId(settings.defaultSizeGridId || (settings.sizeGrids[0]?.id)); 
      } 
  }, [settings]);

  useEffect(() => { 
      if (highlightSetting === 'rates' && ratesRef.current) { 
          ratesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
          ratesRef.current.classList.add('ring-4', 'ring-green-400', 'bg-green-50', 'transition-all', 'duration-500'); 
          setTimeout(() => { 
              ratesRef.current.classList.remove('ring-4', 'ring-green-400', 'bg-green-50'); 
              setHighlightSetting(null); 
          }, 2500); 
      } 
  }, [highlightSetting, setHighlightSetting]);

  const saveAll = async (updates) => { 
      const newSettings = { ...settings, ...updates }; 
      setSettings(newSettings); 
      try { 
          await apiCall('/settings', 'POST', newSettings); 
          if (updates.mainCurrency && loadAllData) await loadAllData(); 
          addToast("Сохранено"); 
      } catch(e) { 
          addToast("Ошибка сохранения", "error"); 
      } 
  };

  const handleRateChange = (curr, val) => { 
      const newRates = { ...rates, [curr]: Number(val), isManual: true }; 
      setRates(newRates); 
      if (val !== '') saveAll({ exchangeRates: newRates }); 
  };

  const fetchNBU = async () => { 
      try { 
          const res = await fetch(`http://localhost:3001/api/nbu-rates`); 
          const data = await res.json(); 
          const newRates = { usd: Number(data.usd.toFixed(2)), eur: Number(data.eur.toFixed(2)), isManual: false }; 
          setRates(newRates); 
          saveAll({ exchangeRates: newRates }); 
          addToast("Курсы обновлены (НБУ)"); 
      } catch (e) { 
          addToast("Ошибка НБУ", "error"); 
      } 
  };

  const handleAddGrid = () => { 
      if(!newGridData.name || !newGridData.min || !newGridData.max) return; 
      if(grids.length >= 5) return addToast("Максимум 5 сеток", "error"); 
      const newId = grids.length > 0 ? Math.max(...grids.map(g=>g.id || 0))+1 : 1; 
      const isFirst = grids.length === 0; 
      const newGrid = { id: newId, ...newGridData, isDefault: isFirst }; 
      const newGrids = [...grids, newGrid]; 
      const newTemplates = { ...boxTemplates, [newId]: {} }; 
      saveAll({ sizeGrids: newGrids, boxTemplates: newTemplates, defaultSizeGridId: isFirst ? newId : settings.defaultSizeGridId }); 
      setNewGridData({ name: '', min: '', max: '' }); 
      setIsGridModalOpen(false); 
      setActiveGridId(newId); 
  };

  const confirmDeleteGrid = (id) => { 
      if(grids.length <= 1) return addToast("Нельзя удалить последнюю сетку", "error"); 
      setGridToDelete(id); 
      setIsDeleteGridModalOpen(true); 
  };

  const performDeleteGrid = () => { 
      const newGrids = grids.filter(g => g.id !== gridToDelete); 
      let newDef = settings.defaultSizeGridId; 
      if (gridToDelete === newDef) { newDef = newGrids[0].id; newGrids[0].isDefault = true; } 
      if (gridToDelete === activeGridId) setActiveGridId(newDef); 
      const newTemplates = { ...boxTemplates }; 
      delete newTemplates[gridToDelete]; 
      saveAll({ sizeGrids: newGrids, defaultSizeGridId: newDef, boxTemplates: newTemplates }); 
      setIsDeleteGridModalOpen(false); 
      setGridToDelete(null); 
      addToast("Сетка удалена"); 
  };

  const handleSetDefault = (id, e) => { 
      e.stopPropagation(); 
      const newGrids = grids.map(g => ({ ...g, isDefault: g.id === id })); 
      setGrids(newGrids); 
      saveAll({ sizeGrids: newGrids, defaultSizeGridId: id }); 
  };

  const handleAddBox = () => { 
      if (!newBoxSize) return; 
      const sizeKey = String(newBoxSize); 
      const currentTemplates = boxTemplates[activeGridId] || {}; 
      if (Object.keys(currentTemplates).length >= 8) return addToast("Максимум 8 типов ящиков", "error"); 
      if (currentTemplates[sizeKey]) return addToast("Такой ящик уже есть", "error"); 
      const newTemplates = { ...boxTemplates }; 
      if(!newTemplates[activeGridId]) newTemplates[activeGridId] = {}; 
      newTemplates[activeGridId][sizeKey] = {}; 
      saveAll({ boxTemplates: newTemplates }); 
      setBoxTemplates(newTemplates); 
      setActiveBoxTab(sizeKey); 
      setIsAddBoxModalOpen(false); 
      setNewBoxSize(''); 
  };

  const confirmDeleteBox = (e, boxSize) => { 
      e.stopPropagation(); 
      setBoxToDelete(boxSize); 
      setIsDeleteBoxModalOpen(true); 
  };

  const performDeleteBox = () => { 
      const newTemplates = { ...boxTemplates }; 
      if (newTemplates[activeGridId]) { 
          delete newTemplates[activeGridId][boxToDelete]; 
          saveAll({ boxTemplates: newTemplates }); 
          setBoxTemplates(newTemplates); 
          if (activeBoxTab === boxToDelete) setActiveBoxTab(null); 
      } 
      setIsDeleteBoxModalOpen(false); 
      setBoxToDelete(null); 
      addToast("Ящик удален"); 
  };

  const handleUpdateBoxContent = (size, val) => { 
      if (!activeBoxTab) return; 
      const t = { ...boxTemplates }; 
      if(!t[activeGridId]) t[activeGridId] = {}; 
      if(!t[activeGridId][activeBoxTab]) t[activeGridId][activeBoxTab] = {}; 
      const numVal = Number(val); 
      if (numVal > 0) t[activeGridId][activeBoxTab][size] = numVal; 
      else delete t[activeGridId][activeBoxTab][size]; 
      saveAll({ boxTemplates: t }); 
  };

  const handleLogoUpload = async (e) => { 
      if(!e.target.files[0]) return; 
      const f = await uploadBrandLogo(e.target.files[0], brandName); 
      saveAll({ brandLogo: f }); 
  };

  const addPhone = () => { 
      const cleanPhone = newPhone.replace(/\D/g, ''); // ТОЛЬКО ЦИФРЫ
      if(cleanPhone && phones.length < 3) { 
          const p = [...phones, cleanPhone]; 
          setPhones(p); 
          setNewPhone(''); 
          saveAll({ brandPhones: p }); 
      } 
  };

  const confirmDeletePhone = (phone) => { 
      setPhoneToDelete(phone); 
      setIsDeletePhoneModalOpen(true); 
  };

  const performDeletePhone = () => { 
      const n = phones.filter(p => p !== phoneToDelete); 
      setPhones(n); 
      saveAll({ brandPhones: n }); 
      setIsDeletePhoneModalOpen(false); 
      setPhoneToDelete(null); 
      addToast("Номер удален"); 
  };

  const currentGrid = grids.find(g => g.id === parseInt(activeGridId)) || grids[0];
  const sizeRange = currentGrid ? Array.from({ length: parseInt(currentGrid.max) - parseInt(currentGrid.min) + 1 }, (_, i) => parseInt(currentGrid.min) + i) : [];
  const availableBoxes = currentGrid ? Object.keys(boxTemplates[activeGridId] || {}).sort((a,b)=>Number(a)-Number(b)) : [];
  
  useEffect(() => { 
      if (availableBoxes.length > 0) { 
          if (!availableBoxes.includes(activeBoxTab)) setActiveBoxTab(availableBoxes[0]); 
      } else { 
          setActiveBoxTab(null); 
      } 
  }, [activeGridId, boxTemplates]);

  const currentTotal = (currentGrid && activeBoxTab) ? Object.values(boxTemplates[activeGridId]?.[activeBoxTab] || {}).reduce((a,b)=>a+b,0) : 0;
  const isBoxConfigValid = activeBoxTab && currentTotal === parseInt(activeBoxTab);

  // Расчет кросс-курса
  const crossRate = (rates.usd > 0 && rates.eur > 0) ? (rates.eur / rates.usd).toFixed(3) : '0.000';

  return (
    <div className="page-container flex flex-col gap-6 pb-6">
       <ToastContainer toasts={toasts} removeToast={removeToast} />
       
       <div className="page-header-card">
           <div className="page-header-group">
                <h1 className="text-h1">Настройки</h1>
                <p className="text-subtitle">Параметры системы</p>
           </div>
           
           <div className="page-header-actions flex gap-4">
               <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
                   <span className="font-bold text-slate-500 uppercase text-xs">Валюта</span>
                   <select className="font-bold text-blue-600 bg-transparent outline-none cursor-pointer text-lg" value={mainCurrency} onChange={e=>saveAll({mainCurrency:e.target.value})}>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="UAH">UAH</option>
                   </select>
               </div>
               
               {/* РАСШИРЕННЫЕ ПОЛЯ КУРСОВ */}
               <div ref={ratesRef} className="bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200 flex items-center gap-6 shadow-sm">
                   <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-500 text-xs">USD/UAH</span>
                       <input className="w-20 bg-white border border-slate-300 rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none p-1" type="number" value={rates.usd} onFocus={(e) => e.target.select()} onChange={e=>handleRateChange('usd', e.target.value)}/>
                   </div>
                   <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-500 text-xs">EUR/UAH</span>
                       <input className="w-20 bg-white border border-slate-300 rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none p-1" type="number" value={rates.eur} onFocus={(e) => e.target.select()} onChange={e=>handleRateChange('eur', e.target.value)}/>
                   </div>
                   <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                       <span className="font-bold text-slate-400 text-[10px] uppercase">Кросс EUR/USD:</span>
                       <span className="font-black text-slate-700 text-base">{crossRate}</span>
                   </div>
                   <button onClick={fetchNBU} className="text-blue-500 hover:text-blue-700 bg-blue-100 hover:bg-blue-200 p-1.5 rounded-lg transition-colors" title="Сбросить к НБУ"><RefreshCw size={18}/></button>
               </div>
           </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* ПЕЧАТЬ (на месте языков) */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 mb-4">
                    <Printer size={20} className="text-blue-600"/>
                    <span>Печать</span>
                </div>
                <div className="flex flex-col gap-4">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">Количество копий при печати накладной:</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="5"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-lg" 
                        value={defaultPrintCopies} 
                        onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setDefaultPrintCopies(val);
                            saveAll({ defaultPrintCopies: val });
                        }}
                    />
                    <p className="text-xs text-slate-400 font-medium">Установите количество экземпляров, которое будет печататься при печати накладной.</p>
                </div>
           </div>
           
           {/* BRANDING */}
           <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row gap-8 items-start">
               <div className="flex-1 space-y-5 w-full">
                   <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b border-slate-100 pb-2">
                       <Briefcase size={20} className="text-blue-600"/>
                       <span>Брендинг</span>
                   </div>
                   
                   <Input label="Название бренда" value={brandName} onChange={e=>{setBrandName(e.target.value); saveAll({brandName:e.target.value})}} />
                   
                   <div>
                       <label className="block text-sm font-bold text-slate-500 mb-2">Телефоны</label>
                       <div className="space-y-2 mb-2">
                           {phones.map((p,i)=>(
                               <div key={i} className="flex justify-between items-center text-lg bg-slate-50 p-2 px-3 rounded-xl border border-slate-200 font-medium text-slate-700">
                                   <span>{formatPhoneNumber(p)}</span> 
                                   <button onClick={() => confirmDeletePhone(p)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-lg transition-all"><Trash2 size={18}/></button>
                               </div>
                           ))}
                       </div>
                       {phones.length < 3 && (
                           <div className="flex gap-2">
                               <Input 
                                 value={newPhone} 
                                 onChange={e => setNewPhone(e.target.value.replace(/\D/g, ''))} // ТОЛЬКО ЦИФРЫ В ПОЛЕ
                                 placeholder="380..." 
                                 className="flex-1" 
                               />
                               <Button onClick={addPhone} icon={Plus} variant="success"></Button>
                           </div>
                       )}
                   </div>
               </div>
               
               <div className="w-full md:w-56 flex flex-col items-center md:items-start shrink-0">
                   <label className="block text-sm font-bold text-slate-500 mb-2 w-full text-left">Логотип</label>
                   <div className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-white hover:border-blue-400 transition-all group" onClick={()=>fileInputRef.current.click()}>
                       {settings.brandLogo ? (
                           <img src={`${IMG_URL}/${settings.brandLogo}`} className="h-20 object-contain mb-1" onError={(e)=>e.target.style.display='none'}/>
                       ) : (
                           <ImageIcon size={28} className="text-slate-300 group-hover:text-blue-400 transition-colors mb-1"/>
                       )}
                       <span className="text-xs text-slate-400 group-hover:text-blue-500 font-bold">Загрузить</span>
                       <input type="file" ref={fileInputRef} hidden onChange={handleLogoUpload}/>
                   </div>
               </div>
           </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
           {/* SIZE GRIDS */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
               <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       <Ruler className="text-blue-600" size={20}/> Размерные сетки
                   </h3>
                   <Button onClick={() => setIsGridModalOpen(true)} icon={Plus} variant="success" className="w-8 h-8 p-0" disabled={grids.length >= 5} size="sm"></Button>
               </div>
               
               <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                   {grids.map(g => (
                       <div key={g.id} onClick={() => setActiveGridId(g.id)} className={`p-3 rounded-xl border transition-all cursor-pointer group ${activeGridId === g.id ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                           <div className="flex justify-between items-center w-full">
                               <div>
                                   <div className="font-bold text-sm text-slate-800">{g.name}</div>
                                   <div className="text-xs text-slate-500 font-bold mt-0.5 bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block">{g.min} — {g.max}</div>
                               </div>
                               <div className="flex items-center gap-2">
                                   {g.isDefault ? (
                                       <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded">По умолчанию</span>
                                   ) : (
                                       <button onClick={(e) => handleSetDefault(g.id, e)} className="opacity-0 group-hover:opacity-100 text-[10px] font-bold bg-slate-200 text-slate-600 hover:bg-green-100 hover:text-green-700 px-2 py-1 rounded transition-all">Поставить по умолчанию</button>
                                   )}
                                   <button onClick={(e) => { e.stopPropagation(); confirmDeleteGrid(g.id); }} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors" disabled={grids.length <= 1}><Trash2 size={16}/></button>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
           
           {/* BOX TEMPLATES */}
           <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
               {currentGrid ? (
                   <>
                   <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                       <div>
                           <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                               <Box className="text-blue-600" size={20}/> Типы ящиков
                           </h3>
                           <p className="text-slate-400 text-xs mt-1 ml-7 font-medium">Для сетки: <span className="text-slate-800 font-bold">{currentGrid.name}</span></p>
                       </div>
                   </div>
                   
                   <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-6">
                       {availableBoxes.map(s => (
                           <div key={s} onClick={()=>setActiveBoxTab(s)} className={`relative h-16 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md group ${activeBoxTab===s ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-300 bg-white text-slate-600'}`}>
                               <span className="text-xl font-black leading-none">{s}</span>
                               <span className="text-[9px] uppercase font-bold opacity-60">пар</span>
                               <button onClick={(e) => confirmDeleteBox(e, s)} className="absolute -top-1.5 -right-1.5 p-1 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-red-600 hover:border-red-200 shadow-sm transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                           </div>
                       ))}
                       {availableBoxes.length < 8 && (
                           <button onClick={() => setIsAddBoxModalOpen(true)} className="h-16 rounded-xl border-2 border-dashed border-green-300 bg-green-50/30 flex flex-col items-center justify-center text-green-600 hover:bg-green-100 hover:border-green-500 transition-all">
                               <Plus size={24}/>
                               <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wide">Добавить</span>
                           </button>
                       )}
                   </div>
                   
                   {activeBoxTab ? (
                       <div className="animate-fade-in bg-slate-50 rounded-xl p-5 border border-slate-200 flex-1">
                           <div className="flex justify-between items-center mb-4">
                               <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Состав ящика ({activeBoxTab} пар)</h4>
                               <div className={`text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isBoxConfigValid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                   {isBoxConfigValid ? <CheckSquare size={14}/> : <AlertTriangle size={14}/>}
                                   <span>Собрано: {currentTotal} из {activeBoxTab}</span>
                               </div>
                           </div>
                           <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                               {sizeRange.map(s => { 
                                   const val = boxTemplates[activeGridId]?.[activeBoxTab]?.[s] || 0; 
                                   return (
                                       <div key={s} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${val > 0 ? 'border-blue-400 bg-white shadow-sm ring-2 ring-blue-50' : 'border-slate-200 bg-white'}`}>
                                           <span className="text-slate-400 text-[10px] font-bold uppercase mb-1">{s}</span>
                                           <input type="number" min="0" className={`w-full text-center text-lg font-black bg-transparent outline-none transition-colors ${val > 0 ? 'text-blue-600' : 'text-slate-300 focus:text-slate-800'}`} value={val || ''} onChange={e => handleUpdateBoxContent(s, e.target.value)} placeholder="-" onFocus={(e) => e.target.select()}/>
                                       </div>
                                   )
                               })}
                           </div>
                       </div>
                   ) : (
                       <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium flex-1 flex flex-col items-center justify-center gap-2">
                           <Box size={32} className="opacity-20"/>
                           Выберите ящик для настройки
                       </div>
                   )}
                   </>
               ) : <div className="text-center text-slate-400 py-10 text-sm">Нет сеток</div>}
           </div>
       </div>

       {/* MODALS */}
       <Modal title="Новая сетка" isOpen={isGridModalOpen} onClose={()=>setIsGridModalOpen(false)} footer={<Button onClick={handleAddGrid} variant="success">Создать</Button>}><div className="space-y-4"><Input label="Название" value={newGridData.name} onChange={e=>setNewGridData({...newGridData, name:e.target.value})} placeholder="Например: Подростковая" autoFocus/><div className="grid grid-cols-2 gap-4"><Input label="Мин. размер" type="number" value={newGridData.min} onChange={e=>setNewGridData({...newGridData, min:e.target.value})} placeholder="36"/><Input label="Макс. размер" type="number" value={newGridData.max} onChange={e=>setNewGridData({...newGridData, max:e.target.value})} placeholder="41"/></div></div></Modal>
       <Modal title="Удалить сетку?" isOpen={isDeleteGridModalOpen} onClose={()=>setIsDeleteGridModalOpen(false)} footer={<><Button variant="secondary" onClick={()=>setIsDeleteGridModalOpen(false)}>Отмена</Button><Button variant="danger" onClick={performDeleteGrid}>Удалить</Button></>}><div className="text-center text-slate-600 py-4 text-base">Удалить сетку безвозвратно?</div></Modal>
       <Modal title="Удалить ящик?" isOpen={isDeleteBoxModalOpen} onClose={()=>setIsDeleteBoxModalOpen(false)} footer={<><Button variant="secondary" onClick={()=>setIsDeleteBoxModalOpen(false)}>Отмена</Button><Button variant="danger" onClick={performDeleteBox}>Удалить</Button></>}><div className="text-center text-slate-600 py-4 text-base">Удалить тип ящика на <b>{boxToDelete}</b> пар?</div></Modal>
       <Modal title="Удалить телефон?" isOpen={isDeletePhoneModalOpen} onClose={()=>setIsDeletePhoneModalOpen(false)} footer={<><Button variant="secondary" onClick={()=>setIsDeletePhoneModalOpen(false)}>Отмена</Button><Button variant="danger" onClick={performDeletePhone}>Удалить</Button></>}><div className="text-center text-slate-600 py-4 text-base">Удалить номер <b>{phoneToDelete}</b>?</div></Modal>
       <Modal title="Новый тип ящика" isOpen={isAddBoxModalOpen} onClose={()=>setIsAddBoxModalOpen(false)} footer={<Button onClick={handleAddBox} variant="success">Добавить</Button>}><div className="py-2"><Input label="Количество пар" type="number" value={newBoxSize} onChange={e=>setNewBoxSize(e.target.value)} autoFocus placeholder="15"/><p className="text-xs text-slate-500 mt-2">После добавления вы сможете настроить состав размеров.</p></div></Modal>
    </div>
  );
};

export default SettingsPage;