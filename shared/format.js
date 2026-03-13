/**
 * Currency formatting utilities — ported from existing app
 */

function formatCurrency(amount, currency = '₦') {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency}0`;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

function formatCurrencyAmount(amount, currency = '₦') {
  return formatCurrency(amount, currency);
}

function parseCurrencyInput(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[₦,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

module.exports = { formatCurrency, formatCurrencyAmount, parseCurrencyInput };
