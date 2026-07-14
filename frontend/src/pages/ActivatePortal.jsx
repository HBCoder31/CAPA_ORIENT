import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, CheckCircle, ShieldAlert, Loader2, ArrowRight, Building2 } from 'lucide-react';
import { gsap } from 'gsap';
import ThemeToggle from '../components/ThemeToggle';
import logoImg from '../assets/logo.png';

const API_URL = 'http://localhost:5000/api/auth';

function ActivatePortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const rootRef = useRef(null);

  // Entrance animation — staggered reveal
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!token) {
      setError("Activation token is missing. Please check your link.");
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API_URL}/activate`, {
        token,
        password,
      });

      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Activation failed. The token may have expired or is invalid.'
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

      {/* Brand logo header */}
      <div className="reveal fixed top-6 left-6 z-20">
        <img 
          src={logoImg} 
          alt="CK Birla Group | Orient Paper Logo" 
          className="h-10 w-auto object-contain bg-white dark:bg-white/95 p-1.5 rounded-xl border shadow-sm" 
          style={{ borderColor: 'var(--border-subtle)' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="reveal text-center mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Portal Account Setup
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Set up your password to activate your CCMS access.
          </p>
        </div>

        <div 
          className="reveal rounded-3xl p-7 md:p-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 60px var(--shadow-color)', backdropFilter: 'blur(20px)' }}
        >
          {error && (
            <div className="reveal mb-5 p-3.5 rounded-2xl flex items-start gap-3 text-sm animate-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-6 py-4">
              <div className="flex justify-center reveal">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              </div>
              <div className="space-y-2 reveal">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Account Activated!</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Your portal access is now ready. You can log in using your email and new password.
                </p>
              </div>
              <Link
                to="/login"
                className="btn-sheen reveal w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                <span>Go to Login</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="reveal space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors duration-300"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>
              </div>

              <div className="reveal space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors duration-300"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-sheen reveal w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Activate Account</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="reveal text-center pt-2">
                <Link to="/login" className="text-xs font-semibold hover:underline transition-colors" style={{ color: 'var(--text-muted)' }}>
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="reveal text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Orient Paper & Industries Limited — CCMS
        </p>
      </div>
    </div>
  );
}

export default ActivatePortal;
