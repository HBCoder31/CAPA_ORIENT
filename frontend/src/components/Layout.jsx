import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  User, 
  Landmark
} from 'lucide-react';
import { gsap } from 'gsap';
import ThemeToggle from './ThemeToggle';
import logoImg from '../assets/logo.png';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  
  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : { name: 'Guest User', role: 'Visitor', email: '' };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.sidebar-reveal', {
        opacity: 0,
        x: -20,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
      });
      gsap.from('.main-reveal', {
        opacity: 0,
        y: 16,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.15
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const menuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard
    },
    {
      name: 'Log Complaint',
      path: '/complaints/new',
      icon: PlusCircle
    },
    {
      name: 'Account Settings',
      path: '/account',
      icon: User
    }
  ];

  const filteredMenuItems = menuItems;

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col md:flex-row transition-colors duration-300" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Sidebar navigation */}
      <aside 
        className="w-full md:w-64 border-b md:border-b-0 md:border-r flex flex-col justify-between shrink-0 p-4 md:sticky md:top-0 md:h-screen transition-colors duration-300"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: '0 8px 32px 0 var(--shadow-color)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div className="space-y-8">
          {/* Logo / Company header */}
          {/* Logo / Company header */}
          <div className="flex items-center justify-center px-2 py-3 border-b sidebar-reveal" style={{ borderColor: 'var(--border-subtle)' }}>
            <img 
              src={logoImg} 
              alt="CK Birla Group | Orient Paper Logo" 
              className="h-10 w-full object-contain bg-white dark:bg-white/95 p-1.5 rounded-xl border shadow-sm" 
              style={{ borderColor: 'var(--border-subtle)' }}
            />
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-350 transform hover:scale-[1.05] active:scale-[0.98] cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-900/10'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User context footer */}
        <div className="mt-8 md:mt-0 pt-4 border-t space-y-4 sidebar-reveal" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-3 min-w-0 mr-2">
              <div className="p-2 rounded-xl border shrink-0" style={{ background: 'var(--accent-soft)', borderColor: 'var(--border-subtle)', color: 'var(--accent)' }}>
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.role}</span>
              </div>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main workspace area */}
      <main className="flex-1 overflow-x-hidden p-6 md:p-10 relative">
        <div className="max-w-7xl mx-auto main-reveal">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
