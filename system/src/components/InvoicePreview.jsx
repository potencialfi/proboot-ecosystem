import React from 'react';
import { Globe } from 'lucide-react';
import { IMG_URL } from '../api';
import { convertPrice, formatPhoneNumber } from '../utils';

const InvoicePreview = ({ order, settings }) => {
    if (!order) return null;

    const mainCurrency = settings?.mainCurrency || 'USD';
    const brandName = settings?.brandName || 'SHOE EXPO';
    const brandLogo = settings?.brandLogo;
    const brandPhones = settings?.brandPhones || [];
    const exchangeRates = settings?.exchangeRates || { usd: 1, eur: 1 };

    const dateObj = new Date(order.date || Date.now());
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Форматування номера замовлення
    const displayId = order.orderId ? String(order.orderId) : (order.id ? String(order.id) : 'Новий');

    // Отримуємо ім'я клієнта коректно
    const clientName = order.clientName || order.client?.name || order.selectedClient?.name || 'Не вказаний';
    const clientCity = order.clientCity || order.client?.city || order.selectedClient?.city || '';
    const clientPhone = order.clientPhone || order.client?.phone || order.selectedClient?.phone || '';

    // --- РОЗРАХУНКИ ---
    const items = order.items || [];
    
    const grossTotalUSD = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalPairDiscountUSD = items.reduce((acc, item) => acc + ((item.discountPerPair || 0) * item.qty), 0);
    const lumpDiscountUSD = parseFloat(order.lumpDiscount) || 0;
    const totalDiscountUSD = totalPairDiscountUSD + lumpDiscountUSD;
    
    const netTotalUSD = Math.max(0, grossTotalUSD - totalDiscountUSD);

    const payment = order.payment || {};
    const prepaymentOriginal = payment.originalAmount || 0;
    const prepaymentOriginalCurrency = payment.originalCurrency || mainCurrency;
    
    let prepaymentInUSD = payment.prepaymentInUSD;
    if (prepaymentInUSD === undefined && prepaymentOriginal > 0) {
        if (prepaymentOriginalCurrency === 'USD') prepaymentInUSD = prepaymentOriginal;
        else prepaymentInUSD = 0; 
    }
    
    const remainingUSD = Math.max(0, netTotalUSD - (prepaymentInUSD || 0));

    const hasDiscount = totalDiscountUSD > 0;
    const hasPrepayment = prepaymentOriginal > 0;
    const showSubtotal = hasDiscount || hasPrepayment;

    const formatSizes = (sizes) => {
        if (!sizes) return '';
        if (typeof sizes === 'string') return sizes;
        return Object.entries(sizes)
            .filter(([_, q]) => q > 0)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([s, q]) => `${s}(${q})`)
            .join(', ');
    };

    return (
        <div className="bg-white max-w-[210mm] min-h-[297mm] mx-auto p-8 shadow-lg print:shadow-none print:m-0 print:w-full print:h-auto print:min-h-0 flex flex-col justify-between">
            
            <div>
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                    <div>
                        {brandLogo ? (
                            <img src={`${IMG_URL}/${brandLogo}`} alt={brandName} className="h-10 object-contain mb-3" onError={(e) => e.target.style.display = 'none'} />
                        ) : (
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2 uppercase">{brandName}</h1>
                        )}
                        <div className="space-y-0.5 text-sm">
                            {brandPhones.map((phone, idx) => (
                                <p key={idx} className="text-gray-600 font-medium">{formatPhoneNumber(phone)}</p>
                            ))}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-gray-800 mb-1">Замовлення №{displayId}</div>
                        <div className="text-sm text-gray-500">{dateStr} {timeStr}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                    <div>
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-1">Клієнт</h3>
                        <div className="font-bold text-base text-gray-900 leading-tight">{clientName}</div>
                        <div className="text-gray-600 leading-tight">{clientCity}</div>
                        <div className="text-gray-600 font-mono mt-0.5">{formatPhoneNumber(clientPhone)}</div>
                    </div>
                    <div className="text-right">
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-1">Деталі</h3>
                        <div className="flex justify-end gap-4 border-b border-gray-100 pb-0.5 mb-0.5">
                            <span className="text-gray-500">Позицій:</span>
                            <span className="font-bold">{items.length}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="text-gray-500">Всього пар:</span>
                            <span className="font-bold">{items.reduce((a,b)=>a+b.qty,0)}</span>
                        </div>
                    </div>
                </div>

                <table className="w-full text-left text-xs mb-6">
                    <thead>
                        <tr className="border-b-2 border-gray-800 text-gray-600 uppercase tracking-wider">
                            <th className="py-2 font-bold w-[25%]">Модель / Колір</th>
                            <th className="py-2 font-bold w-[45%]">Розміри</th>
                            <th className="py-2 text-center font-bold">Кількість</th>
                            <th className="py-2 text-right font-bold">Ціна</th>
                            <th className="py-2 text-right font-bold">Сума</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="py-2 align-top pr-2">
                                    <div className="font-bold text-gray-900 leading-tight">
                                        {item.sku}<span className="font-normal text-gray-500"> / {item.color}</span>
                                    </div>
                                    {item.discountPerPair > 0 && <div className="text-[10px] text-green-600 mt-0.5">Знижка: -{convertPrice(item.discountPerPair, mainCurrency, exchangeRates)} {mainCurrency}/пара</div>}
                                </td>
                                <td className="py-2 align-top text-gray-600 leading-snug pr-2">
                                    {item.sizes ? formatSizes(item.sizes) : item.note}
                                </td>
                                <td className="py-2 align-top text-center font-medium">{item.qty}</td>
                                <td className="py-2 align-top text-right text-gray-600">
                                    {convertPrice(item.price, mainCurrency, exchangeRates)}
                                </td>
                                <td className="py-2 align-top text-right font-bold text-gray-900">
                                    {convertPrice(item.price * item.qty, mainCurrency, exchangeRates)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* БЛОК ПІДСУМКІВ */}
                <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-100 text-sm">
                    
                    {/* ЛІВА ЧАСТИНА: В один рядок */}
                    <div className="flex flex-wrap gap-6 items-center text-gray-600">
                        {/* Сума */}
                        {showSubtotal && (
                            <div className="flex gap-2 items-center">
                                <span className="text-gray-400 font-medium">Сума:</span>
                                <span className="text-gray-900 font-bold">{convertPrice(grossTotalUSD, mainCurrency, exchangeRates)} {mainCurrency}</span>
                            </div>
                        )}
                        
                        {/* Знижка */}
                        {hasDiscount && (
                            <div className="flex gap-2 items-center text-green-600">
                                <span className="font-medium">Знижка:</span>
                                <span className="font-bold">-{convertPrice(totalDiscountUSD, mainCurrency, exchangeRates)} {mainCurrency}</span>
                            </div>
                        )}

                        {/* Оплачено */}
                        {hasPrepayment && (
                            <div className="flex gap-2 items-center bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                <span className="text-gray-500 font-bold text-xs uppercase tracking-wide">Оплачено:</span>
                                <span className="font-bold text-gray-800">{prepaymentOriginal} {prepaymentOriginalCurrency}</span>
                            </div>
                        )}
                    </div>

                    {/* ПРАВА ЧАСТИНА: ПІДСУМОК/ЗАЛИШОК */}
                    <div className="text-right pl-4">
                        <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">
                            {hasPrepayment ? 'Залишок' : 'Разом'}
                        </div>
                        <div className="text-2xl font-black text-blue-600 leading-none whitespace-nowrap">
                            {convertPrice(remainingUSD, mainCurrency, exchangeRates)} {mainCurrency}
                        </div>
                    </div>

                </div>

                {/* Підписи */}
                {hasPrepayment && (
                    <div className="grid grid-cols-2 gap-16 mt-16 mb-8">
                        <div><div className="border-b border-gray-400 mb-1"></div><div className="text-center text-[10px] text-gray-400 uppercase tracking-wide">Представник бренду</div></div>
                        <div><div className="border-b border-gray-400 mb-1"></div><div className="text-center text-[10px] text-gray-400 uppercase tracking-wide">Клієнт</div></div>
                    </div>
                )}
            </div>
            
            <div className="mt-auto">
                <div className="text-center text-gray-800 font-medium text-sm mb-4">Дякуємо за ваше замовлення!</div>
                <div className="pt-4 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-400">
                    <div className="flex items-center gap-2"><span>Створено в</span><img src={`${IMG_URL}/proboot-invoice.png`} alt="ProBoot" className="h-4 opacity-70" onError={(e) => e.target.style.display = 'none'} /></div>
                    <div className="flex items-center gap-2"><Globe size={12}/> <span>proboot.app</span></div>
                </div>
            </div>
        </div>
    );
};

export default InvoicePreview;