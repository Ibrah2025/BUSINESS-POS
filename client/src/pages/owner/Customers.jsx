import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../../i18n';
import api from '../../api/client';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0 }).format(amount || 0);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function Customers() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    creditLimit: '',
    notes: '',
  });

  const fetchCustomers = useCallback(async (search = '') => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const { data } = await api.get('/customers', { params });
      const list = data.customers || data.data || data || [];
      setCustomers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const debouncedSearch = useRef(
    debounce((q) => fetchCustomers(q), 400)
  ).current;

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleExpand = async (customer) => {
    const id = customer.id || customer._id;
    if (expandedId === id) {
      setExpandedId(null);
      setCustomerDetail(null);
      return;
    }
    setExpandedId(id);
    setCustomerDetail(null);
    try {
      setDetailLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      setCustomerDetail(data.customer || data.data || data || {});
    } catch (err) {
      console.error('Failed to fetch customer detail:', err);
      setCustomerDetail({});
    } finally {
      setDetailLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', creditLimit: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (customer, e) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : '',
      notes: customer.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingCustomer) {
        const id = editingCustomer.id || editingCustomer._id;
        await api.put(`/customers/${id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setShowModal(false);
      setEditingCustomer(null);
      fetchCustomers(searchQuery);
    } catch (err) {
      console.error('Failed to save customer:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePayCredit = async (customerId, creditId) => {
    try {
      await api.post(`/customers/${customerId}/credits/${creditId}/pay`);
      // Refresh detail
      const { data } = await api.get(`/customers/${customerId}`);
      setCustomerDetail(data.customer || data.data || data || {});
      fetchCustomers(searchQuery);
    } catch (err) {
      console.error('Failed to pay credit:', err);
    }
  };

  const recentPurchases = customerDetail?.recentPurchases || customerDetail?.purchases || [];
  const credits = customerDetail?.credits || customerDetail?.outstandingCredits || [];
  const lifetimeTotal = customerDetail?.totalPurchases || customerDetail?.lifetimePurchases || 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] px-4 pt-6 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('customers')}</h1>
          <span className="text-sm text-[var(--text-secondary)]">
            {customers.length} {t('customers')}
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('search_customers')}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <button
          onClick={openAddModal}
          className="mt-3 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl active:bg-blue-700 transition"
        >
          {t('add_customer')}
        </button>
      </div>

      {/* Customer List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] py-12">
            {searchQuery ? t('no_customers_match') : t('no_customers')}
          </p>
        ) : (
          customers.map((customer) => {
            const id = customer.id || customer._id;
            const isExpanded = expandedId === id;
            return (
              <div key={id}>
                <button
                  onClick={() => handleExpand(customer)}
                  className="w-full text-left bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] active:scale-[0.98] transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {customer.name}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {customer.phone || t('no_phone')}
                      </p>
                      {customer.lastPurchaseDate && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          {t('last_purchase')}{' '}
                          {new Date(customer.lastPurchaseDate).toLocaleDateString('en-NG', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        &#8358;{formatCurrency(customer.totalPurchases)}
                      </p>
                      {(customer.outstandingCredit > 0 || customer.creditBalance > 0) && (
                        <p className="text-xs font-semibold text-red-600 mt-0.5">
                          {t('owes')} &#8358;{formatCurrency(customer.outstandingCredit || customer.creditBalance)}
                        </p>
                      )}
                      <button
                        onClick={(e) => openEditModal(customer, e)}
                        className="text-xs text-blue-600 font-medium mt-1"
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-1">
                    <svg
                      className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                    {detailLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {/* Lifetime Total */}
                        <div className="px-4 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                          <p className="text-xs text-[var(--text-secondary)]">{t('lifetime_purchases')}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('lifetime_purchases_hint')}</p>
                          <p className="text-lg font-bold text-[var(--text-primary)]">
                            &#8358;{formatCurrency(lifetimeTotal)}
                          </p>
                        </div>

                        {/* Recent Purchases */}
                        <div className="border-b border-[var(--border-color)]">
                          <div className="px-4 py-2 border-b border-[var(--border-color)]">
                            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                              {t('recent_purchases')}
                            </p>
                          </div>
                          {recentPurchases.length === 0 ? (
                            <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                              {t('no_purchases')}
                            </p>
                          ) : (
                            <div className="divide-y divide-[var(--border-color)] max-h-48 overflow-y-auto">
                              {recentPurchases.slice(0, 10).map((p, i) => (
                                <div key={p.id || p._id || i} className="px-4 py-2.5 flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-[var(--text-primary)] truncate">
                                      {p.description || p.items?.map((it) => it.name).join(', ') || 'Sale'}
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                      {p.date
                                        ? new Date(p.date).toLocaleDateString('en-NG', {
                                            day: 'numeric', month: 'short',
                                          })
                                        : ''}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold text-[var(--text-primary)] ml-3">
                                    &#8358;{formatCurrency(p.total || p.amount)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Outstanding Credits */}
                        <div>
                          <div className="px-4 py-2 border-b border-[var(--border-color)]">
                            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                              {t('outstanding_credits')}
                            </p>
                          </div>
                          {credits.length === 0 ? (
                            <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                              {t('no_outstanding_credits')}
                            </p>
                          ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                              {credits.map((c, i) => (
                                <div key={c.id || c._id || i} className="px-4 py-3 flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-red-600">
                                      &#8358;{formatCurrency(c.amount || c.balance)}
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                      {c.description || c.reason || '—'}
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                      {c.date
                                        ? new Date(c.date).toLocaleDateString('en-NG', {
                                            day: 'numeric', month: 'short',
                                          })
                                        : ''}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handlePayCredit(id, c.id || c._id)}
                                    className="ml-3 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg active:bg-green-700 transition flex-shrink-0"
                                  >
                                    {t('mark_paid')}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-secondary)] rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingCustomer ? t('edit') + ' ' + t('customers').slice(0, -1) : t('add_customer')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-primary)]"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('customer_name')}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('phone')}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder={t('phone_placeholder')}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('credit_limit')} (&#8358;)
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">{t('credit_limit_hint')}</p>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.creditLimit}
                  onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder={t('no_limit')}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('optional_notes')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-blue-700 transition mt-2"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
