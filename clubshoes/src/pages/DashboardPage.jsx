import React, { useState, useMemo } from 'react';
import { ShoppingBag, Footprints, Wallet, CreditCard, Eye, EyeOff, Plus, ArrowRight, Edit, Trash2, X, AlertTriangle } from 'lucide-react';
import { convertPrice } from '../utils';
import { PageHeader, Button } from '../components/UI';
import { apiCall } from '../api';

const DashboardPage = ({ orders = [], clients = [], setActiveTab, settings, onEditOrder }) => {
  const [showStats, setShowStats] = useState(false);
  
  // Состояние модалки теперь хранит ЦЕЛЫЙ ОБЪЕКТ заказа
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  const mainCurrency = settings?.mainCurrency || 'USD';

  // Открыть модалку (передаем весь объект)
  const openDeleteModal = (order) => {
    setOrderToDelete(order);
    setIsDeleteModalOpen(true);
  };

  // Закрыть модалку
  const closeDeleteModal = () => {
    setOrderToDelete(null);
    setIsDeleteModalOpen(false);
  };

  // Подтвердить
  const confirmDelete = async () => {
    if (!orderToDelete) return;
    try {
        await apiCall(`/orders/${orderToDelete.id}`, 'DELETE');
        window.location.reload();
    } catch (e) {
        alert('Ошибка при удалении: ' + e.message);
    } finally {
        closeDeleteModal();
    }
  };

  const handleEdit = (order) => {
      if (onEditOrder) {
          onEditOrder(order);
      } else {
          setActiveTab('newOrder');
      }
  };

  const stats = useMemo(() => {
    if (!orders) return { totalOrders: 0, totalSumUSD: 0, totalPairs: 0, prepayments: {}, avgCheckUSD: 0 };
    const totalOrders = orders.length;
    const totalSumUSD = orders.reduce((acc, o) => acc + (o.total || 0), 0);
    const totalPairs = orders.reduce((acc, o) => acc + (o.items || []).reduce((sum, i) => sum + (i.qty || 0), 0), 0);
    const avgCheckUSD = totalOrders > 0 ? totalSumUSD / totalOrders : 0;
    
    const prepayments = { USD: 0, EUR: 0, UAH: 0 };
    orders.forEach(o => {
        if (o.payment) {
            const curr = o.payment.originalCurrency || 'USD';
            const amt = Number(o.payment.originalAmount) || 0;
            if (prepayments[curr] !== undefined) prepayments[curr] += amt;
            else prepayments[curr] = amt;
        }
    });
    return { totalOrders, totalSumUSD, totalPairs, prepayments, avgCheckUSD };
  }, [orders]);

  const totalPrepaymentInMain = useMemo(() => {
      const rates = settings?.exchangeRates || { usd: 1, eur: 1 };
      const usdFromUSD = stats.prepayments.USD;
      const usdFromEUR = stats.prepayments.EUR * (rates.eur / rates.usd);
      const usdFromUAH = stats.prepayments.UAH / rates.usd;
      const totalUSD = usdFromUSD + usdFromEUR + usdFromUAH;
      return convertPrice(totalUSD, mainCurrency, settings.exchangeRates);
  }, [stats.prepayments, mainCurrency, settings]);

  const displayCardValue = (value, type = 'number') => {
    if (showStats) {
      if (type === 'money') return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mainCurrency}`;
      return Math.round(value).toLocaleString();
    }
    return <span className="emoji-card">{type === 'money' ? '💰' : '🤫'}</span>;
  };

  const displayTableValue = (value, type = 'number') => {
    if (showStats) {
      if (type === 'money') return `${convertPrice(value, mainCurrency, settings.exchangeRates)} ${mainCurrency}`;
      return Math.round(value).toLocaleString();
    }
    return <span className="emoji-table">{type === 'money' ? '💰' : '🤫'}</span>;
  };

  const recentOrders = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  return (
    <div className="page-container">
      <div className="page-header-card">
         <div className="page-header-group"><h1 className="text-h1">Главная</h1><p className="text-subtitle">Сегодня {new Date().toLocaleDateString()}</p></div>
         <div className="page-header-actions">
             <div className="stats-control">
                <span className="stats-label">Статистика</span>
                <div className="toggle-wrapper">
                    <button onClick={() => setShowStats(true)} className={`toggle-btn ${showStats ? 'toggle-btn-active' : 'toggle-btn-inactive'}`}><Eye/> Показать</button>
                    <button onClick={() => setShowStats(false)} className={`toggle-btn ${!showStats ? 'toggle-btn-active' : 'toggle-btn-inactive'}`}><EyeOff/> Скрыть</button>
                </div>
             </div>
             <Button onClick={() => setActiveTab('newOrder')} variant="success" size="md" icon={Plus}>Новый заказ</Button>
         </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
            <div className="stat-header st-neutral"><ShoppingBag className="icon-dashboard"/> Всего заказов</div>
            <div className="stat-val-xl">{displayCardValue(stats.totalOrders, 'number')}</div>
            <div className="bg-st-neutral"><ShoppingBag className="icon-fluid"/></div>
        </div>
        <div className="stat-card">
            <div className="stat-header st-indigo"><Footprints className="icon-dashboard"/> Продано пар</div>
            <div className="stat-val-xl">{displayCardValue(stats.totalPairs, 'number')}</div>
            <div className="bg-st-indigo"><Footprints className="icon-fluid"/></div>
        </div>
        <div className="stat-card">
            <div className="stat-header st-green"><Wallet className="icon-dashboard"/> Общая выручка</div>
            <div className="z-10">
                <div className="stat-val-lg">{showStats ? `${convertPrice(stats.totalSumUSD, mainCurrency, settings.exchangeRates)} ${mainCurrency}` : <span className="emoji-card">💰</span>}</div>
                {showStats && <div className="stat-subtext">Ср. чек: {convertPrice(stats.avgCheckUSD, mainCurrency, settings.exchangeRates)} {mainCurrency}</div>}
            </div>
            <div className="bg-st-green"><Wallet className="icon-fluid"/></div>
        </div>
        <div className="stat-card">
            <div className="stat-header st-blue"><CreditCard className="icon-dashboard"/> Предоплата</div>
            <div className="z-10">
                <div className="stat-val-md">{displayCardValue(totalPrepaymentInMain, 'money')}</div>
                {showStats && (
                    <div className="stat-code-group">
                        {stats.prepayments.USD > 0 && <span>{stats.prepayments.USD} USD</span>}
                        {stats.prepayments.EUR > 0 && <span>{stats.prepayments.EUR} EUR</span>}
                        {stats.prepayments.UAH > 0 && <span>{stats.prepayments.UAH} UAH</span>}
                    </div>
                )}
            </div>
            <div className="bg-st-blue"><CreditCard className="icon-fluid"/></div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header"><h3 className="section-title-clean">Последние заказы</h3><button onClick={() => setActiveTab('history')} className="link-action">Все заказы <ArrowRight/></button></div>
        <div className="table-scroll-area">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-base col-id">ID</th>
                <th className="th-base col-date">Дата</th>
                <th className="th-base">Клиент</th>
                <th className="th-base col-phone">Телефон</th>
                <th className="th-base col-stat">Пар</th>
                <th className="th-base col-money">Сумма</th>
                <th className="th-base col-action"></th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o => {
                const client = clients.find(c => c.id === o.clientId);
                return (
                  <tr key={o.id} className="tr-row">
                    <td className="td-id">#{o.orderId || o.id}</td>
                    <td className="td-date">{new Date(o.date).toLocaleDateString()}</td>
                    <td className="td-title">{client?.name || 'Удален'}</td>
                    <td className="td-phone">{client?.phone || '-'}</td>
                    <td className="td-center">
                        {showStats ? <span className="badge badge-neutral">{o.items.reduce((a,i)=>a+i.qty,0)}</span> : displayTableValue(0, 'number')}
                    </td>
                    <td className="td-money">{displayTableValue(o.total, 'money')}</td>
                    <td className="td-actions">
                        <div className="actions-group">
                            <button onClick={() => handleEdit(o)} className="btn-action-edit" title="Редактировать"><Edit/></button>
                            {/* Передаем ВЕСЬ объект заказа */}
                            <button onClick={() => openDeleteModal(o)} className="btn-action-delete" title="Удалить"><Trash2/></button>
                        </div>
                    </td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 && <tr><td colSpan="7" className="td-empty">Нет заказов</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- МОДАЛЬНОЕ ОКНО УДАЛЕНИЯ --- */}
      {isDeleteModalOpen && orderToDelete && (
        <div className="modal-overlay">
          <div className="modal-wrapper">
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <AlertTriangle className="text-red-500 w-5 h-5" /> 
                Удалить заказ?
              </h3>
              <button onClick={closeDeleteModal} className="modal-close"><X/></button>
            </div>
            
            <div className="modal-body">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🗑️</div>
                <p className="text-gray-800 font-bold text-lg">Заказ #{orderToDelete.orderId || orderToDelete.id}</p>
                {/* ПОКАЗЫВАЕМ ИМЯ КЛИЕНТА */}
                <p className="text-gray-500 text-sm">
                  Клиент: {clients.find(c => c.id === orderToDelete.clientId)?.name || 'Неизвестный'}
                </p>
              </div>
              <p className="text-gray-600 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100">
                Это действие необратимо. Заказ и вся информация о нем будут удалены.
              </p>
            </div>

            <div className="modal-footer">
              <button onClick={closeDeleteModal} className="btn btn-secondary justify-center">Отмена</button>
              <button onClick={confirmDelete} className="btn btn-danger justify-center">Удалить</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default DashboardPage;