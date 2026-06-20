import React, { useState, useEffect, useMemo } from 'react';
import { ActiveSection, Product, CartItem, SaleTransaction, SystemNotification, Employee, EmployeeShift, TaxConfig, Customer } from './types';
import { INITIAL_PRODUCTS } from './data/mockProducts';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import POSTerminal from './components/POSTerminal';
import InventoryAdmin from './components/InventoryAdmin';
import SalesHistory from './components/SalesHistory';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SettingsPanel from './components/SettingsPanel';
import ReportsManager from './components/ReportsManager';
import EmployeeShifts from './components/EmployeeShifts';

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'EMP001', name: 'Alexander Wright', role: 'Store Manager', status: 'Active' },
  { id: 'EMP002', name: 'Sophia Sterling', role: 'Senior Cashier', status: 'Active' },
  { id: 'EMP003', name: 'Marcus Sterling', role: 'Sales Associate', status: 'Active' }
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'CUST001', name: 'Jane Doe', phone: '555-019-1111', email: 'jane.doe@gmail.com', loyaltyPoints: 320, totalSpent: 245.50, visits: 8 },
  { id: 'CUST002', name: 'John Smith', phone: '555-019-2222', email: 'john.smith@yahoo.com', loyaltyPoints: 120, totalSpent: 98.00, visits: 3 },
  { id: 'CUST003', name: 'Emily Davis', phone: '555-019-3333', email: 'emily.d@outlook.com', loyaltyPoints: 50, totalSpent: 45.00, visits: 2 },
  { id: 'CUST004', name: 'Michael Brown', phone: '555-019-4444', email: 'mbrown@gmail.com', loyaltyPoints: 850, totalSpent: 620.00, visits: 14 }
];

const DEFAULT_TAX_CONFIG: TaxConfig = {
  globalRate: 8,
  categoryRates: {
    'Beverages': 5,
    'Fast Food': 10,
    'Bakery & Dessert': 6,
    'Electronics': 12,
    'Apparel': 8
  }
};

export default function App() {
  // Navigation active tab
  const [activeSection, setActiveSection] = useState<ActiveSection>('pos');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Synchronized States
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  
  // Shifts and Employees States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>(() => {
    return localStorage.getItem('notus_current_employee_id') || 'EMP001';
  });

  // Customers (Loyalty database) State
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Tax Configurations state
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(DEFAULT_TAX_CONFIG);
  
  // Search bar state sync (passed down to active POS/Inventory views)
  const [searchFilter, setSearchFilter] = useState('');

  // Persist Current Employee ID
  useEffect(() => {
    localStorage.setItem('notus_current_employee_id', currentEmployeeId);
  }, [currentEmployeeId]);

  // 1. Mount & Initialize from localStorage
  useEffect(() => {
    // Products Database init
    const cachedProducts = localStorage.getItem('notus_products');
    if (cachedProducts) {
      try {
        setProducts(JSON.parse(cachedProducts));
      } catch (e) {
        setProducts(INITIAL_PRODUCTS);
      }
    } else {
      setProducts(INITIAL_PRODUCTS);
    }

    // Transactions History init
    const cachedTransactions = localStorage.getItem('notus_transactions');
    if (cachedTransactions) {
      try {
        setTransactions(JSON.parse(cachedTransactions));
      } catch (e) {
        setTransactions([]);
      }
    } else {
      setTransactions([]);
    }

    // Tax Configurations init
    const cachedTax = localStorage.getItem('notus_tax_config');
    if (cachedTax) {
      try {
        setTaxConfig(JSON.parse(cachedTax));
      } catch (e) {
        setTaxConfig(DEFAULT_TAX_CONFIG);
      }
    } else {
      setTaxConfig(DEFAULT_TAX_CONFIG);
    }

    // Employees Directory init
    const cachedEmployees = localStorage.getItem('notus_employees');
    if (cachedEmployees) {
      try {
        setEmployees(JSON.parse(cachedEmployees));
      } catch (e) {
        setEmployees(INITIAL_EMPLOYEES);
      }
    } else {
      setEmployees(INITIAL_EMPLOYEES);
    }

    // Customers Directory init
    const cachedCustomers = localStorage.getItem('notus_customers');
    if (cachedCustomers) {
      try {
        setCustomers(JSON.parse(cachedCustomers));
      } catch (e) {
        setCustomers(INITIAL_CUSTOMERS);
      }
    } else {
      setCustomers(INITIAL_CUSTOMERS);
    }

    // Active & Historical Shifts init
    const cachedShifts = localStorage.getItem('notus_shifts');
    if (cachedShifts) {
      try {
        setShifts(JSON.parse(cachedShifts));
      } catch (e) {
        setShifts([]);
      }
    } else {
      setShifts([]);
    }

    // Notifications Center init
    const cachedNotifications = localStorage.getItem('notus_notifications');
    if (cachedNotifications) {
      try {
        setNotifications(JSON.parse(cachedNotifications));
      } catch (e) {
        setNotifications([]);
      }
    } else {
      // Launch starter warnings triggers out of the box
      const initialAlerts: SystemNotification[] = [
        {
          id: 'n-welcome',
          text: 'Welcome to Notus POS Dashboard. Shift duty session successfully initialized.',
          type: 'success',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        },
        {
          id: 'n-mango-alert',
          text: 'Inventory Warning: Mango Smoothie stock is critical (4 remaining)! Threshold is 6.',
          type: 'warning',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        }
      ];
      setNotifications(initialAlerts);
    }
  }, []);

  // 2. Continuous Persistence writes
  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('notus_products', JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    localStorage.setItem('notus_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('notus_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('notus_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('notus_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('notus_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('notus_tax_config', JSON.stringify(taxConfig));
  }, [taxConfig]);

  // 3. Global Keyboard Event Listener for Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct modifier key support (either Ctrl or Cmd keys)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        // Check if user is typing in a text field
        const isTargetInput = 
          document.activeElement && 
          (document.activeElement.tagName === 'INPUT' || 
           document.activeElement.tagName === 'TEXTAREA' ||
           document.activeElement.getAttribute('contenteditable') === 'true');

        switch (key) {
          case 'p':
            e.preventDefault();
            setActiveSection('pos');
            setSearchFilter('');
            dispatchNotification('Hotkey: Navigated to POS Terminal 🛒', 'info');
            break;
          case 'i':
            e.preventDefault();
            setActiveSection('inventory');
            setSearchFilter('');
            dispatchNotification('Hotkey: Navigated to Inventory Manager 📦', 'info');
            break;
          case 's':
            // Prevent default page-save action in browser and open Sales History
            e.preventDefault();
            setActiveSection('sales');
            dispatchNotification('Hotkey: Opened Sales History & Audits 📜', 'info');
            break;
          case 'f':
            // Prevent default page search in browser and open Shifts
            e.preventDefault();
            setActiveSection('shifts');
            dispatchNotification('Hotkey: Opened Employee Shifts tracking dashboard ⏰', 'info');
            break;
          case 'a':
            // Override Ctrl+A default (select-all) ONLY if user is not active inside an input box
            if (!isTargetInput) {
              e.preventDefault();
              setActiveSection('analytics');
              dispatchNotification('Hotkey: Opened Analytics Dashboard 📊', 'info');
            }
            break;
          case 'o':
            // Ctrl+O is commonly Open File - override to open terminal settings
            e.preventDefault();
            setActiveSection('settings');
            dispatchNotification('Hotkey: Opened System Settings ⚙️', 'info');
            break;
          case 'r':
            // Override Ctrl+R (reload page) to open active Reports View
            e.preventDefault();
            setActiveSection('reports');
            dispatchNotification('Hotkey: Opened Reports Audit Terminal 📋', 'info');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  // Derived alert metrics: count low-stock items to show red pill in sidebar
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.threshold).length;
  }, [products]);

  // Master helpers to create live notification triggers
  const dispatchNotification = (text: string, type: 'info' | 'warning' | 'success') => {
    const newAlert: SystemNotification = {
      id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      text,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications(prev => [newAlert, ...prev]);
  };

  // Checkout Completion Callback (updates transaction list & reduces inventory stock safely)
  const handleCheckoutComplete = (tx: SaleTransaction) => {
    setTransactions(prev => [tx, ...prev]);

    // Update customer stats if loyalty member is associated with this transaction
    if (tx.customerId) {
      setCustomers(prevCustomers => {
        return prevCustomers.map(cust => {
          if (cust.id === tx.customerId) {
            const addedPoints = tx.earnedPoints || 0;
            const subbedPoints = tx.redeemedPoints || 0;
            return {
              ...cust,
              loyaltyPoints: Math.max(0, cust.loyaltyPoints + addedPoints - subbedPoints),
              totalSpent: parseFloat((cust.totalSpent + tx.totalAmount).toFixed(2)),
              visits: cust.visits + 1
            };
          }
          return cust;
        });
      });
    }

    // Mutate and adjust remaining inventory levels
    setProducts(prevProducts => {
      return prevProducts.map(product => {
        // Find if this product was part of checkout list
        const checkoutItem = tx.items.find(item => item.productId === product.id);
        if (checkoutItem) {
          const newStock = Math.max(0, product.stock - checkoutItem.quantity);
          
          // Stock check triggers
          if (newStock === 0) {
            dispatchNotification(`SOLDOUT: "${product.name}" is completely out of stock!`, 'warning');
          } else if (newStock <= product.threshold) {
            dispatchNotification(`LOWSTOCK Warning: "${product.name}" current count (${newStock}) is below threshold (${product.threshold})!`, 'warning');
          }

          return { ...product, stock: newStock };
        }
        return product;
      });
    });

    dispatchNotification(`Order checked out successfully. Invoice ${tx.invoiceNo} logged.`, 'success');
  };

  // Revert/Void Sales Receipt Transaction (Restore purchase quantities back to inventory stock database)
  const handleRefundTransaction = (transactionId: string) => {
    const txToRefund = transactions.find(t => t.id === transactionId);
    if (!txToRefund) return;

    // Filter out of transaction log
    setTransactions(prev => prev.filter(t => t.id !== transactionId));

    // Restore inventory quantities
    setProducts(prevProducts => {
      return prevProducts.map(product => {
        const itemToReturn = txToRefund.items.find(item => item.productId === product.id);
        if (itemToReturn) {
          return { ...product, stock: product.stock + itemToReturn.quantity };
        }
        return product;
      });
    });

    dispatchNotification(`Void Processed: Invoice ${txToRefund.invoiceNo} reversed. Returned items to stock catalog.`, 'info');
  };

  // Inventory CRUD Mutators
  const handleAddProduct = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    dispatchNotification(`Registered new SKU: "${newProduct.name}" added inside catalog index.`, 'success');
  };

  const handleUpdateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    dispatchNotification(`Modified record for SKU: "${updated.name}" updated successfully.`, 'info');
    
    // Check if new edited stock level remains below critical warnings
    if (updated.stock <= updated.threshold && updated.stock > 0) {
      dispatchNotification(`Inventory Notice: Edited item "${updated.name}" is below critical warning limits.`, 'warning');
    }
  };

  const handleDeleteProduct = (productId: string) => {
    const item = products.find(p => p.id === productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    if (item) {
      dispatchNotification(`Removed item block: "${item.name}" deleted from registry catalog.`, 'info');
    }
  };

  // Easy Quick replenish key shortcut actions (+10 or +50)
  const handleQuickReplenish = (productId: string, qty: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const afterQty = p.stock + qty;
        return { ...p, stock: afterQty };
      }
      return p;
    }));

    const target = products.find(p => p.id === productId);
    if (target) {
      dispatchNotification(`Replenished: Verified supply arrival of +${qty} units to "${target.name}".`, 'success');
    }
  };

  // Notification managers
  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  // Factory hard-reset defaults loop
  const handleFactoryReset = () => {
    localStorage.removeItem('notus_products');
    localStorage.removeItem('notus_transactions');
    localStorage.removeItem('notus_notifications');
    localStorage.removeItem('notus_employees');
    localStorage.removeItem('notus_shifts');
    localStorage.removeItem('notus_tax_config');
    localStorage.removeItem('notus_customers');
    setCart([]);
    setProducts(INITIAL_PRODUCTS);
    setTransactions([]);
    setEmployees(INITIAL_EMPLOYEES);
    setShifts([]);
    setTaxConfig(DEFAULT_TAX_CONFIG);
    setCustomers(INITIAL_CUSTOMERS);
    setNotifications([
      {
        id: `n-welcome-${Date.now()}`,
        text: 'System database cleared. Rebuilt factory defaults successfully.',
        type: 'success',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      }
    ]);
    setActiveSection('pos');
  };


  return (
    <div className="min-h-screen bg-stone-100/50 flex">
      
      {/* 1. Left docked brand sidebar */}
      <Sidebar 
        activeSection={activeSection}
        setActiveSection={(s) => {
          setActiveSection(s);
          setSearchFilter(''); // Clear screen-specific filters
        }}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        lowStockCount={lowStockCount}
      />

      {/* 2. Right core visual stage */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* Sticky action bar */}
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearNotifications={handleClearNotifications}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          activeSection={activeSection}
          currentEmployeeId={currentEmployeeId}
          setCurrentEmployeeId={setCurrentEmployeeId}
          employees={employees}
          shifts={shifts}
          setShifts={setShifts}
          dispatchNotification={(text, type) => dispatchNotification(text, type)}
        />

        {/* Dynamic component routing panels with clean transitions */}
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-300">
            {activeSection === 'pos' && (
              <POSTerminal 
                products={products}
                cart={cart}
                setCart={setCart}
                searchFilter={searchFilter}
                onCheckout={handleCheckoutComplete}
                triggerSystemWarning={(txt) => dispatchNotification(txt, 'warning')}
                employees={employees}
                shifts={shifts}
                taxConfig={taxConfig}
                customers={customers}
                setCustomers={setCustomers}
                transactions={transactions}
                currentEmployeeId={currentEmployeeId}
                setCurrentEmployeeId={setCurrentEmployeeId}
              />
            )}

            {activeSection === 'inventory' && (
              <InventoryAdmin 
                products={products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onQuickReplenish={handleQuickReplenish}
                searchFilter={searchFilter}
              />
            )}

            {activeSection === 'sales' && (
              <SalesHistory 
                transactions={transactions}
                onRefundTransaction={handleRefundTransaction}
                employees={employees}
                setTransactions={setTransactions}
              />
            )}

            {activeSection === 'shifts' && (
              <EmployeeShifts 
                employees={employees}
                setEmployees={setEmployees}
                shifts={shifts}
                setShifts={setShifts}
                transactions={transactions}
                dispatchNotification={(text, type) => dispatchNotification(text, type)}
              />
            )}

            {activeSection === 'analytics' && (
              <AnalyticsDashboard 
                transactions={transactions}
                products={products}
              />
            )}

            {activeSection === 'reports' && (
              <ReportsManager 
                transactions={transactions}
                products={products}
                triggerSystemWarning={(txt) => dispatchNotification(txt, 'info')}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsPanel 
                onFactoryReset={handleFactoryReset}
                triggerSystemWarning={(txt) => dispatchNotification(txt, 'warning')}
                taxConfig={taxConfig}
                setTaxConfig={setTaxConfig}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
