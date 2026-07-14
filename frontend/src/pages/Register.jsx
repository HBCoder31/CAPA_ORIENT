import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Building2, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { gsap } from 'gsap';
import ThemeToggle from '../components/ThemeToggle';
import logoImg from '../assets/logo.png';

const API_URL = 'http://localhost:5000/api/auth';

function Register() {
  const navigate = useNavigate();
  
  // Step 1: Verification Form state
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  
  // Step 2: Password Creation state
  const [customerName, setCustomerName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMode, setPasswordMode] = useState('manual'); // 'manual' or 'generate'
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  
  // Stepped Flow control
  const [step, setStep] = useState(1); // 1 = Verify, 2 = Set Password, 3 = Success
  
  // General status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.reveal-item', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power3.out'
      });
    }, containerRef);
    return () => ctx.revert();
  }, [step]);

  // Handler for Step 1: Verification
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/register/check`, {
        customerId,
        email
      });
      setCustomerName(res.data.data.customerName);
      setAlreadyRegistered(!!res.data.data.alreadyRegistered);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please contact your Key Account Manager.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate a strong password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$*!-_";
    let newPass = "";
    for (let i = 0; i < 12; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPass);
    setConfirmPassword(newPass);
    setCopied(false);
  };

  const copyToClipboard = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(password)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopyText(password);
        });
    } else {
      fallbackCopyText(password);
    }
  };

  const fallbackCopyText = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  // Handler for Step 2: Self-registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/register/submit`, {
        customerId,
        email,
        password
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete registration.');
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
    <div 
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg-app)' }}
    >
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      {/* Brand logo header */}
      <div className="reveal-item fixed top-6 left-6 z-20">
        <img 
          src={logoImg} 
          alt="CK Birla Group | Orient Paper Logo" 
          className="h-14 md:h-16 w-auto object-contain bg-white dark:bg-white/95 p-2 rounded-2xl border shadow-md" 
          style={{ borderColor: 'var(--border-subtle)' }}
        />
      </div>

      {/* Main Aurora Background circles */}
      <div className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 animate-pulse pointer-events-none" style={{ background: 'var(--accent)', top: '-10%', left: '-10%' }} />
      <div className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 animate-pulse pointer-events-none" style={{ background: 'var(--accent)', bottom: '-10%', right: '-10%' }} />

      <div className="w-full max-w-lg z-10 space-y-6">
        {/* Title / Logo Header */}
        <div className="text-center space-y-2">

          <h1 className="reveal-item text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {step === 1 && 'Register Portal Account'}
            {step === 2 && (alreadyRegistered ? 'Reset Portal Password' : 'Set Portal Password')}
            {step === 3 && (alreadyRegistered ? 'Password Reset Success!' : 'Registration Success!')}
          </h1>
          <p className="reveal-item text-xs" style={{ color: 'var(--text-muted)' }}>
            {step === 1 && 'Verify your SAP profile details to begin self-registration.'}
            {step === 2 && (alreadyRegistered ? 'Create a new password to reset your account credentials.' : 'Set a custom password or generate a secure credentials hash.')}
            {step === 3 && (alreadyRegistered ? 'Your password has been reset successfully.' : 'Your CCMS customer account is now fully active.')}
          </p>
        </div>

        {error && (
          <div className="reveal-item p-4 rounded-2xl flex items-start gap-3 text-sm border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div
          className="reveal-item rounded-3xl p-6 md:p-8"
          style={{ 
            background: 'var(--bg-surface)', 
            border: '1px solid var(--border-subtle)', 
            boxShadow: '0 20px 60px var(--shadow-color)',
            backdropFilter: 'blur(20px)' 
          }}
        >
          {step === 1 && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Customer ID (SAP code)
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="e.g. CUST100001"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors duration-300"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. procurement@company.com"
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
                className="btn-sheen w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Verify Identity</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: 'var(--text-muted)' }}>Customer Name</span>
                <span className="text-sm font-bold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{customerName}</span>
              </div>

              {alreadyRegistered && (
                <div className="p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 leading-relaxed bg-blue-500/10 border-blue-500/20 text-blue-400">
                  <span className="shrink-0">ℹ️</span>
                  <span><strong>Notice:</strong> This profile is already registered. Saving a new password will overwrite your existing access credentials.</span>
                </div>
              )}

              {/* Password choice tabs */}
              <div className="flex p-1 rounded-2xl border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => { setPasswordMode('manual'); setPassword(''); setConfirmPassword(''); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${passwordMode === 'manual' ? 'text-white' : 'text-slate-500'}`}
                  style={passwordMode === 'manual' ? { background: 'var(--accent)' } : {}}
                >
                  Custom Password
                </button>
                <button
                  type="button"
                  onClick={() => { setPasswordMode('generate'); generatePassword(); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${passwordMode === 'generate' ? 'text-white' : 'text-slate-500'}`}
                  style={passwordMode === 'generate' ? { background: 'var(--accent)' } : {}}
                >
                  Generate Secure Password
                </button>
              </div>

              {passwordMode === 'manual' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none"
                        style={fieldStyle}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none"
                        style={fieldStyle}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Generated Password
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          readOnly
                          value={password}
                          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-mono outline-none font-bold"
                          style={fieldStyle}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="px-4 rounded-2xl border flex items-center justify-center transition-all hover:bg-[var(--bg-surface-2)]"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {copied && (
                      <span className="text-[10px] font-bold text-emerald-500 block text-right mt-1">Copied to Clipboard!</span>
                    )}
                  </div>

                  <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/20 text-amber-500 text-xs leading-relaxed">
                    ⚠️ <strong>Important:</strong> Please copy and store this password securely before clicking Save & Activate.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="btn-sheen w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>Save & Activate</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 text-xs font-bold transition-colors hover:text-[var(--accent)] cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Go back to Verification</span>
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-6 py-4 animate-scale-up">
              <div className="flex justify-center">
                <div className="p-4 rounded-full border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                  <CheckCircle2 className="w-16 h-16" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {alreadyRegistered ? 'Password Reset!' : 'Account Activated!'}
                </h2>
                <p className="text-sm px-4" style={{ color: 'var(--text-secondary)' }}>
                  {alreadyRegistered
                    ? 'Your account password has been reset successfully. You can now use your email to log in.'
                    : 'Your password has been successfully configured. You can now use your email to access the customer portal.'}
                </p>
              </div>

              <button
                onClick={() => navigate('/login', { state: { email, password, role: 'customer' } })}
                className="w-full max-w-xs py-4 rounded-2xl font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 btn-sheen cursor-pointer"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                {alreadyRegistered ? 'Proceed to Sign In' : 'Back to Sign In'}
              </button>
            </div>
          )}
        </div>

        <p className="reveal-item text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Orient Paper & Industries Limited — CCMS
        </p>
      </div>
    </div>
  );
}

export default Register;
