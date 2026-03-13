/**
 * Telegram Bot Service for BizPOS
 * Bilingual: English + Hausa — auto-detects from business settings
 */

const db = require('../config/database');
const accountsService = require('./accounts.service');
const salesService = require('./sales.service');
const inventoryService = require('./inventory.service');

let bot = null;

const fmt = (n) => '₦' + (Number(n) || 0).toLocaleString('en-NG');

// ─── Translations ──────────────────────────────────────────────────────────

const T = {
  en: {
    welcome: '👋 <b>Welcome to BizPOS Bot!</b>\n\nLink your business:\n<code>/start 08012345678 1234</code>\n\n<i>Use your phone number and PIN from the app</i>',
    invalid_cred: '❌ Invalid phone or PIN.',
    linked: (name) => `✅ <b>Linked to: ${name}</b>\n\nChoose an option below:`,
    error_link: '❌ Error linking. Try again.',
    not_linked: '⚠️ Not linked yet.\nSend: <code>/start phone PIN</code>',
    what_todo: (name) => `👋 <b>${name || 'BizPOS'}</b>\n\nWhat would you like to do?`,
    unknown: (name) => `🤔 I didn't understand that.\n\n👋 <b>${name || 'BizPOS'}</b>\n\nWhat would you like to do?`,
    error_generic: '❌ Something went wrong. Try again.',
    // Menu buttons
    btn_today: '📊 Today',
    btn_banks: '🏦 Banks',
    btn_low: '⚠️ Low Stock',
    btn_stock: '📦 Stock Check',
    btn_price: '💰 Update Price',
    btn_bank_update: '🔄 Update Bank',
    btn_help: '❓ Help',
    btn_back: '◀️ Main Menu',
    // Today
    today_title: "📊 <b>Today's Summary</b>",
    transactions: '🧾  Transactions',
    total_sales: '💵  Total Sales',
    profit: '📈  Profit',
    cash: '💷  Cash',
    bank: '🏦  Bank',
    // Bank
    bal_title: '🏦 <b>Bank Balances</b>',
    bal_total: '💰  Total',
    bal_none: '🏦 No bank accounts yet.\nAdd one from the app first.',
    bal_hint: '<i>💡 Quick update: type bank name + amount\nExample: GT 160000</i>',
    bal_updated: (name, old, now) => `✅ <b>${name}</b> updated\n${fmt(old)} → <b>${fmt(now)}</b>`,
    bal_no_match: (s, banks) => `❌ No bank matching "<b>${s}</b>"\n\nYour banks: ${banks}`,
    // Low stock
    low_title: '📦 <b>Low Stock Alert</b>',
    low_ok: '✅ All stock levels OK!',
    left: 'left',
    // Stock
    stock_usage: '📦 Usage: <code>/stock Indomie</code>',
    stock_none: (s) => `❌ No product matching "<b>${s}</b>"`,
    stock_label: 'Stock',
    sell_label: 'Sell',
    buy_label: 'Buy',
    // Price
    price_usage: '💰 Usage: <code>/price Indomie 250</code>',
    price_updated: (name, old, now) => `✅ <b>${name}</b> price updated\n${fmt(old)} → <b>${fmt(now)}</b>`,
    // Prompts
    stock_prompt: '📦 <b>Stock Check</b>\n\nType product name:\n<code>/stock Indomie</code>',
    price_prompt: '💰 <b>Update Price</b>\n\nType product name + new price:\n<code>/price Indomie 250</code>',
    bank_prompt: '🏦 <b>Update Bank Balance</b>\n\nType bank name + new balance:\n<code>GT 160000</code>\n<code>Access 80000</code>',
    // Help
    help: (
      `📋 <b>BizPOS Bot Commands</b>\n━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📊 Sales</b>\n  /today — Today's summary\n\n` +
      `<b>🏦 Banking</b>\n  /bal — Bank balances\n  <code>GT 160000</code> — Update balance\n\n` +
      `<b>📦 Inventory</b>\n  /stock Indomie — Check stock\n  /price Indomie 250 — Update price\n  /low — Low stock\n\n` +
      `<b>🔧 Setup</b>\n  /menu — Main menu\n  /help — This message`
    ),
    error_fetch: (what) => `❌ Could not fetch ${what}.`,
  },
  ha: {
    welcome: '👋 <b>Barka da zuwa BizPOS Bot!</b>\n\nHaɗa kasuwancinka:\n<code>/start 08012345678 1234</code>\n\n<i>Yi amfani da lambar waya da PIN daga app ɗin</i>',
    invalid_cred: '❌ Lambar waya ko PIN ba daidai ba.',
    linked: (name) => `✅ <b>An haɗa da: ${name}</b>\n\nZaɓi abin da kake so:`,
    error_link: '❌ Kuskure wajen haɗawa. Sake gwadawa.',
    not_linked: '⚠️ Ba a haɗa ba tukuna.\nAika: <code>/start waya PIN</code>',
    what_todo: (name) => `👋 <b>${name || 'BizPOS'}</b>\n\nMe kake son yi?`,
    unknown: (name) => `🤔 Ban gane ba.\n\n👋 <b>${name || 'BizPOS'}</b>\n\nMe kake son yi?`,
    error_generic: '❌ Wani abu ya faru. Sake gwadawa.',
    // Menu buttons
    btn_today: '📊 Yau',
    btn_banks: '🏦 Bankuna',
    btn_low: '⚠️ Ƙarancin Kaya',
    btn_stock: '📦 Duba Kaya',
    btn_price: '💰 Canja Farashi',
    btn_bank_update: '🔄 Sabunta Banki',
    btn_help: '❓ Taimako',
    btn_back: '◀️ Babban Menu',
    // Today
    today_title: '📊 <b>Taƙaitaccen Yau</b>',
    transactions: '🧾  Sayayya',
    total_sales: '💵  Jimlar Tallace',
    profit: '📈  Riba',
    cash: '💷  Tsabar Kuɗi',
    bank: '🏦  Banki',
    // Bank
    bal_title: '🏦 <b>Ma\'aunin Bankuna</b>',
    bal_total: '💰  Jimla',
    bal_none: '🏦 Babu asusun banki tukuna.\nƘara ɗaya daga app ɗin.',
    bal_hint: '<i>💡 Sabunta: rubuta sunan banki da kuɗi\nMisali: GT 160000</i>',
    bal_updated: (name, old, now) => `✅ <b>${name}</b> an sabunta\n${fmt(old)} → <b>${fmt(now)}</b>`,
    bal_no_match: (s, banks) => `❌ Babu banki mai suna "<b>${s}</b>"\n\nBankunanka: ${banks}`,
    // Low stock
    low_title: '📦 <b>Ƙarancin Kaya</b>',
    low_ok: '✅ Duk kaya sun isa!',
    left: 'sauran',
    // Stock
    stock_usage: '📦 Yadda ake: <code>/stock Indomie</code>',
    stock_none: (s) => `❌ Babu kaya mai suna "<b>${s}</b>"`,
    stock_label: 'Adadi',
    sell_label: 'Sayarwa',
    buy_label: 'Saya',
    // Price
    price_usage: '💰 Yadda ake: <code>/price Indomie 250</code>',
    price_updated: (name, old, now) => `✅ <b>${name}</b> an canja farashi\n${fmt(old)} → <b>${fmt(now)}</b>`,
    // Prompts
    stock_prompt: '📦 <b>Duba Kaya</b>\n\nRubuta sunan kaya:\n<code>/stock Indomie</code>',
    price_prompt: '💰 <b>Canja Farashi</b>\n\nRubuta sunan kaya da sabon farashi:\n<code>/price Indomie 250</code>',
    bank_prompt: '🏦 <b>Sabunta Ma\'aunin Banki</b>\n\nRubuta sunan banki da sabon adadi:\n<code>GT 160000</code>\n<code>Access 80000</code>',
    // Help
    help: (
      `📋 <b>Umarni na BizPOS Bot</b>\n━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📊 Tallace</b>\n  /today — Taƙaitaccen yau\n\n` +
      `<b>🏦 Banki</b>\n  /bal — Ma'aunin bankuna\n  <code>GT 160000</code> — Sabunta kuɗi\n\n` +
      `<b>📦 Kayayyaki</b>\n  /stock Indomie — Duba kaya\n  /price Indomie 250 — Canja farashi\n  /low — Ƙarancin kaya\n\n` +
      `<b>🔧 Saiti</b>\n  /menu — Babban menu\n  /help — Wannan saƙo`
    ),
    error_fetch: (what) => `❌ Ba a iya samun ${what}.`,
  },
};

// ─── Language Helper ───────────────────────────────────────────────────────

async function getLang(businessId) {
  if (!businessId) return 'en';
  const settings = await db('settings').where({ business_id: businessId }).first();
  return (settings?.language === 'ha') ? 'ha' : 'en';
}

function t(lang) {
  return T[lang] || T.en;
}

function mainMenu(lang) {
  const l = t(lang);
  return {
    inline_keyboard: [
      [
        { text: l.btn_today, callback_data: 'today' },
        { text: l.btn_banks, callback_data: 'bal' },
        { text: l.btn_low, callback_data: 'low' },
      ],
      [
        { text: l.btn_stock, callback_data: 'stock_prompt' },
        { text: l.btn_price, callback_data: 'price_prompt' },
      ],
      [
        { text: l.btn_bank_update, callback_data: 'bank_prompt' },
      ],
      [
        { text: l.btn_help, callback_data: 'help' },
      ],
    ],
  };
}

function backBtn(lang) {
  return { inline_keyboard: [[{ text: t(lang).btn_back, callback_data: 'menu' }]] };
}

// ─── Chat-to-Business Linking ──────────────────────────────────────────────

async function linkChat(chatId, businessId, userName) {
  const existing = await db('telegram_links').where({ chat_id: String(chatId) }).first();
  if (existing) {
    await db('telegram_links').where({ chat_id: String(chatId) }).update({
      business_id: businessId, user_name: userName || null, updated_at: db.fn.now(),
    });
  } else {
    await db('telegram_links').insert({
      chat_id: String(chatId), business_id: businessId, user_name: userName || null,
    });
  }
}

async function getBusinessId(chatId) {
  const link = await db('telegram_links').where({ chat_id: String(chatId) }).first();
  return link?.business_id || null;
}

// ─── Response Builders ─────────────────────────────────────────────────────

async function buildToday(businessId, lang) {
  const l = t(lang);
  const s = await salesService.todaySummary(businessId);
  return (
    `${l.today_title}\n━━━━━━━━━━━━━━━━━\n` +
    `${l.transactions}:  <b>${s.transactionCount}</b>\n` +
    `${l.total_sales}:  <b>${fmt(s.totalSales)}</b>\n` +
    `${l.profit}:  <b>${fmt(s.totalProfit)}</b>\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `${l.cash}:  ${fmt(s.cashTotal)}\n` +
    `${l.bank}:  ${fmt(s.bankTotal)}`
  );
}

async function buildBal(businessId, lang) {
  const l = t(lang);
  const accounts = await accountsService.list(businessId);
  if (!accounts.length) return l.bal_none;
  let total = 0;
  const lines = accounts.map((a) => {
    total += Number(a.balance) || 0;
    return `  ${a.bankName}:  <b>${fmt(a.balance)}</b>`;
  });
  return (
    `${l.bal_title}\n━━━━━━━━━━━━━━━━━\n` +
    lines.join('\n') + '\n' +
    `━━━━━━━━━━━━━━━━━\n` +
    `${l.bal_total}:  <b>${fmt(total)}</b>\n\n` +
    l.bal_hint
  );
}

async function buildLow(businessId, lang) {
  const l = t(lang);
  const products = await inventoryService.getLowStock(businessId);
  if (!products.length) return l.low_ok;
  const lines = products.slice(0, 15).map((p) =>
    `  ⚠️ ${p.name}:  <b>${p.quantity}</b> ${l.left}`
  );
  return `${l.low_title}\n━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

// ─── Send Helpers ──────────────────────────────────────────────────────────

function send(chatId, text, keyboard) {
  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard || undefined,
  });
}

function editMsg(chatId, messageId, text, keyboard) {
  return bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    parse_mode: 'HTML', reply_markup: keyboard || undefined,
  }).catch(() => send(chatId, text, keyboard));
}

// ─── Callback Query Handler ────────────────────────────────────────────────

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;
  bot.answerCallbackQuery(query.id);

  const businessId = await getBusinessId(chatId);
  if (!businessId) return editMsg(chatId, msgId, T.en.not_linked);

  const lang = await getLang(businessId);
  const l = t(lang);
  const back = backBtn(lang);

  try {
    switch (data) {
      case 'menu': {
        const biz = await db('businesses').where({ id: businessId }).first();
        return editMsg(chatId, msgId, l.what_todo(biz?.name), mainMenu(lang));
      }
      case 'today':
        return editMsg(chatId, msgId, await buildToday(businessId, lang), back);
      case 'bal':
        return editMsg(chatId, msgId, await buildBal(businessId, lang), back);
      case 'low':
        return editMsg(chatId, msgId, await buildLow(businessId, lang), back);
      case 'help':
        return editMsg(chatId, msgId, l.help, back);
      case 'stock_prompt':
        return editMsg(chatId, msgId, l.stock_prompt, back);
      case 'price_prompt':
        return editMsg(chatId, msgId, l.price_prompt, back);
      case 'bank_prompt':
        return editMsg(chatId, msgId, l.bank_prompt, back);
      default:
        return editMsg(chatId, msgId, l.error_generic, back);
    }
  } catch (err) {
    console.error('Telegram callback error:', err.message);
    return editMsg(chatId, msgId, l.error_generic, back);
  }
}

// ─── Message Handler ───────────────────────────────────────────────────────

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;
  const lower = text.toLowerCase();

  // /start <phone> <pin>
  if (lower.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const phone = parts[1];
    const pin = parts[2];
    if (!phone || !pin) {
      return send(chatId, T.en.welcome);
    }
    try {
      const bcrypt = require('bcrypt');
      const user = await db('users').where({ phone, is_active: true }).first();
      if (!user) return send(chatId, T.en.invalid_cred);
      const valid = await bcrypt.compare(pin, user.pin_hash);
      if (!valid) return send(chatId, T.en.invalid_cred);
      const biz = await db('businesses').where({ id: user.business_id }).first();
      await linkChat(chatId, user.business_id, msg.from?.first_name);
      const lang = await getLang(user.business_id);
      const l = t(lang);
      return send(chatId, l.linked(biz?.name || 'Your Business'), mainMenu(lang));
    } catch (err) {
      console.error('Telegram /start error:', err.message);
      return send(chatId, T.en.error_link);
    }
  }

  // All other commands need a linked business
  const businessId = await getBusinessId(chatId);
  if (!businessId) return send(chatId, T.en.not_linked);

  const lang = await getLang(businessId);
  const l = t(lang);
  const back = backBtn(lang);

  // /menu
  if (lower === '/menu' || lower === 'menu') {
    const biz = await db('businesses').where({ id: businessId }).first();
    return send(chatId, l.what_todo(biz?.name), mainMenu(lang));
  }

  // /help
  if (lower === '/help' || lower === 'help') return send(chatId, l.help, back);

  // /today
  if (lower === '/today' || lower === 'today') {
    try { return send(chatId, await buildToday(businessId, lang), back); }
    catch { return send(chatId, l.error_fetch('summary'), back); }
  }

  // /bal
  if (lower === '/bal' || lower === 'bal') {
    try { return send(chatId, await buildBal(businessId, lang), back); }
    catch { return send(chatId, l.error_fetch('balances'), back); }
  }

  // /low
  if (lower === '/low' || lower === 'low') {
    try { return send(chatId, await buildLow(businessId, lang), back); }
    catch { return send(chatId, l.error_fetch('low stock'), back); }
  }

  // /stock <name>
  if (lower.startsWith('/stock')) {
    const search = text.slice(6).trim();
    if (!search) return send(chatId, l.stock_usage, back);
    try {
      const result = await inventoryService.list(businessId, { search, limit: 5 });
      const products = result.products || result;
      if (!products.length) return send(chatId, l.stock_none(search), back);
      const lines = products.map((p) =>
        `📦 <b>${p.name}</b>\n   ${l.stock_label}: ${p.quantity}  |  ${l.sell_label}: ${fmt(p.sellPrice)}  |  ${l.buy_label}: ${fmt(p.buyPrice)}`
      );
      return send(chatId, lines.join('\n\n'), back);
    } catch { return send(chatId, l.error_fetch('products'), back); }
  }

  // /price <name> <amount>
  if (lower.startsWith('/price')) {
    const parts = text.slice(6).trim().split(/\s+/);
    const newPrice = parseFloat(parts.pop());
    const search = parts.join(' ');
    if (!search || isNaN(newPrice) || newPrice <= 0) return send(chatId, l.price_usage, back);
    try {
      const result = await inventoryService.list(businessId, { search, limit: 1 });
      const products = result.products || result;
      if (!products.length) return send(chatId, l.stock_none(search), back);
      const p = products[0];
      await inventoryService.update(businessId, p.id, { sellPrice: newPrice });
      return send(chatId, l.price_updated(p.name, p.sellPrice, newPrice), back);
    } catch { return send(chatId, l.error_fetch('price update'), back); }
  }

  // <bank-name> <amount> — quick bank balance update
  const balanceMatch = text.match(/^(.+?)\s+([\d,]+)\s*$/);
  if (balanceMatch) {
    const bankSearch = balanceMatch[1].trim().toLowerCase();
    const amount = parseFloat(balanceMatch[2].replace(/,/g, ''));
    if (!isNaN(amount)) {
      try {
        const accounts = await accountsService.list(businessId);
        const match = accounts.find((a) =>
          a.bankName.toLowerCase().startsWith(bankSearch) ||
          a.bankName.toLowerCase().includes(bankSearch)
        );
        if (!match) {
          const names = accounts.map((a) => a.bankName).join(', ') || 'none';
          return send(chatId, l.bal_no_match(balanceMatch[1], names), back);
        }
        const oldBal = Number(match.balance) || 0;
        await accountsService.update(businessId, match.id, { balance: amount });
        return send(chatId, l.bal_updated(match.bankName, oldBal, amount), back);
      } catch { return send(chatId, l.error_fetch('bank update'), back); }
    }
  }

  // Unknown — show menu
  const biz = await db('businesses').where({ id: businessId }).first();
  return send(chatId, l.unknown(biz?.name), mainMenu(lang));
}

// ─── Live Sale Notification ────────────────────────────────────────────────

async function notifySale(businessId, saleData) {
  if (!bot) return;
  try {
    // Find all Telegram chats linked to this business
    const links = await db('telegram_links').where({ business_id: businessId });
    if (!links.length) return;

    const lang = await getLang(businessId);
    const l = t(lang);
    const items = (saleData.items || []).map((i) => {
      const name = i.product_name || i.productName || i.name || '?';
      const qty = parseInt(i.quantity) || 0;
      const price = i.unit_price || i.unitPrice || 0;
      return `  ${name} x${qty}  →  ${fmt(price * qty)}`;
    }).join('\n');

    const method = saleData.payments?.[0]?.method || 'cash';
    const methodLabel = {
      cash: lang === 'ha' ? '💷 Tsabar Kuɗi' : '💷 Cash',
      bank: lang === 'ha' ? '🏦 Banki' : '🏦 Bank',
      credit: lang === 'ha' ? '📋 Bashi' : '📋 Credit',
    }[method] || method;

    // Format time and date
    const saleTime = new Date(saleData.created_at || Date.now());
    const timeStr = saleTime.toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    // Get attendant name if available
    let attendantLine = '';
    if (saleData.attendant_id) {
      try {
        const attendant = await db('users').where({ id: saleData.attendant_id }).select('name').first();
        if (attendant?.name) {
          attendantLine = `\n👤  ${lang === 'ha' ? 'Mai sayarwa' : 'Sold by'}:  ${attendant.name}`;
        }
      } catch {}
    }

    const text =
      `🛒 <b>${lang === 'ha' ? 'Sabon Saye!' : 'New Sale!'}</b>\n` +
      `🕐  ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `${items}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `💵  ${lang === 'ha' ? 'Jimla' : 'Total'}:  <b>${fmt(saleData.total_amount || saleData.totalAmount)}</b>\n` +
      `📈  ${lang === 'ha' ? 'Riba' : 'Profit'}:  <b>${fmt(saleData.profit)}</b>\n` +
      `💳  ${methodLabel}` +
      attendantLine;

    for (const link of links) {
      bot.sendMessage(link.chat_id, text, { parse_mode: 'HTML' }).catch(() => {});
    }
  } catch (err) {
    console.error('Telegram sale notification error:', err.message);
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

function init(token) {
  if (!token) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  const TelegramBot = require('node-telegram-bot-api');
  bot = new TelegramBot(token, { polling: { interval: 5000, autoStart: false } });

  // Suppress polling errors (DNS failures when offline) — just log once
  let lastPollingError = 0;
  bot.on('polling_error', (err) => {
    const now = Date.now();
    if (now - lastPollingError > 60000) {
      console.log('⚠️  Telegram polling offline:', err.code || err.message);
      lastPollingError = now;
    }
  });

  // Register command menu (the blue menu button in Telegram)
  bot.setMyCommands([
    { command: 'menu', description: '📋 Main Menu / Babban Menu' },
    { command: 'today', description: '📊 Sales Summary / Taƙaitaccen Yau' },
    { command: 'bal', description: '🏦 Bank Balances / Ma\'aunin Bankuna' },
    { command: 'low', description: '⚠️ Low Stock / Ƙarancin Kaya' },
    { command: 'stock', description: '📦 Check Stock / Duba Kaya' },
    { command: 'price', description: '💰 Update Price / Canja Farashi' },
    { command: 'help', description: '❓ Help / Taimako' },
  ]).catch(() => {});

  bot.on('callback_query', (query) => {
    handleCallback(query).catch((err) => console.error('Telegram callback error:', err.message));
  });

  bot.on('message', (msg) => {
    handleMessage(msg).catch((err) => console.error('Telegram bot error:', err.message));
  });

  // Start polling (non-blocking, won't crash on failure)
  bot.startPolling();
  console.log('🤖 Telegram bot started (polling mode)');
}

module.exports = { init, notifySale };
