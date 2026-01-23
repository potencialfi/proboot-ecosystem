import React, { useState, useEffect } from 'react';
import { apiCall } from './api';
import { ensureXLSX } from './utils';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewOrderPage from './pages/NewOrderPage';
import ClientsPage from './pages/ClientsPage';
import ModelsPage from './pages/ModelsPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import { Toast, ImportResultModal } from './components/UI';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [clients, setClients] = useState([]);
  const [models, setModels] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const [settings, setSettings] = useState({ 
      sizeGrids: [], 
      defaultSizeGridId: null,
      boxTemplates: {}, 
      exchangeRates: { usd: 0, eur: 0, isManual: false },
      mainCurrency: 'USD',
      defaultPrintCopies: 1,
      brandName: 'SHOE EXPO',
      brandPhones: [],
      brandLogo: null
  });

  // --- ИСПРАВЛЕНИЕ 1: Добавлено поле note ---
  const initialOrderState = {
      cart: [],
      clientPhone: '',
      clientName: '',
      clientCity: '',
      note: '', // <--- Было пропущено
      selectedClient: null,
      prepayment: '',
      paymentCurrency: 'USD',
      lumpDiscount: ''
  };
  const [orderDraft, setOrderDraft] = useState(initialOrderState);
  
  const [highlightSetting, setHighlightSetting] = useState(null);
  const [toast, setToast] = useState(null); 
  const [importResult, setImportResult] = useState(null);

  const loadAllData = async () => { 
      try { 
          const data = await apiCall('/data'); 
          setClients(data.clients || []); 
          setModels(data.models || []); 
          setOrders(data.orders || []); 
          
          if(data.settings) {
             setSettings(prev => ({ ...prev, ...data.settings }));
             setOrderDraft(prev => {
                 if (!prev.id) {
                     return { ...prev, paymentCurrency: prev.paymentCurrency || data.settings.mainCurrency || 'USD' };
                 }
                 return prev;
             });
          }
      } catch (e) { triggerToast('Ошибка подключения к серверу: ' + e.message, 'error'); } 
  };

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);
  
  const triggerToast = (msg, type = 'success') => {
      setToast({ message: msg, type });
      setTimeout(() => setToast(null), 3000);
  };
  
  const clearOrderDraft = () => {
      setOrderDraft({ ...initialOrderState, paymentCurrency: settings.mainCurrency || 'USD' });
  };

  const handleEditOrder = (order) => {
      const client = clients.find(c => c.id === order.clientId);
      const items = order.items || [];
      const payment = order.payment || {};

      // --- ИСПРАВЛЕНИЕ 2: Подтягиваем note из заказа ---
      setOrderDraft({
          id: order.id, 
          orderId: order.orderId, 
          cart: items,
          clientPhone: client ? client.phone : '',
          clientName: client ? client.name : '',
          clientCity: client ? client.city : '',
          note: order.note || '', // <--- Важно! Иначе при редактировании примечание стиралось
          selectedClient: client,
          prepayment: payment.originalAmount || '',
          paymentCurrency: payment.originalCurrency || (settings.mainCurrency || 'USD'),
          lumpDiscount: order.lumpDiscount || ''
      });
      setActiveTab('newOrder');
  };

  const goToSettingsAndHighlight = (section) => {
      setActiveTab('settings');
      setHighlightSetting(section);
  };
  
  const handleFileImport = async (e, endpoint, cb = null) => { 
    const file = e.target.files[0]; 
    if (!file) return; 
    e.target.value = ''; 
    try { 
      const XLSX = await ensureXLSX(); 
      const reader = new FileReader(); 
      reader.onload = async (ev) => { 
        try { 
          const wb = XLSX.read(ev.target.result, { type: 'binary' }); 
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const data = XLSX.utils.sheet_to_json(ws); 
          if (!data || data.length === 0) { triggerToast("Файл пуст", 'error'); return; }
          const res = await apiCall(endpoint, 'POST', data); 
          if(cb) await cb(); 
          setImportResult(res); 
        } catch (err) { triggerToast("Ошибка обработки файла: " + err.message, 'error'); } 
      }; 
      reader.readAsBinaryString(file); 
    } catch (err) { triggerToast("Ошибка чтения Excel: " + err.message, 'error'); } 
  };

  const handleLoginSuccess = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={handleLoginSuccess} />;

  return (
    <div className="flex h-screen bg-slate-50 text-gray-800 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} settings={settings} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-auto relative custom-scrollbar">
        {activeTab === 'dashboard' && <div className="p-0 h-full"><DashboardPage orders={orders} clients={clients} setActiveTab={setActiveTab} settings={settings} onEditOrder={handleEditOrder} /></div>}
        
        {activeTab === 'newOrder' && (
            <div className="p-0 h-full">
            <NewOrderPage 
                clients={clients} setClients={setClients} models={models} sizeGrid={settings.sizeGrids} 
                setOrders={setOrders} orders={orders} triggerToast={triggerToast} settings={settings}
                orderDraft={orderDraft} setOrderDraft={setOrderDraft} clearOrderDraft={clearOrderDraft} 
                goToSettingsAndHighlight={goToSettingsAndHighlight}
                onOrderCreated={loadAllData} // Чтобы обновить список после создания
                onOrderUpdated={loadAllData}
                onCancelEdit={() => { clearOrderDraft(); setActiveTab('history'); }} // Возврат в историю
            />
            </div>
        )}
        
        {activeTab === 'clients' && <ClientsPage clients={clients} setClients={setClients} triggerToast={triggerToast} handleFileImport={handleFileImport} loadAllData={loadAllData} setImportResult={setImportResult}/>}
        {activeTab === 'models' && <ModelsPage models={models} setModels={setModels} triggerToast={triggerToast} handleFileImport={handleFileImport} loadAllData={loadAllData} setImportResult={setImportResult} settings={settings}/>}
        {activeTab === 'history' && <OrdersPage orders={orders} setOrders={setOrders} clients={clients} settings={settings} triggerToast={triggerToast} onEdit={handleEditOrder} />}
        {activeTab === 'settings' && <SettingsPage apiCall={apiCall} triggerToast={triggerToast} settings={settings} setSettings={setSettings} highlightSetting={highlightSetting} setHighlightSetting={setHighlightSetting} loadAllData={loadAllData} />}
        
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />
      </main>
    </div>
  );
}