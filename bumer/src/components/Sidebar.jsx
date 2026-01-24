import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Box, 
  History, 
  Settings, 
  LogOut, 
  Bell,
  FileText // Добавляем иконку
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, user, settings, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'models', label: 'Модели', icon: Box },
    { id: 'history', label: 'История', icon: History },
    { id: 'reports', label: 'Отчеты', icon: FileText }, // Новый пункт
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  // Первая буква бренда или логина для аватара
  const brandInitial = settings?.brandName 
    ? settings.brandName.trim().charAt(0).toUpperCase() 
    : (user?.login?.charAt(0).toUpperCase() || 'U');

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-50">
      
      <div className="p-8 pb-10 flex justify-center">
        <img 
          src="images/proboot.png" 
          alt="ProBoot Logo" 
          className="h-12 w-auto object-contain cursor-pointer transition-transform hover:scale-105"
          onClick={() => setActiveTab('dashboard')}
        />
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={22} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
              <span className="text-[15px]">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 p-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 shrink-0">
            <span className="text-blue-700 font-black text-base">{brandInitial}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate" title={user?.login}>
              {user?.login || 'Пользователь'}
            </div>
            {/* Название бренда вместо "Менеджер" */}
            <div className="text-[11px] font-black text-blue-600 uppercase tracking-tighter truncate">
              {settings?.brandName || 'Менеджер'}
            </div>
          </div>

          <div className="flex flex-col gap-1 pr-1">
            {/* Кнопка уведомлений с кастомной плашкой */}
            <div className="relative group/notif">
              <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                <Bell size={18} />
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover/notif:block w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg shadow-xl animate-fade-in pointer-events-none z-[60]">
                Уведомлений пока нет
                <div className="absolute top-full right-3 w-2 h-2 bg-slate-800 rotate-45 -mt-1"></div>
              </div>
            </div>

            <button 
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Выход"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;