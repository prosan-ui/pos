import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Tag, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Plus, 
  Minus, 
  ShoppingCart, 
  AlertTriangle, 
  Sparkles, 
  Receipt,
  Download,
  Printer,
  CheckCircle2,
  Undo2
} from 'lucide-react';
import { Product, CartItem, SaleTransaction } from '../types';
import { CATEGORIES, DISCOUNT_CODES } from '../data/mockProducts';

interface POSTerminalProps {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  searchFilter: string;
  onCheckout: (transaction: SaleTransaction) => void;
  triggerSystemWarning: (text: string) => void;
}

export default function POSTerminal({
  products,
  cart,
  setCart,
  searchFilter,
  onCheckout,
  triggerSystemWarning
}: POSTerminalProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discountCode, setDiscountCode] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'Cash' | 'Card' | 'Mobile Pay'>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  
  // Checkout & Receipt Modal States
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [recentInvoice, setRecentInvoice] = useState<SaleTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'detailed'>('thermal');

  // Filter products based on Category & Search Filter
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchSearch = product.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchFilter]);

  // Compute Cart Financial Sums
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  }, [cart]);

  const discountDetails = useMemo(() => {
    if (!discountCode) return { percent: 0, flat: 0, code: '', amount: 0 };
    
    const promo = DISCOUNT_CODES.find(d => d.code.toUpperCase() === discountCode.trim().toUpperCase());
    if (!promo) return { percent: 0, flat: 0, code: '', amount: 0 };

    if (promo.type === 'percent') {
      const amount = (subtotal * promo.value) / 100;
      return { percent: promo.value, flat: 0, code: promo.code, amount };
    } else {
      const amount = Math.min(promo.value, subtotal);
      return { percent: 0, flat: promo.value, code: promo.code, amount };
    }
  }, [discountCode, subtotal]);

  const taxAmount = useMemo(() => {
    const taxableBase = Math.max(0, subtotal - discountDetails.amount);
    return taxableBase * 0.08; // Flat 8% tax rate
  }, [subtotal, discountDetails]);

  const totalAmount = useMemo(() => {
    const net = subtotal - discountDetails.amount + taxAmount;
    return Math.max(0, net);
  }, [subtotal, discountDetails, taxAmount]);

  // Fast Cash Options for Payment Calculation
  const fastCashAmounts = useMemo(() => {
    if (totalAmount <= 0) return [];
    const base = Math.ceil(totalAmount);
    return [
      base,
      Math.ceil(totalAmount / 5) * 5,
      Math.ceil(totalAmount / 10) * 10,
      Math.ceil(totalAmount / 20) * 20,
      100
    ].filter((val, idx, self) => self.indexOf(val) === idx && val >= totalAmount).slice(0, 4);
  }, [totalAmount]);

  const computedChange = useMemo(() => {
    const cashNum = parseFloat(cashTendered);
    if (isNaN(cashNum) || cashNum < totalAmount) return 0;
    return cashNum - totalAmount;
  }, [cashTendered, totalAmount]);

  // Cart Mutators
  const addToCart = (product: Product) => {
    // Check if item is already fully booked
    const existing = cart.find(item => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    
    if (product.stock <= 0) {
      triggerSystemWarning(`Cannot add "${product.name}". Product is completely out of stock.`);
      return;
    }

    if (currentQty >= product.stock) {
      triggerSystemWarning(`Cannot allocate more "${product.name}". Low stock limit reached (${product.stock} available).`);
      return;
    }

    if (existing) {
      setCart(prev => prev.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart(prev => [...prev, { id: `cart-${Date.now()}-${product.id}`, product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
      return;
    }

    // Check inventory ceiling bounds
    if (delta > 0 && newQty > item.product.stock) {
      triggerSystemWarning(`Allocation limit exceeded for "${item.product.name}". Only ${item.product.stock} units are in stock.`);
      return;
    }

    setCart(prev => prev.map(i => 
      i.product.id === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountCode('');
    setCashTendered('');
  };

  // Submit Completed Transaction and Open Receipt Panel
  const handleCheckoutComplete = () => {
    if (cart.length === 0) return;

    const cashVal = parseFloat(cashTendered);
    if (selectedPayment === 'Cash') {
      if (isNaN(cashVal) || cashVal < totalAmount) {
        triggerSystemWarning('Invalid Cash Received Amount. Minimum balance required exceeds input.');
        return;
      }
    }

    setIsCheckoutProcessing(true);

    // Formulate final transaction parameters
    const transactionItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      total: item.product.price * item.quantity
    }));

    // Calculate total costs to derive true profit margins
    const totalCostOfGoods = cart.reduce((acc, item) => acc + (item.product.cost * item.quantity), 0);
    const finalProfit = totalAmount - totalCostOfGoods;

    const invoiceNo = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newTransaction: SaleTransaction = {
      id: `tx-${Date.now()}`,
      invoiceNo,
      timestamp: new Date().toLocaleString(),
      items: transactionItems,
      subtotal,
      discountPercent: discountDetails.percent,
      discountAmount: discountDetails.amount,
      discountCode: discountDetails.code,
      taxAmount,
      totalAmount,
      profitAmount: finalProfit,
      paymentMethod: selectedPayment,
      cashReceived: selectedPayment === 'Cash' ? cashVal : totalAmount,
      changeDue: selectedPayment === 'Cash' ? computedChange : 0
    };

    setTimeout(() => {
      onCheckout(newTransaction);
      setRecentInvoice(newTransaction);
      setIsCheckoutProcessing(false);
      setIsReceiptModalOpen(true);
      clearCart();
    }, 850); // Small realistic delay
  };

  // Trigger native print dialog for the current browser page
  const handleReceiptPrint = () => {
    window.print();
  };

  const handleReceiptDownloadSimulation = () => {
    if (!recentInvoice) return;
    const receiptText = `
-----------------------------------------
            NOTUS POS TERMINAL               
            VUE ADIN KIT SYSTEM           
-----------------------------------------
Invoice No : ${recentInvoice.invoiceNo}
Date       : ${recentInvoice.timestamp}
=========================================
${recentInvoice.items.map(item => `${item.name.padEnd(24)} x${item.quantity}  $${item.total.toFixed(2)}`).join('\n')}
=========================================
Subtotal   : $${recentInvoice.subtotal.toFixed(2)}
Discount   : -$${recentInvoice.discountAmount.toFixed(2)} (${recentInvoice.discountCode || 'N/A'})
Tax (8%)   : $${recentInvoice.taxAmount.toFixed(2)}
-----------------------------------------
TOTAL PAID : $${recentInvoice.totalAmount.toFixed(2)}
Method     : ${recentInvoice.paymentMethod}
Received   : $${(recentInvoice.cashReceived || 0).toFixed(2)}
Change Due : $${(recentInvoice.changeDue || 0).toFixed(2)}
-----------------------------------------
        Thank you for your visit!        
`;
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${recentInvoice.invoiceNo}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-5rem)] p-4 md:p-6 bg-slate-50/50">
      
      {/* LEFT COLUMN: CATEGORIES + PRODUCTS (Col span 7/12 on large desktops) */}
      <div className="xl:col-span-7 flex flex-col space-y-6">
        
        {/* Categories Bar Panel */}
        <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs">
          <div className="flex gap-2 overflow-x-auto scroller pb-1.5 pt-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                id={`cat-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedCategory(category)}
                className={`text-xs px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100 font-bold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200/50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Product Catalog Registry Grid */}
        <div className="flex-1">
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-xs">
              <p className="text-stone-400 text-sm">No products found matching filters.</p>
              <button 
                id="reset-pos-filter-btn"
                onClick={() => { setSelectedCategory('All'); }}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 mx-auto"
              >
                <Undo2 className="w-4 h-4" /> Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" id="pos-product-catalog">
              {filteredProducts.map((product) => {
                const inCartItem = cart.find(item => item.product.id === product.id);
                const quantityAllocated = inCartItem ? inCartItem.quantity : 0;
                const isOutOfStock = product.stock <= 0;
                const isLowStock = !isOutOfStock && product.stock <= product.threshold;
                const progressWidth = isOutOfStock ? 0 : Math.min(100, (product.stock / 50) * 100);

                // Setup tag colors
                let colorClasses = 'border-stone-100 bg-white';
                let accentBg = 'bg-stone-100 text-stone-600';
                
                if (product.color === 'amber') { colorClasses = 'hover:border-amber-400 focus:bg-amber-50/10'; accentBg = 'bg-amber-50 text-amber-700 border border-amber-100'; }
                else if (product.color === 'emerald') { colorClasses = 'hover:border-emerald-400 focus:bg-emerald-50/10'; accentBg = 'bg-emerald-50 text-emerald-800 border border-emerald-100'; }
                else if (product.color === 'orange') { colorClasses = 'hover:border-orange-400'; accentBg = 'bg-orange-50 text-orange-800 border border-orange-100'; }
                else if (product.color === 'blue') { colorClasses = 'hover:border-blue-400'; accentBg = 'bg-blue-50 text-blue-800 border border-blue-100'; }
                else if (product.color === 'rose') { colorClasses = 'hover:border-rose-400'; accentBg = 'bg-rose-50 text-rose-800 border border-rose-100'; }
                else if (product.color === 'yellow') { colorClasses = 'hover:border-yellow-400'; accentBg = 'bg-yellow-50 text-yellow-800 border border-yellow-100'; }
                else if (product.color === 'pink') { colorClasses = 'hover:border-pink-400'; accentBg = 'bg-pink-50 text-pink-800 border border-pink-100'; }
                else if (product.color === 'violet') { colorClasses = 'hover:border-violet-400'; accentBg = 'bg-violet-50 text-violet-800 border border-violet-100'; }
                else if (product.color === 'teal') { colorClasses = 'hover:border-teal-400'; accentBg = 'bg-teal-50 text-teal-800 border border-teal-100'; }
                else if (product.color === 'indigo') { colorClasses = 'hover:border-indigo-400'; accentBg = 'bg-indigo-50 text-indigo-800 border border-indigo-100'; }
                else if (product.color === 'sky') { colorClasses = 'hover:border-sky-400'; accentBg = 'bg-sky-50 text-sky-800 border border-sky-100'; }
                else if (product.color === 'purple') { colorClasses = 'hover:border-purple-400'; accentBg = 'bg-purple-50 text-purple-800 border border-purple-100'; }

                return (
                  <button
                    key={product.id}
                    id={`pos-product-${product.id}`}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    disabled={isOutOfStock}
                    title={isOutOfStock ? `${product.name} is Out of stock` : `Add ${product.name} to cart`}
                    className={`w-full text-left bg-white border rounded-2xl p-4 transition-all duration-150 relative group flex flex-col justify-between h-[180px] shadow-xs cursor-pointer ${colorClasses} ${
                      isOutOfStock ? 'opacity-60 cursor-not-allowed border-stone-200' : 'hover:shadow-md'
                    }`}
                  >
                    {/* Badge identifiers */}
                    <div className="flex justify-between items-start w-full">
                      <div className={`text-xl p-2 rounded-xl ${accentBg} transition-transform duration-150 group-hover:scale-110`}>
                        {product.icon}
                      </div>

                      {quantityAllocated > 0 && (
                        <span className="bg-indigo-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                          {quantityAllocated} in cart
                        </span>
                      )}

                      {isOutOfStock && (
                        <span className="bg-stone-100 text-stone-500 border border-stone-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-stone-400" /> OUT
                        </span>
                      )}

                      {isLowStock && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> LOW
                        </span>
                      )}
                    </div>

                    {/* Catalog info text */}
                    <div className="mt-3.5 flex-1 select-none">
                      <p className="text-[10px] text-stone-400 font-semibold tracking-wider font-mono uppercase">
                        {product.sku}
                      </p>
                      <h4 className="font-bold text-stone-800 group-hover:text-indigo-600 transition-colors text-xs line-clamp-2 leading-snug mt-0.5">
                        {product.name}
                      </h4>
                    </div>

                    {/* Pricing, remaining count and bar representation */}
                    <div className="mt-3 w-full">
                      <div className="flex justify-between items-end border-t border-stone-100 pt-2.5">
                        <span className="text-[11px] font-semibold text-stone-400">
                          Qty: <strong className={product.stock <= 5 ? 'text-rose-500 font-extrabold':'text-stone-800'}>{product.stock}</strong>
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-stone-900 font-mono">
                            ${product.price.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Micro inventory thermometer bar */}
                      <div className="w-full bg-stone-100 h-1 mt-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            isOutOfStock ? 'w-0' :
                            isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} 
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: INTERACTIVE ORDER CART SUMMARY (Col span 5/12) */}
      <div className="xl:col-span-5 flex flex-col bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
        {/* Cart Title Actions */}
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-stone-800">
              Active Order Receipt ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </span>
          </div>
          
          {cart.length > 0 && (
            <button
              id="empty-cart-btn"
              onClick={clearCart}
              className="text-stone-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] uppercase font-bold"
              title="Empty active order"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Dynamic Items list */}
        <div className="flex-1 overflow-y-auto max-h-[320px] p-4 divide-y divide-stone-100" id="cart-items-container">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center py-20 text-center text-stone-400">
              <ShoppingCart className="w-12 h-12 text-stone-200 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold text-stone-600">Register is empty</p>
              <span className="text-[10px] text-stone-400 max-w-[200px] leading-relaxed mt-1">
                Select items from the catalog on the left to initialize order billing.
              </span>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.id} 
                id={`cart-item-${item.product.id}`}
                className="py-3.5 flex items-center justify-between gap-3 group first:pt-0"
              >
                {/* Info summary */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm shrink-0">{item.product.icon}</span>
                    <h5 className="font-bold text-stone-800 text-xs truncate leading-snug">
                      {item.product.name}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-stone-400 mt-1">
                    <span>${item.product.price.toFixed(2)} / unit</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">Qty limit: {item.product.stock}</span>
                  </div>
                </div>

                {/* Adjustments row */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-50 select-none">
                    <button
                      id={`cart-decrement-${item.product.id}`}
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 text-stone-500 hover:text-stone-800 hover:bg-white rounded-md transition-colors"
                      title="Reduce quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="w-7 text-center font-mono text-xs font-extrabold text-stone-800">
                      {item.quantity}
                    </span>

                    <button
                      id={`cart-increment-${item.product.id}`}
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 text-stone-500 hover:text-stone-800 hover:bg-white rounded-md transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-16 text-right">
                    <span className="font-mono text-xs font-extrabold text-stone-900 block">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  <button
                    id={`cart-remove-${item.product.id}`}
                    onClick={() => removeCartItem(item.product.id)}
                    className="p-1 text-stone-300 hover:text-rose-500 rounded-lg hover:bg-stone-50 opacity-0 group-hover:opacity-100 transition-all duration-150"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* COUPON & PAYMENT METHOD CHANNELS */}
        {cart.length > 0 && (
          <div className="p-4 bg-stone-50 border-t border-b border-stone-200">
            {/* Promo coupons dropdown selection */}
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-stone-400" />
              <label htmlFor="promo-dropdown" className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                Apply Promo Discount
              </label>
            </div>
            
            <div className="flex gap-2 mt-1.5">
              <select
                id="promo-dropdown"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="flex-1 text-xs bg-white text-stone-900 border border-stone-200 px-2 py-1.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="">No Promotional Code</option>
                {DISCOUNT_CODES.map(d => (
                  <option key={d.code} value={d.code}>
                    {d.code} (-{d.type === 'percent' ? `${d.value}%` : `$${d.value.toFixed(2)}`})
                  </option>
                ))}
              </select>
              {discountCode && (
                <button
                  id="remove-discount-btn"
                  onClick={() => setDiscountCode('')}
                  className="text-xs text-rose-500 hover:text-rose-700 bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg font-medium"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Payment Method Selector Grid */}
            <div className="mt-4">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                Select Tender Payment Method
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'Cash', icon: DollarSign, color: 'text-emerald-500' },
                  { value: 'Card', icon: CreditCard, color: 'text-blue-500' },
                  { value: 'Mobile Pay', icon: Smartphone, color: 'text-violet-500' }
                ].map((pay) => {
                  const PayIcon = pay.icon;
                  const isSelected = selectedPayment === pay.value;
                  return (
                    <button
                      key={pay.value}
                      id={`pay-method-${pay.value.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        setSelectedPayment(pay.value as any);
                        if (pay.value !== 'Cash') {
                          setCashTendered('');
                        }
                      }}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100 hover:border-stone-300'
                      }`}
                    >
                      <PayIcon className={`w-4 h-4 ${pay.color}`} />
                      <span className="text-[10px]">{pay.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If Payment method is Cash, prompt cash input + fast calculators */}
            {selectedPayment === 'Cash' && (
              <div className="mt-4 p-3 bg-white border border-stone-200 rounded-xl space-y-2.5" id="tender-cash-section">
                <div className="flex items-center justify-between gap-2.5">
                  <label htmlFor="tender-cash-input" className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    Cash Received Tender
                  </label>
                  <div className="relative max-w-[120px]">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-stone-400 text-xs font-bold">$</span>
                    <input
                      id="tender-cash-input"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full text-xs text-right bg-stone-50 border border-stone-200 pl-5 pr-2 py-1 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono font-extrabold"
                    />
                  </div>
                </div>

                {/* Fast Tender helpers */}
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <button
                    id="tender-exact-change-btn"
                    onClick={() => setCashTendered(totalAmount.toFixed(2))}
                    className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
                  >
                    Exact: ${totalAmount.toFixed(2)}
                  </button>
                  {fastCashAmounts.map((amt) => (
                    <button
                      key={amt}
                      id={`tender-fast-${amt}`}
                      onClick={() => setCashTendered(amt.toFixed(2))}
                      className="text-[9px] font-mono font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-stone-200 px-2.5 py-1 rounded-md transition-colors"
                    >
                      ${amt.toFixed(2)}
                    </button>
                  ))}
                </div>

                {/* Change calculator projection */}
                {parseFloat(cashTendered) >= totalAmount && (
                  <div className="pt-2 border-t border-dashed border-stone-100 flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-500">Change Due Back:</span>
                    <span className="font-mono font-extrabold text-emerald-600">
                      ${computedChange.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FINANCIAL SUMMARY & CHECKOUT BUTTON */}
        <div className="p-4 space-y-3 bg-white mt-auto border-t border-stone-200">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">Cart Subtotal</span>
              <span className="font-mono font-semibold text-stone-800">${subtotal.toFixed(2)}</span>
            </div>
            
            {discountDetails.amount > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-700">
                <span className="flex items-center gap-1 font-medium">Discount ({discountDetails.code})</span>
                <span className="font-mono font-bold">-${discountDetails.amount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-xs text-stone-500">
              <span className="flex items-center gap-1">Sales Tax (8%)</span>
              <span className="font-mono font-semibold text-stone-800">${taxAmount.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
              <span className="font-bold text-stone-800 text-sm">Grand Total</span>
              <span className="font-mono font-extrabold text-indigo-600 text-lg" id="checkout-grand-total">
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            id="pos-checkout-complete-btn"
            onClick={handleCheckoutComplete}
            disabled={cart.length === 0 || isCheckoutProcessing || (selectedPayment === 'Cash' && (!cashTendered || parseFloat(cashTendered) < totalAmount))}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            {isCheckoutProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing checkout...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 shrink-0" />
                Complete Payment Checkout
              </>
            )}
          </button>
        </div>
      </div>

      {/* RECIPT DIALOG MODAL SIMULATION */}
      {isReceiptModalOpen && recentInvoice && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto print:p-0 print:bg-white">
          {/* Backdrop exit block - Hidden when printing */}
          <div className="fixed inset-0 no-print" onClick={() => setIsReceiptModalOpen(false)} />
          
          <div 
            id="receipt-modal-card"
            className="relative bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200 z-60 animate-in fade-in duration-300 print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-full print:bg-white print:p-0"
          >
            {/* Modal Header banner - Hidden when printing */}
            <div className="bg-emerald-500 text-white p-4 text-center no-print flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-xs tracking-wide">TENDER PAY SUCCESSFUL</h3>
                  <p className="text-[9px] text-emerald-100 font-mono">Invoice: {recentInvoice.invoiceNo}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-emerald-600 p-1 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Layout selection tabs - Hidden when printing */}
            <div className="no-print bg-stone-100 p-1.5 flex gap-1.5 border-b border-stone-250/60 text-xs shadow-inner">
              <button
                onClick={() => setPrintFormat('thermal')}
                className={`flex-1 py-2 font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  printFormat === 'thermal'
                    ? 'bg-white text-indigo-700 shadow-sm border-stone-200'
                    : 'text-stone-500 hover:text-stone-850 hover:bg-stone-50 border-transparent'
                }`}
              >
                <div className="text-base">📟</div>
                80mm Thermal Receipt
              </button>
              <button
                onClick={() => setPrintFormat('detailed')}
                className={`flex-1 py-2 font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  printFormat === 'detailed'
                    ? 'bg-white text-indigo-700 shadow-sm border-stone-200'
                    : 'text-stone-500 hover:text-stone-850 hover:bg-stone-50 border-transparent'
                }`}
              >
                <div className="text-base">📄</div>
                Detailed corporate Invoice
              </button>
            </div>

            {/* Central Printable Area */}
            <div className="p-6 bg-stone-50 max-h-[500px] overflow-y-auto print:max-h-none print:p-0 print:bg-white" id="print-invoice-area">
              
              {printFormat === 'thermal' ? (
                /* 1. Monochromatic Thermal Paper Slip format */
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs text-stone-700 text-[11px] font-mono select-text leading-relaxed mx-auto max-w-sm print:border-none print:shadow-none print:p-0">
                  <div className="text-center font-sans space-y-1 pb-4 border-b border-dashed border-stone-300">
                    <h4 className="font-extrabold text-base text-stone-900 tracking-wider">
                      ★ NOTUS TERMINAL ★
                    </h4>
                    <p className="text-[10px] text-stone-500">123 Corporate Blvd, Ste 400</p>
                    <p className="text-[10px] text-stone-500">Tel: (555) 019-2834</p>
                    <div className="bg-stone-900 text-white text-[9px] hover:bg-black font-semibold px-2 py-0.5 rounded uppercase mt-2 inline-block font-sans">
                      POS THERMAL SALE RECEIPT
                    </div>
                  </div>

                  <div className="space-y-1 border-b border-dashed border-stone-300 py-3 text-[10px] text-stone-500 uppercase">
                    <div className="flex justify-between"><span>DATE / TIME:</span><span>{recentInvoice.timestamp}</span></div>
                    <div className="flex justify-between"><span>INVOICE ID:</span><span className="font-bold text-stone-800">{recentInvoice.invoiceNo}</span></div>
                    <div className="flex justify-between"><span>REGISTER:</span><span>STATION-01-A</span></div>
                    <div className="flex justify-between"><span>DUTY CLERK:</span><span>John Doe-012</span></div>
                    <div className="flex justify-between"><span>PAYMENT METHOD:</span><span>{recentInvoice.paymentMethod}</span></div>
                  </div>

                  {/* Items detailed breakdown list */}
                  <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-stone-400">
                      <span>QTY / ITEM CATALOG DESCR.</span>
                      <span>TOTAL</span>
                    </div>
                    {recentInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                        <div className="break-words max-w-[220px]">
                          <span className="font-semibold">{item.quantity} x {item.name}</span>
                          <span className="text-[10px] text-stone-400 block">@ ${item.price.toFixed(2)} each</span>
                        </div>
                        <span className="font-bold">${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals arithmetic lines */}
                  <div className="space-y-1.5 pt-3 text-stone-850">
                    <div className="flex justify-between">
                      <span>SUBTOTAL AMOUNT:</span>
                      <span>${recentInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    {recentInvoice.discountAmount > 0 && (
                      <div className="flex justify-between text-stone-900 border-b border-dotted border-stone-200 pb-1">
                        <span>DISCOUNT ({recentInvoice.discountCode}):</span>
                        <span>-${recentInvoice.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>TAX CALCULATED (8%):</span>
                      <span>${recentInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-950 font-extrabold border-t border-dashed border-stone-300 pt-2 font-sans">
                      <span>GRAND TOTAL PAID:</span>
                      <span className="font-mono text-base">${recentInvoice.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-dotted border-stone-200 pt-2.5 space-y-1 text-[10px] text-stone-500">
                      <div className="flex justify-between">
                        <span>RECEIVED TENDER CASH:</span>
                        <span>${(recentInvoice.cashReceived || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-stone-900">
                        <span>CHANGE RETURNED:</span>
                        <span className="font-bold">${(recentInvoice.changeDue || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* barcode */}
                  <div className="pt-6 text-center mt-2 border-t border-dashed border-stone-300">
                    <div className="h-10 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_5px,#000_5px,#000_7px)] mx-auto max-w-[190px] opacity-80" />
                    <p className="text-[9px] text-stone-400 mt-1.5 uppercase font-semibold">Verification Code: {recentInvoice.id}</p>
                    <p className="text-[10px] text-stone-600 font-sans italic mt-3 font-semibold">
                      *** THANK YOU FOR VISITING NOTUS ***<br/>
                      PLEASE RETAIN THIS COMPLIANCE SLIP
                    </p>
                  </div>
                </div>
              ) : (
                /* 2. Premium Detailed Corporate Letterhead format */
                <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-xs text-stone-700 text-xs select-text leading-relaxed mx-auto max-w-full print:border-none print:shadow-none print:p-0">
                  {/* Letterhead Header */}
                  <div className="flex justify-between items-start border-b border-indigo-100 pb-6">
                    <div>
                      <h4 className="text-xl font-black text-indigo-700 tracking-tight font-sans">
                        NOTUS TERMINALS, INC.
                      </h4>
                      <p className="text-[11px] text-stone-500 font-sans mt-1">
                        High Speed POS Infrastructure & Store Control System
                      </p>
                      <p className="text-[10px] text-stone-400 font-sans mt-0.5">
                        Headquarters: 123 Corporate Blvd, Suite 400<br/>
                        Cityville, NY 10001 | contact@notustech.cloud
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-md font-sans">
                        OFFICIAL TRANSACTION RECORD
                      </span>
                      <h5 className="text-stone-900 font-extrabold text-sm mt-3 font-mono">
                        {recentInvoice.invoiceNo}
                      </h5>
                      <p className="text-[10px] text-stone-400 mt-0.5">Date: {recentInvoice.timestamp}</p>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 gap-4 py-6 border-b border-stone-100 text-[11px]">
                    <div>
                      <span className="font-bold text-stone-400 uppercase tracking-wider block text-[9px] mb-1">Billed From</span>
                      <strong className="text-stone-800 block text-xs">Notus Station Terminal-1A</strong>
                      <span className="text-stone-500">Clerk Operative: John Doe (ID: 012)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-stone-400 uppercase tracking-wider block text-[9px] mb-1">Billed To</span>
                      <strong className="text-stone-800 block text-xs">Walk-In Retail Customer</strong>
                      <span className="text-stone-500">Clearing Method: {recentInvoice.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items detailed grid table */}
                  <table className="w-full text-left my-6 text-[11.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-400 text-[9px] font-bold uppercase tracking-wider">
                        <th className="py-2.5">Item Description</th>
                        <th className="py-2.5 text-center w-12">Qty</th>
                        <th className="py-2.5 text-right w-24">Unit Price</th>
                        <th className="py-2.5 text-right w-24">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {recentInvoice.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 font-medium text-stone-900">
                            {item.name}
                          </td>
                          <td className="py-3 text-center font-semibold text-stone-500">
                            {item.quantity}
                          </td>
                          <td className="py-3 text-right text-stone-500">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-bold text-stone-900">
                            ${item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Financial breakdown */}
                  <div className="flex justify-end pt-4 border-t border-stone-200">
                    <div className="w-72 space-y-2 text-[11px] text-stone-500">
                      <div className="flex justify-between">
                        <span>Invoice Subtotal:</span>
                        <span className="font-semibold text-stone-800">${recentInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      {recentInvoice.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount Applied ({recentInvoice.discountCode}):</span>
                          <span className="font-bold">-${recentInvoice.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Applicable Sales Tax (8.00%):</span>
                        <span className="font-semibold text-stone-800">${recentInvoice.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-indigo-700 font-extrabold border-t border-indigo-100 pt-2.5 font-sans">
                        <span className="text-xs uppercase tracking-wide">Grand Total Billed:</span>
                        <span className="text-sm font-bold text-indigo-600 font-mono">${recentInvoice.totalAmount.toFixed(2)}</span>
                      </div>

                      <div className="border-t border-dashed border-stone-200 pt-2.5 space-y-1 text-[10px] leading-relaxed">
                        <div className="flex justify-between">
                          <span>Payment Method Cleared:</span>
                          <span className="font-medium text-stone-700">{recentInvoice.paymentMethod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amount Tendered:</span>
                          <span className="font-mono text-stone-800">${(recentInvoice.cashReceived || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-800 font-medium">
                          <span>Change Settled / Due Back:</span>
                          <span className="font-mono text-stone-900 font-bold">${(recentInvoice.changeDue || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-stone-100 text-[10px] text-stone-400 flex justify-between items-center">
                    <span>Invoice generated automatically by secure Notus crypt-ledger standard.</span>
                    <span className="font-semibold text-indigo-600 uppercase tracking-widest text-[8px]">
                      Authentic Document
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions buttons - Hidden when printing */}
            <div className="p-4 bg-stone-150/80 border-t border-stone-200 flex gap-2.5 no-print">
              <button
                id="receipt-print-btn"
                onClick={handleReceiptPrint}
                className="flex-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                title="Print Receipt"
              >
                <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                Print Invoice
              </button>
              
              <button
                id="receipt-download-btn"
                onClick={handleReceiptDownloadSimulation}
                className="flex-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                title="Download text receipt"
              >
                <Download className="w-4 h-4 text-stone-500 shrink-0" />
                Download TXT
              </button>

              <button
                id="receipt-close-btn"
                onClick={() => setIsReceiptModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-5 rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-150"
                title="Start new order"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

