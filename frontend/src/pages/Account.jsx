import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { 
  User, Mail, Key, Briefcase, ShieldAlert, Building, Phone, MapPin, Loader2, ShieldCheck
} from 'lucide-react';

function Account() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Configuration States (Moved from Dashboard)
  const [customerPortalEnabled, setCustomerPortalEnabled] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [kams, setKams] = useState([]);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [selectedBuForSla, setSelectedBuForSla] = useState(1);
  const [mdApprovalLimit, setMdApprovalLimit] = useState(100000);

  useEffect(() => {
    async function loadProfileAndConfigs() {
      try {
        setLoading(true);
        const res = await api.get('/auth/profile');
        setProfile(res.data.data);

        if (user.role === 'Administrator') {
          const [configRes, custRes, kamsRes, slaRes] = await Promise.all([
            api.get('/auth/config/customer-portal'),
            api.get('/complaints/customers'),
            api.get('/auth/config/kams'),
            api.get('/auth/config/sla')
          ]);
          setCustomerPortalEnabled(configRes.data.data.enabled);
          setCustomers(custRes.data.data);
          setKams(kamsRes.data.data);
          setSlaConfigs(slaRes.data.data);
        }

        if (['Administrator', 'Managing Director'].includes(user.role)) {
          const limitRes = await api.get('/auth/config/md-limit');
          setMdApprovalLimit(limitRes.data.data.limit);
        }
      } catch (err) {
        setProfileError(err.response?.data?.message || 'Failed to load details.');
      } finally {
        setLoading(false);
      }
    }
    loadProfileAndConfigs();
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordSuccess('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  // Config Action Handlers (Moved from Dashboard)
  const handlePortalToggle = async (e) => {
    const val = e.target.checked;
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/customer-portal', { enabled: val });
      setCustomerPortalEnabled(val);
    } catch (err) {
      alert('Failed to update system configuration.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleKamReassign = async (customerId, kamId) => {
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/kam-assignment', { customerId, kamId: parseInt(kamId, 10) });
      setCustomers(prev => prev.map(c => {
        if (c.Customer_ID === customerId) {
          const selectedKam = kams.find(k => k.KAM_ID === parseInt(kamId, 10));
          return {
            ...c,
            KAM_ID: parseInt(kamId, 10),
            KAM_Name: selectedKam ? selectedKam.Employee_Name : c.KAM_Name
          };
        }
        return c;
      }));
    } catch (err) {
      alert('Failed to update KAM assignment.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleSlaChange = async (workflowId, days) => {
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/sla', { workflowId, slaDays: parseInt(days, 10) });
      setSlaConfigs(prev => prev.map(item => {
        if (item.Workflow_ID === workflowId) {
          return { ...item, SLA_Days: parseInt(days, 10) };
        }
        return item;
      }));
    } catch (err) {
      alert('Failed to update SLA configuration.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleMdLimitChange = async (val) => {
    try {
      setUpdatingConfig(true);
      const numericVal = parseFloat(val);
      if (isNaN(numericVal) || numericVal < 0) return;
      setMdApprovalLimit(numericVal);
      await api.put('/auth/config/md-limit', { limit: numericVal });
    } catch (err) {
      alert('Failed to update MD approval limit.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const fieldStyle = {
    background: 'var(--bg-surface-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto main-reveal">
        {/* Header section */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Account Settings</h1>
          <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage your personal profile details, organization mapping, and system administration configurations.
          </p>
        </div>

        {profileError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center space-x-3 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Main Info Card */}
            <div 
              className="p-6 md:p-8 rounded-3xl space-y-6"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border font-bold text-xl text-white" style={{ background: 'var(--accent)', boxShadow: '0 8px 24px var(--accent-soft)' }}>
                  {profile?.Customer_Name?.[0] || profile?.Employee_Name?.[0] || 'U'}
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {profile?.Customer_Name || profile?.Employee_Name}
                  </h2>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border text-white bg-emerald-500" style={{ borderColor: 'var(--border-subtle)' }}>
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                
                {/* Identification Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Profile Information</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 text-xs">
                      <Briefcase className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Account ID</span>
                        <span className="font-mono mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.Customer_ID || profile?.Employee_Code || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 text-xs">
                      <Mail className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Official Email</span>
                        <span className="mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.Customer_Email || profile?.Official_Email}</span>
                      </div>
                    </div>

                    {profile?.Mobile_Number && (
                      <div className="flex items-start space-x-3 text-xs">
                        <Phone className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Mobile Phone</span>
                          <span className="mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.Mobile_Number}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scope & Mapping Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Organizational Context</h3>

                  <div className="space-y-3">
                    {user.role === 'Customer' ? (
                      <>
                        <div className="flex items-start space-x-3 text-xs">
                          <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Location Address</span>
                            <span className="mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.City ? `${profile.City}, ${profile.State || ''}` : 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 text-xs">
                          <Building className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>SAP Account Code</span>
                            <span className="font-mono mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.SAP_Customer_Code || 'N/A'}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start space-x-3 text-xs">
                          <Building className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Department</span>
                            <span className="mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.Department_Name || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 text-xs">
                          <User className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <span className="block font-semibold" style={{ color: 'var(--text-secondary)' }}>Reporting Line</span>
                            <span className="mt-0.5 block" style={{ color: 'var(--text-primary)' }}>{profile?.Manager_Name ? `Reports to ${profile.Manager_Name}` : 'Independent'}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Mapped Key Account Manager (Only for Customers) */}
            {user.role === 'Customer' && profile?.KAM_Name && (
              <div 
                className="p-6 rounded-3xl space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Designated Key Account Manager (KAM)</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Direct contact profile for any urgent support or lodging questions.</p>
                </div>
                
                <div className="p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>{profile.KAM_Name}</span>
                    <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Customer Relationship Officer</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 text-xs font-mono">
                    <div className="flex items-center space-x-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <Mail className="w-4 h-4" />
                      <span>{profile.KAM_Email}</span>
                    </div>
                    {profile.KAM_Phone && (
                      <div className="flex items-center space-x-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <Phone className="w-4 h-4" />
                        <span>{profile.KAM_Phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Column 3: Security / Change Password */}
          <div>
            <div 
              className="p-6 rounded-3xl space-y-6 sticky top-8"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Security settings</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Update your portal login credential password.</p>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={fieldStyle}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-emerald-500 transition-all"
                    placeholder="Enter current password..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={fieldStyle}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-emerald-500 transition-all"
                    placeholder="Min 6 characters..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={fieldStyle}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-emerald-500 transition-all"
                    placeholder="Repeat new password..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl text-xs font-bold transition-all text-white cursor-pointer btn-sheen flex items-center justify-center space-x-2"
                  style={{
                    background: 'var(--accent)',
                    boxShadow: '0 8px 24px var(--accent-soft)'
                  }}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Configurations Section (Moved from Dashboard) */}
        
        {/* MD & Admin Escalation Limits Settings Panel */}
        {['Administrator', 'Managing Director'].includes(user.role) && (
          <div 
            className="p-6 rounded-3xl space-y-4 transition-all duration-300"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 30px var(--shadow-color)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Escalation Limits Settings</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Configure payout thresholds for managing director approvals.</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1 pr-4">
                <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>MD Approval Payout Limit</span>
                <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                  Commercial settlements with amounts exceeding this limit will be escalated to the MD for final approval. Settlements below this value skip the MD stage.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={mdApprovalLimit}
                  onChange={(e) => handleMdLimitChange(e.target.value)}
                  disabled={updatingConfig}
                  className="w-32 px-3 py-2 rounded-xl border font-semibold outline-none text-xs text-slate-850 dark:text-white"
                  style={{ 
                    background: 'var(--bg-surface-2)', 
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>INR</span>
              </div>
            </div>
          </div>
        )}

        {/* Admin Configuration Settings Panel */}
        {user.role === 'Administrator' && (
          <div 
            className="p-6 rounded-3xl space-y-6 transition-all duration-300"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 30px var(--shadow-color)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>System Administration Settings</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Configure portal access rules and features globally.</p>
              </div>
            </div>
            
            {/* Allow Portal Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1 pr-4">
                <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>Allow Customer Portal Logins</span>
                <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                  When checked, customers can sign in to view and log complaints. When unchecked, customer logins are disabled globally, requiring KAMs to file complaints on their behalf.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={customerPortalEnabled} 
                  disabled={updatingConfig}
                  onChange={handlePortalToggle}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-700/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Customer KAM Assignment Settings */}
            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Manage Customer KAM Mappings</h4>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Dynamically reassign default Key Account Managers to client profiles.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-1">
                {customers.map((c) => (
                  <div 
                    key={c.Customer_ID} 
                    className="p-3 rounded-2xl flex items-center justify-between border text-xs"
                    style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div>
                      <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{c.Customer_Name}</span>
                      <span className="text-[10px] font-mono block" style={{ color: 'var(--text-muted)' }}>{c.Customer_ID} | {c.City || ''}</span>
                    </div>
                    <select
                      value={c.KAM_ID || ''}
                      onChange={(e) => handleKamReassign(c.Customer_ID, e.target.value)}
                      disabled={updatingConfig}
                      className="px-2 py-1.5 rounded-xl border font-semibold outline-none text-xs text-slate-850 dark:text-white"
                      style={{ 
                        background: 'var(--bg-surface)', 
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="" disabled className="text-slate-850 dark:text-white">Select KAM</option>
                      {kams.map((k) => (
                        <option key={k.KAM_ID} value={k.KAM_ID} className="text-slate-850 dark:text-white">{k.Employee_Name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow SLA Timings Settings */}
            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Manage Stage SLA Timings</h4>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Configure resolving timeline durations (in Days) per workflow stage.</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedBuForSla(1)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedBuForSla === 1 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-slate-700/30 text-slate-400 border border-transparent'
                    }`}
                  >
                    Paper BU
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBuForSla(2)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedBuForSla === 2 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-slate-700/30 text-slate-400 border border-transparent'
                    }`}
                  >
                    Chemical BU
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-1">
                {slaConfigs
                  .filter((item) => item.Business_Unit_ID === selectedBuForSla)
                  .map((item) => (
                    <div 
                      key={item.Workflow_ID} 
                      className="p-3 rounded-2xl flex items-center justify-between border text-xs"
                      style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{item.Stage_Name}</span>
                        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>Stage Number: {item.Stage_Number}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={item.SLA_Days}
                          onChange={(e) => handleSlaChange(item.Workflow_ID, e.target.value)}
                          disabled={updatingConfig}
                          className="w-16 px-2 py-1 rounded-xl border text-center font-semibold outline-none text-xs text-slate-850 dark:text-white"
                          style={{ 
                            background: 'var(--bg-surface)', 
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Days</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

export default Account;
