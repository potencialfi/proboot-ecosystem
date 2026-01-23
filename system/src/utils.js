export const normalizePhone = (phone) => String(phone).replace(/\D/g, '');

export const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  let clean = digits;
  if (digits.length === 10 && digits.startsWith('0')) clean = '38' + digits;
  if (clean.length === 12 && clean.startsWith('380')) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10, 12)}`;
  }
  return value; 
};

export const getNoun = (number, one, two, five) => {
  let n = Math.abs(number); n %= 100;
  if (n >= 5 && n <= 20) return five;
  n %= 10;
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return two;
  return five;
};

export const convertPrice = (priceInBase, targetCurrency, rates) => {
  const val = parseFloat(priceInBase);
  if (isNaN(val)) return '0.00';
  const currency = targetCurrency ? targetCurrency.toUpperCase() : 'USD';
  if (!rates) return val.toFixed(2);

  const usdRate = Number(rates.usd) || 0;
  const eurRate = Number(rates.eur) || 0;

  if (currency === 'USD') return val.toFixed(2);
  if (currency === 'UAH') return (val * usdRate).toFixed(2);
  if (currency === 'EUR') {
      if (eurRate === 0) return '0.00';
      return ((val * usdRate) / eurRate).toFixed(2);
  }
  return val.toFixed(2);
};

export const convertToUSD = (amount, currency, rates) => {
  const val = parseFloat(amount);
  if (isNaN(val)) return 0;
  const code = currency ? currency.toUpperCase() : 'USD';
  const usdRate = Number(rates?.usd) || 1;
  const eurRate = Number(rates?.eur) || 1;

  if (code === 'USD') return val;
  if (code === 'UAH') return val / usdRate;
  if (code === 'EUR') return (val * eurRate) / usdRate;
  return val;
};

export const CURRENCY_CODES = { USD: 'USD', EUR: 'EUR', UAH: 'UAH' };

export async function ensureXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Failed to load XLSX library"));
    document.head.appendChild(script);
  });
}

export async function handleExportExcel(data, filename) {
  try {
    const XLSX = await ensureXLSX();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch (e) { console.error(e); }
}

export async function exportSingleOrderXLSX(order, client, settings) {
    try {
        const XLSX = await ensureXLSX();
        const mainCurrency = settings?.mainCurrency || 'USD';
        const brandName = settings?.brandName || 'SHOE EXPO';
        const brandPhones = settings?.brandPhones?.join(', ') || '';
        const rates = settings?.exchangeRates;

        const items = order.items || [];
        const grossTotalUSD = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const totalPairDiscountUSD = items.reduce((acc, item) => acc + ((item.discountPerPair || 0) * item.qty), 0);
        const lumpDiscountUSD = parseFloat(order.lumpDiscount) || 0;
        const totalDiscountUSD = totalPairDiscountUSD + lumpDiscountUSD;
        const netTotalUSD = Math.max(0, grossTotalUSD - totalDiscountUSD);

        const payment = order.payment || {};
        const prepaymentOriginal = payment.originalAmount || 0;
        const prepaymentCurrency = payment.originalCurrency || mainCurrency;
        let prepaymentInUSD = payment.prepaymentInUSD;
        if (prepaymentInUSD === undefined && prepaymentOriginal > 0) {
            if (prepaymentCurrency === 'USD') prepaymentInUSD = prepaymentOriginal; else prepaymentInUSD = 0;
        }
        const remainingUSD = Math.max(0, netTotalUSD - (prepaymentInUSD || 0));

        const rows = [
            [brandName, "", "", "", `Заказ №${order.orderId || order.id}`],
            [brandPhones, "", "", "", new Date(order.date).toLocaleDateString()],
            [], ["КЛИЕНТ", "", "", "", "ДЕТАЛИ"],
            [client.name, "", "", "", "Позиций:", items.length],
            [client.city, "", "", "", "Всего пар:", items.reduce((a,b)=>a+b.qty,0)],
            [client.phone],
            [],
            [`Модель / Цвет`, `Размеры`, `Кол-во`, `Цена (${mainCurrency})`, `Сумма (${mainCurrency})`],
        ];

        items.forEach(item => {
            const sizesStr = item.sizes ? Object.entries(item.sizes).filter(([_, q]) => q > 0).map(([s, q]) => `${s}(${q})`).join(', ') : item.note;
            const price = convertPrice(item.price, mainCurrency, rates);
            const total = convertPrice(item.price * item.qty, mainCurrency, rates);
            rows.push([`${item.sku} / ${item.color}`, sizesStr, item.qty, price, total]);
        });

        rows.push([]);
        const grossVal = convertPrice(grossTotalUSD, mainCurrency, rates);
        const discountVal = convertPrice(totalDiscountUSD, mainCurrency, rates);
        const remainingVal = convertPrice(remainingUSD, mainCurrency, rates);

        if (totalDiscountUSD > 0 || prepaymentOriginal > 0) rows.push(["", "", "", "Сумма:", `${grossVal} ${mainCurrency}`]);
        if (totalDiscountUSD > 0) rows.push(["", "", "", "Скидка:", `-${discountVal} ${mainCurrency}`]);
        if (prepaymentOriginal > 0) {
             rows.push(["", "", "", "Оплачено:", `${prepaymentOriginal} ${prepaymentCurrency}`]);
             rows.push(["", "", "", "Остаток:", `${remainingVal} ${mainCurrency}`]);
        } else {
             rows.push(["", "", "", "ИТОГО:", `${remainingVal} ${mainCurrency}`]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:30}, {wch:40}, {wch:10}, {wch:15}, {wch:20}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Order");
        XLSX.writeFile(wb, `Order_${order.orderId || order.id}.xlsx`);
    } catch (e) { console.error("Excel export error:", e); }
}