import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import { 
  FileText, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Award,
  ChevronRight,
  Loader2,
  Users,
  AlertOctagon
} from 'lucide-react';
import { gsap } from 'gsap';

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dashboardRef = useRef(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [statsRes, listRes] = await Promise.all([
          api.get('/complaints/dashboard/stats'),
          api.get('/complaints')
        ]);
        setStats(statsRes.data.data);
        setComplaints(listRes.data.data);
      } catch (err) {
        setError('Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);



  useEffect(() => {
    if (!loading && stats) {
      const ctx = gsap.context(() => {
        gsap.from('.reveal-header', {
          opacity: 0,
          y: -15,
          duration: 0.5,
          ease: 'power3.out'
        });
        gsap.from('.reveal-card', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.1
        });
        gsap.from('.reveal-chart', {
          opacity: 0,
          y: 15,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.2
        });
        gsap.from('.reveal-table', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: 'power3.out',
          delay: 0.3
        });
      }, dashboardRef);
      return () => ctx.revert();
    }
  }, [loading, stats]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-2xl flex items-start space-x-3 text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div ref={dashboardRef} className="space-y-8">
        {/* Page header */}
        <div className="reveal-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Orient Paper <span className="text-gradient">CCMS</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time complaint tracking & resolution pipeline.
            </p>
          </div>
          {['Customer', 'KAM', 'Administrator', 'Marketing Executive', 'Marketing Head', 'TS Head', 'TS Engineer'].includes(user.role) && (
            <button
              onClick={() => navigate('/complaints/new')}
              className="py-3 px-6 rounded-2xl font-bold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-white btn-sheen cursor-pointer"
              style={{ background: 'var(--accent)', boxShadow: '0 8px 24px var(--accent-soft)' }}
            >
              Log New Complaint
            </button>
          )}
        </div>



        {/* 1. Metric widgets */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Total Complaints */}
            <div 
              className="reveal-card p-6 rounded-3xl flex items-center space-x-4 transition-transform duration-300 hover:-translate-y-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div 
                className="p-3.5 rounded-2xl border" 
                style={{ background: 'var(--accent-soft)', borderColor: 'var(--border-subtle)', color: 'var(--accent)' }}
              >
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Total Claims</span>
                <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.totalComplaints}</span>
              </div>
            </div>

            {/* Card 2: SLA Compliance Pct */}
            <div 
              className="reveal-card p-6 rounded-3xl flex items-center space-x-4 transition-transform duration-300 hover:-translate-y-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>SLA Compliance</span>
                <span className="text-2xl font-black text-emerald-500">{stats.slaCompliancePct}%</span>
              </div>
            </div>

            {/* Card 3: Avg Resolution Days */}
            <div 
              className="reveal-card p-6 rounded-3xl flex items-center space-x-4 transition-transform duration-300 hover:-translate-y-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-500">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Avg Resolution</span>
                <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {stats.avgResolutionTimeDays !== 'N/A' 
                    ? `${stats.avgResolutionTimeDays} Days`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Card 4: Open Claims Count */}
            <div 
              className="reveal-card p-6 rounded-3xl flex items-center space-x-4 transition-transform duration-300 hover:-translate-y-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Open Pipeline</span>
                <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {stats.statusBreakdown.reduce((sum, s) => s.status !== 'Closed' ? sum + s.count : sum, 0)}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* 2. Charts and Offender list */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Complaints by Category Chart */}
          <div 
            className="reveal-chart lg:col-span-4 p-6 rounded-3xl space-y-4"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 30px var(--shadow-color)'
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Claims by Category</h3>
            {stats?.categoryBreakdown.length === 0 ? (
              <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>No categories logged yet.</p>
            ) : (
              <div className="space-y-3.5 py-2">
                {stats?.categoryBreakdown.map((c) => {
                  const pct = Math.max(5, Math.round((c.count / stats.totalComplaints) * 100));
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span style={{ color: 'var(--text-primary)' }}>{c.category}</span>
                        <span style={{ color: 'var(--accent)' }}>{c.count} ({pct}%)</span>
                      </div>
                      <div className="w-full rounded-full h-2 overflow-hidden border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ background: 'var(--accent)', width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Complaints by Business Unit (Plant) */}
          <div 
            className="reveal-chart lg:col-span-4 p-6 rounded-3xl space-y-4"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 30px var(--shadow-color)'
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Claims by Business Unit</h3>
            {stats?.plantBreakdown.length === 0 ? (
              <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>No BU data logged yet.</p>
            ) : (
              <div className="space-y-3.5 py-2">
                {stats?.plantBreakdown.map((p) => {
                  const pct = Math.max(5, Math.round((p.count / stats.totalComplaints) * 100));
                  const isPaper = p.plant.toLowerCase().includes('paper');
                  return (
                    <div key={p.plant} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span style={{ color: 'var(--text-primary)' }}>{p.plant}</span>
                        <span style={{ color: 'var(--accent)' }}>{p.count} ({pct}%)</span>
                      </div>
                      <div className="w-full rounded-full h-2 overflow-hidden border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ background: isPaper ? 'var(--accent)' : '#8b5cf6', width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Repeat Complaints list (Only Admin/KAM) */}
          {user.role !== 'Customer' && (
            <div 
              className="reveal-chart lg:col-span-4 p-6 rounded-3xl space-y-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans" style={{ color: 'var(--text-secondary)' }}>Repeat Claimants</h3>
              </div>
              
              {stats?.repeatCustomers.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>No customers with 3+ claims in 90 days.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {stats?.repeatCustomers.map((c) => (
                    <div key={c.Customer_ID} className="pt-2 flex justify-between items-center text-xs border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div>
                        <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{c.Customer_Name}</span>
                        <span className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>ID: {c.Customer_ID}</span>
                      </div>
                      <span 
                        className="px-2.5 py-1 border rounded-xl font-bold font-mono text-[10px]"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderColor: 'rgba(239, 68, 68, 0.25)',
                          color: '#f87171'
                        }}
                      >
                        {c.count} Claims
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* 3. Complaints Table Listing */}
        <div 
          className="reveal-table p-6 rounded-3xl space-y-4"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 10px 30px var(--shadow-color)'
          }}
        >
          <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Complaints Pipeline</h3>
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{complaints.length} claims total</span>
          </div>

          {complaints.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="font-medium" style={{ color: 'var(--text-muted)' }}>No complaints logged in this queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th className="pb-3 pl-2">Claim ID / Date</th>
                    <th className="pb-3">Complaint Title</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Severity</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">SLA Due</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                  {complaints.map((c) => {
                    const isOverdue = c.Is_Overdue === 1;
                    const isAtRisk = c.Is_At_Risk === 1;
                    const isEscalated = c.Is_Escalated === 1;
                    
                    return (
                      <tr key={c.Complaint_ID} className="group hover:bg-[var(--bg-surface-2)] transition-colors duration-200">
                        {/* Claim ID / Date */}
                        <td className="py-4 pl-2 font-mono">
                          <span className="font-bold block" style={{ color: 'var(--accent)' }}>{c.Complaint_Number}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(c.Complaint_Date).toLocaleDateString()}</span>
                        </td>
                        
                        {/* Title & Escalated Flag */}
                        <td className="py-4 max-w-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold truncate block group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>{c.Complaint_Title}</span>
                            {isEscalated && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                                <AlertOctagon className="w-2.5 h-2.5" />
                                <span>Escalated</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>Assignee: {c.Assignee || 'Unassigned'}</span>
                        </td>

                        {/* Customer */}
                        <td className="py-4">
                          <span className="font-semibold block" style={{ color: 'var(--text-secondary)' }}>{c.Customer_Name}</span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{c.Customer_ID}</span>
                        </td>

                        {/* Severity Badge */}
                        <td className="py-4">
                          <span 
                            className="px-2.5 py-1 rounded-xl text-xs font-bold font-mono border"
                            style={
                              c.Severity === 'Critical' 
                                ? { background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }
                                : c.Severity === 'High'
                                ? { background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' }
                                : c.Severity === 'Medium'
                                ? { background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.25)', color: '#facc15' }
                                : { background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }
                            }
                          >
                            {c.Severity}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4">
                          <div className="flex flex-col space-y-1">
                            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                              {c.Status === 'Submitted' ? 'Submitted (Pending KAM Review)' : c.Status}
                            </span>
                            {isAtRisk && (
                              <span className="inline-flex items-center space-x-1 w-max px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#facc15' }}>
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>At Risk</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SLA Due */}
                        <td className="py-4">
                          <span className="font-mono text-xs font-semibold" style={{ color: isOverdue ? '#f87171' : 'var(--text-secondary)' }}>
                            {new Date(c.SLA_Due_Date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 pr-2 text-right">
                          <Link
                            to={`/complaints/${c.Complaint_ID}`}
                            className="inline-flex items-center space-x-1 p-2 rounded-xl transition-all font-semibold text-xs border hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                            style={{
                              background: 'var(--bg-surface-2)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
