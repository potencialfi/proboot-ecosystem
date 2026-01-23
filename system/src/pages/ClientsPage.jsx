import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit, Upload, FileDown, User, MapPin, Phone, X, Check, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiCall } from '../api';
import { Button } from '../components/UI';

// --- КОМПОНЕНТ ДЛЯ ПОРТАЛОВ (Чтобы перекрывать сайдбар) ---
const ModalPortal = ({ children }) => {
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            {children}
        </div>,
        document.body
    );
};

// --- TOAST CONTAINER (Тоже через портал, чтобы быть поверх всего) ---
const ToastContainer = ({ toasts, removeToast }) => {
  return createPortal(
    <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right min-w-[300px] backdrop-blur-md 
            ${toast.type === 'delete' ? 'bg-red-50 border-red-200 text-red-700' : 
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
              'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
        >
          <div className={`p-1.5 rounded-full shrink-0 ${toast.type === 'delete' || toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {toast.type === 'delete' ? <Trash2 size={16} /> : 
             toast.type === 'error' ? <AlertTriangle size={16} /> : 
             <Check size={16} />}
          </div>
          <div className="flex-1 text-sm font-bold">
            {toast.message}
          </div>
          <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};

// --- MODAL CONFIRM ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <ModalPortal>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up ring-1 ring-gray-200 p-6 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6 leading-relaxed">{message}</p>
        
        <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
                Отмена
            </button>
            <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95">
                Удалить
            </button>
        </div>
      </div>
    </ModalPortal>
  );
};

// --- MODAL EDIT ---
const EditClientModal = ({ client, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({ name: '', city: '', phone: '' });

    useEffect(() => {
        if (client) {
            setFormData({
                name: client.name || '',
                city: client.city || '',
                phone: client.phone || ''
            });
        }
    }, [client]);

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-up ring-1 ring-gray-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Редактировать клиента</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-6 flex flex-col gap-4">
                    <div>
                        <label className="text-label">Имя</label>
                        <div className="relative">
                            <User className="input-icon"/>
                            <input 
                                className="input-with-icon" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="ФИО"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-label">Город</label>
                        <div className="relative">
                            <MapPin className="input-icon"/>
                            <input 
                                className="input-with-icon" 
                                value={formData.city}
                                onChange={e => setFormData({...formData, city: e.target.value})}
                                placeholder="Город"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-label">Телефон</label>
                        <div className="relative">
                            <Phone className="input-icon"/>
                            <input 
                                className="input-with-icon" 
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                placeholder="Телефон"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                    <Button onClick={onClose} variant="secondary">Отмена</Button>
                    <Button onClick={() => onSave(client.id, formData)} variant="success" icon={Check}>Сохранить</Button>
                </div>
            </div>
        </ModalPortal>
    );
};

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  // Modals state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, isAll: false, name: '' });
  const [editModal, setEditModal] = useState({ isOpen: false, client: null });

  // Add Form
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const fileInputRef = useRef(null);

  // --- TOAST LOGIC ---
  const addToast = (message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // --- FETCH ---
  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const data = await apiCall('/clients');
      setClients(Array.isArray(data) ? data.sort((a,b) => b.id - a.id) : []); 
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // --- ADD CLIENT ---
  const handleAdd = async () => {
    if (!newName.trim()) {
        addToast('Введите имя клиента', 'error');
        return;
    }
    
    try {
      const newClient = {
        name: newName,
        city: newCity,
        phone: newPhone
      };
      await apiCall('/clients', 'POST', newClient);
      
      setNewName('');
      setNewCity('');
      setNewPhone('');
      await fetchClients();
      addToast('Клиент успешно добавлен', 'success');
    } catch (e) {
      addToast(e.message, 'error');
    }
  };

  // --- DELETE LOGIC ---
  const openDeleteSingle = (client) => {
      setDeleteModal({ isOpen: true, id: client.id, isAll: false, name: client.name });
  };

  const openDeleteAll = () => {
      setDeleteModal({ isOpen: true, id: null, isAll: true, name: 'ВСЕХ КЛИЕНТОВ' });
  };

  const confirmDelete = async () => {
      try {
          if (deleteModal.isAll) {
              await apiCall('/clients', 'DELETE');
              addToast('Все клиенты удалены', 'delete');
          } else {
              await apiCall(`/clients/${deleteModal.id}`, 'DELETE');
              addToast('Клиент удален', 'delete');
          }
          await fetchClients();
      } catch (e) {
          addToast('Ошибка удаления: ' + e.message, 'error');
      } finally {
          setDeleteModal({ isOpen: false, id: null, isAll: false, name: '' });
      }
  };

  // --- EDIT LOGIC ---
  const handleEditClick = (client) => {
      setEditModal({ isOpen: true, client });
  };

  const saveEdit = async (id, updatedData) => {
      try {
          await apiCall(`/clients/${id}`, 'PUT', updatedData);
          await fetchClients();
          addToast('Изменения сохранены', 'success');
          setEditModal({ isOpen: false, client: null });
      } catch (e) {
          addToast(e.message, 'error');
      }
  };

  // --- EXPORT / IMPORT ---
  const handleExport = () => {
    if (clients.length === 0) return addToast('Нет данных для экспорта', 'error');
    const dataToExport = clients.map(c => ({
        ID: c.id, Имя: c.name, Город: c.city, Телефон: c.phone,
        Дата: new Date(c.date || Date.now()).toLocaleDateString()
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Клиенты");
    XLSX.writeFile(wb, `Clients_${new Date().toLocaleDateString()}.xlsx`);
    addToast('Файл скачан', 'success');
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws);

              const newClientsData = [];
              data.forEach(row => {
                  const name = row['Имя'] || row['Name'] || row['name'];
                  if (name) {
                      newClientsData.push({
                          name: String(name),
                          city: String(row['Город'] || row['City'] || row['city'] || ''),
                          phone: String(row['Телефон'] || row['Phone'] || row['phone'] || '')
                      });
                  }
              });

              if (newClientsData.length > 0) {
                  const res = await apiCall('/clients/import', 'POST', newClientsData);
                  await fetchClients();
                  addToast(res.message || 'Импорт завершен', 'success');
              } else {
                  addToast('Файл пуст или формат неверен', 'error');
              }
          } catch (err) {
              console.error(err);
              addToast('Ошибка импорта: ' + err.message, 'error');
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; 
  };

  // --- SEARCH ---
  const cleanPhone = (str) => String(str || '').replace(/\D/g, '');
  const filteredClients = clients.filter(c => {
      const s = search.toLowerCase();
      const sDig = cleanPhone(search);
      const phoneDig = cleanPhone(c.phone);
      
      return (c.name || '').toLowerCase().includes(s) || 
             (c.city || '').toLowerCase().includes(s) || 
             (sDig.length > 0 && phoneDig.includes(sDig));
  });

  return (
    <div className="page-container relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* ПОРТАЛЬНЫЕ МОДАЛКИ (БУДУТ ПОВЕРХ ВСЕГО) */}
      <ConfirmModal 
        isOpen={deleteModal.isOpen} 
        onClose={() => setDeleteModal({ isOpen: false, id: null, isAll: false, name: '' })}
        onConfirm={confirmDelete}
        title={deleteModal.isAll ? "Удалить ВСЕХ?" : "Удаление клиента"}
        message={deleteModal.isAll 
            ? "Вы собираетесь удалить полную базу клиентов. Это действие необратимо." 
            : `Удалить клиента "${deleteModal.name}"?`}
      />

      <EditClientModal 
        isOpen={editModal.isOpen}
        client={editModal.client}
        onClose={() => setEditModal({ isOpen: false, client: null })}
        onSave={saveEdit}
      />

      {/* HEADER */}
      <div className="page-header-card">
         <div className="page-header-group">
             <h1 className="text-h1">Клиенты</h1>
             <p className="text-subtitle">Всего: {clients.length}</p>
         </div>
         <div className="flex gap-3">
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".xlsx, .xls"
             />
             <Button onClick={handleImportClick} variant="secondary" icon={Upload}>
                 Импорт
             </Button>
             <Button onClick={handleExport} variant="secondary" icon={FileDown}>
                 Экспорт
             </Button>
         </div>
      </div>

      {/* ADD FORM */}
      <div className="card">
        <h3 className="text-base font-bold text-gray-800 mb-4 tracking-wide">Добавить нового клиента</h3>
        
        <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex-1 w-full relative">
                <User className="input-icon"/>
                <input 
                    className="input-with-icon" 
                    placeholder="Имя"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                />
            </div>
            
            <div className="w-full md:w-1/4 relative">
                <MapPin className="input-icon"/>
                <input 
                    className="input-with-icon" 
                    placeholder="Город"
                    value={newCity}
                    onChange={e => setNewCity(e.target.value)}
                />
            </div>

            <div className="w-full md:w-1/4 relative">
                <Phone className="input-icon"/>
                <input 
                    className="input-with-icon" 
                    placeholder="Телефон"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                />
            </div>

            <div className="flex-shrink-0">
                <Button onClick={handleAdd} variant="success" icon={Plus}>
                    Добавить
                </Button>
            </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="w-full">
           <div className="relative w-full">
                <Search className="input-icon" />
                <input 
                   type="text" 
                   className="input-with-icon w-full" 
                   placeholder="Поиск (имя, город, телефон)"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                />
           </div>
      </div>

      {/* TABLE */}
      <div className="table-card">
        <div className="table-scroll-area">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-base col-id">ID</th>
                <th className="th-base">Клиент</th>
                <th className="th-base">Город</th>
                <th className="th-base col-phone">Телефон</th>
                {/* КНОПКА УДАЛИТЬ ВСЕХ В ЗАГОЛОВКЕ КОЛОНКИ ДЕЙСТВИЙ */}
                <th className="th-base col-action text-right">
                    <button 
                        onClick={openDeleteAll}
                        className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors uppercase tracking-wider"
                    >
                        Удалить всех
                    </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id} className="tr-row">
                  <td className="td-id">#{String(client.id).slice(-4)}</td>
                  <td className="td-title">{client.name}</td>
                  <td className="td-base">{client.city || '-'}</td>
                  <td className="td-phone">{client.phone || '-'}</td>
                  <td className="td-actions">
                      <div className="actions-group">
                          <button onClick={() => handleEditClick(client)} className="btn-action-edit" title="Редактировать"><Edit/></button>
                          <button onClick={() => openDeleteSingle(client)} className="btn-action-delete" title="Удалить"><Trash2/></button>
                      </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                    <td colSpan="5" className="td-empty">
                        {isLoading ? 'Загрузка...' : 'Клиенты не найдены'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ClientsPage;