import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Undo2,
  Camera,
  Scan,
  Volume2,
  VolumeX,
  Play,
  StopCircle,
  User,
  UserPlus,
  Award,
  Phone,
  Mail,
  Search,
  Target,
  TrendingUp,
  Settings,
  QrCode,
  Copy,
  ChevronRight,
  Sparkle,
  Info
} from 'lucide-react';
import { Product, CartItem, SaleTransaction, Employee, EmployeeShift, TaxConfig, Customer } from '../types';
import { CATEGORIES, DISCOUNT_CODES } from '../data/mockProducts';
import QRCode from 'qrcode';

// Customer unique barcode scanner and profile presentation
interface CustomerQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function CustomerQRCode({ value, size = 110, className = '' }: CustomerQRCodeProps) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      margin: 1.5,
      width: size,
      color: {
        dark: '#4f46e5', // Brand Indigo
        light: '#ffffff', // Clean contrast white
      },
    })
      .then((url) => {
        if (active) setQrSrc(url);
      })
      .catch((err) => {
        console.error('Failed to generate Loyalty QR code:', err);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!qrSrc) {
    return (
      <div 
        className="animate-pulse bg-stone-100 flex items-center justify-center rounded-lg border border-stone-200" 
        style={{ width: size, height: size }}
      >
        <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className={`p-1 bg-white border border-stone-200 rounded-lg shadow-2xs flex items-center justify-center ${className}`}>
      <img src={qrSrc} alt={`Loyalty QR Code for ${value}`} className="w-full h-auto origin-center" referrerPolicy="no-referrer" />
    </div>
  );
}

interface POSTerminalProps {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  searchFilter: string;
  onCheckout: (transaction: SaleTransaction) => void;
  triggerSystemWarning: (text: string) => void;
  employees: Employee[];
  shifts: EmployeeShift[];
  taxConfig?: TaxConfig;
  customers?: Customer[];
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
  transactions?: SaleTransaction[];
  currentEmployeeId?: string;
  setCurrentEmployeeId?: (id: string) => void;
}

export default function POSTerminal({
  products,
  cart,
  setCart,
  searchFilter,
  onCheckout,
  triggerSystemWarning,
  employees = [],
  shifts = [],
  taxConfig,
  customers = [],
  setCustomers,
  transactions = [],
  currentEmployeeId,
  setCurrentEmployeeId
}: POSTerminalProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discountCode, setDiscountCode] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'Cash' | 'Card' | 'Mobile Pay'>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  
  // Choose Employee State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    if (currentEmployeeId) return currentEmployeeId;
    const active = shifts.filter(s => !s.checkOutTime);
    if (active.length > 0) return active[0].employeeId;
    return '';
  });
  const [manualEmployeeId, setManualEmployeeId] = useState<string>('');

  // Keep selectedEmployeeId in sync with currentEmployeeId
  useEffect(() => {
    if (currentEmployeeId) {
      setSelectedEmployeeId(currentEmployeeId);
    }
  }, [currentEmployeeId]);

  // Keep currentEmployeeId in sync with selectedEmployeeId changes
  useEffect(() => {
    if (selectedEmployeeId && selectedEmployeeId !== 'manual' && setCurrentEmployeeId) {
      if (selectedEmployeeId !== currentEmployeeId) {
        setCurrentEmployeeId(selectedEmployeeId);
      }
    }
  }, [selectedEmployeeId, currentEmployeeId, setCurrentEmployeeId]);

  // Customer Loyalty States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [redeemPoints, setRedeemPoints] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [custRegNotice, setCustRegNotice] = useState<string | null>(null);

  // New QR & Profile Directory States
  const [isCustomerDirectoryOpen, setIsCustomerDirectoryOpen] = useState<boolean>(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);
  const [selectedCustomerForQrZoom, setSelectedCustomerForQrZoom] = useState<Customer | null>(null);
  const [manualQrScanInput, setManualQrScanInput] = useState<string>('');
  const [scannerFeedback, setScannerFeedback] = useState<{message: string; type: 'success' | 'error' | null}>({message: '', type: null});
  const [scannerBlink, setScannerBlink] = useState<boolean>(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState<string>('');

  // Daily Revenue Goal States
  const [dailySalesGoal, setDailySalesGoal] = useState<number>(() => {
    const saved = localStorage.getItem('notus_daily_sales_goal');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 1500; // default $1500 goal
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInputVal, setGoalInputVal] = useState(dailySalesGoal.toString());

  const activeEmployees = useMemo(() => {
    return shifts.filter(s => !s.checkOutTime);
  }, [shifts]);

  const filteredDirectoryCustomers = useMemo(() => {
    if (!directorySearchQuery) return customers;
    const q = directorySearchQuery.toLowerCase().trim();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.id.toLowerCase().includes(q) || 
      c.phone.includes(q) || 
      c.email.toLowerCase().includes(q)
    );
  }, [customers, directorySearchQuery]);

  // Checkout & Receipt Modal States
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [recentInvoice, setRecentInvoice] = useState<SaleTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'detailed'>('thermal');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'stock' | 'category' | 'sku'>('name');

  // Barcode Scanner states
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [isBeepEnabled, setIsBeepEnabled] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio Context playback failed or blocked:", e);
    }
  };

  const startCamera = async () => {
    try {
      setScanMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setIsScannerActive(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      console.error("Camera access failed/denied:", err);
      setIsScannerActive(true);
      setScanMessage("Virtual Simulator Active: Camera blocked/not found, using simulated stream.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsScannerActive(false);
    setAutoScanActive(false);
    setScanMessage(null);
  };

  const triggerSimulatedScan = (skuCode: string) => {
    const matched = products.find(p => p.sku.toLowerCase() === skuCode.trim().toLowerCase());
    if (matched) {
      if (matched.stock <= 0) {
        setScanMessage(`⚠️ SKU [${skuCode}] (${matched.name}) is out of stock!`);
        return;
      }
      
      if (isBeepEnabled) {
        playBeep();
      }

      addToCart(matched);
      setScanMessage(`✅ Successfully Scanned: ${matched.name} (${skuCode})`);
      
      setTimeout(() => {
        setScanMessage(prev => prev && prev.includes(skuCode) ? null : prev);
      }, 3500);
    } else {
      setScanMessage(`❌ Unknown Barcode: "${skuCode}" not found in catalog.`);
      setTimeout(() => {
        setScanMessage(prev => prev && prev.includes(skuCode) ? null : prev);
      }, 3500);
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    let intervalId: any = null;
    if (autoScanActive && isScannerActive) {
      intervalId = setInterval(() => {
        const available = products.filter(p => p.stock > 0);
        if (available.length > 0) {
          const randomProduct = available[Math.floor(Math.random() * available.length)];
          triggerSimulatedScan(randomProduct.sku);
        }
      }, 7000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoScanActive, isScannerActive, products]);

  // Calculate live product counts per category in POS terminal view
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
      const matchCategory = selectedCategory === 'All' || 
                            (product.categories && product.categories.includes(selectedCategory)) || 
                            product.category === selectedCategory;
      const matchSearch = product.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCategory && matchSearch;
    });

    // Apply active sort specifications
    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'price-asc') {
        return a.price - b.price;
      } else if (sortBy === 'price-desc') {
        return b.price - a.price;
      } else if (sortBy === 'stock') {
        return a.stock - b.stock;
      } else if (sortBy === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        return catA.localeCompare(catB);
      } else if (sortBy === 'sku') {
        return a.sku.localeCompare(b.sku);
      }
      return 0;
    });
  }, [products, selectedCategory, searchFilter, sortBy]);

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

  // Selected Customer reference
  const selectedCustomer = useMemo(() => {
    return (customers || []).find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Loyalty Member 5% discount (stacks on top of promo code discounts)
  const loyaltyDiscountAmount = useMemo(() => {
    if (!selectedCustomer) return 0;
    // 5% off the remaining balance after general promo discount
    const initialReduced = Math.max(0, subtotal - discountDetails.amount);
    return parseFloat((initialReduced * 0.05).toFixed(2));
  }, [selectedCustomer, subtotal, discountDetails.amount]);

  // Max points that can be redeemed based on remaining price
  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCustomer) return 0;
    const remainingAfterLoyalty = Math.max(0, subtotal - discountDetails.amount - loyaltyDiscountAmount);
    // 10 points = $1.00 of discount
    return Math.min(selectedCustomer.loyaltyPoints, Math.ceil(remainingAfterLoyalty * 10));
  }, [selectedCustomer, subtotal, discountDetails.amount, loyaltyDiscountAmount]);

  // Value of redeemed points ($0.10 per point)
  const loyaltyPointsRedeemDiscount = useMemo(() => {
    if (!selectedCustomer || !redeemPoints) return 0;
    return parseFloat((maxRedeemablePoints * 0.10).toFixed(2));
  }, [selectedCustomer, redeemPoints, maxRedeemablePoints]);

  // Taxable base after coupon, member discount, and points redemption
  const taxableBase = useMemo(() => {
    return Math.max(0, subtotal - discountDetails.amount - loyaltyDiscountAmount - loyaltyPointsRedeemDiscount);
  }, [subtotal, discountDetails.amount, loyaltyDiscountAmount, loyaltyPointsRedeemDiscount]);

  const taxAmount = useMemo(() => {
    const config = taxConfig || { globalRate: 8, categoryRates: {} };
    const rawTotalTax = cart.reduce((sum, item) => {
      const itemPrice = item.product.price;
      const itemQty = item.quantity;
      const category = item.product.category;
      
      const rate = (config.categoryRates && config.categoryRates[category] !== undefined)
        ? config.categoryRates[category]
        : config.globalRate;
        
      const itemTax = (itemPrice * itemQty) * (rate / 100);
      return sum + itemTax;
    }, 0);

    // Scaling factor proportional to pre-tax subtotal reduction by discounts
    const discountRatio = subtotal > 0 ? taxableBase / subtotal : 0;
    return rawTotalTax * discountRatio;
  }, [cart, subtotal, taxableBase, taxConfig]);

  const effectiveTaxRate = useMemo(() => {
    if (taxableBase <= 0) {
      return taxConfig?.globalRate ?? 8;
    }
    return (taxAmount / taxableBase) * 100;
  }, [taxAmount, taxableBase, taxConfig]);

  const totalAmount = useMemo(() => {
    const net = subtotal - discountDetails.amount - loyaltyDiscountAmount - loyaltyPointsRedeemDiscount + taxAmount;
    return Math.max(0, net);
  }, [subtotal, discountDetails.amount, loyaltyDiscountAmount, loyaltyPointsRedeemDiscount, taxAmount]);

  // Points earned on the current order (1 point per dollar spent)
  const earnedPoints = useMemo(() => {
    return Math.floor(totalAmount);
  }, [totalAmount]);

  // Filter customers for lookup autocomplete dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery) return [];
    const query = customerSearchQuery.trim().toLowerCase();
    return (customers || []).filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.replace(/[^0-9]/g, '').includes(query) || 
      c.phone.includes(query) ||
      c.email.toLowerCase().includes(query)
    );
  }, [customers, customerSearchQuery]);

  // Daily Sales calculations
  const dailyRevenueProgress = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    
    // Sum the total of all transactions completed today
    const salesToday = (transactions || []).reduce((sum, tx) => {
      try {
        const txDate = new Date(tx.timestamp).toLocaleDateString();
        if (txDate === todayStr) {
          return sum + tx.totalAmount;
        }
      } catch (e) {
        // Fallback checks
      }
      if (tx.timestamp && tx.timestamp.includes(todayStr)) {
        return sum + tx.totalAmount;
      }
      return sum;
    }, 0);

    const percent = dailySalesGoal > 0 ? (salesToday / dailySalesGoal) * 100 : 0;
    const remaining = Math.max(0, dailySalesGoal - salesToday);
    const isCompleted = salesToday >= dailySalesGoal;

    return {
      salesToday,
      percent: parseFloat(percent.toFixed(1)),
      remaining,
      isCompleted
    };
  }, [transactions, dailySalesGoal]);

  const handleSaveGoal = (valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      setDailySalesGoal(val);
      localStorage.setItem('notus_daily_sales_goal', val.toString());
      setIsEditingGoal(false);
    } else {
      triggerSystemWarning("Daily revenue goal must be a positive number.");
    }
  };

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
    setSelectedCustomerId('');
    setRedeemPoints(false);
    setCustomerSearchQuery('');
    setCustRegNotice(null);
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

    // Resolve employee cashier identity
    let assignedId = undefined;
    let assignedName = undefined;

    if (selectedEmployeeId && selectedEmployeeId !== 'manual') {
      assignedId = selectedEmployeeId;
      const actEmp = activeEmployees.find(e => e.employeeId === selectedEmployeeId);
      assignedName = actEmp ? actEmp.employeeName : undefined;
    } else if (manualEmployeeId.trim()) {
      assignedId = manualEmployeeId.trim().toUpperCase();
      const generalEmp = employees.find(e => e.id === assignedId);
      assignedName = generalEmp ? generalEmp.name : `Cashier ${assignedId}`;
    }

    if (!assignedId) {
      triggerSystemWarning('Please assign a Cashier / Employee ID for this transaction checkout.');
      return;
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
    
    const codeList = [
      discountDetails.code,
      selectedCustomer ? 'LOYALTY_MEMBER' : '',
      redeemPoints ? `REDEEM(${maxRedeemablePoints}pts)` : ''
    ].filter(Boolean);

    const newTransaction: SaleTransaction = {
      id: `tx-${Date.now()}`,
      invoiceNo,
      timestamp: new Date().toLocaleString(),
      items: transactionItems,
      subtotal,
      discountPercent: discountDetails.percent + (selectedCustomer ? 5 : 0),
      discountAmount: parseFloat((discountDetails.amount + loyaltyDiscountAmount + loyaltyPointsRedeemDiscount).toFixed(2)),
      discountCode: codeList.join(' + ') || 'None',
      taxAmount,
      totalAmount,
      profitAmount: finalProfit,
      paymentMethod: selectedPayment,
      cashReceived: selectedPayment === 'Cash' ? cashVal : totalAmount,
      changeDue: selectedPayment === 'Cash' ? computedChange : 0,
      employeeId: assignedId,
      employeeName: assignedName,
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      earnedPoints: selectedCustomer ? earnedPoints : undefined,
      redeemedPoints: selectedCustomer && redeemPoints ? maxRedeemablePoints : undefined
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
    const computedTaxPercent = recentInvoice.subtotal > 0 
      ? (recentInvoice.taxAmount / Math.max(0.01, recentInvoice.subtotal - recentInvoice.discountAmount)) * 100 
      : 8;
    const taxRateLabel = `Tax (${computedTaxPercent.toFixed(1)}%)`.padEnd(11);
    
    const customerSec = recentInvoice.customerId ? `
=========================================
LOYALTY ACCOUNT ASSOCIATED
Customer ID  : ${recentInvoice.customerId}
Member Name  : ${recentInvoice.customerName}
Points Earned: +${recentInvoice.earnedPoints || 0} pts
Points Used  : -${recentInvoice.redeemedPoints || 0} pts
=========================================` : '';

    const receiptText = `
-----------------------------------------
            NOTUS POS TERMINAL               
            VUE ADIN KIT SYSTEM           
-----------------------------------------
Invoice No : ${recentInvoice.invoiceNo}
Date       : ${recentInvoice.timestamp}${customerSec}
=========================================
${recentInvoice.items.map(item => `${item.name.padEnd(24)} x${item.quantity}  $${item.total.toFixed(2)}`).join('\n')}
=========================================
Subtotal   : $${recentInvoice.subtotal.toFixed(2)}
Discount   : -$${recentInvoice.discountAmount.toFixed(2)} (${recentInvoice.discountCode || 'N/A'})
${taxRateLabel}: $${recentInvoice.taxAmount.toFixed(2)}
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

  // Handler for loyalty barcodes quick simulation scanner scan
  const handleSimulatedCategoryScan = (customer: Customer) => {
    playBeep();
    setScannerFeedback({
      message: `🎯 SUCCESS: Scanned loyalty card for ${customer.name}!`,
      type: 'success'
    });
    setScannerBlink(true);
    setTimeout(() => setScannerBlink(false), 200);

    setSelectedCustomerId(customer.id);

    // Close the scanner nicely
    setTimeout(() => {
      setIsQrScannerOpen(false);
      setScannerFeedback({message: '', type: null});
    }, 1250);
  };

  // Handler for manual scanned loyalty code input submit (USB physical laser scanner simulation)
  const handleManualQrInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualQrScanInput.trim();
    if (!query) return;

    const matched = customers.find(c => 
      c.id.toLowerCase() === query.toLowerCase() || 
      c.phone.replace(/[^0-9]/g, '') === query.replace(/[^0-9]/g, '') ||
      c.email.toLowerCase() === query.toLowerCase()
    );

    if (matched) {
      handleSimulatedCategoryScan(matched);
      setManualQrScanInput('');
    } else {
      // Sound alert if wrong scan triggers
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (err) {}

      setScannerFeedback({
        message: `⚠️ No shopper matches the ID/details "${query}".`,
        type: 'error'
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-slate-50/50 min-h-[calc(100vh-5rem)]">
      
      {/* DAILY SALES TARGET TRACKER */}
      <div id="daily-sales-goal-card" className="bg-white border border-stone-200 rounded-xl p-4 md:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title and stats summary */}
          <div className="space-y-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Target className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  Daily Performance Tracker
                </h3>
                <p className="text-[10px] text-stone-400 font-medium">Real-time checkout monitoring vs company target settings</p>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-xl font-sans font-extrabold text-stone-800">
                ${dailyRevenueProgress.salesToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-stone-400">/</span>
              <span className="text-sm font-semibold text-stone-500 font-mono">
                ${dailySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                dailyRevenueProgress.isCompleted 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-250/30' 
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-250/30'
              }`}>
                {dailyRevenueProgress.percent}%
              </span>
            </div>
          </div>

          {/* Interactive visual progress bar container */}
          <div className="flex-1 max-w-2xl lg:px-4">
            <div className="flex justify-between text-[10px] font-bold text-stone-400 mb-1.5">
              <span className="uppercase tracking-wider">Progress Gauge</span>
              <span>
                {dailyRevenueProgress.isCompleted 
                  ? '🎉 GOAL COMPLETED!' 
                  : `Remaining: $${dailyRevenueProgress.remaining.toFixed(2)}`}
              </span>
            </div>
            
            <div className="relative w-full h-3.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200 shadow-3xs">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  dailyRevenueProgress.isCompleted 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, dailyRevenueProgress.percent)}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            </div>

            <p className="text-[9px] text-stone-400 italic mt-1.5 font-medium">
              {dailyRevenueProgress.isCompleted 
                ? "Excellent job! The retail checkout unit is performing above the standard daily goal." 
                : `Keep driving checkouts! Only $${dailyRevenueProgress.remaining.toFixed(2)} remaining to hit the daily goal.`}
            </p>
          </div>

          {/* Manager settings panel */}
          <div className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl lg:w-64">
            {!isEditingGoal ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Sales Goal</span>
                </div>
                <button
                  id="btn-edit-sales-goal"
                  type="button"
                  onClick={() => {
                    setGoalInputVal(dailySalesGoal.toString());
                    setIsEditingGoal(true);
                  }}
                  className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-stone-50 border border-stone-200/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  Adjust
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">Set Target (USD)</span>
                <div className="flex gap-2">
                  <input
                    id="input-sales-goal"
                    type="number"
                    min="1"
                    placeholder="E.g. 1500"
                    value={goalInputVal}
                    onChange={(e) => setGoalInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveGoal(goalInputVal);
                      }
                    }}
                    className="w-full text-xs p-1 bg-white text-stone-900 border border-stone-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <div className="flex gap-1">
                    <button
                      id="btn-save-sales-goal"
                      type="button"
                      onClick={() => handleSaveGoal(goalInputVal)}
                      className="text-[8px] font-bold bg-indigo-600 text-white min-w-[40px] px-2 py-1 rounded hover:bg-indigo-700 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      id="btn-cancel-sales-goal"
                      type="button"
                      onClick={() => setIsEditingGoal(false)}
                      className="text-[8px] font-bold bg-white text-stone-500 border border-stone-200 px-2 py-1 rounded hover:bg-stone-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[8px] text-stone-400 font-bold uppercase">Presets:</span>
                  {[1000, 2000, 5000].map(val => (
                    <button
                      key={val}
                      id={`btn-preset-goal-${val}`}
                      type="button"
                      onClick={() => {
                        setGoalInputVal(val.toString());
                        handleSaveGoal(val.toString());
                      }}
                      className="text-[8px] font-semibold text-stone-600 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-stone-200 rounded px-1.5 py-0.5 cursor-pointer"
                    >
                      ${val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: CATEGORIES + PRODUCTS (Col span 7/12 on large desktops) */}
      <div className="xl:col-span-7 flex flex-col md:flex-row gap-5">
        
        {/* Modern left Filtering Sidebar inside left column */}
        <div className="w-full md:w-52 shrink-0 bg-white border border-stone-200 rounded-xl p-4 shadow-2xs flex flex-col space-y-4 h-fit md:sticky md:top-20">
          
          {/* BARCODE SCANNER LIVE TERMINAL */}
          <div className="border border-indigo-150 bg-indigo-50/20 rounded-xl p-3 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5 text-indigo-500" /> Scanner Gateway
              </span>
              {isScannerActive && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[8px] font-extrabold text-emerald-600 uppercase tracking-widest">LIVE</span>
                </span>
              )}
            </div>

            {!isScannerActive ? (
              <div className="bg-white border border-stone-200/80 rounded-lg p-2 text-center space-y-2">
                <p className="text-[9px] text-stone-400 font-semibold leading-relaxed">
                  Scan Product SKUs instantly via your browser camera stream.
                </p>
                <button
                  id="btn-start-scanner"
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                >
                  <Camera className="w-3 h-3" />
                  <span>Activate Scanner</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Visual Viewfinder Frame */}
                <div className="relative rounded-lg overflow-hidden border border-stone-300 bg-black aspect-square flex items-center justify-center group shadow-inner">
                  {cameraStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 text-stone-400 bg-stone-900/95">
                      <Camera className="w-5 h-5 text-stone-500 animate-pulse mb-1" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Lens Active (Simulated)</span>
                    </div>
                  )}

                  {/* Red Laser Overlay Line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-rose-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce pointer-events-none" style={{ top: '45%' }} />
                </div>

                {/* Scan notice display */}
                {scanMessage && (
                  <div className={`p-1.5 rounded-lg text-[9px] font-extrabold text-center border animate-fade-in ${
                    scanMessage.startsWith('✅') 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : scanMessage.startsWith('⚠️')
                      ? 'bg-amber-50 border-amber-100 text-amber-700'
                      : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                  }`}>
                    {scanMessage}
                  </div>
                )}

                {/* Controller Action buttons */}
                <div className="flex items-center gap-1 select-none">
                  {/* Auto loop simulation toggle */}
                  <button
                    id="btn-toggle-autoscan"
                    onClick={() => {
                      setAutoScanActive(!autoScanActive);
                      if (!autoScanActive) {
                        setScanMessage("🤖 Cycle-scan active (7s intervals)");
                      } else {
                        setScanMessage(null);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded-md text-[8px] font-bold border cursor-pointer transition-all ${
                      autoScanActive
                        ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold shadow-3xs'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                    title="Simulates scanning automatic random products every 7s"
                  >
                    {autoScanActive ? <StopCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" /> : <Play className="w-2.5 h-2.5 text-stone-400 shrink-0" />}
                    <span>{autoScanActive ? 'Stop' : 'Auto'}</span>
                  </button>

                  {/* Sound on/off switch */}
                  <button
                    id="btn-toggle-scannersound"
                    onClick={() => setIsBeepEnabled(!isBeepEnabled)}
                    className="p-1.5 bg-white border border-stone-200 rounded-md text-stone-500 hover:bg-stone-50 cursor-pointer flex items-center justify-center"
                    title={isBeepEnabled ? "Disable Scan Beep Alert" : "Enable Scan Beep Alert"}
                  >
                    {isBeepEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
                  </button>

                  {/* Stop terminal */}
                  <button
                    id="btn-stop-scanner-terminal"
                    onClick={stopCamera}
                    className="px-2 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md text-[8px] font-bold text-rose-700 cursor-pointer whitespace-nowrap min-w-[40px]"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Test Barcode triggers panel inside Scanner gateway */}
            <div className="bg-white border border-stone-150 rounded-lg p-2 space-y-1">
              <span className="text-[8px] font-extrabold text-stone-400 uppercase tracking-widest block">
                Virtual Barcodes (Click to Scan)
              </span>
              
              <div className="flex flex-wrap gap-1 max-h-[110px] overflow-y-auto pr-1">
                {products.map((p) => (
                  <button
                    key={p.id}
                    id={`btn-scan-sku-${p.sku.toLowerCase()}`}
                    type="button"
                    onClick={() => {
                      if (!isScannerActive) {
                        setIsScannerActive(true);
                      }
                      triggerSimulatedScan(p.sku);
                    }}
                    className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-stone-50 hover:bg-indigo-50 border border-stone-200/70 hover:border-indigo-200 text-stone-700 hover:text-indigo-700 flex items-center gap-0.5 transition-all cursor-pointer"
                    title={`Instantly scan card for SKU: ${p.sku} (${p.name})`}
                  >
                    <span>{p.icon}</span>
                    <span>{p.sku}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-stone-150" />

          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
              Categories
            </span>
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible scroller">
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category;
                const count = categoryCounts[category] || 0;
                return (
                  <button
                    key={category}
                    id={`cat-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => setSelectedCategory(category)}
                    className={`text-xs px-3 py-2.5 rounded-lg font-semibold text-left transition-all cursor-pointer flex items-center justify-between whitespace-nowrap md:whitespace-normal w-full shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-100 font-bold'
                        : 'bg-stone-50 md:bg-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-950 border border-stone-200/50 md:border-transparent'
                    }`}
                  >
                    <span>{category}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-indigo-700 text-white' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-stone-100 hidden md:block" />

          {/* Sorter controls */}
          <div className="space-y-1.5">
            <label htmlFor="pos-sort-by" className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              Sort Catalog By
            </label>
            <select
              id="pos-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-xs bg-stone-50 text-stone-900 border border-stone-200 p-2 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-semibold cursor-pointer"
            >
              <option value="name">Product Title (A-Z)</option>
              <option value="category">Category Grouping</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="stock">Stock Level (low first)</option>
              <option value="sku">SKU Code Sequence</option>
            </select>
          </div>
        </div>

        {/* Product Catalog Registry Grid */}
        <div className="flex-1 flex flex-col space-y-4">
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
            
            {/* CUSTOMER LOYALTY GATEWAY */}
            <div className="mb-4 pb-4 border-b border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    Customer Loyalty Profile
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap shrink-0">
                  <button
                    id="btn-open-customer-directory"
                    type="button"
                    onClick={() => setIsCustomerDirectoryOpen(true)}
                    className="text-[9px] font-bold text-stone-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-stone-200 hover:border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                    title="Browse all customer QR profile sheets"
                  >
                    <QrCode className="w-2.5 h-2.5 text-indigo-600" /> Directory
                  </button>
                  <button
                    id="btn-toggle-customer-mode"
                    type="button"
                    onClick={() => {
                      setIsAddingCustomer(!isAddingCustomer);
                      setCustRegNotice(null);
                    }}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-stone-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    {isAddingCustomer ? (
                      <>
                        <Search className="w-2.5 h-2.5" /> Lookup Member
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-2.5 h-2.5" /> Register Shopper
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!isAddingCustomer ? (
                <div className="space-y-2">
                  {/* Search Input field */}
                  {!selectedCustomerId ? (
                    <div className="relative flex items-center">
                      <input
                        id="loyalty-search-input"
                        type="text"
                        placeholder="Search Name, Phone, or Email..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full text-xs pl-8 pr-16 py-1.5 bg-white text-stone-900 border border-stone-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
                      
                      <button
                        id="btn-open-loyalty-scanner"
                        type="button"
                        onClick={() => {
                          setIsQrScannerOpen(true);
                          setScannerFeedback({message: '', type: null});
                          setManualQrScanInput('');
                        }}
                        className="absolute right-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-850 text-[9px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer border border-indigo-250/70 flex items-center gap-1 transition-all select-none"
                        title="Scan QR loyalty code"
                      >
                        <Scan className="w-2 h-2 text-indigo-650" /> Scan QR
                      </button>

                      {/* Quick recommendations dropdown */}
                      {customerSearchQuery && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-stone-100">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-stone-400">
                              No registered shopper found.
                            </div>
                          ) : (
                            filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                id={`select-cust-${c.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setCustomerSearchQuery('');
                                }}
                                className="w-full text-left p-2.5 hover:bg-indigo-50/50 flex flex-col items-start gap-0.5 transition-colors cursor-pointer"
                              >
                                <div className="flex justify-between items-center w-full">
                                  <span className="font-bold text-xs text-stone-800">{c.name}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                    {c.loyaltyPoints} pts
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-stone-450">
                                  <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {c.phone}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" /> {c.email}</span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Selected Customer badge details */
                    selectedCustomer && (
                      <div className="p-3 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {selectedCustomer.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-stone-800 text-xs">{selectedCustomer.name}</h4>
                              <p className="text-[9px] text-stone-400 font-mono">Member ID: {selectedCustomer.id}</p>
                            </div>
                          </div>
                          <button
                            id="btn-unlink-customer"
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId('');
                              setRedeemPoints(false);
                            }}
                            className="text-[9px] font-bold text-stone-400 hover:text-rose-600 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-250 px-2 py-0.5 rounded cursor-pointer transition-colors"
                          >
                            Unlink
                          </button>
                        </div>

                        {/* Interactive Personal Loyalty QR Pass Widget */}
                        <div 
                          id="btn-zoom-customer-pass"
                          onClick={() => setSelectedCustomerForQrZoom(selectedCustomer)}
                          className="flex items-center justify-between gap-3 p-2 bg-white border border-indigo-50 hover:border-indigo-150 rounded-xl cursor-pointer hover:shadow-3xs transition-all select-none"
                          title="Click to zoom loyalty barcode pass"
                        >
                          <div className="flex items-center gap-2 text-left">
                            <div className="w-6 h-6 bg-indigo-50 text-indigo-650 rounded-lg flex items-center justify-center shrink-0">
                              <QrCode className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-[10px] text-stone-805 block">Loyalty Membership Pass</span>
                              <span className="text-[8.5px] text-stone-400 block font-normal leading-none mt-0.5">Click to view printable QR code pass</span>
                            </div>
                          </div>
                          <CustomerQRCode value={selectedCustomer.id} size={28} className="w-7 h-7 rounded border border-stone-150 p-0.5 shrink-0" />
                        </div>

                        {/* Loyalty points display bar */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/60 text-stone-700">
                          <div className="bg-white/80 border border-stone-150 p-1.5 rounded-lg text-center flex flex-col justify-center">
                            <span className="text-[8px] text-stone-400 uppercase tracking-wider block font-bold">Loyalty Points</span>
                            <span className="font-sans font-extrabold text-indigo-600 text-xs flex items-center justify-center gap-1 mt-0.5">
                              <Award className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                              {selectedCustomer.loyaltyPoints}
                            </span>
                            <span className="text-[8px] text-stone-440 block">Value: ${(selectedCustomer.loyaltyPoints * 0.10).toFixed(2)}</span>
                          </div>
                          <div className="bg-white/80 border border-stone-150 p-1.5 rounded-lg text-center flex flex-col justify-center">
                            <span className="text-[8px] text-stone-400 uppercase tracking-wider block font-bold">Visits / Total</span>
                            <span className="font-mono font-extrabold text-stone-750 text-[10px] mt-1">
                              {selectedCustomer.visits} visits
                            </span>
                            <span className="text-[8px] text-stone-440 block font-semibold">${selectedCustomer.totalSpent.toFixed(2)} spent</span>
                          </div>
                        </div>

                        {/* Instant Member discount declaration */}
                        <div className="p-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold flex items-center justify-between border border-emerald-100">
                          <span>✓ 5% Member Reward applied</span>
                          <span className="font-mono font-extrabold">-${loyaltyDiscountAmount.toFixed(2)}</span>
                        </div>

                        {/* Redeem Points Action */}
                        {selectedCustomer.loyaltyPoints >= 10 ? (
                          <div className="pt-1.5 flex items-center justify-between border-t border-dashed border-stone-200">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                id="chk-redeem-loyalty-points"
                                type="checkbox"
                                checked={redeemPoints}
                                onChange={(e) => setRedeemPoints(e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-650 border-stone-300 rounded focus:ring-indigo-500"
                              />
                              <div>
                                <span className="text-[10px] font-bold text-stone-750 block">Redeem points for credit?</span>
                                <span className="text-[8px] text-indigo-500 block">Use {maxRedeemablePoints} pts (save ${(maxRedeemablePoints * 0.10).toFixed(2)})</span>
                              </div>
                            </label>
                            {redeemPoints && (
                              <span className="font-mono font-extrabold text-indigo-600 text-xs">
                                -${loyaltyPointsRedeemDiscount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[8px] text-stone-400 text-center italic pt-1 border-t border-stone-100">
                            (Need 10+ points to enable shopping credit redemption)
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Register New Customer Form */
                <div className="p-3 bg-white border border-stone-250/70 rounded-xl space-y-2.5 text-xs text-stone-700">
                  {custRegNotice && (
                    <div className="p-1.5 px-2 rounded-lg text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 text-center">
                      {custRegNotice}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-[8px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Full Name *</label>
                      <input
                        id="new-cust-name-input"
                        type="text"
                        placeholder="E.g. Jane Foster"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="w-full text-xs p-1.5 bg-white text-stone-900 border border-stone-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Phone Number *</label>
                        <input
                          id="new-cust-phone-input"
                          type="text"
                          placeholder="555-019-XXXX"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          className="w-full text-xs p-1.5 bg-white text-stone-900 border border-stone-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Email address</label>
                        <input
                          id="new-cust-email-input"
                          type="email"
                          placeholder="jane@example.com"
                          value={newCustEmail}
                          onChange={(e) => setNewCustEmail(e.target.value)}
                          className="w-full text-xs p-1.5 bg-white text-stone-900 border border-stone-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-submit-new-customer"
                    type="button"
                    onClick={() => {
                      if (!newCustName.trim() || !newCustPhone.trim()) {
                        triggerSystemWarning("Name and Phone number are required fields for registration.");
                        return;
                      }
                      const checkDup = (customers || []).find(c => c.phone.replace(/[^0-9]/g, '') === newCustPhone.replace(/[^0-9]/g, ''));
                      if (checkDup) {
                        triggerSystemWarning(`Duplicate Phone: ${newCustPhone} is already registered under "${checkDup.name}".`);
                        return;
                      }

                      const newCustomerObj: Customer = {
                        id: `CUST-${Date.now().toString().slice(-4)}`,
                        name: newCustName.trim(),
                        phone: newCustPhone.trim(),
                        email: newCustEmail.trim() || 'walkin@notustech.cloud',
                        loyaltyPoints: 10, // 10 welcome points!
                        totalSpent: 0,
                        visits: 0
                      };

                      if (setCustomers) {
                        setCustomers(prev => [newCustomerObj, ...prev]);
                      }
                      
                      setCustRegNotice("🎉 Registration successful! Account linked (+10 welcome points).");
                      setSelectedCustomerId(newCustomerObj.id);
                      
                      // Clear inputs
                      setNewCustName('');
                      setNewCustPhone('');
                      setNewCustEmail('');
                      
                      setTimeout(() => {
                        setIsAddingCustomer(false);
                        setCustRegNotice(null);
                      }, 1500);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                  >
                    Save & Associate Member
                  </button>
                </div>
              )}
            </div>

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

            {/* Cashier Assignment */}
            <div className="mt-4 pt-4 border-t border-stone-100">
              <label htmlFor="checkout-cashier-select" className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                Assign Order Cashier *
              </label>
              {activeEmployees.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200/50 rounded-xl text-[10px] font-semibold leading-relaxed">
                  ⚠️ No active staff clocked in. Please clock in at the "Employee Shifts" section, or input an Employee ID code below to associate:
                  <input
                    id="checkout-cashier-manual-input"
                    type="text"
                    placeholder="Enter Employee ID..."
                    value={manualEmployeeId}
                    onChange={(e) => {
                      setManualEmployeeId(e.target.value);
                      setSelectedEmployeeId('manual');
                    }}
                    className="mt-1.5 w-full text-xs p-2 bg-white border border-stone-200 text-stone-900 rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
              ) : (
                <select
                  id="checkout-cashier-select"
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    if (e.target.value !== 'manual') {
                      setManualEmployeeId('');
                    }
                  }}
                  className="w-full text-xs bg-white text-stone-900 border border-stone-200 p-2 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-semibold cursor-pointer"
                >
                  <option value="">-- Choose Sales Cache/Server --</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeName} (ID: {emp.employeeId})
                    </option>
                  ))}
                  <option value="manual">-- Custom Employee ID Override --</option>
                </select>
              )}

              {selectedEmployeeId === 'manual' && activeEmployees.length > 0 && (
                <input
                  id="checkout-cashier-manual-input-override"
                  type="text"
                  placeholder="Enter custom Employee ID..."
                  value={manualEmployeeId}
                  onChange={(e) => setManualEmployeeId(e.target.value)}
                  className="mt-2 w-full text-xs p-2 bg-white border border-stone-200 text-stone-905 rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                />
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
          <div className="space-y-1.5 text-stone-700">
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">Cart Subtotal</span>
              <span className="font-mono font-semibold text-stone-800">${subtotal.toFixed(2)}</span>
            </div>
            
            {discountDetails.amount > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-700">
                <span className="flex items-center gap-1 font-medium">Promo Discount ({discountDetails.code})</span>
                <span className="font-mono font-bold">-${discountDetails.amount.toFixed(2)}</span>
              </div>
            )}

            {loyaltyDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-xs text-indigo-700 font-semibold">
                <span className="flex items-center gap-1">Member Reward (5% Off)</span>
                <span className="font-mono text-indigo-600 font-bold">-${loyaltyDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            {loyaltyPointsRedeemDiscount > 0 && (
              <div className="flex justify-between items-center text-xs text-purple-700 font-semibold">
                <span className="flex items-center gap-1">Credit Redeemed ({maxRedeemablePoints} pts)</span>
                <span className="font-mono text-purple-600 font-bold">-${loyaltyPointsRedeemDiscount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-xs text-stone-500">
              <span className="flex items-center gap-1">Sales Tax ({effectiveTaxRate.toFixed(2)}%)</span>
              <span className="font-mono font-semibold text-stone-800">${taxAmount.toFixed(2)}</span>
            </div>

            {selectedCustomer && earnedPoints > 0 && (
              <div className="flex justify-between items-center text-[10px] text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-250/20">
                <span className="flex items-center gap-1 font-bold">★ Points to earn this sale:</span>
                <span className="font-mono font-extrabold">+{earnedPoints} pts</span>
              </div>
            )}

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
                    <div className="flex justify-between"><span>DUTY CLERK:</span><span>{recentInvoice.employeeName ? `${recentInvoice.employeeName} (${recentInvoice.employeeId})` : 'SYSTEM OPERATOR'}</span></div>
                    <div className="flex justify-between"><span>PAYMENT METHOD:</span><span>{recentInvoice.paymentMethod}</span></div>
                    {recentInvoice.customerId && (
                      <div className="border-t border-dashed border-stone-250 mt-1.5 pt-1.5 space-y-1 text-slate-705">
                        <div className="flex justify-between text-indigo-600 font-bold">
                          <span>MEMBER NAME:</span>
                          <span>{recentInvoice.customerName}</span>
                        </div>
                        <div className="flex justify-between text-indigo-650">
                          <span>MEMBER ID:</span>
                          <span>{recentInvoice.customerId}</span>
                        </div>
                        <div className="flex justify-between text-amber-600">
                          <span>PENDING PTS EARNED:</span>
                          <span>+{recentInvoice.earnedPoints || 0} PTS</span>
                        </div>
                        {recentInvoice.redeemedPoints !== undefined && recentInvoice.redeemedPoints > 0 && (
                          <div className="flex justify-between text-purple-650">
                            <span>REDEEMED BALANCE:</span>
                            <span>-{recentInvoice.redeemedPoints} PTS</span>
                          </div>
                        )}
                      </div>
                    )}
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
                      <span>TAX CALCULATED ({(recentInvoice.subtotal > 0 ? (recentInvoice.taxAmount / Math.max(0.01, recentInvoice.subtotal - recentInvoice.discountAmount)) * 100 : 8).toFixed(1)}%):</span>
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
                      <span className="text-stone-500">Clerk Operative: {recentInvoice.employeeName || 'System Operator'} (ID: {recentInvoice.employeeId || 'ST-1A'})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-stone-400 uppercase tracking-wider block text-[9px] mb-1">Billed To</span>
                      {recentInvoice.customerId ? (
                        <>
                          <strong className="text-indigo-600 block text-xs">{recentInvoice.customerName}</strong>
                          <span className="text-stone-500 block">Loyalty ID: {recentInvoice.customerId}</span>
                          <span className="text-[10px] text-amber-600 font-semibold block">Bonus Earned: +{recentInvoice.earnedPoints || 0} pts</span>
                          {recentInvoice.redeemedPoints !== undefined && recentInvoice.redeemedPoints > 0 && (
                            <span className="text-[10px] text-purple-600 font-semibold block">Redemption Credit: -{recentInvoice.redeemedPoints} pts</span>
                          )}
                        </>
                      ) : (
                        <>
                          <strong className="text-stone-800 block text-xs">Walk-In Retail Customer</strong>
                          <span className="text-stone-500">Clearing Method: {recentInvoice.paymentMethod}</span>
                        </>
                      )}
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
                        <span>Applicable Sales Tax ({(recentInvoice.subtotal > 0 ? (recentInvoice.taxAmount / Math.max(0.01, recentInvoice.subtotal - recentInvoice.discountAmount)) * 100 : 8).toFixed(2)}%):</span>
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

      {/* ========================================================================= */}
      {/* 1. LOYALTY CUSTOMER DIRECTORY & PASS SHEETS MODAL */}
      {/* ========================================================================= */}
      {isCustomerDirectoryOpen && (
        <div id="customer-directory-modal" className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200/80 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-850 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-400/30">
                  <QrCode className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-indigo-50 leading-none">Loyalty Profiles Directory</h3>
                  <p className="text-[10px] text-indigo-200 mt-1 font-mono">Total Members Loaded: {customers.length}</p>
                </div>
              </div>
              <button 
                id="close-directory-modal-btn"
                onClick={() => {
                  setIsCustomerDirectoryOpen(false);
                  setDirectorySearchQuery('');
                }}
                className="p-1.5 rounded-lg bg-indigo-805 hover:bg-rose-650 text-indigo-200 hover:text-white transition-colors cursor-pointer"
                title="Close directory lookup"
              >
                <span className="text-xs uppercase font-extrabold px-1">Exit</span>
              </button>
            </div>

            {/* Directory Controls */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <input
                  id="directory-search-input"
                  type="text"
                  placeholder="Filter name, phone number, email or loyalty key..."
                  value={directorySearchQuery}
                  onChange={(e) => setDirectorySearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-8 py-2 bg-white text-stone-900 border border-stone-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
                />
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
                {directorySearchQuery && (
                  <button 
                    onClick={() => setDirectorySearchQuery('')}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Action notice */}
              <div className="text-[10px] text-stone-500 font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Double click or press the select button to link a member directly to the current checkout cart.</span>
              </div>
            </div>

            {/* Custom Grid / Sheet content */}
            <div className="p-6 overflow-y-auto bg-stone-50/50 flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[300px]">
              {filteredDirectoryCustomers.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                    <User className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-stone-850 text-xs">No registered customer card found</h4>
                  <p className="text-[10px] text-stone-450">Try broadening your keywords or register a new customer in the POS.</p>
                </div>
              ) : (
                filteredDirectoryCustomers.map(c => {
                  const isLinkedToCart = selectedCustomerId === c.id;
                  return (
                    <div 
                      key={c.id}
                      id={`directory-card-${c.id}`}
                      onDoubleClick={() => {
                        setSelectedCustomerId(c.id);
                        setIsCustomerDirectoryOpen(false);
                      }}
                      className={`relative bg-white border rounded-2xl p-4.5 flex flex-col transition-all group ${
                        isLinkedToCart 
                          ? 'border-indigo-600/80 shadow-md ring-1 ring-indigo-500/20' 
                          : 'border-stone-200 hover:border-indigo-200 hover:shadow-xs'
                      }`}
                    >
                      {/* Active / Linked Badge */}
                      {isLinkedToCart && (
                        <span className="absolute top-3.5 right-3.5 bg-indigo-600 text-white text-[7.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                          <CheckCircle2 className="w-2 h-2 fill-white text-indigo-600" /> Selected
                        </span>
                      )}

                      {/* Header profile info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-stone-700 flex items-center justify-center font-bold text-sm shrink-0 border border-stone-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-colors">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5 min-w-0 pr-12">
                          <h4 className="font-extrabold text-stone-850 text-xs truncate leading-tight">{c.name}</h4>
                          <span className="text-[9px] font-mono font-bold text-stone-450 block">{c.id}</span>
                        </div>
                      </div>

                      {/* Meta lists */}
                      <div className="mt-3.5 space-y-1.5 text-[10px] text-stone-500 border-t border-b border-stone-100 py-3.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium"><Phone className="w-3 h-3 text-stone-400 shrink-0" /> Phone:</span>
                          <span className="font-bold text-stone-800">{c.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium"><Mail className="w-3 h-3 text-stone-400 shrink-0" /> Email:</span>
                          <span className="font-semibold text-stone-800 truncate pl-3 text-right max-w-[140px]">{c.email}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-50">
                          <span className="font-medium text-stone-450 uppercase tracking-widest text-[8px]">Loyalty Credits</span>
                          <span className="font-extrabold text-indigo-600 flex items-center gap-0.5 text-xs">
                            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {c.loyaltyPoints} points
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-stone-450 uppercase tracking-widest text-[8px]">Total Spend Cash</span>
                          <span className="font-bold font-mono text-stone-800 text-xs">${c.totalSpent.toFixed(2)} / {c.visits} visits</span>
                        </div>
                      </div>

                      {/* Embed generated unique loyalty QR code pass */}
                      <div className="mt-4 flex items-center gap-3.5 justify-between bg-stone-50 rounded-xl p-2.5 border border-stone-150">
                        <div className="text-[9px] text-stone-450 leading-relaxed text-left space-y-1 font-mono">
                          <span className="font-extrabold text-stone-700 block uppercase tracking-wider">QR Code Pass</span>
                          <span>Encoded: {c.id}</span>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(c.id);
                              triggerSystemWarning(`Copied Member key: "${c.id}"`);
                            }}
                            className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                            title="Copy badge unique key"
                          >
                            <Copy className="w-2.5 h-2.5 text-stone-400" /> Copy Key
                          </button>
                        </div>
                        <div 
                          onClick={() => setSelectedCustomerForQrZoom(c)}
                          className="cursor-pointer group-hover:scale-105 transition-transform shrink-0"
                          title="Zoom in on Loyalist Pass"
                        >
                          <CustomerQRCode value={c.id} size={50} className="w-12 h-12 p-0.5 border border-stone-200 rounded-md" />
                        </div>
                      </div>

                      {/* Modal Actions */}
                      <div className="mt-4 flex gap-1.5">
                        <button
                          id={`btn-zoomcard-${c.id}`}
                          type="button"
                          onClick={() => setSelectedCustomerForQrZoom(c)}
                          className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[9.5px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <QrCode className="w-3 h-3 text-stone-500 shrink-0" />
                          <span>View Pass</span>
                        </button>
                        
                        <button
                          id={`btn-selectcard-${c.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(isLinkedToCart ? '' : c.id);
                            if (!isLinkedToCart) {
                              setIsCustomerDirectoryOpen(false);
                              triggerSystemWarning(`Member "${c.name}" linked to cash checkout successfully.`);
                            }
                          }}
                          className={`flex-1 text-[9.5px] font-extrabold py-1.5 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                            isLinkedToCart
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs'
                          }`}
                        >
                          {isLinkedToCart ? 'Unlink Cart' : 'Link Cart'}
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-100 border-t border-stone-200 text-center text-[10px] text-stone-450 font-medium">
              Notus POS Loyalty Database encrypted safely. Supports rapid scan check-in integration.
            </div>

          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 2. LOYALTY QR BARCODE SCANNER SIMULATION MODAL */}
      {/* ========================================================================= */}
      {isQrScannerOpen && (
        <div id="loyalty-scanner-simulation-modal" className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-stone-900 border border-stone-750 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-stone-100 animate-scale-up">
            
            {/* Scanner header */}
            <div className="p-4 bg-stone-850 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">POS Loyalty Barcode Scanner Gateway</span>
              </div>
              <button 
                id="close-loyalty-scanner-btn"
                onClick={() => {
                  setIsQrScannerOpen(false);
                  setScannerFeedback({message: '', type: null});
                }}
                className="text-stone-400 hover:text-white hover:bg-stone-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border border-stone-800"
              >
                Close
              </button>
            </div>

            {/* Scanner Viewfinder Box */}
            <div className="p-6 flex flex-col items-center justify-center bg-stone-950 relative min-h-[340px]">
              
              {/* Laser Flash overlay */}
              {scannerBlink && (
                <div className="absolute inset-0 bg-emerald-500/25 z-20 animate-ping pointer-events-none" />
              )}

              {/* Viewfinder Frame */}
              <div className="relative w-48 h-48 border-2 border-emerald-500/40 rounded-3xl p-4 bg-stone-900/50 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.1)] group">
                {/* 4 Corner Markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />

                {/* Simulated Red/Green Laser line moving vertically */}
                <div className={`absolute left-0 right-0 h-0.5 bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.8)] pointer-events-none animate-bounce`} style={{ top: '35%' }} />

                {/* Laser scan graphics inside target box */}
                <div className="w-24 h-24 bg-stone-800/40 rounded-xl border border-stone-750 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                  <QrCode className="w-12 h-12 text-stone-600 animate-pulse" />
                </div>

                <span className="text-[8px] font-mono font-extrabold text-emerald-400/65 mt-2.5 tracking-wider select-none animate-pulse uppercase">VIEW FINDER EYE</span>
              </div>

              {/* Feedback messages */}
              <div className="mt-5 text-center min-h-[48px] px-6 max-w-sm flex items-center justify-center self-center">
                {scannerFeedback.message ? (
                  <div className={`text-[11px] font-bold py-1.5 px-3 rounded-lg border-2 animate-bounce ${
                    scannerFeedback.type === 'success'
                      ? 'bg-emerald-950/85 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950/85 text-rose-300 border-rose-800'
                  }`}>
                    {scannerFeedback.message}
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-400 leading-normal font-mono select-none">
                    🎯 Bring loyalty membership badge or QR code in front of the cashier scanner, or execute simulated scan buttons below.
                  </p>
                )}
              </div>

              {/* Form representing keyboard-wedge physical scanner typing */}
              <form onSubmit={handleManualQrInputSubmit} className="mt-4 w-full max-w-xs flex items-center gap-1.5">
                <input
                  id="scanner-manual-input"
                  type="text"
                  placeholder="Focus standard USB scan input..."
                  value={manualQrScanInput}
                  onChange={(e) => setManualQrScanInput(e.target.value)}
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg text-xs px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-stone-105 placeholder-stone-600 font-mono"
                  autoFocus
                />
                <button
                  id="btn-keyboard-scan-submit"
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer select-none border border-emerald-500 shadow-xs uppercase tracking-wider shrink-0"
                >
                  Enter
                </button>
              </form>
            </div>

            {/* QUICK SIMULATOR DEACTUATION PANEL - Beautifully presents each customer so we can mock actions */}
            <div className="p-4 bg-stone-850 border-t border-stone-800 space-y-2">
              <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                <Sparkle className="w-2.5 h-2.5 text-indigo-400" /> Mock QR Scan Simulator Trigger Controls
              </span>
              <p className="text-[9px] text-stone-400 leading-normal">
                No real scanner device? Click any registered customer card below to simulate bringing their unique loyalist QR pass in front of the laser beam.
              </p>

              <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto pr-1">
                {customers.map(c => {
                  const isLinked = selectedCustomerId === c.id;
                  return (
                    <button
                      key={c.id}
                      id={`simulate-scan-trigger-${c.id}`}
                      type="button"
                      onClick={() => handleSimulatedCategoryScan(c)}
                      className={`p-2 rounded-xl text-left border flex items-center justify-between gap-1 transition-all cursor-pointer ${
                        isLinked
                          ? 'border-emerald-700 bg-emerald-950/20 hover:bg-emerald-950/30 text-emerald-300'
                          : 'border-stone-700 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold block truncate">{c.name}</span>
                        <code className="text-[8px] font-mono text-stone-450 block">{c.id}</code>
                      </div>
                      <div className="w-7 h-7 bg-white p-0.5 rounded border border-stone-600 flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5 text-indigo-850 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instructions help text */}
            <div className="p-3.5 bg-stone-900 text-center justify-center text-[9px] text-stone-500 border-t border-stone-850 leading-relaxed font-sans">
              💡 Physical Keyboard-Wedge emulation compatible: Any automated USB sequence typing a member key and pressing [ENTER] matches instantly.
            </div>

          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 3. LOYALTY CARD INDIVIDUAL PASSPORT ZOOM DIALOG MODAL */}
      {/* ========================================================================= */}
      {selectedCustomerForQrZoom && (
        <div id="loyalty-pass-zoom-modal" className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-110 flex items-center justify-center p-4 animate-fade-in print-container no-print">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-stone-150 w-full max-w-sm flex flex-col items-center animate-scale-up text-stone-900 text-center relative print-box">
            
            {/* Card Ribbon Accent background */}
            <div className="absolute top-0 left-0 right-0 h-28 bg-linear-to-tr from-indigo-700 to-purple-800 rounded-t-3xl" />

            {/* Header member logo frame */}
            <div className="relative mt-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white text-indigo-900 flex items-center justify-center font-extrabold text-2xl border-4 border-white shadow-md">
                {selectedCustomerForQrZoom.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-sm font-extrabold text-white mt-2 drop-shadow-sm uppercase tracking-wider">{selectedCustomerForQrZoom.name}</h3>
              <p className="text-[10px] text-indigo-150 leading-none">Registered Loyalty Pass Member</p>
            </div>

            {/* Passport presentation Body */}
            <div className="mt-8 bg-stone-50 rounded-2xl border border-stone-200/85 p-5 w-full space-y-4 shadow-3xs">
              
              {/* Massive high definition Vector QR Loyalty Code */}
              <div className="flex flex-col items-center justify-center space-y-1">
                <CustomerQRCode value={selectedCustomerForQrZoom.id} size={150} className="w-36 h-36 border-2 border-stone-150 p-1 bg-white rounded-xl shadow-xs" />
                <span className="text-[10px] font-mono font-extrabold text-stone-500 mt-2 block tracking-widest uppercase">ID: {selectedCustomerForQrZoom.id}</span>
              </div>

              {/* Metadata Details */}
              <div className="border-t border-dashed border-stone-250 pt-3.5 space-y-2 text-[10px] text-stone-600 leading-tight">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-440">Loyalty Balance:</span>
                  <span className="font-extrabold text-indigo-700 text-xs flex items-center gap-0.5"><Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {selectedCustomerForQrZoom.loyaltyPoints} points</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-440">Purchases Audit:</span>
                  <span className="font-bold font-mono text-stone-850">{selectedCustomerForQrZoom.visits} visits / ${selectedCustomerForQrZoom.totalSpent.toFixed(2)} spent</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-stone-200/60">
                  <span className="font-medium text-stone-440">Registration Phone:</span>
                  <span className="font-medium text-stone-850">{selectedCustomerForQrZoom.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-440">Account Email:</span>
                  <span className="font-medium text-stone-850 truncate max-w-[170px]">{selectedCustomerForQrZoom.email}</span>
                </div>
              </div>

            </div>

            {/* Passport Printable Card Controls */}
            <div className="mt-5.5 w-full flex gap-2.5">
              <button
                id="btn-print-membership-pass"
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Print digital membership passport card"
              >
                <Printer className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Print Pass</span>
              </button>
              
              <button
                id="btn-close-passzoom-dialog"
                type="button"
                onClick={() => setSelectedCustomerForQrZoom(null)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-150 hover:shadow-lg"
              >
                Dismiss
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
    </div>
  );
}

