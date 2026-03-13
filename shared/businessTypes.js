const BUSINESS_TYPES = {
  provision_store: {
    label: 'Provision Store',
    defaultCategories: ['Beverages', 'Snacks', 'Toiletries', 'Household', 'Canned Goods', 'Cereals', 'Other'],
    defaultUnits: ['pcs', 'packs', 'cartons', 'bags', 'sachets'],
    receiptTitle: 'Provision Store'
  },
  restaurant: {
    label: 'Restaurant / Food',
    defaultCategories: ['Main Dishes', 'Soups', 'Drinks', 'Snacks', 'Desserts', 'Sides', 'Other'],
    defaultUnits: ['plates', 'pcs', 'cups', 'bowls', 'litres'],
    receiptTitle: 'Restaurant'
  },
  pharmacy: {
    label: 'Pharmacy',
    defaultCategories: ['Tablets', 'Syrups', 'Injections', 'Creams', 'First Aid', 'Supplements', 'Other'],
    defaultUnits: ['pcs', 'packs', 'strips', 'bottles', 'boxes'],
    receiptTitle: 'Pharmacy'
  },
  textile: {
    label: 'Textile / Fashion',
    defaultCategories: ['Fabric', 'Ready-made', 'Accessories', 'Shoes', 'Bags', 'Other'],
    defaultUnits: ['yards', 'pcs', 'pairs', 'metres', 'bundles'],
    receiptTitle: 'Textile Shop'
  },
  building_materials: {
    label: 'Building Materials',
    defaultCategories: ['Cement', 'Iron Rods', 'Roofing', 'Plumbing', 'Electrical', 'Paint', 'Tiles', 'Other'],
    defaultUnits: ['bags', 'pcs', 'bundles', 'tonnes', 'litres', 'rolls'],
    receiptTitle: 'Building Materials'
  },
  electronics: {
    label: 'Electronics / Phone Accessories',
    defaultCategories: ['Phones', 'Chargers', 'Earphones', 'Cases', 'Screens', 'Batteries', 'Other'],
    defaultUnits: ['pcs', 'packs', 'sets'],
    receiptTitle: 'Electronics Store'
  },
  currency_exchange: {
    label: 'Currency Exchange (Bureau de Change)',
    defaultCategories: ['USD', 'EUR', 'GBP', 'CAD', 'AED', 'CNY', 'Other'],
    defaultUnits: ['units'],
    receiptTitle: 'Bureau de Change'
  },
  supermarket: {
    label: 'Supermarket / Mini Mart',
    defaultCategories: ['Food', 'Beverages', 'Household', 'Personal Care', 'Baby Products', 'Frozen', 'Other'],
    defaultUnits: ['pcs', 'packs', 'kg', 'litres', 'cartons'],
    receiptTitle: 'Supermarket'
  },
  water_factory: {
    label: 'Pure Water / Drinks Factory',
    defaultCategories: ['Sachet Water', 'Bottle Water', 'Soft Drinks', 'Juice', 'Other'],
    defaultUnits: ['bags', 'packs', 'crates', 'cartons', 'pcs'],
    receiptTitle: 'Water Factory'
  },
  bakery: {
    label: 'Bakery / Bread Seller',
    defaultCategories: ['Bread', 'Pastries', 'Cakes', 'Snacks', 'Other'],
    defaultUnits: ['pcs', 'slices', 'packs', 'dozen'],
    receiptTitle: 'Bakery'
  },
  custom: {
    label: 'Other (Custom)',
    defaultCategories: ['General', 'Other'],
    defaultUnits: ['pcs', 'kg', 'litres', 'packs', 'bags', 'bundles', 'yards', 'metres', 'crates', 'cartons'],
    receiptTitle: 'Business'
  }
};

module.exports = { BUSINESS_TYPES };
