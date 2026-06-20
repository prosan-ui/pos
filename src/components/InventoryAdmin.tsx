import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  PlusCircle, 
  AlertTriangle, 
  X, 
  Save, 
  RefreshCw,
  Search,
  Hash,
  DollarSign,
  Layers,
  ArrowRight,
  Upload,
  Download,
  Check,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../data/mockProducts';

// Utility CSV parser that supports double quotes, escaped commas, and trailing blank rows.
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentValue.trim());
      lines.push(row);
      row = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    lines.push(row);
  }
  return lines.filter(r => r.some(cell => cell !== ""));
}

interface InventoryAdminProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onQuickReplenish: (id: string, qty: number) => void;
  searchFilter: string;
}

export default function InventoryAdmin({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onQuickReplenish,
  searchFilter
}: InventoryAdminProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'cost' | 'price' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  
  // Modals / Editor States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // CSV Bulk Import states
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [csvFileName, setCsvFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [onDuplicateAction, setOnDuplicateAction] = useState<'skip' | 'overwrite' | 'merge'>('overwrite');

  // Mappings represent which CSV column index links to which property
  const [mappings, setMappings] = useState<Record<string, number>>({
    name: -1,
    sku: -1,
    price: -1,
    cost: -1,
    stock: -1,
    category: -1,
    icon: -1,
    color: -1,
    threshold: -1
  });

  // Dynamic preview extraction
  const parsedProducts = useMemo(() => {
    if (parsedRows.length === 0) return [];
    
    const randomEmojis = ['☕', '🥤', '🍔', '🍟', '🍕', '🥐', '🍪', '🍨', '📦', '🎁', '🛍️', '🔥'];
    const randomColors = ['amber', 'emerald', 'orange', 'blue', 'rose', 'indigo', 'sky', 'purple', 'teal', 'pink'];

    return parsedRows.map((row, idx) => {
      const getVal = (field: string) => {
        const colIdx = mappings[field];
        if (colIdx !== undefined && colIdx !== -1 && colIdx < row.length) {
          return row[colIdx];
        }
        return '';
      };

      const name = getVal('name').trim();
      const rawSku = getVal('sku').trim() || `SKU-CSV-${idx + 100}`;
      const sku = rawSku.toUpperCase().replace(/\s+/g, '-');
      
      const price = parseFloat(getVal('price')) || 0;
      const cost = parseFloat(getVal('cost')) || 0;
      const stock = parseInt(getVal('stock')) || 0;
      const threshold = parseInt(getVal('threshold')) || 5;
      
      const category = getVal('category').trim() || 'Beverages';
      const icon = getVal('icon').trim() || randomEmojis[idx % randomEmojis.length];
      const color = getVal('color').trim() || randomColors[idx % randomColors.length];
      
      return {
        id: `p-csv-${idx}-${Date.now()}`,
        name,
        sku,
        price: Math.max(0, price),
        cost: Math.max(0, cost),
        stock: Math.max(0, stock),
        category: category,
        categories: [category],
        icon,
        color,
        threshold: Math.max(1, threshold)
      } as Product;
    });
  }, [parsedRows, mappings]);

  const validationResults = useMemo(() => {
    return parsedProducts.map(p => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (!p.name) {
        errors.push("Missing Title");
      }
      
      if (!p.sku) {
        errors.push("Missing SKU code");
      } else {
        const dbProduct = products.find(existing => existing.sku === p.sku);
        if (dbProduct) {
          warnings.push(`Duplicate SKU (already in DB: "${dbProduct.name}")`);
        }
      }

      if (p.price <= 0) {
        warnings.push("Selling price is $0.00");
      } else if (p.price < p.cost) {
        warnings.push(`Selling Price ($${p.price.toFixed(2)}) < Cost Price ($${p.cost.toFixed(2)})`);
      }

      return {
        errors,
        warnings,
        isDuplicate: products.some(existing => existing.sku === p.sku),
        hasErrors: errors.length > 0
      };
    });
  }, [parsedProducts, products]);

  // CSV Template download
  const downloadTemplateCSV = () => {
    const csvContent = 
      "Product Name,SKU,Selling Price,Wholesale Cost,Stock Quantity,Category,Icon Emoji,Color Accent,Reorder Threshold\n" +
      "Caramel Macchiato,SKU-CARM-01,5.50,1.80,45,Beverages,☕,amber,10\n" +
      "Chocolate Chip Muffin,SKU-CHOC-MUF,3.75,1.10,24,Pastries,🍩,orange,5\n" +
      "Unsweetened Iced Green Tea,SKU-GRN-TEA,4.25,0.90,30,Beverages,🍵,emerald,8\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvLoaded = (text: string, fileName: string) => {
    const rawRows = parseCSV(text);
    if (rawRows.length === 0) {
      alert("The CSV file is completely empty or invalid!");
      return;
    }
    
    const csvHeaders = rawRows[0].map(h => h.trim());
    setHeaders(csvHeaders);
    setParsedRows(rawRows.slice(1));
    setCsvFileName(fileName);
    
    // Autodetect heuristics
    const newMappings: Record<string, number> = {
      name: -1,
      sku: -1,
      price: -1,
      cost: -1,
      stock: -1,
      category: -1,
      icon: -1,
      color: -1,
      threshold: -1
    };

    const heuristics: Record<string, string[]> = {
      name: ['name', 'title', 'product name', 'item', 'product', 'label'],
      sku: ['sku', 'code', 'barcode', 'identifier', 'part number', 'partno'],
      price: ['price', 'retail', 'sell', 'selling price', 'retail price', 'rate'],
      cost: ['cost', 'wholesale', 'purchase', 'purchase price', 'buy price', 'cost price'],
      stock: ['stock', 'qty', 'quantity', 'inventory', 'count', 'amount', 'on hand'],
      category: ['category', 'categories', 'dept', 'department', 'group', 'type'],
      icon: ['icon', 'emoji', 'symbol', 'avatar', 'img'],
      color: ['color', 'accent', 'skin', 'theme'],
      threshold: ['threshold', 'alert', 'low stock limit', 'minimum', 'min', 'lowstock']
    };

    Object.keys(newMappings).forEach(field => {
      const fieldHeuristics = heuristics[field];
      const foundIdx = csvHeaders.findIndex(header => {
        const lowerHeader = header.toLowerCase();
        return fieldHeuristics.some(h => lowerHeader.includes(h) || h.includes(lowerHeader));
      });
      newMappings[field] = foundIdx;
    });

    setMappings(newMappings);
    setImportStep(2);
  };

  const resetImportWizard = () => {
    setImportStep(1);
    setCsvFileName('');
    setParsedRows([]);
    setHeaders([]);
    setMappings({
      name: -1,
      sku: -1,
      price: -1,
      cost: -1,
      stock: -1,
      category: -1,
      icon: -1,
      color: -1,
      threshold: -1
    });
  };

  const handleBulkImportSubmit = () => {
    let successCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    parsedProducts.forEach((p, idx) => {
      const pValidation = validationResults[idx];
      if (pValidation.hasErrors) {
        skipCount++;
        return;
      }

      const existingProduct = products.find(existing => existing.sku === p.sku);

      if (existingProduct) {
        if (onDuplicateAction === 'skip') {
          skipCount++;
        } else if (onDuplicateAction === 'overwrite') {
          onUpdateProduct({
            ...existingProduct,
            name: p.name || existingProduct.name,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            category: p.category,
            categories: [p.category],
            threshold: p.threshold,
            icon: p.icon || existingProduct.icon,
            color: p.color || existingProduct.color
          });
          updateCount++;
        } else if (onDuplicateAction === 'merge') {
          onUpdateProduct({
            ...existingProduct,
            stock: existingProduct.stock + p.stock
          });
          updateCount++;
        }
      } else {
        onAddProduct({
          ...p,
          id: `p-${Date.now()}-${idx}`
        });
        successCount++;
      }
    });

    alert(`CSV Import Finished!\n- Registered new product assets: ${successCount}\n- Updated existing records: ${updateCount}\n- Skipped/Errors items: ${skipCount}`);
    setIsImportModalOpen(false);
    resetImportWizard();
  };

  // Form State variables
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formCategories, setFormCategories] = useState<string[]>(['Beverages']);
  const [formIcon, setFormIcon] = useState('☕');
  const [formColor, setFormColor] = useState('amber');
  const [formThreshold, setFormThreshold] = useState('10');

  // Calculate live product counts per category in real-time
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    CATEGORIES.filter(c => c !== 'All').forEach(cat => {
      counts[cat] = products.filter(p => 
        (p.categories && p.categories.includes(cat)) || p.category === cat
      ).length;
    });
    return counts;
  }, [products]);

  // Filter and sort products based on selected Category and search filters
  const filteredProducts = useMemo(() => {
    const list = products.filter(product => {
      // support multi-category check
      const matchCategory = selectedCategory === 'All' || 
                            (product.categories && product.categories.includes(selectedCategory)) || 
                            product.category === selectedCategory;
      const matchSearch = product.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchFilter.toLowerCase());
      
      const isOutOfStock = product.stock <= 0;
      const isLowStock = !isOutOfStock && product.stock <= product.threshold;
      
      const matchLowStock = !showLowStockOnly || isLowStock;
      const matchOutOfStock = !showOutOfStockOnly || isOutOfStock;

      return matchCategory && matchSearch && matchLowStock && matchOutOfStock;
    });

    // Apply active sort specifications
    return [...list].sort((a, b) => {
      const coeff = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') {
        return coeff * a.name.localeCompare(b.name);
      } else if (sortBy === 'sku') {
        return coeff * a.sku.localeCompare(b.sku);
      } else if (sortBy === 'cost') {
        return coeff * (a.cost - b.cost);
      } else if (sortBy === 'price') {
        return coeff * (a.price - b.price);
      } else if (sortBy === 'stock') {
        return coeff * (a.stock - b.stock);
      } else if (sortBy === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        return coeff * catA.localeCompare(catB);
      }
      return 0;
    });
  }, [products, selectedCategory, searchFilter, sortBy, sortOrder, showLowStockOnly, showOutOfStockOnly]);

  // Form Initializers (Add vs. Edit)
  const openAddModal = () => {
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    setFormName('');
    setFormSku(`SKU-NEW-${randomSuffix}`);
    setFormPrice('5.00');
    setFormCost('1.50');
    setFormStock('20');
    setFormCategories(['Beverages']);
    setFormIcon('☕');
    setFormColor('amber');
    setFormThreshold('5');
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormSku(product.sku);
    setFormPrice(product.price.toString());
    setFormCost(product.cost.toString());
    setFormStock(product.stock.toString());
    setFormCategories(product.categories && product.categories.length > 0 ? product.categories : [product.category]);
    setFormIcon(product.icon);
    setFormColor(product.color);
    setFormThreshold(product.threshold.toString());
    setIsEditModalOpen(true);
  };

  // Submission handlers
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim() || formCategories.length === 0) return;

    const newProduct: Product = {
      id: `p-${Date.now()}`,
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      price: Math.max(0, parseFloat(formPrice) || 0),
      cost: Math.max(0, parseFloat(formCost) || 0),
      stock: Math.max(0, parseInt(formStock) || 0),
      category: formCategories[0] || 'Beverages',
      categories: formCategories,
      icon: formIcon,
      color: formColor,
      threshold: Math.max(0, parseInt(formThreshold) || 1)
    };

    onAddProduct(newProduct);
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !formName.trim() || !formSku.trim() || formCategories.length === 0) return;

    const updated: Product = {
      ...editingProduct,
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      price: Math.max(0, parseFloat(formPrice) || 0),
      cost: Math.max(0, parseFloat(formCost) || 0),
      stock: Math.max(0, parseInt(formStock) || 0),
      category: formCategories[0] || 'Beverages',
      categories: formCategories,
      icon: formIcon,
      color: formColor,
      threshold: Math.max(0, parseInt(formThreshold) || 1)
    };

    onUpdateProduct(updated);
    setIsEditModalOpen(false);
    setEditingProduct(null);
  };

  const emojiOptions = ['☕', '🍵', '🥭', '🥤', '🍺', '🥛', '🍔', '🍟', '🍗', '🍕', '🥐', '🍩', '🍰', '🍪', '🍨', '🖱️', '⌨️', '🎧', '🧥', '🧢', '👕', '👜', '👟', '📦', '🎁', '🛍️', '🔥', '✨'];
  const colorOptions = ['amber', 'emerald', 'orange', 'blue', 'rose', 'yellow', 'pink', 'violet', 'teal', 'indigo', 'sky', 'purple'];

  return (
    <div className="p-4 md:p-6 bg-slate-50/50 min-h-[calc(100vh-5rem)] flex flex-col space-y-6">
      
      {/* Top action cards & Overview */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-stone-900 tracking-tight font-sans uppercase">
            Store Stock Control Panel
          </h2>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Manage your stock bookkeeping records, replenish supplies, and category indexing.
          </p>
        </div>
        
        {/* Actions button container */}
        <div id="catalog-header-actions" className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0">
          {/* CSV Import workflow trigger */}
          <button
            id="csv-import-modal-toggle"
            type="button"
            onClick={() => {
              resetImportWizard();
              setIsImportModalOpen(true);
            }}
            className="border border-stone-200 hover:border-indigo-600 bg-white hover:bg-indigo-50 text-stone-700 hover:text-indigo-700 font-extrabold text-xs py-3 px-4.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-3xs uppercase tracking-wider h-11"
          >
            <Upload className="w-4 h-4 text-stone-500 hover:text-indigo-600" />
            Bulk CSV Upload
          </button>

          {/* Master Addition trigger */}
          <button
            id="add-product-modal-toggle"
            type="button"
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-5 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer uppercase tracking-wider h-11"
          >
            <Plus className="w-4 h-4" />
            Add Item catalog
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COMPACT COMPREHENSIVE SIDEBAR */}
        <div className="lg:col-span-3 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-5">
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
              Category Sidebar filters
            </span>
            <div className="space-y-1">
              {CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat;
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    id={`inv-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-indigo-200 text-indigo-800' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Sorter Dropdown controls */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="inv-sort-by" className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                Sort Records By
              </label>
              <select
                id="inv-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="name">Product Name (A-Z)</option>
                <option value="category">Primary Category</option>
                <option value="stock">Current Stock Levels</option>
                <option value="price">Retail Selling Price</option>
                <option value="cost">Purchase wholesale Cost</option>
                <option value="sku">SKU Code Sequence</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                Sort Sequence
              </label>
              <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSortOrder('asc')}
                  className={`flex-1 py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                    sortOrder === 'asc' 
                      ? 'bg-white text-indigo-700 shadow-sm' 
                      : 'text-stone-500 hover:text-stone-850'
                  }`}
                >
                  Ascending
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  className={`flex-1 py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                    sortOrder === 'desc' 
                      ? 'bg-white text-indigo-700 shadow-sm' 
                      : 'text-stone-500 hover:text-stone-850'
                  }`}
                >
                  Descending
                </button>
              </div>
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Quick stock states status filters */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              Stock Alerts & Status Filters
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-stone-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Show Low Stock Alert</span>
              </label>
              
              <label className="flex items-center gap-2 text-xs text-stone-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOutOfStockOnly}
                  onChange={(e) => setShowOutOfStockOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Show Sold Out Only</span>
              </label>
            </div>

            {(selectedCategory !== 'All' || showLowStockOnly || showOutOfStockOnly) && (
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setShowLowStockOnly(false);
                  setShowOutOfStockOnly(false);
                }}
                className="w-full mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/60 p-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* RIGHT DATA GRID & CONTROL BOOK TABLE */}
        <div className="lg:col-span-9 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse" id="inventory-registry-table">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-400 tracking-wider uppercase">
                <th className="py-4 px-6">Product Catalog Details</th>
                <th className="py-4 px-4">SKU / Code</th>
                <th className="py-4 px-4 text-right">Cost Price</th>
                <th className="py-4 px-4 text-right">Retail Sell</th>
                <th className="py-4 px-4 text-center">Stock Level Status</th>
                <th className="py-4 px-4 text-center">Low Limit</th>
                <th className="py-4 px-6 text-center">Quick replenishment / Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-stone-100 text-xs text-stone-600">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No registry products currently matching active filter scopes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  const isLowStock = !isOutOfStock && product.stock <= product.threshold;
                  const profitMargin = ((product.price - product.cost) / product.price) * 100;

                  return (
                    <tr 
                      key={product.id} 
                      id={`inv-row-${product.id}`}
                      className="hover:bg-indigo-50/20 transition-colors"
                    >
                      {/* Product identity */}
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg select-none bg-${product.color}-50 border border-${product.color}-100 shrink-0`}>
                            {product.icon}
                          </div>
                          <div>
                            <div className="flex gap-1 flex-wrap mb-1">
                              {(product.categories && product.categories.length > 0 ? product.categories : [product.category]).map(cat => (
                                <span key={cat} className="text-[9px] bg-stone-105 border border-stone-200/50 text-stone-600 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                  {cat}
                                </span>
                              ))}
                            </div>
                            <h4 className="font-bold text-stone-800 text-xs mt-0.5" id={`inv-name-${product.id}`}>
                              {product.name}
                            </h4>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono text-[10px] text-stone-500">
                        {product.sku}
                      </td>

                      {/* Cost value */}
                      <td className="py-3 px-4 text-right font-mono text-stone-700">
                        ${product.cost.toFixed(2)}
                      </td>

                      {/* Selling price + Margin projection */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-stone-800">${product.price.toFixed(2)}</div>
                        <div className="text-[9px] text-emerald-600 font-bold mt-0.5">{profitMargin.toFixed(0)}% Margin</div>
                      </td>

                      {/* Current Stock status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-center">
                          {isOutOfStock ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.1 text-amber-600 shrink-0" /> Low stock
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              Normal
                            </span>
                          )}
                          
                          <span className="font-mono font-extrabold text-stone-800 text-xs mt-1.5">
                            {product.stock} units
                          </span>
                        </div>
                      </td>

                      {/* Alert Threshold */}
                      <td className="py-3 px-4 text-center font-mono text-stone-500">
                        {product.threshold}
                      </td>

                      {/* Replenish shortcuts and adjustments */}
                      <td className="py-3 px-6">
                        <div className="flex items-center justify-center gap-3">
                          {/* Quick replenish triggers */}
                          <div className="flex items-center gap-1 border border-stone-200 rounded-lg p-0.5 bg-stone-50 shrink-0">
                            <span className="text-[9px] text-stone-400 font-bold px-1 uppercase tracking-wider">Restock:</span>
                            <button
                              id={`quick-add-10-${product.id}`}
                              onClick={() => onQuickReplenish(product.id, 10)}
                              className="text-[9px] font-bold bg-white text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 border border-stone-100 px-1.5 py-1 rounded-md transition-colors"
                              title="Add +10 units to stock"
                            >
                              +10
                            </button>
                            <button
                              id={`quick-add-50-${product.id}`}
                              onClick={() => onQuickReplenish(product.id, 50)}
                              className="text-[9px] font-bold bg-white text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 border border-stone-100 px-1.5 py-1 rounded-md transition-colors"
                              title="Add +50 units to stock"
                            >
                              +50
                            </button>
                          </div>

                          <span className="text-stone-200 font-light">|</span>

                          {/* Primary editor controls */}
                          <div className="flex items-center gap-1">
                            <button
                              id={`edit-item-btn-${product.id}`}
                              onClick={() => openEditModal(product)}
                              className="p-1.5 rounded-md border border-stone-200 hover:border-indigo-500 text-stone-400 hover:text-indigo-600 bg-white hover:bg-indigo-50/30 transition-all transition-colors cursor-pointer"
                              title="Edit item specs"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              id={`delete-item-btn-${product.id}`}
                              onClick={() => {
                                if (confirm(`Caution! Are you absolutely sure you want to delete ${product.name} from the catalog inventory? This is irreversible.`)) {
                                  onDeleteProduct(product.id);
                                }
                              }}
                              className="p-1.5 rounded-md border border-stone-200 hover:border-rose-300 text-stone-400 hover:text-rose-600 bg-white hover:bg-rose-50/50 transition-all transition-colors cursor-pointer"
                              title="Delete catalog item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info counts summaries */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-between items-center text-xs text-stone-500 font-medium">
          <span>Active Count: <strong>{filteredProducts.length} items</strong> filtered</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> High Stock
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Threshold trigger Alert
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block animate-pulse" /> Out of stock
            </span>
          </span>
        </div>
      </div>
    </div>

      {/* ADD NEW PRODUCT DIALOG MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          {/* backdrop action close */}
          <div className="fixed inset-0" onClick={() => setIsAddModalOpen(false)} />
          
          <div 
            id="add-product-form-card"
            className="relative bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-stone-200 z-60 animate-in zoom-in duration-150"
          >
            {/* Form banner header */}
            <div className="bg-indigo-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-200" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">REGISTER NEW CATALOG PRODUCT</h3>
              </div>
              <button 
                id="close-add-modal-btn"
                onClick={() => setIsAddModalOpen(false)} 
                className="text-indigo-100 hover:text-white hover:bg-indigo-700/50 p-1 rounded-md transition-colors"
                title="Cancel addition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Product Name */}
                <div className="space-y-1">
                  <label htmlFor="add-name-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Product Title *
                  </label>
                  <input
                    id="add-name-input"
                    type="text"
                    required
                    placeholder="e.g. Organic Blueberry Cold Brew"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* SKU Code */}
                <div className="space-y-1">
                  <label htmlFor="add-sku-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Stock Keeping Unit (SKU) *
                  </label>
                  <input
                    id="add-sku-input"
                    type="text"
                    required
                    placeholder="e.g. BEV-BREW-05"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono uppercase"
                  />
                </div>

                {/* Categories Checklist */}
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                    Product Categories * (Select all that apply)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                    {CATEGORIES.filter(c => c !== 'All').map(c => {
                      const isChecked = formCategories.includes(c);
                      return (
                        <label 
                          key={c} 
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
                            isChecked 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-2xs' 
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCategories(prev => [...prev, c]);
                              } else {
                                if (formCategories.length > 1) {
                                  setFormCategories(prev => prev.filter(item => item !== c));
                                }
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Stock Level */}
                <div className="space-y-1">
                  <label htmlFor="add-stock-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Initial Stock Quanity
                  </label>
                  <input
                    id="add-stock-input"
                    type="number"
                    min="0"
                    required
                    placeholder="25"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Cost price */}
                <div className="space-y-1">
                  <label htmlFor="add-cost-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Purchase Cost ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      id="add-cost-input"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="1.20"
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 pl-7 pr-3 py-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Selling Price */}
                <div className="space-y-1">
                  <label htmlFor="add-price-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Retail Selling Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      id="add-price-input"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="4.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 pl-7 pr-3 py-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Low Threshold warning limit */}
                <div className="space-y-1">
                  <label htmlFor="add-threshold-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Reorder Stock warning threshold limit
                  </label>
                  <input
                    id="add-threshold-input"
                    type="number"
                    min="1"
                    required
                    placeholder="8"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Frame Color styling picker */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                    Skins Color Accents
                  </span>
                  <div className="flex gap-1.5 flex-wrap pt-0.5 justify-start">
                    {colorOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        id={`add-color-${c}`}
                        onClick={() => setFormColor(c)}
                        className={`w-5 h-5 rounded-full bg-${c}-500 border-2 transition-transform shrink-0 ${
                          formColor === c ? 'border-indigo-600 scale-120' : 'border-white hover:scale-110'
                        }`}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* Emoji illustration icons selection row */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                  Select Visual Avatar Symbol Icon
                </span>
                <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-2 bg-stone-50 rounded-lg border border-stone-200">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      id={`add-emoji-${emoji}`}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={`text-lg p-1 rounded-md transition-colors hover:bg-stone-200 shrink-0 ${
                        formIcon === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-offset-1' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action triggers */}
              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="add-product-cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="add-product-submit-btn"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2 px-5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT SPECIFIC MODAL DIALOG */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          {/* Backdrop exit screen click handler */}
          <div className="fixed inset-0" onClick={() => setIsEditModalOpen(false)} />
          
          <div 
            id="edit-product-form-card"
            className="relative bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-stone-200 z-60 animate-in zoom-in duration-150"
          >
            {/* Header branding */}
            <div className="bg-indigo-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-indigo-200" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">EDIT PRODUCT specifications</h3>
              </div>
              <button 
                id="close-edit-modal-btn"
                onClick={() => setIsEditModalOpen(false)} 
                className="text-indigo-100 hover:text-white p-1 rounded-md hover:bg-indigo-700/50"
                title="Cancel changes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Product Name */}
                <div className="space-y-1">
                  <label htmlFor="edit-name-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Product Title *
                  </label>
                  <input
                    id="edit-name-input"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* SKU Code */}
                <div className="space-y-1">
                  <label htmlFor="edit-sku-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Stock Keeping Unit (SKU)
                  </label>
                  <input
                    id="edit-sku-input"
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono uppercase"
                  />
                </div>

                {/* Categories Checklist */}
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                    Product Categories * (Select all that apply)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                    {CATEGORIES.filter(c => c !== 'All').map(c => {
                      const isChecked = formCategories.includes(c);
                      return (
                        <label 
                          key={c} 
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
                            isChecked 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-2xs' 
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCategories(prev => [...prev, c]);
                              } else {
                                if (formCategories.length > 1) {
                                  setFormCategories(prev => prev.filter(item => item !== c));
                                }
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Stock Edit */}
                <div className="space-y-1">
                  <label htmlFor="edit-stock-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Available Stock Quantity
                  </label>
                  <input
                    id="edit-stock-input"
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Purchase cost */}
                <div className="space-y-1">
                  <label htmlFor="edit-cost-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Purchase Cost ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      id="edit-cost-input"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 pl-7 pr-3 py-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Selling Price */}
                <div className="space-y-1">
                  <label htmlFor="edit-price-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Retail Selling Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      id="edit-price-input"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 pl-7 pr-3 py-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Min Stock warning */}
                <div className="space-y-1">
                  <label htmlFor="edit-threshold-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Reorder Stock warning threshold limit
                  </label>
                  <input
                    id="edit-threshold-input"
                    type="number"
                    min="1"
                    required
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Skins color accented styling picker */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                    Skin Color Accent
                  </span>
                  <div className="flex gap-1.5 flex-wrap pt-0.5 justify-start">
                    {colorOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        id={`edit-color-${c}`}
                        onClick={() => setFormColor(c)}
                        className={`w-5 h-5 rounded-full bg-${c}-500 border-2 transition-transform shrink-0 ${
                          formColor === c ? 'border-indigo-600 scale-120' : 'border-white hover:scale-110'
                        }`}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* Emoji avatar selectors row */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                  Select Visual Avatar Symbol Icon
                </span>
                <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-2 bg-stone-50 rounded-lg border border-stone-200">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      id={`edit-emoji-${emoji}`}
                      onClick={() => setFormIcon(emoji)}
                      className={`text-lg p-1 rounded-md transition-colors hover:bg-stone-200 shrink-0 ${
                        formIcon === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-offset-1' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="edit-product-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="edit-product-submit-btn"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2 px-5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Modification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV IMPORT WIZARD DIALOG MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          {/* Backdrop dismiss */}
          <div className="fixed inset-0" onClick={() => {
            resetImportWizard();
            setIsImportModalOpen(false);
          }} />

          <div
            id="csv-import-wizard-card"
            className="relative bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl border border-stone-200 z-60 animate-in zoom-in duration-150 flex flex-col my-8 max-h-[85vh]"
          >
            {/* Modal Header banner */}
            <div className="bg-indigo-650 bg-indigo-600 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5.5 h-5.5 text-indigo-200" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">Bulk Catalog Import Wizard</h3>
                  <p className="text-[10px] text-indigo-150 text-indigo-200 font-semibold mt-0.5">Bulk upload products to inventory database via safe CSV encoding</p>
                </div>
              </div>
              <button
                id="close-import-wizard-btn"
                type="button"
                onClick={() => {
                  resetImportWizard();
                  setIsImportModalOpen(false);
                }}
                className="text-indigo-100 hover:text-white hover:bg-indigo-700 flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                title="Cancel bulk upload"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wizard Steps indicator */}
            <div className="bg-stone-50 border-b border-stone-200 px-6 py-3.5 flex items-center justify-between text-xs select-none shrink-0">
              <div className="flex items-center gap-8 md:gap-12 w-full justify-center">
                {/* Step 1 indicator */}
                <div className={`flex items-center gap-2 ${importStep === 1 ? 'text-indigo-600 font-black' : 'text-stone-400 font-bold'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] border ${
                    importStep === 1 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-stone-200'
                  }`}>1</span>
                  <span>Upload Document</span>
                </div>
                
                {/* Chevron */}
                <ArrowRight className="w-4 h-4 text-stone-300 hidden sm:block" />

                {/* Step 2 indicator */}
                <div className={`flex items-center gap-2 ${importStep === 2 ? 'text-indigo-600 font-black' : 'text-stone-400 font-bold'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] border ${
                    importStep === 2 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-stone-200'
                  }`}>2</span>
                  <span>Reconcile & Map Fields</span>
                </div>

                {/* Chevron */}
                <ArrowRight className="w-4 h-4 text-stone-300 hidden sm:block" />

                {/* Step 3 indicator */}
                <div className={`flex items-center gap-2 ${importStep === 3 ? 'text-indigo-600 font-black' : 'text-stone-400 font-bold'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] border ${
                    importStep === 3 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-stone-200'
                  }`}>3</span>
                  <span>Review & Commit</span>
                </div>
              </div>
            </div>

            {/* Scrollable Wizard content container */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* STEP 1: LOAD DOCUMENT */}
              {importStep === 1 && (
                <div className="space-y-6 max-w-xl mx-auto py-4">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-extrabold text-stone-850">Select or Drag CSV File</h4>
                    <p className="text-xs text-stone-500 max-w-md mx-auto">
                      Load a `.csv` comma-separated values file specifying your inventory catalog data.
                      Missing attributes will be automatically filled with secure defaults.
                    </p>
                  </div>

                  {/* Dropzone container */}
                  <div 
                    id="csv-drag-dropzone"
                    className="border-2 border-dashed border-stone-200 hover:border-indigo-500 bg-stone-50/50 hover:bg-indigo-50/10 rounded-2xl p-8 text-center transition-all cursor-pointer relative"
                    onClick={() => document.getElementById('csv-file-selector')?.click()}
                  >
                    <input 
                      id="csv-file-selector"
                      type="file" 
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            handleCsvLoaded(text, file.name);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                    <span className="text-xs font-bold text-stone-700 block">Click to select CSV layout file</span>
                    <span className="text-[10px] text-stone-400 block mt-1">Accepts standard layout documents up to 5MB</span>
                  </div>

                  {/* Downloader template card */}
                  <div className="bg-indigo-50/30 border border-indigo-150/40 rounded-xl p-4 flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-indigo-950">Don't have a spreadsheet template ready?</p>
                      <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">Download a beautifully formatted helper file specifying our pre-configured inventory SKU patterns and category rules.</p>
                      <button
                        id="btn-download-csv-template"
                        type="button"
                        onClick={downloadTemplateCSV}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-905 text-indigo-900 bg-white border border-indigo-200 px-3.5 py-1.5 rounded-md hover:bg-indigo-50 cursor-pointer shadow-3xs uppercase tracking-wider transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Template CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: RECONCILE COLUMN MAPPING */}
              {importStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-stone-850">Map Spreadsheet Columns to Stock Specifications</h4>
                    <p className="text-xs text-stone-500">
                      Match the column titles found in your uploaded CSV (<strong>{csvFileName}</strong>) to the store database properties. We've done our best to automatically detect matching headers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Database properties panel */}
                    <div className="space-y-3 bg-stone-50 border border-stone-200 p-4 rounded-2xl">
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest block mb-2">Required Core Fields</span>
                      
                      {/* Name dynamic select */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="map-name" className="text-[11px] font-bold text-stone-700">Product Title / Name *</label>
                        <select
                          id="map-name"
                          value={mappings.name}
                          onChange={(e) => setMappings(prev => ({...prev, name: parseInt(e.target.value)}))}
                          className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="-1">-- Leave Blank / Generate random title --</option>
                          {headers.map((h, i) => <option key={i} value={i}>Column {i + 1}: "{h}"</option>)}
                        </select>
                      </div>

                      {/* SKU dynamic select */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="map-sku" className="text-[11px] font-bold text-stone-700">Stock Keeping Unit (SKU) *</label>
                        <select
                          id="map-sku"
                          value={mappings.sku}
                          onChange={(e) => setMappings(prev => ({...prev, sku: parseInt(e.target.value)}))}
                          className="w-full text-xs bg-white text-stone-100 md:bg-white text-stone-90) text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="-1">-- Unmapped / Auto-generate IDs --</option>
                          {headers.map((h, i) => <option key={i} value={i}>Column {i + 1}: "{h}"</option>)}
                        </select>
                      </div>

                      {/* Sell price dynamic select */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="map-price" className="text-[11px] font-bold text-stone-700">Retail Selling Price ($) *</label>
                        <select
                          id="map-price"
                          value={mappings.price}
                          onChange={(e) => setMappings(prev => ({...prev, price: parseInt(e.target.value)}))}
                          className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="-1">-- Unmapped / Set to $0.00 --</option>
                          {headers.map((h, i) => <option key={i} value={i}>Column {i + 1}: "{h}"</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Metadata attributes panel */}
                    <div className="space-y-3 bg-stone-50 border border-stone-200 p-4 rounded-2xl">
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest block mb-2">Optional Attributes & Limits</span>

                      {/* Cost margin select */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="map-cost" className="text-[11px] font-bold text-stone-700">Purchase Wholesale Cost ($)</label>
                        <select
                          id="map-cost"
                          value={mappings.cost}
                          onChange={(e) => setMappings(prev => ({...prev, cost: parseInt(e.target.value)}))}
                          className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold"
                        >
                          <option value="-1">-- Unmapped / Defaults to $0.00 --</option>
                          {headers.map((h, i) => <option key={i} value={i}>Column {i + 1}: "{h}"</option>)}
                        </select>
                      </div>

                      {/* Stock level select */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="map-stock" className="text-[11px] font-bold text-stone-700">Initial Stock Quantity</label>
                        <select
                          id="map-stock"
                          value={mappings.stock}
                          onChange={(e) => setMappings(prev => ({...prev, stock: parseInt(e.target.value)}))}
                          className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold"
                        >
                          <option value="-1">-- Unmapped / Set to 0 units --</option>
                          {headers.map((h, i) => <option key={i} value={i}>Column {i + 1}: "{h}"</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Categories Mapping */}
                        <div className="flex flex-col gap-1">
                          <label htmlFor="map-category" className="text-[11px] font-bold text-stone-700">Category</label>
                          <select
                            id="map-category"
                            value={mappings.category}
                            onChange={(e) => setMappings(prev => ({...prev, category: parseInt(e.target.value)}))}
                            className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold"
                          >
                            <option value="-1">-- Default: "Beverages" --</option>
                            {headers.map((h, i) => <option key={i} value={i}>"{h}"</option>)}
                          </select>
                        </div>

                        {/* Reorder Threshold Mapping */}
                        <div className="flex flex-col gap-1">
                          <label htmlFor="map-threshold" className="text-[11px] font-bold text-stone-700">Min. Threshold</label>
                          <select
                            id="map-threshold"
                            value={mappings.threshold}
                            onChange={(e) => setMappings(prev => ({...prev, threshold: parseInt(e.target.value)}))}
                            className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg cursor-pointer font-semibold"
                          >
                            <option value="-1">-- Default: 5 --</option>
                            {headers.map((h, i) => <option key={i} value={i}>"{h}"</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions mapping footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-stone-100 bg-white shrink-0">
                    <button
                      type="button"
                      id="btn-mapping-back"
                      onClick={resetImportWizard}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold py-2 px-5 rounded-lg transition-colors cursor-pointer font-sans"
                    >
                      Back to upload
                    </button>

                    <button
                      type="button"
                      id="btn-mapping-continue"
                      onClick={() => setImportStep(3)}
                      disabled={mappings.name === -1 && mappings.sku === -1}
                      className={`text-white text-xs font-black py-2 px-6 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider font-sans ${
                        mappings.name === -1 && mappings.sku === -1 
                          ? 'bg-stone-300 cursor-not-allowed opacity-60' 
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      Continue to review
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PREVIEW, RECONCILE DUPLICATES & COMPLETE */}
              {importStep === 3 && (
                <div className="space-y-6">
                  {/* File stats Summary */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-indigo-50/40 border border-indigo-150/50 p-4 rounded-xl">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">Processed Document Analytics</h4>
                      <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                        Identified <strong>{parsedProducts.length} rows</strong> of catalog items inside <strong>{csvFileName}</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold self-start md:self-auto">
                      <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-center">
                        <span className="font-mono block text-sm font-black text-emerald-900">{parsedProducts.filter((_, idx) => !validationResults[idx].hasErrors && !validationResults[idx].isDuplicate).length}</span>
                        <span className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider font-sans">NEW ASSETS</span>
                      </div>
                      <div className="bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-center">
                        <span className="font-mono block text-sm font-black text-amber-900">{parsedProducts.filter((_, idx) => validationResults[idx].isDuplicate).length}</span>
                        <span className="text-[9px] uppercase font-bold text-amber-700 tracking-wider font-sans">DUPLICATE SKUs</span>
                      </div>
                      <div className="bg-rose-100 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-lg text-center">
                        <span className="font-mono block text-sm font-black text-rose-900">{parsedProducts.filter((_, idx) => validationResults[idx].hasErrors).length}</span>
                        <span className="text-[9px] uppercase font-bold text-rose-700 tracking-wider font-sans">ERRORS SKIPPED</span>
                      </div>
                    </div>
                  </div>

                  {/* DUPLICATE KEY CONFLICT SETTING */}
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest block">Double SKU Collision Strategy</span>
                    <p className="text-[11px] text-stone-500">How should our registry write-back if an uploaded CSV item has an identical SKU code already registered in the store database?</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1.5">
                      <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all select-none ${
                        onDuplicateAction === 'overwrite' 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' 
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}>
                        <input
                          type="radio"
                          name="duplicateActionField"
                          checked={onDuplicateAction === 'overwrite'}
                          onChange={() => setOnDuplicateAction('overwrite')}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 animate-none cursor-pointer"
                        />
                        <div className="text-left">
                          <p className="text-[11px] font-black leading-none uppercase">Overwrite specs</p>
                          <span className="text-[9px] text-stone-500 block mt-1 font-semibold">Replace stored product name, sell rates, cost, and stock with the CSV file values.</span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all select-none ${
                        onDuplicateAction === 'merge' 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' 
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}>
                        <input
                          type="radio"
                          name="duplicateActionField"
                          checked={onDuplicateAction === 'merge'}
                          onChange={() => setOnDuplicateAction('merge')}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 animate-none cursor-pointer"
                        />
                        <div className="text-left">
                          <p className="text-[11px] font-black leading-none uppercase">AddTo stock (Merge)</p>
                          <span className="text-[9px] text-stone-500 block mt-1 font-semibold">Keep current prices & details. Add the CSV stock count directly into the existing item's quantity.</span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all select-none ${
                        onDuplicateAction === 'skip' 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' 
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}>
                        <input
                          type="radio"
                          name="duplicateActionField"
                          checked={onDuplicateAction === 'skip'}
                          onChange={() => setOnDuplicateAction('skip')}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 animate-none cursor-pointer"
                        />
                        <div className="text-left">
                          <p className="text-[11px] font-black leading-none uppercase">Ignore item / Skip</p>
                          <span className="text-[9px] text-stone-500 block mt-1 font-semibold">Do not modify the existing registered product details. Skip the duplicate record entirely.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* PREVIEW SUB TABLE */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest block">Data preview registry checklist</span>
                    <div className="border border-stone-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table id="csv-import-preview-table" className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-bold text-stone-500 uppercase tracking-wider">
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3">Import Details</th>
                            <th className="p-3">SKU</th>
                            <th className="p-3 text-right">Cost</th>
                            <th className="p-3 text-right">Selling</th>
                            <th className="p-3 text-center">Initial Stock</th>
                            <th className="p-3">Status check</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                          {parsedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-stone-400">Loading previews...</td>
                            </tr>
                          ) : (
                            parsedProducts.map((p, idx) => {
                              const val = validationResults[idx];
                              return (
                                <tr key={p.id} className={`hover:bg-stone-50/50 ${val.hasErrors ? 'bg-rose-50/30' : val.isDuplicate ? 'bg-amber-50/15' : ''}`}>
                                  <td className="p-3 text-center font-mono text-stone-400 font-normal">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm select-none">{p.icon}</span>
                                      <div className="truncate">
                                        <p className="font-extrabold text-stone-900 truncate">{p.name || <em className="text-stone-300 font-normal">No Title Provided</em>}</p>
                                        <span className="text-[8.5px] font-bold bg-stone-100 px-1 py-0.5 rounded text-stone-500 uppercase">{p.category}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-stone-500 text-[10px]">{p.sku || <em className="text-stone-300">N/A</em>}</td>
                                  <td className="p-3 text-right font-mono text-stone-700">${p.cost.toFixed(2)}</td>
                                  <td className="p-3 text-right font-mono font-bold text-stone-900">${p.price.toFixed(2)}</td>
                                  <td className="p-3 text-center font-mono font-black text-stone-850">{p.stock} units</td>
                                  <td className="p-3">
                                    {val.hasErrors ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md border border-rose-200">
                                        <AlertCircle className="w-3 h-3 shrink-0" /> Invalid
                                      </span>
                                    ) : val.isDuplicate ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] bg-amber-100 text-amber-805 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200" title={val.warnings.join(", ")}>
                                        <AlertTriangle className="w-3 h-3 shrink-0" /> Collides SKU
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                                        <Check className="w-3 h-3" /> Ready
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Wizard actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-stone-100 bg-white">
                    <button
                      type="button"
                      id="btn-preview-back"
                      onClick={() => setImportStep(2)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold py-2 px-5 rounded-lg transition-colors cursor-pointer font-sans"
                    >
                      Back to mapping
                    </button>

                    <button
                      type="button"
                      id="btn-preview-confirm"
                      onClick={handleBulkImportSubmit}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-6 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-150 transition-all font-sans uppercase tracking-wider"
                    >
                      <Check className="w-4 h-4" /> Confirm & Process Bulk-Add
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
