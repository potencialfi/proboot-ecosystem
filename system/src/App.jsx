import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Database, Settings, Factory } from 'lucide-react';

const Sidebar = () => {
  const { t, i18n } = useTranslation();
  
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'sidebar.dashboard' },
    { path: '/materials', icon: Database, label: 'sidebar.materials' },
    { path: '/production', icon: Factory, label: 'sidebar.production' },
    { path: '/settings', icon: Settings, label: 'sidebar.settings' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen p-4 flex flex-col fixed">
      <h1 className="text-xl font-bold mb-8 px-2 tracking-tight">PROBOOT <span className="text-blue-500">ERP</span></h1>
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className="flex items-center p-3 hover:bg-slate-800 rounded-lg transition-colors group"
          >
            <item.icon className="mr-3 w-5 h-5 text-slate-400 group-hover:text-white" />
            <span className="text-sm font-medium">{t(item.label)}</span>
          </Link>
        ))}
      </nav>
      <div className="pt-4 border-t border-slate-800 flex justify-around">
        {['ru', 'uk', 'en'].map(lng => (
          <button 
            key={lng} 
            onClick={() => i18n.changeLanguage(lng)}
            className={`text-xs font-bold p-2 rounded ${i18n.language === lng ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="p-8">{t('common.loading')}</div>}>
      <BrowserRouter basename="/system">
        <div className="flex bg-gray-50 min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 p-8">
            <Routes>
              <Route path="/" element={<h2 className="text-2xl font-bold text-slate-800">{t('sidebar.dashboard')}</h2>} />
              <Route path="/materials" element={<h2 className="text-2xl font-bold text-slate-800">{t('sidebar.materials')}</h2>} />
              <Route path="/production" element={<h2 className="text-2xl font-bold text-slate-800">{t('sidebar.production')}</h2>} />
              <Route path="/settings" element={<h2 className="text-2xl font-bold text-slate-800">{t('sidebar.settings')}</h2>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Suspense>
  );
}