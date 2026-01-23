import React, { useState, useEffect } from 'react';
import { Users, Building, Bell, Lock, Unlock, LogOut, Trash2, Edit2, X, Check, Search, Plus } from 'lucide-react';
import { apiCall } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

// 1. Toast (Всплывающее уведомление)
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, []);

    const bgClass = type === 'error' ? 'bg-red-500 shadow-red-200' : 'bg-green-600 shadow-green-200';
    const Icon = type === 'error' ? X : Check;

    return (
        <div className={`fixed top-6 right-6 ${bgClass} text-white px-5 py-3 rounded-xl shadow-xl z-[100] animate-fade-in flex items-center gap-3 font-bold text-sm`}>
            <Icon size={18} />
            {message}
        </div>
    );
};

// 2. Modal (Модальное окно)
const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-xl text-gray-800">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={20}/>
                </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50">
                {children}
            </div>
        </div>
    </div>
);

// --- КОНСТАНТЫ И УТИЛИТЫ ---

const PERMISSIONS_LIST = [
    { key: 'settings', label: 'Доступ к настройкам компании' },
    { key: 'delete_order', label: 'Удаление заказов' },
    { key: 'edit_order', label: 'Редактирование старых заказов' },
    { key: 'see_analytics', label: 'Просмотр аналитики' },
    { key: 'manage_users', label: 'Управление сотрудниками (если Админ)' },
    { key: 'export_excel', label: 'Выгрузка в Excel' }
];

const transliterate = (text) => {
    return text.toLowerCase()
        .replace(/[а-яё]/g, '') // Для простоты удаляем кириллицу (лучше использовать библиотеку)
        .replace(/ /g, '_')
        .replace(/[^a-z0-9_]/g, '');
};

// --- ГЛАВНЫЙ КОМПОНЕНТ ---

const AdminPage = ({ onLogout }) => {
    // Состояние данных
    const [companies, setCompanies] = useState([]);
    const [activeTab, setActiveTab] = useState('companies');
    const [toast, setToast] = useState(null);

    // Состояние формы создания компании
    const [createForm, setCreateForm] = useState({ name: '', id: '', adminLogin: '', adminPassword: '' });

    // Состояние модалок пользователей
    const [userModalData, setUserModalData] = useState(null); // { company: Object, users: Array }
    const [editingUser, setEditingUser] = useState(null); // Object (если edit) или null (если список)

    // Состояние рассылки
    const [notifyMsg, setNotifyMsg] = useState('');
    const [notifyTarget, setNotifyTarget] = useState('');

    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    // Загрузка списка компаний
    const loadCompanies = async () => {
        try {
            const data = await apiCall('/admin/companies');
            setCompanies(data || []);
        } catch (e) {
            showToast('Ошибка загрузки: ' + e.message, 'error');
        }
    };

    useEffect(() => { loadCompanies(); }, []);

    // --- ЛОГИКА КОМПАНИЙ ---

    const handleNameChange = (e) => {
        const val = e.target.value;
        // Автоматически генерируем ID из названия
        setCreateForm(prev => ({ 
            ...prev, 
            name: val, 
            id: transliterate(val) 
        }));
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        try {
            await apiCall('/admin/companies', 'POST', {
                ...createForm,
                ownerLogin: createForm.adminLogin, // Переименовываем для бэкенда
                ownerPassword: createForm.adminPassword
            });
            showToast('Компания успешно создана');
            setCreateForm({ name: '', id: '', adminLogin: '', adminPassword: '' });
            loadCompanies();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const toggleCompanyStatus = async (id) => {
        try {
            await apiCall(`/admin/companies/${id}/toggle`, 'PUT');
            loadCompanies();
        } catch (e) { showToast(e.message, 'error'); }
    };

    // --- ЛОГИКА ПОЛЬЗОВАТЕЛЕЙ ---

    const openUsersModal = async (company) => {
        try {
            const users = await apiCall(`/admin/companies/${company.id}/users`);
            setUserModalData({ company, users });
            setEditingUser(null); // Сначала показываем список
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleSaveUser = async (formData) => {
        try {
            const companyId = userModalData.company.id;
            
            if (editingUser?.id) {
                // Редактирование существующего
                const updated = await apiCall(`/admin/companies/${companyId}/users/${editingUser.id}`, 'PUT', formData);
                setUserModalData(prev => ({
                    ...prev,
                    users: prev.users.map(u => u.id === updated.id ? updated : u)
                }));
                showToast('Данные сотрудника обновлены');
            } else {
                // Создание нового
                const created = await apiCall(`/admin/companies/${companyId}/users`, 'POST', formData);
                setUserModalData(prev => ({
                    ...prev,
                    users: [...prev.users, created]
                }));
                showToast('Сотрудник добавлен');
            }
            setEditingUser(null); // Возврат к списку
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleDeleteUser = async (userId) => {
        // Простой confirm (можно заменить на кастомную модалку, если нужно)
        if (!confirm('Вы уверены? Этот сотрудник потеряет доступ.')) return;
        
        try {
            await apiCall(`/admin/companies/${userModalData.company.id}/users/${userId}`, 'DELETE');
            setUserModalData(prev => ({
                ...prev,
                users: prev.users.filter(u => u.id !== userId)
            }));
            showToast('Сотрудник удален');
        } catch (e) { showToast(e.message, 'error'); }
    };

    // --- ЛОГИКА РАССЫЛКИ ---
    const sendNotification = async () => {
        if (!notifyMsg) return;
        try {
            const res = await apiCall('/admin/notify', 'POST', { 
                message: notifyMsg, 
                targetCompanyId: notifyTarget || null 
            });
            showToast(`Уведомление отправлено (${res.count} получателей)`);
            setNotifyMsg('');
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-blue-100">
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}

            {/* САЙДБАР */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-20 shrink-0">
                {/* ИСПРАВЛЕНО: Убрана надпись AdminPanel, логотип выровнен как в основном меню */}
                <div className="h-20 flex items-center justify-center border-b border-gray-100 px-4">
                    <img src="/system/images/proboot.png" alt="ProBoot" className="h-10 object-contain" />
                </div>
                
                <nav className="flex-1 p-4 space-y-1 mt-4">
                    <SidebarButton 
                        active={activeTab === 'companies'} 
                        onClick={() => setActiveTab('companies')} 
                        icon={Building} 
                        label="Компании" 
                    />
                    <SidebarButton 
                        active={activeTab === 'notify'} 
                        onClick={() => setActiveTab('notify')} 
                        icon={Bell} 
                        label="Уведомления" 
                    />
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                        <LogOut size={18} />
                        <span>Выйти</span>
                    </button>
                </div>
            </aside>

            {/* ОСНОВНОЙ КОНТЕНТ */}
            <main className="flex-1 overflow-auto p-8 relative">
                
                {activeTab === 'companies' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        
                        {/* 1. Блок создания компании */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 tracking-tight">Создание новой компании</h2>
                            <form onSubmit={handleCreateCompany} className="space-y-6">
                                <div>
                                    <Input 
                                        placeholder="Название компании (например: Nike Shop)" 
                                        className="text-lg py-3 font-medium"
                                        value={createForm.name} 
                                        onChange={handleNameChange} 
                                        required 
                                    />
                                    {/* Скрытая отладка ID */}
                                    {createForm.id && (
                                        <div className="mt-2 text-xs text-gray-400 font-mono pl-1">
                                            System ID: <span className="text-gray-600">{createForm.id}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-5 pt-2">
                                    <Input 
                                        placeholder="Логин Администратора" 
                                        value={createForm.adminLogin} 
                                        onChange={e => setCreateForm({...createForm, adminLogin: e.target.value})} 
                                    />
                                    <Input 
                                        placeholder="Пароль Администратора" 
                                        value={createForm.adminPassword} 
                                        onChange={e => setCreateForm({...createForm, adminPassword: e.target.value})} 
                                    />
                                </div>
                                <p className="text-xs text-gray-400 px-1">* Если оставить пустым, будет создан: admin / 123</p>

                                <Button variant="success" className="w-full h-12 text-lg font-bold shadow-lg shadow-green-100">
                                    Создать базу данных
                                </Button>
                            </form>
                        </div>

                        {/* 2. Список компаний */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Активные компании</h3>
                            {companies.length === 0 && <div className="text-center text-gray-400 py-10">Компаний пока нет</div>}
                            
                            {companies.map(c => (
                                <div key={c.id} className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-all duration-200">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center font-bold text-xl border border-blue-100">
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg text-gray-800 leading-tight">{c.name}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{c.id}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            <span className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {c.isActive ? 'Active' : 'Blocked'}
                                        </span>
                                        
                                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                                        <Button variant="secondary" onClick={() => openUsersModal(c)} icon={Users} className="h-10 text-sm font-bold bg-gray-50 border-0 hover:bg-gray-100">
                                            Сотрудники
                                        </Button>
                                        
                                        <button 
                                            onClick={() => toggleCompanyStatus(c.id)} 
                                            className={`h-10 w-10 flex items-center justify-center rounded-xl transition-colors ${c.isActive ? 'text-gray-400 hover:bg-red-50 hover:text-red-500' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                                            title={c.isActive ? "Заблокировать" : "Разблокировать"}
                                        >
                                            {c.isActive ? <Lock size={18}/> : <Unlock size={18}/>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'notify' && (
                    <div className="max-w-2xl mx-auto mt-12">
                        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-gray-100">
                            <div className="flex items-center gap-3 mb-6 text-gray-800">
                                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><Bell size={24}/></div>
                                <h2 className="text-2xl font-bold">Системное уведомление</h2>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Получатель</label>
                                <select 
                                    className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                    value={notifyTarget}
                                    onChange={e => setNotifyTarget(e.target.value)}
                                >
                                    <option value="">Все компании</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Сообщение</label>
                                <textarea 
                                    className="w-full h-40 p-5 border border-gray-200 rounded-2xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100 text-lg transition-all resize-none" 
                                    placeholder="Введите текст уведомления..." 
                                    value={notifyMsg} 
                                    onChange={e => setNotifyMsg(e.target.value)}
                                ></textarea>
                            </div>
                            
                            <Button onClick={sendNotification} className="w-full h-12 text-lg font-bold">Отправить</Button>
                        </div>
                    </div>
                )}
            </main>

            {/* --- МОДАЛЬНОЕ ОКНО СОТРУДНИКОВ --- */}
            {userModalData && (
                <Modal title={`Сотрудники: ${userModalData.company.name}`} onClose={() => setUserModalData(null)}>
                    {!editingUser ? (
                        // РЕЖИМ СПИСКА
                        <div className="space-y-4">
                            <Button onClick={() => setEditingUser({ role: 'manager', permissions: [] })} className="w-full py-3 font-bold" variant="secondary">
                                <Plus size={18} /> Добавить сотрудника
                            </Button>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                {userModalData.users.length === 0 && <div className="p-6 text-center text-gray-400">Сотрудников нет</div>}
                                
                                {userModalData.users.map((u, idx) => (
                                    <div key={u.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${idx !== userModalData.users.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800">{u.name}</div>
                                                <div className="text-xs text-gray-400">{u.login}</div>
                                            </div>
                                            <RoleBadge role={u.role}/>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingUser(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Edit2 size={18}/>
                                            </button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // РЕЖИМ РЕДАКТИРОВАНИЯ
                        <UserEditForm 
                            user={editingUser} 
                            onSave={handleSaveUser} 
                            onCancel={() => setEditingUser(null)} 
                        />
                    )}
                </Modal>
            )}
        </div>
    );
};

// --- КОМПОНЕНТЫ ДЛЯ ЧИСТОТЫ КОДА ---

const SidebarButton = ({ active, onClick, icon: Icon, label }) => (
    <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
    >
        <Icon size={20}/> {label}
    </button>
);

const RoleBadge = ({ role }) => {
    const isAdm = role === 'admin';
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isAdm ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
            {isAdm ? 'Admin' : 'Manager'}
        </span>
    );
};

// --- ФОРМА РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЯ ---
const UserEditForm = ({ user, onSave, onCancel }) => {
    const isNew = !user.id;
    const [form, setForm] = useState({ 
        name: user.name || '', 
        login: user.login || '', 
        password: '', // Пароль всегда пустой при открытии
        role: user.role || 'manager',
        permissions: user.permissions || []
    });

    const togglePermission = (key) => {
        setForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(key)
                ? prev.permissions.filter(k => k !== key)
                : [...prev.permissions, key]
        }));
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Имя сотрудника" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus required />
                <div className="relative">
                    <select 
                        className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                        value={form.role} 
                        onChange={e => setForm({...form, role: e.target.value})}
                    >
                        <option value="manager">Менеджер</option>
                        <option value="admin">Администратор</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <Input 
                    placeholder="Логин" 
                    value={form.login} 
                    onChange={e => setForm({...form, login: e.target.value})} 
                    required 
                    // Запрещаем менять логин, если это админ, чтобы не потерять доступ
                    disabled={!isNew && user.role === 'admin'} 
                />
                <Input 
                    placeholder={isNew ? "Пароль" : "Новый пароль (оставьте пустым)"} 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    required={isNew} 
                />
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-4">Права доступа</h4>
                
                {form.role === 'admin' ? (
                    <div className="text-sm text-purple-600 font-bold bg-purple-50 p-3 rounded-lg flex items-center gap-2">
                        <Check size={16}/> Администратор имеет полный доступ ко всем функциям
                    </div>
                ) : (
                    <div className="space-y-2">
                        {PERMISSIONS_LIST.map(p => (
                            <label key={p.key} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors select-none">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.permissions.includes(p.key) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                    {form.permissions.includes(p.key) && <Check size={12} className="text-white"/>}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden"
                                    checked={form.permissions.includes(p.key)}
                                    onChange={() => togglePermission(p.key)}
                                />
                                <span className="font-bold text-sm text-gray-700">{p.label}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600">
                    Отмена
                </Button>
                <Button type="submit" className="flex-1">
                    {isNew ? 'Создать сотрудника' : 'Сохранить изменения'}
                </Button>
            </div>
        </form>
    );
};

export default AdminPage;