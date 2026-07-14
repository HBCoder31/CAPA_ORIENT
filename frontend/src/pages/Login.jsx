import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Mail, Lock, User, ShieldAlert, ArrowRight, Loader2, Landmark, Building2 } from 'lucide-react';
import { gsap } from 'gsap';
import ThemeToggle from '../components/ThemeToggle';
import { Link, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.png';

const API_URL = 'http://localhost:5000/api/auth';

function Login() {
  const location = useLocation();
  const [isCustomer, setIsCustomer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);

  const rootRef = useRef(null);
  const employeeTabRef = useRef(null);
  const customerTabRef = useRef(null);

  useEffect(() => {
    if (location.state) {
      const { email: stateEmail, password: statePassword, role: stateRole } = location.state;
      if (stateEmail) setEmail(stateEmail);
      if (statePassword) setPassword(statePassword);
      if (stateRole === 'customer') {
        setIsCustomer(true);
      }
      setInfoMessage("Account configured successfully! Click Sign In to enter.");
      // Clear navigation state to prevent showing the banner again on manual refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  const pillRef = useRef(null);

  // Entrance animation — staggered reveal, not a 3D flip
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set('.reveal', { opacity: 0, y: 18 });
      gsap.to('.reveal', {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Sliding pill behind the active role tab
  useEffect(() => {
    const target = isCustomer ? customerTabRef.current : employeeTabRef.current;
    if (target && pillRef.current) {
      gsap.to(pillRef.current, {
        x: target.offsetLeft,
        width: target.offsetWidth,
        duration: 0.45,
        ease: 'power3.out',
      });
    }
  }, [isCustomer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setInfoMessage(null);

    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { token, user } = response.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setSuccess(true);
      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Something went wrong. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    background: 'var(--bg-surface-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  return (
    <div ref={rootRef} className="aurora-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <ThemeToggle className="reveal fixed top-6 right-6 z-20" />

      <div className="reveal fixed top-6 left-6 z-20">
        <img 
          src={logoImg} 
          alt="CK Birla Group | Orient Paper Logo" 
          className="h-14 md:h-16 w-auto object-contain bg-white dark:bg-white/95 p-2 rounded-2xl border shadow-md" 
          style={{ borderColor: 'var(--border-subtle)' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="reveal text-center mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Complaint Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Sign in to log, track and resolve complaints.
          </p>
        </div>

        <div
          className="reveal rounded-3xl p-7 md:p-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 60px var(--shadow-color)', backdropFilter: 'blur(20px)' }}
        >
          {/* Role Switch Tabs */}
          <div className="reveal relative flex p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
            <div ref={pillRef} className="absolute top-1 bottom-1 left-1 rounded-xl transition-none" style={{ background: 'var(--accent)', width: '0px' }} />
            <button
              ref={employeeTabRef}
              type="button"
              onClick={() => { setIsCustomer(false); setError(null); setInfoMessage(null); }}
              className="relative z-10 flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-300"
              style={{ color: !isCustomer ? '#fff' : 'var(--text-secondary)' }}
            >
              <User className="w-4 h-4" />
              Employee / Admin
            </button>
            <button
              ref={customerTabRef}
              type="button"
              onClick={() => { setIsCustomer(true); setError(null); setInfoMessage(null); }}
              className="relative z-10 flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-300"
              style={{ color: isCustomer ? '#fff' : 'var(--text-secondary)' }}
            >
              <Landmark className="w-4 h-4" />
              Customer
            </button>
          </div>

          {infoMessage && (
            <div className="reveal mb-5 p-3.5 rounded-2xl flex items-start gap-3 text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
              <Landmark className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="reveal mb-5 p-3.5 rounded-2xl flex items-start gap-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="reveal mb-5 p-3.5 rounded-2xl flex items-center gap-3 text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span>Login successful! Redirecting…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="reveal space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {isCustomer ? 'Registered Email' : 'Official Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isCustomer ? 'e.g., procurement@company.com' : 'e.g., employee@orientpaper.com'}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors duration-300"
                  style={fieldStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </div>
            </div>

            <div className="reveal space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors duration-300"
                  style={fieldStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="btn-sheen reveal w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="reveal text-center text-xs mt-6 pt-4 border-t border-dashed" style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>First-time Customer? </span>
            <Link to="/register" className="font-bold hover:text-[var(--accent)] transition-colors underline" style={{ color: 'var(--accent)' }}>
              Register / Reset Password here
            </Link>
          </div>
        </div>

        <p className="reveal text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Orient Paper & Industries Limited — CCMS
        </p>
      </div>
    </div>
  );
}

export default Login;