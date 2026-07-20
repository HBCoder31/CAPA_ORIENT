import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import {
  User, Mail, Key, Briefcase, ShieldAlert, Building, Phone, MapPin,
  Loader2, ShieldCheck, Lock, Eye, EyeOff, CreditCard, Globe,
  UserCheck, Settings, AlertTriangle, CheckCircle2, ChevronRight,
  RefreshCw, Users, Sliders, FileText
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
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Admin config states
  const [customerPortalEnabled, setCustomerPortalEnabled] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [kams, setKams] = useState([]);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [selectedBuForSla, setSelectedBuForSla] = useState(1);
  const [mdApprovalLimit, setMdApprovalLimit] = useState(100000);
  const [custAssignments, setCustAssignments] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [openComplaints, setOpenComplaints] = useState([]);

  useEffect(() => {
    async function loadProfileAndConfigs() {
      try {
        setLoading(true);
        const res = await api.get('/auth/profile');
        setProfile(res.data.data);

        if (user.role === 'Administrator') {
          const [configRes, custRes, kamsRes, slaRes, assignRes, statsRes] = await Promise.all([
            api.get('/auth/config/customer-portal'),
            api.get('/complaints/customers'),
            api.get('/auth/config/kams'),
            api.get('/auth/config/sla'),
            api.get('/auth/config/customer-assignments'),
            api.get('/complaints/admin/dept-stats')
          ]);
          setCustomerPortalEnabled(configRes.data.data.enabled);
          setCustomers(custRes.data.data);
          setKams(kamsRes.data.data);
          setSlaConfigs(slaRes.data.data);
          setCustAssignments(assignRes.data.data.assignments);
          setExecutives(assignRes.data.data.executives);
          setWorkloads(statsRes.data.data.workloads);
          setOpenComplaints(statsRes.data.data.openComplaints);
        }

        if (['Administrator', 'Managing Director'].includes(user.role)) {
          const limitRes = await api.get('/auth/config/md-limit');
          setMdApprovalLimit(limitRes.data.data.limit);
        }
      } catch (err) {
        setProfileError(err.response?.data?.message || 'Failed to load profile details.');
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
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed. Check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePortalToggle = async (e) => {
    const val = e.target.checked;
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/customer-portal', { enabled: val });
      setCustomerPortalEnabled(val);
    } catch {
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
          return { ...c, KAM_ID: parseInt(kamId, 10), KAM_Name: selectedKam?.Employee_Name || c.KAM_Name };
        }
        return c;
      }));
    } catch {
      alert('Failed to update KAM assignment.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleSlaChange = async (workflowId, days) => {
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/sla', { workflowId, slaDays: parseInt(days, 10) });
      setSlaConfigs(prev => prev.map(item =>
        item.Workflow_ID === workflowId ? { ...item, SLA_Days: parseInt(days, 10) } : item
      ));
    } catch {
      alert('Failed to update SLA configuration.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleMdLimitChange = async (val) => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal) || numericVal < 0) return;
    setMdApprovalLimit(numericVal);
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/md-limit', { limit: numericVal });
    } catch {
      alert('Failed to update MD approval limit.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleExecReassign = async (customerId, departmentId, employeeId, businessUnitId) => {
    try {
      setUpdatingConfig(true);
      await api.put('/auth/config/customer-assignments', {
        customerId, departmentId: parseInt(departmentId, 10),
        employeeId: parseInt(employeeId, 10), businessUnitId: parseInt(businessUnitId, 10)
      });
      const assignRes = await api.get('/auth/config/customer-assignments');
      setCustAssignments(assignRes.data.data.assignments);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update executive assignment.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleManualReassignComplaint = async (complaintId, employeeId) => {
    try {
      setUpdatingConfig(true);
      await api.put(`/complaints/${complaintId}/assign`, { employeeId: parseInt(employeeId, 10) });
      const statsRes = await api.get('/complaints/admin/dept-stats');
      setWorkloads(statsRes.data.data.workloads);
      setOpenComplaints(statsRes.data.data.openComplaints);
      alert('Complaint reassigned successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reassign complaint.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const displayName = profile?.Customer_Name || profile?.Employee_Name || user.name || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const roleColors = {
    'Administrator':       { bg: 'from-violet-600 to-indigo-600',  badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    'Managing Director':   { bg: 'from-amber-600 to-orange-600',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    'KAM':                 { bg: 'from-emerald-600 to-teal-600',   badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    'Customer':            { bg: 'from-sky-600 to-blue-600',       badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
    'TS Head':             { bg: 'from-rose-600 to-pink-600',      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    'TS Engineer':         { bg: 'from-rose-500 to-red-500',       badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    'QC Head':             { bg: 'from-cyan-600 to-teal-600',      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    'Marketing Head':      { bg: 'from-fuchsia-600 to-purple-600', badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
    'Marketing Executive': { bg: 'from-fuchsia-500 to-pink-500',   badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
    'Finance Head':        { bg: 'from-green-600 to-emerald-600',  badge: 'bg-green-500/20 text-green-300 border-green-500/30' },
    'Operations Head':     { bg: 'from-slate-500 to-slate-600',    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  };
  const roleTheme = roleColors[user.role] || roleColors['Customer'];

  const fieldStyle = {
    background: 'var(--bg-surface-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center h-[60vh] space-y-3">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading profile…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto">

        {/* ── Hero Header ── */}
        <div
          className={`relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br ${roleTheme.bg}`}
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-3xl bg-white" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-15 blur-2xl bg-white" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white bg-white/20 backdrop-blur-sm border border-white/30">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white" title="Active" />
            </div>

            {/* Name & role */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${roleTheme.badge}`}>
                  {user.role}
                </span>
                {profile?.Department_Name && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-white/80 border border-white/20">
                    {profile.Department_Name}
                  </span>
                )}
                {profile?.Employee_Code && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-white/10 text-white/80 border border-white/20">
                    {profile.Employee_Code}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-xs mt-2 font-mono">
                {profile?.Customer_Email || profile?.Official_Email || '—'}
              </p>
            </div>

            {/* Quick stat chips */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-[11px] font-bold text-white">Account Active</span>
              </div>
              {profile?.Manager_Name && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <UserCheck className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-[11px] text-white/70">Reports to {profile.Manager_Name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {profileError && (
          <div className="p-4 rounded-2xl flex items-center space-x-3 text-sm border"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Profile Details ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Profile Info Card */}
            <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 40px var(--shadow-color)' }}>
              {/* Card header strip */}
              <div className="px-6 py-4 border-b flex items-center space-x-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
                <User className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Profile Information</span>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">

                {/* Customer fields */}
                {user.role === 'Customer' && (
                  <>
                    <ProfileField icon={<Briefcase className="w-4 h-4" />} label="Customer ID" value={profile?.Customer_ID} mono />
                    <ProfileField icon={<Mail className="w-4 h-4" />} label="Email Address" value={profile?.Customer_Email} />
                    <ProfileField icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.Customer_Phone} />
                    <ProfileField icon={<MapPin className="w-4 h-4" />} label="Location" value={[profile?.City, profile?.State, profile?.Country].filter(Boolean).join(', ')} />
                    {profile?.GSTIN && <ProfileField icon={<CreditCard className="w-4 h-4" />} label="GSTIN" value={profile.GSTIN} mono />}
                    {profile?.PAN_Number && <ProfileField icon={<FileText className="w-4 h-4" />} label="PAN Number" value={profile.PAN_Number} mono />}
                    {profile?.Billing_Address && (
                      <div className="sm:col-span-2">
                        <ProfileField icon={<Building className="w-4 h-4" />} label="Billing Address" value={profile.Billing_Address} />
                      </div>
                    )}
                  </>
                )}

                {/* Employee fields */}
                {user.role !== 'Customer' && (
                  <>
                    <ProfileField icon={<Briefcase className="w-4 h-4" />} label="Employee Code" value={profile?.Employee_Code} mono />
                    <ProfileField icon={<Mail className="w-4 h-4" />} label="Official Email" value={profile?.Official_Email} />
                    <ProfileField icon={<Phone className="w-4 h-4" />} label="Mobile Number" value={profile?.Mobile_Number} />
                    <ProfileField icon={<Building className="w-4 h-4" />} label="Department" value={profile?.Department_Name} />
                    <ProfileField icon={<Globe className="w-4 h-4" />} label="Role" value={profile?.Role_Name} />
                    <ProfileField icon={<UserCheck className="w-4 h-4" />} label="Reports To" value={profile?.Manager_Name || 'Independent'} />
                  </>
                )}
              </div>
            </div>

            {/* KAM Card (Customer only) */}
            {user.role === 'Customer' && profile?.KAM_Name && (
              <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 40px var(--shadow-color)' }}>
                <div className="px-6 py-4 border-b flex items-center space-x-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Your Key Account Manager</span>
                </div>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0" style={{ background: 'var(--accent)', boxShadow: '0 4px 14px var(--accent-soft)' }}>
                      {profile.KAM_Name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>{profile.KAM_Name}</span>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Key Account Manager</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs shrink-0">
                      <a href={`mailto:${profile.KAM_Email}`} className="flex items-center space-x-1.5 hover:underline" style={{ color: 'var(--accent)' }}>
                        <Mail className="w-3.5 h-3.5" />
                        <span className="font-mono">{profile.KAM_Email}</span>
                      </a>
                      {profile.KAM_Phone && (
                        <div className="flex items-center space-x-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <Phone className="w-3.5 h-3.5" />
                          <span className="font-mono">{profile.KAM_Phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Security Panel ── */}
          <div className="space-y-6">
            <div className="rounded-3xl overflow-hidden sticky top-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 40px var(--shadow-color)' }}>
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center space-x-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Security Settings</span>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Change your portal login password below. Choose a strong password of at least 6 characters.
                </p>

                {/* Alerts */}
                {passwordError && (
                  <div className="flex items-start space-x-2 p-3 rounded-xl text-xs border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="flex items-start space-x-2 p-3 rounded-xl text-xs border" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#34d399' }}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4" autoComplete="off">
                  <PasswordField
                    label="Current Password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    show={showCurrent}
                    onToggle={() => setShowCurrent(v => !v)}
                    fieldStyle={fieldStyle}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <PasswordField
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNew}
                    onToggle={() => setShowNew(v => !v)}
                    fieldStyle={fieldStyle}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                  <PasswordField
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(v => !v)}
                    fieldStyle={fieldStyle}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                  />

                  {/* Password strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex space-x-1">
                        {[1,2,3,4].map(i => {
                          const strength = Math.min(Math.floor(newPassword.length / 3), 4);
                          return (
                            <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{ background: i <= strength
                                ? strength <= 1 ? '#f87171' : strength <= 2 ? '#fb923c' : strength <= 3 ? '#facc15' : '#34d399'
                                : 'var(--border-subtle)' }} />
                          );
                        })}
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {newPassword.length < 6 ? 'Too short' : newPassword.length < 9 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl text-sm font-bold transition-all text-white cursor-pointer btn-sheen flex items-center justify-center space-x-2 disabled:opacity-60"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 24px var(--accent-soft)' }}
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
        </div>

        {/* ── MD / Admin: Escalation Limits ── */}
        {['Administrator', 'Managing Director'].includes(user.role) && (
          <AdminSection
            icon={<Sliders className="w-4 h-4 text-amber-400" />}
            title="Escalation Limit Settings"
            subtitle="Configure payout thresholds for MD approval escalation."
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="space-y-1">
                <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>MD Approval Payout Limit</span>
                <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                  Commercial settlements above this amount are escalated to the MD for final approval.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>₹</span>
                <input
                  type="number" min="0" step="5000" value={mdApprovalLimit}
                  onChange={(e) => handleMdLimitChange(e.target.value)}
                  disabled={updatingConfig}
                  className="w-36 px-3 py-2 rounded-xl border font-semibold outline-none text-xs"
                  style={fieldStyle}
                />
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>INR</span>
              </div>
            </div>
          </AdminSection>
        )}

        {/* ── Admin: System Config ── */}
        {user.role === 'Administrator' && (
          <>
            {/* Portal toggle */}
            <AdminSection
              icon={<Settings className="w-4 h-4 text-indigo-400" />}
              title="System Administration"
              subtitle="Configure portal access rules globally."
            >
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1 pr-4">
                  <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>Allow Customer Portal Logins</span>
                  <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                    When off, customer logins are disabled globally — KAMs must file complaints on their behalf.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={customerPortalEnabled} disabled={updatingConfig} onChange={handlePortalToggle} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>
            </AdminSection>

            {/* KAM Assignments */}
            <AdminSection
              icon={<Users className="w-4 h-4 text-emerald-400" />}
              title="Customer KAM Mappings"
              subtitle="Dynamically reassign Key Account Managers to client profiles."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {customers.map((c) => (
                  <div key={c.Customer_ID} className="p-3 rounded-2xl flex items-center justify-between border text-xs" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{c.Customer_Name}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{c.Customer_ID}</span>
                    </div>
                    <select
                      value={c.KAM_ID || ''}
                      onChange={(e) => handleKamReassign(c.Customer_ID, e.target.value)}
                      disabled={updatingConfig}
                      className="px-2 py-1.5 rounded-xl border font-semibold outline-none text-xs"
                      style={fieldStyle}
                    >
                      <option value="" disabled>Select KAM</option>
                      {kams.map((k) => (
                        <option key={k.KAM_ID} value={k.KAM_ID}>{k.Employee_Name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </AdminSection>

            {/* SLA Config */}
            <AdminSection
              icon={<RefreshCw className="w-4 h-4 text-sky-400" />}
              title="Stage SLA Timings"
              subtitle="Configure resolution timeline durations (in days) per workflow stage."
              headerExtra={
                <div className="flex space-x-1.5">
                  {[{ id: 1, label: 'Paper BU' }, { id: 2, label: 'Chemical BU' }].map(bu => (
                    <button key={bu.id} type="button" onClick={() => setSelectedBuForSla(bu.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${selectedBuForSla === bu.id ? 'border-emerald-500/40 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                      style={{ background: selectedBuForSla === bu.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-surface-2)' }}>
                      {bu.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {slaConfigs.filter(item => item.Business_Unit_ID === selectedBuForSla).map((item) => (
                  <div key={item.Workflow_ID} className="p-3 rounded-2xl flex items-center justify-between border text-xs" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-0.5">
                      <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{item.Stage_Name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Stage {item.Stage_Number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="number" min="1" max="90" value={item.SLA_Days}
                        onChange={(e) => handleSlaChange(item.Workflow_ID, e.target.value)}
                        disabled={updatingConfig}
                        className="w-16 px-2 py-1 rounded-xl border text-center font-bold outline-none text-xs"
                        style={fieldStyle} />
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>days</span>
                    </div>
                  </div>
                ))}
              </div>
            </AdminSection>

            {/* Executive Assignments */}
            <AdminSection
              icon={<UserCheck className="w-4 h-4 text-violet-400" />}
              title="Customer Executive Mappings"
              subtitle="Map default TS, QC, Ops, Marketing, Finance executives to customers per segment."
            >
              {/* Create / Update form */}
              <div className="p-4 rounded-2xl border space-y-3 mb-4" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-secondary)' }}>Create / Update Assignment</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { id: 'assign_cust', label: 'Customer', options: customers.map(c => ({ v: c.Customer_ID, l: `${c.Customer_Name} (${c.Customer_ID})` })) },
                    { id: 'assign_bu',   label: 'Business Unit', options: [{ v: '1', l: 'Paper BU' }, { v: '2', l: 'Chemical BU' }] },
                    { id: 'assign_dept', label: 'Department', options: [
                      { v: '1', l: 'TS Paper' }, { v: '2', l: 'QC Paper' }, { v: '3', l: 'Operations Paper' }, { v: '4', l: 'Marketing Paper' }, { v: '5', l: 'Finance Paper' },
                      { v: '7', l: 'TS Chemical' }, { v: '8', l: 'QC Chemical' }, { v: '9', l: 'Operations Chemical' }, { v: '10', l: 'Marketing Chemical' }, { v: '11', l: 'Finance Chemical' },
                    ]},
                    { id: 'assign_exec', label: 'Executive', options: executives.map(e => ({ v: e.Employee_ID, l: `${e.Employee_Name} (${e.Role_Name})` })) },
                  ].map(sel => (
                    <select key={sel.id} id={sel.id} className="px-2 py-2 rounded-xl border text-xs" style={fieldStyle}>
                      <option value="">-- {sel.label} --</option>
                      {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ))}
                </div>
                <button type="button" disabled={updatingConfig}
                  onClick={() => {
                    const cId = document.getElementById('assign_cust').value;
                    const buId = document.getElementById('assign_bu').value;
                    const dId = document.getElementById('assign_dept').value;
                    const eId = document.getElementById('assign_exec').value;
                    if (!cId || !buId || !dId || !eId) { alert('All fields are required!'); return; }
                    handleExecReassign(cId, dId, eId, buId);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: 'var(--accent)', boxShadow: '0 4px 12px var(--accent-soft)' }}>
                  Save Assignment
                </button>
              </div>

              {/* Current assignments */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {custAssignments.map((a) => (
                  <div key={a.Assignment_ID} className="p-3 rounded-2xl flex items-center justify-between border text-xs" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{a.Customer_Name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.Business_Unit_Name} · {a.Department_Name}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border" style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--accent)', borderColor: 'var(--accent-soft)' }}>
                      {a.Executive_Name}
                    </span>
                  </div>
                ))}
              </div>
            </AdminSection>

            {/* Workload & Complaint Reassignment */}
            <AdminSection
              icon={<FileText className="w-4 h-4 text-rose-400" />}
              title="Department Workload & Reassignment"
              subtitle="Monitor open complaint counts and manually transfer cases to load-balance teams."
            >
              {/* Workload grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {workloads.map((w) => (
                  <div key={w.Employee_ID} className="p-3 rounded-2xl border space-y-1.5 text-xs" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <span className="font-bold block truncate" style={{ color: 'var(--text-primary)' }}>{w.Employee_Name}</span>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>{w.Role_Name}</span>
                    <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Open</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${w.Open_Complaints > 5 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                        {w.Open_Complaints}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transfer form */}
              <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-secondary)' }}>Transfer Open Complaint</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select id="reassign_complaint" className="px-2 py-2 rounded-xl border text-xs" style={fieldStyle}
                    onChange={(e) => {
                      const selectedId = parseInt(e.target.value, 10);
                      const comp = openComplaints.find(c => c.Complaint_ID === selectedId);
                      const execSel = document.getElementById('reassign_target_exec');
                      execSel.value = '';
                      if (comp) {
                        const filtered = executives.filter(ex => ex.Department_ID === comp.Current_Department_ID);
                        execSel.innerHTML = '<option value="">-- Choose Target Executive --</option>' +
                          filtered.map(ex => `<option value="${ex.Employee_ID}">${ex.Employee_Name} (${ex.Role_Name})</option>`).join('');
                      } else {
                        execSel.innerHTML = '<option value="">-- Choose Target Executive --</option>';
                      }
                    }}>
                    <option value="">-- Choose Open Complaint --</option>
                    {openComplaints.map(c => (
                      <option key={c.Complaint_ID} value={c.Complaint_ID}>{c.Complaint_Number} · {c.Customer_Name}</option>
                    ))}
                  </select>
                  <select id="reassign_target_exec" className="px-2 py-2 rounded-xl border text-xs" style={fieldStyle}>
                    <option value="">-- Choose Target Executive --</option>
                  </select>
                </div>
                <button type="button" disabled={updatingConfig}
                  onClick={() => {
                    const cId = document.getElementById('reassign_complaint').value;
                    const eId = document.getElementById('reassign_target_exec').value;
                    if (!cId || !eId) { alert('Select both complaint and target executive.'); return; }
                    handleManualReassignComplaint(cId, eId);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: 'var(--accent)', boxShadow: '0 4px 12px var(--accent-soft)' }}>
                  Transfer Complaint
                </button>
              </div>
            </AdminSection>
          </>
        )}
      </div>
    </Layout>
  );
}

/* ── Reusable sub-components ── */

function ProfileField({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-start space-x-3 text-xs">
      <div className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div className="min-w-0">
        <span className="block font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className={`block break-words ${mono ? 'font-mono' : 'font-medium'}`} style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {value || '—'}
        </span>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, fieldStyle, placeholder, autoComplete }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={fieldStyle}
          className="w-full px-3 py-2.5 pr-10 rounded-xl text-xs outline-none transition-all"
          placeholder={placeholder}
          autoComplete={autoComplete || 'off'}
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function AdminSection({ icon, title, subtitle, children, headerExtra }) {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 40px var(--shadow-color)' }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
        <div className="flex items-center space-x-2">
          {icon}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest block" style={{ color: 'var(--text-secondary)' }}>{title}</span>
            {subtitle && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
          </div>
        </div>
        {headerExtra && <div>{headerExtra}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default Account;
