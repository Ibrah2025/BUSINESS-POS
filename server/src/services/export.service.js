const ExcelJS = require('exceljs');
const db = require('../config/database');

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function autoFitColumns(sheet) {
  sheet.columns.forEach((col) => {
    let maxLen = col.header ? col.header.length : 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 50);
  });
}

const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
  alignment: { horizontal: 'center' },
};

function styleHeaderRow(sheet) {
  const row = sheet.getRow(1);
  row.eachCell((cell) => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
    cell.alignment = headerStyle.alignment;
  });
}

// ───────────────────────────────────────────────
// Data fetching
// ───────────────────────────────────────────────

async function fetchExportData(businessId, query) {
  const { startDate, endDate } = query;

  const [business, products, sales, expenses, bankAccounts, credits, salePayments, saleItems] =
    await Promise.all([
      db('businesses').where({ id: businessId }).first(),
      db('products').where({ business_id: businessId, is_active: true }).orderBy('name'),
      (() => {
        let q = db('sales').where({ business_id: businessId, status: 'completed' });
        if (startDate) q = q.where('created_at', '>=', startDate);
        if (endDate) q = q.where('created_at', '<=', endDate);
        return q.orderBy('created_at', 'desc');
      })(),
      (() => {
        let q = db('expenses').where({ business_id: businessId });
        if (startDate) q = q.where('date', '>=', startDate);
        if (endDate) q = q.where('date', '<=', endDate);
        return q.orderBy('date', 'desc');
      })(),
      db('bank_accounts').where({ business_id: businessId, is_active: true }),
      db('credits').where({ business_id: businessId }).whereIn('status', ['pending', 'partial']),
      (() => {
        let q = db('sale_payments')
          .join('sales', 'sales.id', 'sale_payments.sale_id')
          .where({ 'sales.business_id': businessId, 'sales.status': 'completed' });
        if (startDate) q = q.where('sales.created_at', '>=', startDate);
        if (endDate) q = q.where('sales.created_at', '<=', endDate);
        return q.select('sale_payments.*');
      })(),
      (() => {
        let q = db('sale_items')
          .join('sales', 'sales.id', 'sale_items.sale_id')
          .where({ 'sales.business_id': businessId, 'sales.status': 'completed' });
        if (startDate) q = q.where('sales.created_at', '>=', startDate);
        if (endDate) q = q.where('sales.created_at', '<=', endDate);
        return q.select('sale_items.*');
      })(),
    ]);

  // Get the latest cash balance
  const lastCashTx = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();

  const cashBalance = lastCashTx ? Number(lastCashTx.balance_after) : 0;

  // Aggregate attendant names
  const attendantIds = [...new Set(sales.filter((s) => s.attendant_id).map((s) => s.attendant_id))];
  let attendantMap = {};
  if (attendantIds.length > 0) {
    const users = await db('users').whereIn('id', attendantIds).select('id', 'name');
    attendantMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  }

  return {
    business,
    products,
    sales,
    expenses,
    bankAccounts,
    credits,
    salePayments,
    saleItems,
    cashBalance,
    attendantMap,
  };
}

// ───────────────────────────────────────────────
// Excel export
// ───────────────────────────────────────────────

async function exportExcel(businessId, query = {}) {
  const { startDate, endDate } = query;
  const data = await fetchExportData(businessId, query);
  const {
    business,
    products,
    sales,
    expenses,
    bankAccounts,
    credits,
    salePayments,
    saleItems,
    cashBalance,
    attendantMap,
  } = data;

  const currency = business?.currency || '₦';
  const totalSales = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalProfit = sales.reduce((s, r) => s + Number(r.profit), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const inventoryValue = products.reduce((s, p) => s + Number(p.buy_price) * Number(p.quantity), 0);
  const customerDebts = credits
    .filter((c) => c.type === 'customer')
    .reduce((s, c) => s + Number(c.balance_remaining), 0);
  const supplierDebts = credits
    .filter((c) => c.type === 'supplier')
    .reduce((s, c) => s + Number(c.balance_remaining), 0);
  const bankTotal = bankAccounts.reduce((s, a) => s + Number(a.balance), 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BizPOS';
  workbook.created = new Date();

  // ── Sheet 1: Overview ──
  const overview = workbook.addWorksheet('Overview');
  overview.mergeCells('A1:D1');
  overview.getCell('A1').value = business?.name || 'Business';
  overview.getCell('A1').font = { bold: true, size: 18 };
  overview.getCell('A3').value = 'Export Date:';
  overview.getCell('B3').value = fmtDate(new Date());
  overview.getCell('A4').value = 'Period:';
  overview.getCell('B4').value =
    startDate && endDate ? `${fmtDate(startDate)} – ${fmtDate(endDate)}` : 'All time';
  overview.getCell('A3').font = { bold: true };
  overview.getCell('A4').font = { bold: true };

  const summaryStart = 6;
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Sales', `${currency} ${fmtCurrency(totalSales)}`],
    ['Total Profit', `${currency} ${fmtCurrency(totalProfit)}`],
    ['Total Expenses', `${currency} ${fmtCurrency(totalExpenses)}`],
    ['Net Position (Profit - Expenses)', `${currency} ${fmtCurrency(totalProfit - totalExpenses)}`],
    ['Number of Transactions', sales.length],
    ['Number of Products', products.length],
  ];
  summaryData.forEach((row, i) => {
    overview.getRow(summaryStart + i).values = row;
  });
  overview.getRow(summaryStart).eachCell((cell) => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
  });
  overview.getColumn(1).width = 35;
  overview.getColumn(2).width = 30;

  // ── Sheet 2: Inventory ──
  const inv = workbook.addWorksheet('Inventory');
  inv.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Barcode', key: 'barcode', width: 18 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Buy Price', key: 'buy_price', width: 14 },
    { header: 'Sell Price', key: 'sell_price', width: 14 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Qty Sold', key: 'quantity_sold', width: 12 },
    { header: 'Stock Value', key: 'stock_value', width: 16 },
  ];
  products.forEach((p) => {
    inv.addRow({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category || '',
      unit: p.unit,
      buy_price: Number(p.buy_price),
      sell_price: Number(p.sell_price),
      quantity: Number(p.quantity),
      quantity_sold: Number(p.quantity_sold),
      stock_value: Number(p.buy_price) * Number(p.quantity),
    });
  });
  styleHeaderRow(inv);
  autoFitColumns(inv);

  // ── Sheet 3: Sales/Transactions ──
  const txn = workbook.addWorksheet('Transactions');

  // Build a map of sale_id -> items description and payment methods
  const saleItemsMap = {};
  saleItems.forEach((si) => {
    if (!saleItemsMap[si.sale_id]) saleItemsMap[si.sale_id] = [];
    saleItemsMap[si.sale_id].push(`${si.product_name} x${si.quantity}`);
  });
  const salePaymentMap = {};
  salePayments.forEach((sp) => {
    if (!salePaymentMap[sp.sale_id]) salePaymentMap[sp.sale_id] = [];
    salePaymentMap[sp.sale_id].push(sp.method);
  });

  txn.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Items', key: 'items', width: 40 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Profit', key: 'profit', width: 14 },
    { header: 'Payment Method', key: 'payment', width: 18 },
    { header: 'Attendant', key: 'attendant', width: 18 },
    { header: 'Customer', key: 'customer', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  sales.forEach((s) => {
    txn.addRow({
      date: fmtDate(s.created_at),
      items: (saleItemsMap[s.id] || []).join(', '),
      total: Number(s.total_amount),
      profit: Number(s.profit),
      payment: [...new Set(salePaymentMap[s.id] || [])].join(', '),
      attendant: attendantMap[s.attendant_id] || '',
      customer: s.customer_name || '',
      status: s.status,
    });
  });
  styleHeaderRow(txn);
  autoFitColumns(txn);

  // ── Sheet 4: Expenses ──
  const exp = workbook.addWorksheet('Expenses');
  exp.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Payment Method', key: 'payment_method', width: 18 },
  ];
  expenses.forEach((e) => {
    exp.addRow({
      date: fmtDate(e.date),
      category: e.category,
      description: e.description || '',
      amount: Number(e.amount),
      payment_method: e.payment_method,
    });
  });
  styleHeaderRow(exp);
  autoFitColumns(exp);

  // ── Sheet 5: Summary ──
  const sum = workbook.addWorksheet('Summary');
  const rows = [
    ['ASSETS', ''],
    ['Physical Cash', `${currency} ${fmtCurrency(cashBalance)}`],
  ];
  bankAccounts.forEach((a) => {
    rows.push([`Bank: ${a.bank_name} (${a.account_name || a.account_number || ''})`, `${currency} ${fmtCurrency(a.balance)}`]);
  });
  rows.push(
    ['Total Bank Balances', `${currency} ${fmtCurrency(bankTotal)}`],
    ['Inventory Value (at cost)', `${currency} ${fmtCurrency(inventoryValue)}`],
    ['Customer Debts (owed to you)', `${currency} ${fmtCurrency(customerDebts)}`],
    ['', ''],
    ['LIABILITIES', ''],
    ['Supplier Debts (you owe)', `${currency} ${fmtCurrency(supplierDebts)}`],
    ['Total Expenses (period)', `${currency} ${fmtCurrency(totalExpenses)}`],
    ['', ''],
    ['NET POSITION', ''],
    ['Total Assets', `${currency} ${fmtCurrency(cashBalance + bankTotal + inventoryValue + customerDebts)}`],
    ['Total Liabilities', `${currency} ${fmtCurrency(supplierDebts + totalExpenses)}`],
    [
      'Net Position',
      `${currency} ${fmtCurrency(cashBalance + bankTotal + inventoryValue + customerDebts - supplierDebts - totalExpenses)}`,
    ],
    ['', ''],
    ['Realized Profit (period)', `${currency} ${fmtCurrency(totalProfit)}`],
  );

  rows.forEach((r, i) => {
    const row = sum.getRow(i + 1);
    row.values = r;
    if (['ASSETS', 'LIABILITIES', 'NET POSITION'].includes(r[0])) {
      row.getCell(1).font = { bold: true, size: 13 };
    }
    if (r[0] === 'Net Position' || r[0] === 'Realized Profit (period)') {
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
    }
  });
  sum.getColumn(1).width = 40;
  sum.getColumn(2).width = 30;

  return workbook.xlsx.writeBuffer();
}

// ───────────────────────────────────────────────
// PDF report (HTML for browser printing)
// ───────────────────────────────────────────────

async function exportPdf(businessId, query = {}) {
  const { startDate, endDate } = query;
  const data = await fetchExportData(businessId, query);
  const {
    business,
    products,
    sales,
    expenses,
    bankAccounts,
    credits,
    salePayments,
    saleItems,
    cashBalance,
  } = data;

  const currency = business?.currency || '₦';
  const totalSales = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalProfit = sales.reduce((s, r) => s + Number(r.profit), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const inventoryValue = products.reduce((s, p) => s + Number(p.buy_price) * Number(p.quantity), 0);
  const bankTotal = bankAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const customerDebts = credits
    .filter((c) => c.type === 'customer')
    .reduce((s, c) => s + Number(c.balance_remaining), 0);
  const supplierDebts = credits
    .filter((c) => c.type === 'supplier')
    .reduce((s, c) => s + Number(c.balance_remaining), 0);

  // Payment method breakdown
  const paymentBreakdown = {};
  salePayments.forEach((sp) => {
    paymentBreakdown[sp.method] = (paymentBreakdown[sp.method] || 0) + Number(sp.amount);
  });

  // Top products by quantity sold
  const productSales = {};
  saleItems.forEach((si) => {
    const key = si.product_name;
    if (!productSales[key]) productSales[key] = { name: key, qty: 0, revenue: 0 };
    productSales[key].qty += Number(si.quantity);
    productSales[key].revenue += Number(si.unit_price) * Number(si.quantity);
  });
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Expense by category
  const expByCat = {};
  expenses.forEach((e) => {
    expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount);
  });

  const periodLabel =
    startDate && endDate ? `${fmtDate(startDate)} - ${fmtDate(endDate)}` : 'All time';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${business?.name || 'Business'} - Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
  h2 { font-size: 16px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
  th { background: #2563eb; color: #fff; text-align: left; padding: 8px 10px; }
  td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .summary-card { background: #f0f4ff; border-radius: 8px; padding: 14px; }
  .summary-card .label { font-size: 12px; color: #666; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #1a1a1a; }
  .text-right { text-align: right; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()" style="float:right;padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save PDF</button>
<h1>${business?.name || 'Business'}</h1>
<p class="subtitle">Report for ${periodLabel} &middot; Generated ${fmtDate(new Date())}</p>

<div class="summary-grid">
  <div class="summary-card"><div class="label">Total Sales</div><div class="value">${currency} ${fmtCurrency(totalSales)}</div></div>
  <div class="summary-card"><div class="label">Total Profit</div><div class="value">${currency} ${fmtCurrency(totalProfit)}</div></div>
  <div class="summary-card"><div class="label">Total Expenses</div><div class="value">${currency} ${fmtCurrency(totalExpenses)}</div></div>
  <div class="summary-card"><div class="label">Net (Profit - Expenses)</div><div class="value">${currency} ${fmtCurrency(totalProfit - totalExpenses)}</div></div>
</div>

<h2>Top Products</h2>
<table>
  <tr><th>Product</th><th class="text-right">Qty Sold</th><th class="text-right">Revenue</th></tr>
  ${topProducts.map((p) => `<tr><td>${p.name}</td><td class="text-right">${p.qty}</td><td class="text-right">${currency} ${fmtCurrency(p.revenue)}</td></tr>`).join('')}
</table>

<h2>Payment Method Breakdown</h2>
<table>
  <tr><th>Method</th><th class="text-right">Amount</th></tr>
  ${Object.entries(paymentBreakdown).map(([m, a]) => `<tr><td>${m}</td><td class="text-right">${currency} ${fmtCurrency(a)}</td></tr>`).join('')}
</table>

<h2>Expenses by Category</h2>
<table>
  <tr><th>Category</th><th class="text-right">Amount</th></tr>
  ${Object.entries(expByCat).map(([c, a]) => `<tr><td>${c}</td><td class="text-right">${currency} ${fmtCurrency(a)}</td></tr>`).join('')}
</table>

<h2>Financial Snapshot</h2>
<table>
  <tr><th>Item</th><th class="text-right">Amount</th></tr>
  <tr><td>Physical Cash</td><td class="text-right">${currency} ${fmtCurrency(cashBalance)}</td></tr>
  ${bankAccounts.map((a) => `<tr><td>Bank: ${a.bank_name}</td><td class="text-right">${currency} ${fmtCurrency(a.balance)}</td></tr>`).join('')}
  <tr><td>Inventory Value (at cost)</td><td class="text-right">${currency} ${fmtCurrency(inventoryValue)}</td></tr>
  <tr><td>Customer Debts</td><td class="text-right">${currency} ${fmtCurrency(customerDebts)}</td></tr>
  <tr><td>Supplier Debts</td><td class="text-right">${currency} ${fmtCurrency(supplierDebts)}</td></tr>
  <tr style="font-weight:bold;border-top:2px solid #333"><td>Net Position</td><td class="text-right">${currency} ${fmtCurrency(cashBalance + bankTotal + inventoryValue + customerDebts - supplierDebts)}</td></tr>
</table>

</body>
</html>`;

  return html;
}

// ───────────────────────────────────────────────
// Barcode labels (HTML for browser printing)
// ───────────────────────────────────────────────

// ── Code 128B SVG barcode generator (no dependencies) ──
function code128Svg(text, width = 200, height = 50) {
  const START_B = 104, STOP = 106;
  const PATTERNS = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11100101100','11100100110',
    '11101100100','11100110100','11100110010','11011011000','11011000110',
    '11000110110','10100011000','10001011000','10001000110','10110001000',
    '10001101000','10001100010','11010001000','11000101000','11000100010',
    '10110111000','10110001110','10001101110','10111011000','10111000110',
    '10001110110','11101110110','11010001110','11000101110','11011101000',
    '11011100010','11011101110','11101011000','11101000110','11100010110',
    '11101101000','11101100010','11100011010','11101111010','11001000010',
    '11110001010','10100110000','10100001100','10010110000','10010000110',
    '10000101100','10000100110','10110010000','10110000100','10011010000',
    '10011000010','10000110100','10000110010','11000010010','11001010000',
    '11110111010','11000010100','10001111010','10100111100','10010111100',
    '10010011110','10111100100','10011110100','10011110010','11110100100',
    '11110010100','11110010010','11011011110','11011110110','11110110110',
    '10101111000','10100011110','10001011110','10111101000','10111100010',
    '11110101000','11110100010','10111011110','10111101110','11101011110',
    '11110101110','11010000100','11010010000','11010011100','1100011101011',
  ];
  let codes = [START_B];
  let checksum = START_B;
  for (let i = 0; i < text.length; i++) {
    const val = text.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  let bits = '';
  codes.forEach((c) => { bits += PATTERNS[c]; });

  const barW = width / bits.length;
  let bars = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      bars += `<rect x="${(i * barW).toFixed(2)}" y="0" width="${barW.toFixed(2)}" height="${height}" fill="#000"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
}

async function generateBarcodeLabels(businessId, query = {}) {
  const productIds = query.productIds ? query.productIds.split(',') : [];

  const business = await db('businesses').where({ id: businessId }).first();
  const currency = business?.currency || '₦';

  const products = await db('products')
    .where({ business_id: businessId, is_active: true })
    .modify((qb) => {
      if (productIds.length > 0) {
        qb.whereIn('id', productIds);
      }
    })
    .whereNotNull('barcode')
    .orderBy('name');

  const copies = parseInt(query.copies, 10) || 1;
  const labels = [];
  products.forEach((p) => {
    for (let i = 0; i < copies; i++) {
      labels.push(p);
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Barcode Labels</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; padding: 10px; }
  .label-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .label {
    border: 1px dashed #ccc;
    padding: 6px;
    text-align: center;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .label-name {
    font-size: 10px;
    font-weight: bold;
    line-height: 1.2;
    max-height: 24px;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .label-barcode-img { margin-bottom: 1px; }
  .label-code {
    font-size: 9px;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
    color: #333;
  }
  .label-price {
    font-size: 12px;
    font-weight: bold;
    margin-top: 2px;
  }
  .no-print { margin-bottom: 16px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
    .label { border: 1px dashed #999; }
    @page { margin: 8mm; }
  }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print Labels</button>
  <span style="margin-left:12px;color:#666;font-size:13px;">${labels.length} label(s) for ${products.length} product(s)</span>
</div>
<div class="label-grid">
${labels
  .map(
    (p) => `  <div class="label">
    <div class="label-name">${p.name}</div>
    <div class="label-barcode-img">${code128Svg(p.barcode, 160, 40)}</div>
    <div class="label-code">${p.barcode}</div>
    <div class="label-price">${currency} ${fmtCurrency(p.sell_price)}</div>
  </div>`
  )
  .join('\n')}
</div>
</body>
</html>`;

  return html;
}

module.exports = {
  exportExcel,
  exportPdf,
  generateBarcodeLabels,
};
