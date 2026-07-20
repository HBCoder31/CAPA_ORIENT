import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  LogOut,
  User,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { gsap } from 'gsap';
import ThemeToggle from './ThemeToggle';
import logoImg from '../assets/logo.png';
import api from '../utils/api';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const drawerRef = useRef(null);
  const overlayRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : { name: 'Guest User', role: 'Visitor', email: '' };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.clear();
      navigate('/login', { replace: true });
    }
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Animate drawer open/close
  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return;
    if (sidebarOpen) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.fromTo(drawerRef.current, { x: '-100%' }, { x: '0%', duration: 0.3, ease: 'power3.out' });
    } else {
      gsap.to(drawerRef.current, { x: '-100%', duration: 0.25, ease: 'power3.in' });
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' });
    }
  }, [sidebarOpen]);

  // Entry animation (desktop)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.sidebar-reveal', {
        opacity: 0, x: -20, duration: 0.6, stagger: 0.08, ease: 'power3.out',
      });
      gsap.from('.main-reveal', {
        opacity: 0, y: 16, duration: 0.7, ease: 'power3.out', delay: 0.15
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const menuItems = [
    { name: 'Dashboard',        path: '/dashboard',      icon: LayoutDashboard },
    { name: 'Log Complaint',    path: '/complaints/new', icon: PlusCircle },
    { name: 'Account Settings', path: '/account',        icon: User },
  ];

  const SidebarContent = ({ onClose }) => (
    <div className="flex flex-col h-full">
      {/* Logo + close button */}
      <div className="flex items-center justify-between px-4 py-4 border-b sidebar-reveal" style={{ borderColor: 'var(--border-subtle)' }}>
        <img
          src={logoImg}
          alt="CK Birla Group | Orient Paper Logo"
          className="h-9 object-contain bg-white dark:bg-white/95 p-1.5 rounded-xl border shadow-sm"
          style={{ borderColor: 'var(--border-subtle)', maxWidth: '160px' }}
        />
        {/* Close button — only visible on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-surface-2)' }}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group sidebar-reveal ${
                isActive
                  ? 'text-white shadow-lg'
                  : 'hover:scale-[1.02]'
              }`}
              style={
                isActive
                  ? { background: 'var(--accent)', boxShadow: '0 4px 14px var(--accent-soft)' }
                  : { color: 'var(--text-secondary)', background: 'transparent' }
              }
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.name}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t space-y-3 sidebar-reveal" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 mr-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 10px var(--accent-soft)' }}
            >
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
              <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{user.role}</span>
            </div>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#f87171',
            border: '1px solid rgba(239,68,68,0.2)'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="min-h-screen flex transition-colors duration-300" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>

      {/* ── DESKTOP sidebar (always visible ≥ md) ── */}
      <aside
        className="hidden md:flex w-64 flex-col shrink-0 sticky top-0 h-screen transition-colors duration-300"
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: '4px 0 24px var(--shadow-color)',
        }}
      >
        <SidebarContent onClose={null} />
      </aside>

      {/* ── MOBILE overlay + drawer ── */}
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={() => setSidebarOpen(false)}
        className="md:hidden fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          opacity: 0,
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: '8px 0 40px rgba(0,0,0,0.4)',
          transform: 'translateX(-100%)',
        }}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <img
            src={logoImg}
            alt="Orient Paper CCMS"
            className="h-8 object-contain bg-white dark:bg-white/95 px-2 py-1 rounded-lg border shadow-sm"
            style={{ borderColor: 'var(--border-subtle)' }}
          />

          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-10">
          <div className="max-w-7xl mx-auto main-reveal">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
