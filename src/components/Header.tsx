import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Menu, 
  Clock, 
  User, 
  Check, 
  Trash2, 
  AlertCircle,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { SystemNotification, ActiveSection, Employee, EmployeeShift } from '../types';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  notifications: SystemNotification[];
  onMarkNotificationRead: (id: string) => void;
  onClearNotifications: () => void;
  searchFilter: string;
  setSearchFilter: (search: string) => void;
  activeSection: ActiveSection;
  currentEmployeeId?: string;
  setCurrentEmployeeId?: (id: string) => void;
  employees?: Employee[];
  shifts?: EmployeeShift[];
  setShifts?: React.Dispatch<React.SetStateAction<EmployeeShift[]>>;
  dispatchNotification?: (text: string, type: 'info' | 'warning' | 'success') => void;
}

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  searchFilter,
  setSearchFilter,
  activeSection,
  currentEmployeeId,
  setCurrentEmployeeId,
  employees = [],
  shifts = [],
  setShifts,
  dispatchNotification
}: HeaderProps) {
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [systemTime, setSystemTime] = useState(new Date());

  // Run a continuous clock sync
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Resolve employee info from currentEmployeeId
  const currentEmp = (employees || []).find(e => e.id === currentEmployeeId) || (employees || [])[0] || { id: 'EMP001', name: 'Alexander Wright', role: 'Store Manager' };
  
  // Find active shift for the current employee
  const activeShift = (shifts || []).find(s => s.employeeId === currentEmp.id && !s.checkOutTime);

  // Format Elapsed Hours / Minutes / Seconds for active shifts
  const formatShiftDuration = (checkInTime: string) => {
    try {
      const start = new Date(checkInTime).getTime();
      const end = systemTime.getTime();
      const diffMs = Math.max(0, end - start);
      
      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      const hrsStr = hrs.toString().padStart(2, '0');
      const minsStr = mins.toString().padStart(2, '0');
      const secsStr = secs.toString().padStart(2, '0');
      
      return `${hrsStr}:${minsStr}:${secsStr}`;
    } catch (e) {
      return '--:--:--';
    }
  };

  const handleClockIn = (empId: string) => {
    if (!setShifts || !employees) return;
    const employee = employees.find(e => e.id === empId);
    if (!employee) return;

    // Check if already clocked in
    const isClockedIn = (shifts || []).some(s => s.employeeId === empId && !s.checkOutTime);
    if (isClockedIn) {
      dispatchNotification?.(`Cashier ${employee.name} is already checked in!`, 'warning');
      return;
    }

    const newShift: EmployeeShift = {
      id: `shift-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      checkInTime: new Date().toISOString(),
      salesCount: 0,
      salesVolume: 0
    };

    setShifts(prev => [newShift, ...prev]);
    dispatchNotification?.(`Duty Clock-In: ${employee.name} (${employee.id}) checked in successfully!`, 'success');
  };

  const handleClockOut = (empId: string) => {
    if (!setShifts || !shifts) return;
    const activeShiftItem = shifts.find(s => s.employeeId === empId && !s.checkOutTime);
    if (!activeShiftItem) return;

    setShifts(prev => prev.map(s => {
      if (s.id === activeShiftItem.id) {
        return {
          ...s,
          checkOutTime: new Date().toISOString()
        };
      }
      return s;
    }));

    dispatchNotification?.(`Duty Clock-Out: ${activeShiftItem.employeeName} completed shift session successfully.`, 'info');
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'pos': return 'Point of Sale Terminal';
      case 'inventory': return 'Inventory & Stock Admin';
      case 'sales': return 'Receipt Audit Trails';
      case 'analytics': return 'Sales Analytics Dashboard';
      case 'reports': return 'Reports & Auditing Terminal';
      case 'settings': return 'System Settings & Config';
      default: return 'Notus POS System';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header 
      id="main-app-header"
      className="sticky top-0 z-40 h-16 bg-white border-b border-stone-200 px-4 md:px-6 flex items-center justify-between"
    >
      {/* Left section: Breadcrumbs + Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <button
          id="toggle-sidebar-mobile"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-50 lg:hidden transition-colors"
          title="Open Side Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium tracking-wide">
            <span>ADMINISTRATOR</span>
            <span>/</span>
            <span className="uppercase text-stone-500">{activeSection}</span>
          </div>
          <h2 className="title font-bold text-stone-800 text-sm md:text-base leading-tight mt-0.5">
            {getSectionTitle()}
          </h2>
        </div>
      </div>

      {/* Center Section: Search Bar - only shown in POS or Inventory views */}
      {(activeSection === 'pos' || activeSection === 'inventory') && (
        <div className="flex-1 max-w-xs md:max-w-md mx-4 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder={
              activeSection === 'pos' 
                ? "Search item catalog or barcode..." 
                : "Search inventory item by name/sku..."
            }
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full text-xs bg-stone-50 text-stone-900 placeholder-stone-400 pl-9 pr-4 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
          />
          {searchFilter && (
            <button 
              id="clear-search-btn"
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-semibold px-1 rounded-sm hover:bg-stone-200/50"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Right Section: Time, Notifications, User profile */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        {/* Clock Ticker */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-stone-500 bg-stone-50 border border-stone-200/50 px-2.5 py-1.5 rounded-lg font-mono">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span>{systemTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>

        {/* Real-time Duty Shift Duration Timer (Always visible) */}
        {activeShift ? (
          <div 
            id="header-active-shift-timer" 
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-250/50 rounded-lg text-emerald-800 font-mono text-xs select-none"
            title={`Active session for ${currentEmp.name}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden lg:inline font-bold text-[9px] uppercase text-emerald-600 tracking-wider">DUTY TIMER:</span>
            <span className="font-extrabold tracking-tight text-emerald-700 font-mono text-xs">
              {formatShiftDuration(activeShift.checkInTime)}
            </span>
          </div>
        ) : (
          <div 
            id="header-inactive-shift-badge" 
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-450 rounded-lg text-[10px] font-bold uppercase tracking-wider select-none"
          >
            <span className="inline-block w-1.5 h-1.5 bg-stone-300 rounded-full"></span>
            <span>OFF DUTY</span>
          </div>
        )}

        {/* Notifications alert dropdown */}
        <div className="relative">
          <button
            id="notification-bell-btn"
            onClick={() => setShowBellDropdown(!showBellDropdown)}
            className={`p-2 rounded-lg border text-stone-600 hover:text-stone-900 transition-colors relative ${
              showBellDropdown ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-stone-200 hover:bg-stone-50'
            }`}
            title="View system alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Alert Center Panel */}
          {showBellDropdown && (
            <>
              {/* Backing screen block click handler */}
              <div 
                className="fixed inset-0 z-50 cursor-default" 
                onClick={() => setShowBellDropdown(false)} 
              />
              
              <div 
                id="alert-center-dropdown"
                className="absolute right-0 mt-2.5 w-80 bg-white border border-stone-200/80 rounded-xl shadow-2xl z-55 overflow-hidden flex flex-col"
              >
                {/* Bell header panel */}
                <div className="p-3.5 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-stone-800">Alert Notification Center</span>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      id="clear-all-notifications-btn"
                      onClick={() => {
                        onClearNotifications();
                        setShowBellDropdown(false);
                      }}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                </div>

                {/* Notifications list */}
                <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <p className="text-xs">No active alerts</p>
                      <span className="text-[10px] text-stone-400">Everything looks stable!</span>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-3 relative transition-colors ${notif.read ? 'bg-white' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                      >
                        <div className="flex gap-2.5 items-start">
                          <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            notif.type === 'warning' ? 'bg-amber-500' :
                            notif.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-stone-700 leading-normal pr-4">
                              {notif.text}
                            </p>
                            <span className="text-[9px] text-stone-400 font-mono mt-0.5 block">
                              {notif.timestamp}
                            </span>
                          </div>

                          {!notif.read && (
                            <button
                              id={`mark-read-btn-${notif.id}`}
                              onClick={() => onMarkNotificationRead(notif.id)}
                              className="absolute top-3 right-3 text-indigo-600 hover:text-indigo-800 p-0.5 rounded-sm hover:bg-indigo-100/30"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-stone-100 bg-stone-50/50 text-center">
                  <span className="text-[10px] text-stone-400">Shift diagnostics: Running Normally</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User context widget dropdown click handler */}
        <div className="relative">
          <button 
            id="user-profile-menu-btn"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 border-l border-stone-200 pl-2.5 md:pl-4 focus:outline-hidden hover:opacity-90 select-none cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold leading-none shadow-xs">
              <span className="text-indigo-100 text-xs font-black">{currentEmp.name[0]}</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-[11px] font-bold text-stone-850 leading-none">{currentEmp.name}</div>
              <span className="text-[9px] text-stone-400 font-medium">{currentEmp.role}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>

          {showUserDropdown && (
            <>
              {/* Overlay background for closing dropdown */}
              <div 
                className="fixed inset-0 z-50 cursor-default" 
                onClick={() => setShowUserDropdown(false)}
              />

              <div 
                id="user-profile-menu-dropdown"
                className="absolute right-0 mt-2.5 w-76 bg-white border border-stone-200 rounded-xl shadow-2xl z-55 overflow-hidden flex flex-col pt-3 text-left"
              >
                {/* Current Active User Session summary */}
                <div className="px-4 pb-3 border-b border-stone-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-55 bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-black">
                    {currentEmp.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{currentEmp.name}</p>
                    <p className="text-[10px] text-stone-400 font-semibold">{currentEmp.role}</p>
                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">ID: {currentEmp.id}</p>
                  </div>
                </div>

                {/* DUTY TIMER ACTIONS */}
                <div className="p-3.5 bg-stone-50/50 border-b border-stone-100 space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">SHIFT CONTROL STATION</span>
                  {activeShift ? (
                    <div className="space-y-2">
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-extrabold text-emerald-600 block uppercase">ACTIVE ON-DUTY TIMER</span>
                          <span className="text-sm font-mono font-black text-emerald-800 tracking-tight">
                            {formatShiftDuration(activeShift.checkInTime)}
                          </span>
                        </div>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </div>
                      <button
                        id="btn-header-clock-out"
                        type="button"
                        onClick={() => handleClockOut(currentEmp.id)}
                        className="w-full text-center text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Clock Out / End Shift
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-stone-100/80 border border-stone-200/50 rounded-lg p-2 text-center">
                        <span className="text-[10px] font-bold text-stone-500 uppercase">OFF DUTY (CLOCKED OUT)</span>
                        <p className="text-[9px] text-stone-400 mt-0.5">Your sales volumes will not log under this session.</p>
                      </div>
                      <button
                        id="btn-header-clock-in"
                        type="button"
                        onClick={() => handleClockIn(currentEmp.id)}
                        className="w-full text-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Clock In / Begin Shift
                      </button>
                    </div>
                  )}
                </div>

                {/* CHANGER CLERK PROFILE SECTION */}
                <div className="p-3 max-h-48 overflow-y-auto space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">SWITCH REGISTER STAFF</span>
                  {(employees || []).map(emp => {
                    const isEmpActive = (shifts || []).some(s => s.employeeId === emp.id && !s.checkOutTime);
                    const isCurrent = emp.id === currentEmp.id;
                    return (
                      <button
                        key={emp.id}
                        id={`btn-header-select-cashier-${emp.id}`}
                        type="button"
                        onClick={() => {
                          if (setCurrentEmployeeId) {
                            setCurrentEmployeeId(emp.id);
                            setShowUserDropdown(false);
                            dispatchNotification?.(`Operator changed to: ${emp.name}`, 'info');
                          }
                        }}
                        className={`w-full text-left p-1.5 rounded-lg flex items-center justify-between transition-all border ${
                          isCurrent 
                            ? 'bg-indigo-50/40 border-indigo-200/50 text-indigo-955' 
                            : 'bg-white hover:bg-stone-50 border-stone-100 text-stone-700 hover:text-stone-900 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-5 h-5 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                            isCurrent ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-600'
                          }`}>
                            {emp.name[0]}
                          </div>
                          <div className="truncate text-left">
                            <p className="text-[10.5px] font-bold leading-none">{emp.name}</p>
                            <span className="text-[8px] text-stone-400 block mt-0.5">{emp.role}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {isEmpActive ? (
                            <span className="inline-block w-1.5 h-1.5 bg-emerald-550 bg-emerald-500 rounded-full" title="Active on duty" />
                          ) : (
                            <span className="inline-block w-1.5 h-1.5 bg-stone-300 rounded-full" title="Inactive" />
                          )}
                          {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 font-bold ml-1" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
