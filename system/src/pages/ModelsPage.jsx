import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit, Upload, FileDown, Tag, Palette, DollarSign, X, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiCall } from '../api';
import { Button } from '../components/UI';

// --- MODAL PORTAL ---
const ModalPortal = ({ children }) => createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">{children}</div>,
    document.body
);

// --- TOASTS ---
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

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => !isOpen ? null : (
    <ModalPortal>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up ring-1 ring-gray-200 p-6 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28}/></div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">Отмена</button>
            <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200">Удалить</button>
        </div>
      </div>
    </ModalPortal>
);

// --- EDIT MODAL ---
const EditModelModal = ({ model, isOpen, onClose, onSave, settings }) => {
    const [formData, setFormData] = useState({ sku: '', color: '', price: '', gridId: '' });
    const sizeGrids = settings?.sizeGrids || [];
    useEffect(() => { if (model) setFormData({ sku: model.sku, color: model.color, price: model.price, gridId: model.gridId || (sizeGrids[0]?.id || 1) }); }, [model, sizeGrids]);
    if (!isOpen) return null;
    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-up ring-1 ring-gray-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100"><h3 className="text-lg font-bold text-gray-800">Редактировать модель</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 flex flex-col gap-4">
                    <div className="relative"><Tag className="input-icon"/><input className="input-with-icon" value={formData.sku} onChange={e=>setFormData({...formData, sku:e.target.value})} placeholder="Артикул"/></div>
                    <div className="relative"><Palette className="input-icon"/><input className="input-with-icon" value={formData.color} onChange={e=>setFormData({...formData, color:e.target.value})} placeholder="Цвет"/></div>
                    <div className="relative"><DollarSign className="input-icon"/><input type="number" className="input-with-icon" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} placeholder="Цена"/></div>
                    <div className="relative">
                        <select className="input-field appearance-none cursor-pointer pr-10" value={formData.gridId} onChange={e=>setFormData({...formData, gridId:parseInt(e.target.value)})}>
                            {sizeGrids.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-5 h-5"/>
                    </div>
                </div>
                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl"><Button onClick={onClose} variant="secondary">Отмена</Button><Button onClick={()=>onSave(model.id, formData)} variant="success" icon={Check}>Сохранить</Button></div>
            </div>
        </ModalPortal>
    );
};

const ModelsPage = ({ settings }) => {
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, isAll: false, name: '' });
  const [editModal, setEditModal] = useState({ isOpen: false, model: null });
  const [newSku, setNewSku] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newGridId, setNewGridId] = useState('');
  const fileInputRef = useRef(null);
  const sizeGrids = settings?.sizeGrids || [];
  const defaultGridId = settings?.defaultSizeGridId || (sizeGrids[0]?.id || 1);

  useEffect(() => { if (!newGridId) setNewGridId(defaultGridId); }, [defaultGridId, newGridId]);

  const addToast = (msg, type='success') => { const id = Date.now(); setToasts(p=>[...p,{id,message:msg,type}]); setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), 3000); };
  const removeToast = (id) => setToasts(p=>p.filter(t=>t.id!==id));

  const fetchModels = async () => { setIsLoading(true); try { const data = await apiCall('/models'); setModels(Array.isArray(data)?data.sort((a,b)=>b.id-a.id):[]); } catch(e){console.error(e)} finally{setIsLoading(false)} };
  useEffect(() => { fetchModels(); }, []);

  const handleAdd = async () => {
    if (!newSku.trim()) return addToast('Артикул обязателен', 'error');
    try {
      await apiCall('/models', 'POST', { sku: newSku, color: newColor, price: Number(newPrice), gridId: parseInt(newGridId)||defaultGridId });
      setNewSku(''); setNewColor(''); setNewPrice('');
      await fetchModels();
      addToast('Модель добавлена');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const confirmDelete = async () => {
      try {
          if (deleteModal.isAll) { await apiCall('/models', 'DELETE'); addToast('Все модели удалены', 'delete'); }
          else { await apiCall(`/models/${deleteModal.id}`, 'DELETE'); addToast('Модель удалена', 'delete'); }
          await fetchModels();
      } catch (e) { addToast(e.message, 'error'); } 
      finally { setDeleteModal({ isOpen: false, id: null, isAll: false, name: '' }); }
  };

  const saveEdit = async (id, data) => {
      try {
          await apiCall(`/models/${id}`, 'PUT', { ...data, price: Number(data.price), gridId: parseInt(data.gridId) });
          await fetchModels();
          addToast('Сохранено');
          setEditModal({ isOpen: false, model: null });
      } catch (e) { addToast(e.message, 'error'); }
  };

  const handleExport = () => {
    if (models.length===0) return addToast('Нет данных', 'error');
    const data = models.map(m => ({ ID: m.id, Артикул: m.sku, Цвет: m.color, Цена: m.price }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Модели");
    XLSX.writeFile(wb, `Models_${new Date().toLocaleDateString()}.xlsx`);
    addToast('Скачано');
  };

  const handleImport = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const wb = XLSX.read(evt.target.result, { type: 'binary' });
              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
              const payload = [];
              data.forEach(row => {
                  const sku = row['Артикул'] || row['sku'];
                  const price = row['Цена'] || row['price'];
                  if (sku && price) payload.push({ sku: String(sku), color: String(row['Цвет']||row['color']||''), price: Number(price) });
              });
              if (payload.length > 0) {
                  const res = await apiCall('/models/import', 'POST', payload);
                  await fetchModels();
                  addToast(res.message || `Добавлено: ${res.added}`, 'success');
              } else addToast('Файл пуст', 'error');
          } catch (err) { addToast(err.message, 'error'); }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
  };

  const filtered = models.filter(m => {
      const s = search.toLowerCase();
      return (m.sku||'').toLowerCase().includes(s) || (m.color||'').toLowerCase().includes(s);
  });

  return (
    <div className="page-container relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={confirmDelete} title={deleteModal.isAll?"Удалить ВСЕ?":"Удаление"} message={deleteModal.isAll?"Удалить всю базу моделей?":"Удалить модель?"} />
      <EditModelModal isOpen={editModal.isOpen} model={editModal.model} onClose={() => setEditModal({ isOpen: false })} onSave={saveEdit} settings={settings}/>

      <div className="page-header-card">
         <div className="page-header-group"><h1 className="text-h1">Модели</h1><p className="text-subtitle">Всего: {models.length}</p></div>
         <div className="flex gap-3"><input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx, .xls" /><Button onClick={() => fileInputRef.current.click()} variant="secondary" icon={Upload}>Импорт</Button><Button onClick={handleExport} variant="secondary" icon={FileDown}>Экспорт</Button></div>
      </div>

      <div className="card">
        <h3 className="text-base font-bold text-gray-800 mb-4 tracking-wide">Добавить новую модель</h3>
        <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="w-full md:w-1/4 relative"><Tag className="input-icon"/><input className="input-with-icon" placeholder="Артикул" value={newSku} onChange={e => setNewSku(e.target.value)}/></div>
            <div className="w-full md:w-1/4 relative"><Palette className="input-icon"/><input className="input-with-icon" placeholder="Цвет" value={newColor} onChange={e => setNewColor(e.target.value)}/></div>
            <div className="flex-1 w-full relative"><DollarSign className="input-icon"/><input type="number" className="input-with-icon" placeholder="Цена" value={newPrice} onChange={e => setNewPrice(e.target.value)}/></div>
            
            <div className="w-full md:w-1/4 relative">
                <select className="input-field appearance-none cursor-pointer pr-10" value={newGridId} onChange={e => setNewGridId(e.target.value)}>
                    {sizeGrids.map(g => <option key={g.id} value={g.id}>{g.name} ({g.min}-{g.max})</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-5 h-5"/>
            </div>

            <div className="flex-shrink-0"><Button onClick={handleAdd} variant="success" icon={Plus}>Добавить</Button></div>
        </div>
      </div>

      <div className="w-full"><div className="relative w-full"><Search className="input-icon" /><input className="input-with-icon w-full" placeholder="Поиск" value={search} onChange={e => setSearch(e.target.value)}/></div></div>

      <div className="table-card">
        <div className="table-scroll-area">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-base col-id">ID</th>
                <th className="th-base">Артикул</th>
                <th className="th-base">Цвет</th>
                <th className="th-base col-money">Цена</th>
                <th className="th-base col-action text-right"><button onClick={()=>setDeleteModal({isOpen:true,id:null,isAll:true})} className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded uppercase tracking-wider">Удалить все</button></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(model => (
                <tr key={model.id} className="tr-row">
                  <td className="td-id">#{String(model.id).slice(-4)}</td>
                  <td className="td-title">{model.sku}</td>
                  <td className="td-base">{model.color || '-'}</td>
                  <td className="td-money">{model.price} {settings?.mainCurrency}</td>
                  <td className="td-actions">
                      <div className="actions-group"><button onClick={() => setEditModal({isOpen:true,model})} className="btn-action-edit"><Edit/></button><button onClick={() => setDeleteModal({isOpen:true,id:model.id,isAll:false,name:model.sku})} className="btn-action-delete"><Trash2/></button></div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="5" className="td-empty">{isLoading ? 'Загрузка...' : 'Модели не найдены'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModelsPage;