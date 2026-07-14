import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  AlertTriangle,
  Building,
  DollarSign,
  AlertOctagon,
  Loader2,
  Calendar,
  Send,
  ClipboardList,
  ShieldCheck,
  Ban,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { gsap } from 'gsap';

function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isEmployee = user.role !== 'Customer';

  const [data, setData] = useState(null);
  const [tsData, setTsData] = useState(null);
  const [qcData, setQcData] = useState(null);
  const [capaData, setCapaData] = useState(null);
  const [employees, setEmployees] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // TS Form States
  const [tsAction, setTsAction] = useState('forward'); // 'forward', 'clarify', 'visit-schedule', 'visit-complete'
  const [tsObservation, setTsObservation] = useState('');
  const [tsClarifyReq, setTsClarifyReq] = useState(false);
  const [tsSampleReq, setTsSampleReq] = useState(false);
  const [tsVisitReq, setTsVisitReq] = useState(false);
  const [tsRecAction, setTsRecAction] = useState('');
  const [tsCloseReq, setTsCloseReq] = useState(false);
  const [tsRemarks, setTsRemarks] = useState('');
  const [tsVisitDate, setTsVisitDate] = useState('');
  const [tsFindings, setTsFindings] = useState('');
  const [tsFeedback, setTsFeedback] = useState('');
  const [tsFollowUp, setTsFollowUp] = useState(false);

  // QC Form States
  const [qcAction, setQcAction] = useState('forward'); // 'forward', 'sample-request', 'sample-receive'
  const [qcVerified, setQcVerified] = useState(false);
  const [qcObservation, setQcObservation] = useState('');
  const [qcRecommendation, setQcRecommendation] = useState('');
  const [qcRemarks, setQcRemarks] = useState('');
  const [qcSampleReqDate, setQcSampleReqDate] = useState('');
  const [qcSampleDispDate, setQcSampleDispDate] = useState('');
  const [qcSampleRecDate, setQcSampleRecDate] = useState('');
  const [qcCourierDetails, setQcCourierDetails] = useState('');
  const [qcSampleCondition, setQcSampleCondition] = useState('');

  // CAPA Form States
  const [capaRootCause, setCapaRootCause] = useState('');
  const [capaCorrectiveAction, setCapaCorrectiveAction] = useState('');
  const [capaPreventiveAction, setCapaPreventiveAction] = useState('');
  const [capaRespEmployeeId, setCapaRespEmployeeId] = useState('');
  const [capaTargetDate, setCapaTargetDate] = useState('');
  const [capaRemarks, setCapaRemarks] = useState('');

  // Stage Approvals Form States
  const [approveRemarks, setApproveRemarks] = useState('');
  const [approveSettlementAmount, setApproveSettlementAmount] = useState('');

  // KAM Verification Form States
  const [kamSeverityId, setKamSeverityId] = useState('');
  const [kamRemarks, setKamRemarks] = useState('');
  const [priorities, setPriorities] = useState([]);

  // Finance Form States
  const [finCreditNoteNo, setFinCreditNoteNo] = useState('');
  const [finCreditNoteDate, setFinCreditNoteDate] = useState(new Date().toISOString().substring(0, 10));
  const [finCreditNoteAmount, setFinCreditNoteAmount] = useState('');
  const [finFiscalYear, setFinFiscalYear] = useState('2026');
  const [finCompanyCode, setFinCompanyCode] = useState('OPM');
  const [finRemarks, setFinRemarks] = useState('');

  // General Timeline Rejection Form States
  const [rejectAction, setRejectAction] = useState('reject'); // 'reject', 'review-request', 'clarify'
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Reopen Form State
  const [reopenRemarks, setReopenRemarks] = useState('');

  const detailRef = useRef(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      setActionSuccess(null);
      
      const [res, tsRes, qcRes, capaRes, empRes, lookupRes] = await Promise.all([
        api.get(`/complaints/${id}`),
        isEmployee ? api.get(`/complaints/${id}/ts-review`) : Promise.resolve({ data: { data: null } }),
        isEmployee ? api.get(`/complaints/${id}/qc-review`) : Promise.resolve({ data: { data: null } }),
        isEmployee ? api.get(`/complaints/${id}/capa`) : Promise.resolve({ data: { data: null } }),
        isEmployee ? api.get('/complaints/employees') : Promise.resolve({ data: { data: [] } }),
        isEmployee ? api.get('/complaints/lookups') : Promise.resolve({ data: { data: { priorities: [] } } })
      ]);
      
      setData(res.data.data);
      if (res.data.data?.complaint) {
        setKamSeverityId(res.data.data.complaint.Priority_ID || '');
        if (res.data.data.complaint.Complaint_Status_ID === 17) {
          setRejectAction('clarify');
        } else {
          setRejectAction('reject');
        }
      }
      setTsData(tsRes.data.data);
      setQcData(qcRes.data.data);
      setCapaData(capaRes.data.data);
      setEmployees(empRes.data.data || []);
      setPriorities(lookupRes.data.data?.priorities || []);

      // Pre-fill TS details if exists
      if (tsRes.data.data?.tsDetails) {
        const d = tsRes.data.data.tsDetails;
        setTsObservation(d.Technical_Observation || '');
        setTsClarifyReq(!!d.Clarification_Required);
        setTsSampleReq(!!d.Sample_Required);
        setTsVisitReq(!!d.Visit_Required);
        setTsRecAction(d.Recommended_Action || '');
        setTsCloseReq(!!d.Can_Close_Complaint);
        setTsRemarks(d.Remarks || '');
      }

      // Pre-fill QC details if exists
      if (qcRes.data.data?.qcDetails) {
        const d = qcRes.data.data.qcDetails;
        setQcVerified(!!d.Sample_Verified);
        setQcObservation(d.QC_Observation || '');
        setQcRecommendation(d.QC_Recommendation || '');
        setQcRemarks(d.Remarks || '');
      }

      // Pre-fill CAPA details if exists
      if (capaRes.data.data) {
        const cp = capaRes.data.data;
        setCapaRootCause(cp.Root_Cause_Analysis || '');
        setCapaCorrectiveAction(cp.Corrective_Action || '');
        setCapaPreventiveAction(cp.Preventive_Action || '');
        setCapaRespEmployeeId(cp.Responsible_Employee_ID || '');
        setCapaTargetDate(cp.Target_Completion_Date ? cp.Target_Completion_Date.substring(0, 10) : '');
        setCapaRemarks(cp.Remarks || '');
      }

      // Pre-fill settlement and finance amounts
      if (res.data.data?.complaint) {
        const c = res.data.data.complaint;
        setApproveSettlementAmount(c.Expected_Settlement_Amount !== null ? c.Expected_Settlement_Amount : c.Total_Complaint_Value);
      }

      if (res.data.data?.settlement) {
        setFinCreditNoteAmount(res.data.data.settlement.Approved_Amount);
      }

      const currentYear = new Date().getFullYear();
      const generatedCnNo = `SAP-CN-${currentYear}-${String(id).padStart(4, '0')}`;

      if (res.data.data?.creditNote) {
        const cn = res.data.data.creditNote;
        setFinCreditNoteNo(cn.Credit_Note_Number || generatedCnNo);
        setFinCreditNoteDate(cn.Credit_Note_Date ? cn.Credit_Note_Date.substring(0, 10) : new Date().toISOString().substring(0, 10));
        setFinCreditNoteAmount(cn.Credit_Note_Amount || '');
        setFinFiscalYear(cn.SAP_Fiscal_Year || String(currentYear));
        setFinCompanyCode(cn.SAP_Company_Code || 'OPM');
        setFinRemarks(cn.Remarks || '');
      } else if (res.data.data?.complaint?.Complaint_Status_ID === 83) {
        setFinCreditNoteNo(generatedCnNo);
        setFinCreditNoteDate(new Date().toISOString().substring(0, 10));
        setFinFiscalYear(String(currentYear));
        setFinCompanyCode('OPM');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve complaint details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [id]);

  useEffect(() => {
    if (!loading && data) {
      const ctx = gsap.context(() => {
        gsap.from('.reveal-back', {
          opacity: 0,
          x: -15,
          duration: 0.4,
          ease: 'power3.out'
        });
        gsap.from('.reveal-panel', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.1
        });
      }, detailRef);
      return () => ctx.revert();
    }
  }, [loading, data]);

  const handleTsSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        actionType: tsAction,
        observation: tsObservation,
        clarificationRequired: tsClarifyReq,
        sampleRequired: tsSampleReq,
        visitRequired: tsVisitReq,
        recommendedAction: tsRecAction,
        canCloseComplaint: tsCloseReq,
        remarks: tsRemarks,
        visitDate: tsVisitDate,
        findings: tsFindings,
        feedback: tsFeedback,
        followUpRequired: tsFollowUp
      };

      await api.post(`/complaints/${id}/ts-review`, payload);
      setActionSuccess('Technical Services review action recorded.');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit TS review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQcSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        actionType: qcAction,
        sampleVerified: qcVerified,
        observation: qcObservation,
        recommendation: qcRecommendation,
        remarks: qcRemarks,
        sampleRequestDate: qcSampleReqDate,
        sampleDispatchedDate: qcSampleDispDate,
        sampleReceivedDate: qcSampleRecDate,
        courierDetails: qcCourierDetails,
        sampleCondition: qcSampleCondition
      };

      await api.post(`/complaints/${id}/qc-review`, payload);
      setActionSuccess('Quality Control review action recorded.');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit QC review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCapaSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        rootCause: capaRootCause,
        correctiveAction: capaCorrectiveAction,
        preventiveAction: capaPreventiveAction,
        responsibleEmployeeId: capaRespEmployeeId,
        targetCompletionDate: capaTargetDate,
        remarks: capaRemarks
      };

      await api.post(`/complaints/${id}/capa`, payload);
      setActionSuccess('CAPA details saved successfully.');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save CAPA details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalSubmit = async (stageVal) => {
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        stage: stageVal,
        remarks: approveRemarks,
        settlementAmount: stageVal === 'marketing-head' ? parseFloat(approveSettlementAmount) : undefined
      };

      await api.post(`/complaints/${id}/approve`, payload);
      setActionSuccess(`Stage '${stageVal}' approved successfully.`);
      setApproveRemarks('');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKamSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        stage: 'kam',
        remarks: kamRemarks,
        severityId: kamSeverityId
      };

      await api.post(`/complaints/${id}/approve`, payload);
      setActionSuccess('KAM verification completed. Forwarded to TS Review.');
      setKamRemarks('');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to complete KAM verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        creditNoteNumber: finCreditNoteNo,
        creditNoteDate: finCreditNoteDate,
        creditNoteAmount: parseFloat(finCreditNoteAmount),
        fiscalYear: finFiscalYear,
        companyCode: finCompanyCode,
        remarks: finRemarks
      };

      await api.post(`/complaints/${id}/finance`, payload);
      setActionSuccess('SAP Credit note issued and complaint closed successfully.');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to record credit note details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimelineActionSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        action: rejectAction,
        remarks: rejectRemarks
      };

      await api.post(`/complaints/${id}/action`, payload);
      setActionSuccess(`Action '${rejectAction}' submitted successfully.`);
      setRejectRemarks('');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit timeline action.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);

    try {
      const payload = {
        action: 'reopen',
        remarks: reopenRemarks
      };

      await api.post(`/complaints/${id}/action`, payload);
      setActionSuccess('Complaint has been reopened successfully.');
      setReopenRemarks('');
      await loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reopen complaint.');
    } finally {
      setSubmitting(false);
    }
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

  if (error) {
    return (
      <Layout>
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-2xl flex items-start space-x-3 text-red-200">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      </Layout>
    );
  }

  const { complaint, lineItems, logs, settlement, creditNote } = data;
  const isClosed = complaint.Status === 'Closed';

  // Authorize panels mapping
  const isTsDepartment = [1, 7].includes(complaint.Current_Department_ID);
  const isQcDepartment = [2, 8].includes(complaint.Current_Department_ID);
  const isOpsDepartment = [3, 9].includes(complaint.Current_Department_ID);
  const isMarketingDept = [4, 10].includes(complaint.Current_Department_ID);
  const isFinanceDept = [5, 11].includes(complaint.Current_Department_ID);
  const isMdDept = [6, 12].includes(complaint.Current_Department_ID);

  const isKamDepartment = [6, 12].includes(complaint.Current_Department_ID);

  const canEditTs = isEmployee && isTsDepartment && ['Administrator', 'TS Head', 'TS Engineer'].includes(user.role);
  const canEditQc = isEmployee && isQcDepartment && ['Administrator', 'QC Head', 'QC Engineer'].includes(user.role);
  const canEditCapa = isEmployee && isOpsDepartment && ['Administrator', 'Operations Head', 'Operations Engineer'].includes(user.role);
  const canEditFinance = isEmployee && isFinanceDept && complaint.Complaint_Status_ID === 83 && ['Administrator', 'Finance Executive'].includes(user.role);
  
  // Specific approvals authority
  const canApproveKam = isEmployee && complaint.Complaint_Status_ID === 17 && ['Administrator', 'KAM'].includes(user.role);
  const canApproveQcHead = isEmployee && isQcDepartment && complaint.Complaint_Status_ID === 84 && ['Administrator', 'QC Head'].includes(user.role);
  const canApproveOpsHead = isEmployee && isOpsDepartment && complaint.Complaint_Status_ID === 23 && ['Administrator', 'Operations Head'].includes(user.role);
  const canApproveMarketingPm = isEmployee && isMarketingDept && complaint.Complaint_Status_ID === 24 && ['Administrator', 'Marketing Head', 'Marketing Executive'].includes(user.role);
  const canApproveMarketingHead = isEmployee && isMarketingDept && complaint.Complaint_Status_ID === 25 && ['Administrator', 'Marketing Head'].includes(user.role);
  const canApproveMd = isEmployee && isMdDept && complaint.Complaint_Status_ID === 26 && ['Administrator', 'Managing Director'].includes(user.role);
  const canApproveFinanceHead = isEmployee && isFinanceDept && complaint.Complaint_Status_ID === 27 && ['Administrator', 'Finance Head'].includes(user.role);

  // General back-and-forth action panel is visible to anyone who is authorized to do approvals/work on the stage
  const canTakeTimelineAction = canEditTs || canEditQc || canEditCapa || canApproveQcHead || canApproveOpsHead || canApproveMarketingPm || canApproveMarketingHead || canApproveMd || canApproveKam || canApproveFinanceHead;

  // Reopen condition check: must be closed, and caller is customer or KAM
  const canReopen = isClosed && (user.role === 'Customer' || user.role === 'KAM' || user.role === 'Administrator');

  const fieldStyle = {
    background: 'var(--bg-surface-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  return (
    <Layout>
      <div ref={detailRef} className="space-y-8">
        
        {/* Navigation & Status Header */}
        <div className="reveal-back flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 transition-colors text-sm font-bold cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex space-x-2">
            <span 
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono border"
              style={
                complaint.Severity === 'Critical' 
                  ? { background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }
                  : complaint.Severity === 'High'
                  ? { background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' }
                  : complaint.Severity === 'Medium'
                  ? { background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.25)', color: '#facc15' }
                  : { background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }
              }
            >
              {complaint.Severity} Severity
            </span>
            <span 
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold border"
              style={
                complaint.Status === 'Closed'
                  ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#34d399' }
                  : { background: 'var(--accent)', borderColor: 'var(--border-subtle)', color: '#fff' }
              }
            >
              {complaint.Status === 'Submitted' ? 'Submitted (Pending KAM Review)' : complaint.Status}
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {actionSuccess && (
          <div 
            className="p-4 border rounded-2xl flex items-center space-x-3 text-sm animate-fade-in"
            style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#34d399' }}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 2-column details section */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left panel: Info & Lines list */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Header info card */}
            <div 
              className="reveal-panel p-6 md:p-8 rounded-3xl space-y-4 relative overflow-hidden"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <div>
                <span className="text-xs font-bold font-mono uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{complaint.Complaint_Number}</span>
                <h1 className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-primary)' }}>{complaint.Complaint_Title}</h1>
              </div>
              
              <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Description</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{complaint.Complaint_Description}</p>
              </div>

              {data.attachments && data.attachments.length > 0 && (
                <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Claimant Attachments</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                    {data.attachments.map((att) => (
                      <a 
                        key={att.Attachment_ID}
                        href={`http://localhost:5000/${att.File_Path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative rounded-2xl overflow-hidden aspect-video border transition-all duration-300 hover:scale-102 hover:border-[var(--accent)]"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}
                      >
                        <img 
                          src={`http://localhost:5000/${att.File_Path}`}
                          alt={att.File_Name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-xs text-white font-bold px-3 text-center truncate">{att.File_Name}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Claimed items grid */}
            <div 
              className="reveal-panel p-6 rounded-3xl space-y-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Claimed Products & Line Items</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th className="pb-3 pl-2">Invoice / Pos</th>
                      <th className="pb-3">Product Name</th>
                      <th className="pb-3 text-right">Defective Qty</th>
                      <th className="pb-3 text-right">Claim Value</th>
                      <th className="pb-3 pl-4 pr-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--bg-surface-2)] transition-colors">
                        <td className="py-4 pl-2 font-mono">
                          <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{item.Invoice_No}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pos {item.Line_Item}</span>
                        </td>
                        <td className="py-4 font-bold">
                          <span style={{ color: 'var(--text-primary)' }}>{item.Product_Name}</span>
                          <span className="text-[10px] font-mono block" style={{ color: 'var(--text-muted)' }}>SKU: {item.Product_Code}</span>
                        </td>
                        <td className="py-4 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {parseFloat(item.Defective_Quantity).toFixed(3)} {item.Unit_Of_Measure}
                        </td>
                        <td className="py-4 text-right font-mono font-semibold text-emerald-500">
                          ₹{parseFloat(item.Complaint_Value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 pl-4 pr-2 text-xs italic max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {item.Customer_Remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4 border-t mt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="p-4 rounded-2xl flex items-center space-x-6 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Total Defective Value:</span>
                  <span className="text-xl font-black text-emerald-500 font-mono">
                    ₹{parseFloat(complaint.Total_Complaint_Value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Display static CAPA observations if logged in the past */}
            {capaData && (
              <div 
                className="reveal-panel p-6 rounded-3xl space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>CAPA Summary Analysis</h3>
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl space-y-1 border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <span className="block uppercase font-bold text-[9px]" style={{ color: 'var(--text-muted)' }}>Root Cause Analysis</span>
                    <p className="leading-relaxed font-semibold" style={{ color: 'var(--text-primary)' }}>{capaData.Root_Cause_Analysis || 'Pending'}</p>
                  </div>
                  <div className="p-4 rounded-2xl space-y-1 border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <span className="block uppercase font-bold text-[9px]" style={{ color: 'var(--text-muted)' }}>Corrective Action</span>
                    <p className="leading-relaxed font-semibold" style={{ color: 'var(--text-primary)' }}>{capaData.Corrective_Action || 'Pending'}</p>
                  </div>
                  <div className="p-4 rounded-2xl space-y-1 border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <span className="block uppercase font-bold text-[9px]" style={{ color: 'var(--text-muted)' }}>Preventive Action</span>
                    <p className="leading-relaxed font-semibold" style={{ color: 'var(--text-primary)' }}>{capaData.Preventive_Action || 'Pending'}</p>
                  </div>
                  <div className="p-4 rounded-2xl space-y-1 border" style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <span className="block uppercase font-bold text-[9px]" style={{ color: 'var(--text-muted)' }}>Owner / Target Date</span>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Owner: {capaData.Responsible_Employee || 'Not set'} <br />
                      Target: {capaData.Target_Completion_Date ? new Date(capaData.Target_Completion_Date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Display Settlement details if logged */}
            {settlement && (
              <div 
                className="reveal-panel p-6 rounded-3xl space-y-4 border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'rgba(16,185,129,0.25)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2 text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Settlement & Commercial Payout</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Proposed Settlement</span>
                    <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>₹{parseFloat(settlement.Proposed_Amount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Approved Settlement</span>
                    <span className="font-mono text-sm font-black text-emerald-500">₹{parseFloat(settlement.Approved_Amount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Approval Date</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{new Date(settlement.Approval_Date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Payout Status</span>
                    <span className="inline-block px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full font-bold text-[10px] mt-0.5">Approved</span>
                  </div>
                </div>
              </div>
            )}

            {/* Display SAP Credit Note details if sync is done */}
            {creditNote && (
              <div 
                className="reveal-panel p-6 rounded-3xl space-y-4 border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-soft)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2" style={{ color: 'var(--accent)' }}>
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">SAP S/4HANA Credit Note reference</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Credit Note Number</span>
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>{creditNote.Credit_Note_Number}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>CN Value</span>
                    <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>₹{parseFloat(creditNote.Credit_Note_Amount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Company Code</span>
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{creditNote.SAP_Company_Code} ({creditNote.SAP_Fiscal_Year})</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>SAP OData sync</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] mt-0.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-subtle)' }}>Posted</span>
                  </div>
                </div>
                
                <div className="text-[10px] border-t pt-3" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <span className="font-bold">Sync Log: </span>
                  <span className="italic">{creditNote.SAP_Response_Message}</span>
                </div>
              </div>
            )}

          </div>

          {/* Right panel: Meta claims details & Review sheets */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Claims Metadata Card */}
            <div 
              className="reveal-panel p-6 rounded-3xl space-y-5"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Claim Information</h3>
              
              <div className="space-y-4 text-sm font-semibold">
                <div className="flex items-center space-x-2.5">
                  <Building className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Customer</span>
                    <span style={{ color: 'var(--text-primary)' }}>{complaint.Customer_Name}</span>
                    <span className="text-[10px] font-mono block" style={{ color: 'var(--text-muted)' }}>ID: {complaint.Customer_ID}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <User className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Key Account Manager (KAM)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{complaint.KAM_Name || 'General Queue'}</span>
                    <span className="text-xs block font-normal" style={{ color: 'var(--text-secondary)' }}>Assignee: {complaint.Assignee || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Business Division</span>
                    <span style={{ color: 'var(--text-primary)' }}>{complaint.Business_Unit_Name}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>SLA Due Date</span>
                    <span className="font-mono" style={{ color: complaint.Is_Overdue === 1 ? '#f87171' : 'var(--text-secondary)' }}>
                      {new Date(complaint.SLA_Due_Date).toLocaleString('en-IN')}
                    </span>
                    
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {complaint.Is_Overdue === 1 && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                          <AlertOctagon className="w-2.5 h-2.5" />
                          <span>Overdue</span>
                        </span>
                      )}
                      {complaint.Is_At_Risk === 1 && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#facc15' }}>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>At Risk</span>
                        </span>
                      )}
                      {complaint.Is_Escalated === 1 && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                          <AlertOctagon className="w-2.5 h-2.5" />
                          <span>Escalated</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {complaint.Expected_Settlement_Amount !== null && (
                  <div className="flex items-center space-x-2.5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Approved Settlement Value</span>
                      <span className="font-bold text-emerald-500">₹{parseFloat(complaint.Expected_Settlement_Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Actions message box */}
            {actionError && (
              <div 
                className="p-4 border rounded-2xl flex items-start space-x-3 text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {/* KAM Action panel */}
            {canApproveKam && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-soft)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2" style={{ color: 'var(--accent)' }}>
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">KAM Intake Verification</h3>
                </div>

                <form onSubmit={handleKamSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Confirm Severity (Priority)</label>
                    <select
                      value={kamSeverityId}
                      onChange={(e) => setKamSeverityId(e.target.value)}
                      required
                      style={fieldStyle}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none font-semibold"
                    >
                      {priorities.map((p) => (
                        <option key={p.Lookup_ID} value={p.Lookup_ID} className="text-slate-850 dark:text-white">{p.Lookup_Value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Verification Remarks</label>
                    <textarea
                      rows="3"
                      required
                      value={kamRemarks}
                      onChange={(e) => setKamRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Enter verification notes and details to assign..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 20px var(--accent-soft)' }}
                  >
                    <span>Approve & Assign to TS</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* TS Action panel */}
            {canEditTs && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-soft)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2" style={{ color: 'var(--accent)' }}>
                  <ClipboardList className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Technical Services Review</h3>
                </div>

                <form onSubmit={handleTsSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Review Action</label>
                    <select
                      value={tsAction}
                      onChange={(e) => setTsAction(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    >
                      <option value="forward" className="text-slate-850 dark:text-white">Forward to QC</option>
                      <option value="clarify" className="text-slate-850 dark:text-white">Request Clarification</option>
                      <option value="visit-schedule" className="text-slate-850 dark:text-white">Schedule Customer Visit</option>
                      <option value="visit-complete" className="text-slate-850 dark:text-white">Complete Customer Visit</option>
                    </select>
                  </div>

                  {tsAction === 'visit-schedule' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Visit Date</label>
                      <input
                        type="datetime-local"
                        required
                        value={tsVisitDate}
                        onChange={(e) => setTsVisitDate(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                      />
                    </div>
                  )}

                  {tsAction === 'visit-complete' && (
                    <div className="space-y-3 pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Visit Findings</label>
                        <textarea
                          rows="2"
                          required
                          value={tsFindings}
                          onChange={(e) => setTsFindings(e.target.value)}
                          style={fieldStyle}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                          placeholder="Describe onsite observations..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Customer Feedback</label>
                        <textarea
                          rows="2"
                          required
                          value={tsFeedback}
                          onChange={(e) => setTsFeedback(e.target.value)}
                          style={fieldStyle}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                          placeholder="Feedback from customer..."
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="tsFollowUp"
                          checked={tsFollowUp}
                          onChange={(e) => setTsFollowUp(e.target.checked)}
                          className="w-4 h-4 rounded bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                        <label htmlFor="tsFollowUp" className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Follow-up Required</label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t animate-none" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Technical Observations</label>
                      <textarea
                        rows="2"
                        value={tsObservation}
                        onChange={(e) => setTsObservation(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Study of the claim..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Recommended Actions</label>
                      <input
                        type="text"
                        value={tsRecAction}
                        onChange={(e) => setTsRecAction(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Proposed claim settlement method..."
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-wrap gap-3 py-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="tsClarify"
                          checked={tsClarifyReq}
                          onChange={(e) => setTsClarifyReq(e.target.checked)}
                          className="w-4 h-4 rounded bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                        <label htmlFor="tsClarify" className="text-[10px] font-bold uppercase cursor-pointer" style={{ color: 'var(--text-muted)' }}>Clarify Req.</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="tsSample"
                          checked={tsSampleReq}
                          onChange={(e) => setTsSampleReq(e.target.checked)}
                          className="w-4 h-4 rounded bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                        <label htmlFor="tsSample" className="text-[10px] font-bold uppercase cursor-pointer" style={{ color: 'var(--text-muted)' }}>Sample Req.</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="tsVisit"
                          checked={tsVisitReq}
                          onChange={(e) => setTsVisitReq(e.target.checked)}
                          className="w-4 h-4 rounded bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                        <label htmlFor="tsVisit" className="text-[10px] font-bold uppercase cursor-pointer" style={{ color: 'var(--text-muted)' }}>Visit Req.</label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Remarks / Remarks Log</label>
                      <textarea
                        rows="2"
                        value={tsRemarks}
                        onChange={(e) => setTsRemarks(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Timeline narrative comment..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 20px var(--accent-soft)' }}
                  >
                    <span>Execute Transition</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* QC Action panel */}
            {canEditQc && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'rgba(99, 102, 241, 0.25)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2 text-indigo-500">
                  <ClipboardList className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Quality Control Review</h3>
                </div>

                <form onSubmit={handleQcSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Review Action</label>
                    <select
                      value={qcAction}
                      onChange={(e) => setQcAction(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    >
                      <option value="forward" className="text-slate-850 dark:text-white">Forward to Operations (CAPA)</option>
                      <option value="sample-request" className="text-slate-850 dark:text-white">Request Physical Sample</option>
                      <option value="sample-receive" className="text-slate-850 dark:text-white">Log Received Sample</option>
                    </select>
                  </div>

                  {qcAction === 'sample-request' && (
                    <div className="space-y-3 pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Sample Request Date</label>
                        <input
                          type="date"
                          value={qcSampleReqDate}
                          onChange={(e) => setQcSampleReqDate(e.target.value)}
                          style={fieldStyle}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Courier Details</label>
                        <input
                          type="text"
                          value={qcCourierDetails}
                          onChange={(e) => setQcCourierDetails(e.target.value)}
                          style={fieldStyle}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                          placeholder="Courier tracking reference..."
                        />
                      </div>
                    </div>
                  )}

                  {qcAction === 'sample-receive' && (
                    <div className="space-y-3 pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Dispatched Date</label>
                          <input
                            type="date"
                            value={qcSampleDispDate}
                            onChange={(e) => setQcSampleDispDate(e.target.value)}
                            style={fieldStyle}
                            className="w-full px-3 py-2 rounded-xl text-[10px] outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Received Date</label>
                          <input
                            type="date"
                            value={qcSampleRecDate}
                            onChange={(e) => setQcSampleRecDate(e.target.value)}
                            style={fieldStyle}
                            className="w-full px-3 py-2 rounded-xl text-[10px] outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Sample Condition</label>
                        <input
                          type="text"
                          value={qcSampleCondition}
                          onChange={(e) => setQcSampleCondition(e.target.value)}
                          style={fieldStyle}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                          placeholder="Condition of returned reams..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t animate-none" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>QC Lab Observations</label>
                      <textarea
                        rows="2"
                        value={qcObservation}
                        onChange={(e) => setQcObservation(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Testing checks results..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>QC Recommendations</label>
                      <input
                        type="text"
                        value={qcRecommendation}
                        onChange={(e) => setQcRecommendation(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Recommended claim action..."
                      />
                    </div>

                    <div className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id="qcVerified"
                        checked={qcVerified}
                        onChange={(e) => setQcVerified(e.target.checked)}
                        className="w-4 h-4 rounded bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                      />
                      <label htmlFor="qcVerified" className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Sample Verified</label>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Remarks / Remarks Log</label>
                      <textarea
                        rows="2"
                        value={qcRemarks}
                        onChange={(e) => setQcRemarks(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        placeholder="Timeline narrative comment..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 20px var(--accent-soft)' }}
                  >
                    <span>Execute Transition</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Operations CAPA Worksheet Panel */}
            {canEditCapa && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-soft)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2" style={{ color: 'var(--accent)' }}>
                  <ClipboardList className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">CAPA Analysis Details</h3>
                </div>

                <form onSubmit={handleCapaSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Root Cause Analysis</label>
                    <textarea
                      rows="3"
                      required
                      value={capaRootCause}
                      onChange={(e) => setCapaRootCause(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Identify specific machine or process failure..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Corrective Action</label>
                    <textarea
                      rows="2"
                      required
                      value={capaCorrectiveAction}
                      onChange={(e) => setCapaCorrectiveAction(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Action taken immediately to rectify..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Preventive Action</label>
                    <textarea
                      rows="2"
                      required
                      value={capaPreventiveAction}
                      onChange={(e) => setCapaPreventiveAction(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Long term safeguards..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Responsible Person</label>
                      <select
                        value={capaRespEmployeeId}
                        onChange={(e) => setCapaRespEmployeeId(e.target.value)}
                        required
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-[10px] outline-none"
                      >
                        <option value="" className="text-slate-850 dark:text-white">-- Choose Employee --</option>
                        {employees.map(emp => (
                          <option key={emp.Employee_ID} value={emp.Employee_ID} className="text-slate-850 dark:text-white">{emp.Employee_Name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Target Date</label>
                      <input
                        type="date"
                        required
                        value={capaTargetDate}
                        onChange={(e) => setCapaTargetDate(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2 rounded-xl text-[10px] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Remarks</label>
                    <textarea
                      rows="2"
                      value={capaRemarks}
                      onChange={(e) => setCapaRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Timeline logs narrative..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 20px var(--accent-soft)' }}
                  >
                    <span>Save CAPA Worksheet</span>
                  </button>
                </form>
              </div>
            )}

            {/* Stage Approvals Panel */}
            {(canApproveQcHead || canApproveOpsHead || canApproveMarketingPm || canApproveMarketingHead || canApproveMd || canApproveFinanceHead) && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'rgba(16,185,129,0.25)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2 text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    {canApproveQcHead && 'QC Head Verification'}
                    {canApproveOpsHead && 'Ops Head CAPA Approval'}
                    {canApproveMarketingPm && 'Marketing PM Review'}
                    {canApproveMarketingHead && 'Marketing Head Approval'}
                    {canApproveMd && 'MD Final Approval'}
                    {canApproveFinanceHead && 'Finance Head Settlement Approval'}
                  </h3>
                </div>

                <div className="space-y-4">
                  {canApproveMarketingHead && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Settlement Disposal Value (₹)</label>
                      <input
                        type="number"
                        required
                        value={approveSettlementAmount}
                        onChange={(e) => setApproveSettlementAmount(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-xs outline-none font-bold font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Approval Remarks</label>
                    <textarea
                      rows="3"
                      value={approveRemarks}
                      onChange={(e) => setApproveRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                      placeholder="Comment for the workflow timeline log..."
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (canApproveQcHead) handleApprovalSubmit('qc-head');
                      else if (canApproveOpsHead) handleApprovalSubmit('ops-head');
                      else if (canApproveMarketingPm) handleApprovalSubmit('marketing-pm');
                      else if (canApproveMarketingHead) handleApprovalSubmit('marketing-head');
                      else if (canApproveMd) handleApprovalSubmit('md');
                      else if (canApproveFinanceHead) handleApprovalSubmit('finance-head');
                    }}
                    disabled={submitting}
                    className="w-full py-3 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer animate-none"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 24px var(--accent-soft)' }}
                  >
                    <span>Approve Stage</span>
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Finance Credit Note Processing Panel */}
            {canEditFinance && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-soft)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2" style={{ color: 'var(--accent)' }}>
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Issue SAP Credit Note</h3>
                </div>

                <form onSubmit={handleFinanceSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Credit Note Number</label>
                    <input
                      type="text"
                      readOnly
                      required
                      value={finCreditNoteNo}
                      style={{ ...fieldStyle, opacity: 0.8, cursor: 'not-allowed' }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Credit Note Date</label>
                      <input
                        type="date"
                        required
                        value={finCreditNoteDate}
                        onChange={(e) => setFinCreditNoteDate(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-[10px] outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Settlement Amount (₹)</label>
                      <input
                        type="number"
                        required
                        value={finCreditNoteAmount}
                        onChange={(e) => setFinCreditNoteAmount(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-[10px] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Fiscal Year</label>
                      <input
                        type="text"
                        required
                        maxLength="4"
                        value={finFiscalYear}
                        onChange={(e) => setFinFiscalYear(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-[10px] outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Company Code</label>
                      <input
                        type="text"
                        required
                        value={finCompanyCode}
                        onChange={(e) => setFinCompanyCode(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-[10px] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Finance Remarks</label>
                    <textarea
                      rows="2"
                      value={finRemarks}
                      onChange={(e) => setFinRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="e.g. SAP sync complete"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-xs btn-sheen cursor-pointer animate-none"
                    style={{ background: 'var(--accent)', boxShadow: '0 8px 24px var(--accent-soft)' }}
                  >
                    <span>Post CN and Close Complaint</span>
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Backwards Transition Panel (Rejections / Re-examinations) */}
            {canTakeTimelineAction && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.15)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2 text-red-400">
                  <Ban className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Claims Return / Rejection</h3>
                </div>

                <form onSubmit={handleTimelineActionSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Action Type</label>
                    {complaint.Complaint_Status_ID === 17 ? (
                      <div 
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      >
                        Seek Clarifications (Offline request)
                      </div>
                    ) : (
                      <select
                        value={rejectAction}
                        onChange={(e) => setRejectAction(e.target.value)}
                        style={fieldStyle}
                        className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                      >
                        <option value="reject" className="text-slate-850 dark:text-white">Reject Claim (Closed)</option>
                        <option value="review-request" className="text-slate-850 dark:text-white">Request Re-examination (Flag without hard rejection)</option>
                        {!canEditTs && (
                          <option value="clarify" className="text-slate-850 dark:text-white">Seek Clarifications (Offline request)</option>
                        )}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Reason / Action Comments</label>
                    <textarea
                      rows="2"
                      required
                      value={rejectRemarks}
                      onChange={(e) => setRejectRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                      placeholder="Provide specific notes why claim is returned..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Submit Timeline Action</span>
                  </button>
                </form>
              </div>
            )}

            {/* Reopen Complaint Control (Only for closed claims within 7 days) */}
            {canReopen && (
              <div 
                className="reveal-panel p-6 rounded-3xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'rgba(234, 179, 8, 0.25)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <div className="flex items-center space-x-2 text-yellow-500">
                  <RotateCcw className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Reopen Closed Complaint</h3>
                </div>
                
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Orient Paper Mills CCMS guidelines permit reopening of a complaint within 7 days of closure if you believe the settlement was inadequate or requires revision.
                </p>

                <form onSubmit={handleReopenSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Reopen Explanation Remarks</label>
                    <textarea
                      rows="3"
                      required
                      value={reopenRemarks}
                      onChange={(e) => setReopenRemarks(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                      placeholder="State why the credit note settlement is insufficient or has issues..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 hover:text-yellow-500 border border-yellow-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Reopen CCMS Claim</span>
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

        {/* 3. Timeline log */}
        <div 
          className="reveal-panel p-6 md:p-8 rounded-3xl space-y-6 animate-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 10px 30px var(--shadow-color)'
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Workflow Timeline & Audit History</h3>
          
          <div className="relative border-l pl-6 ml-4 space-y-8" style={{ borderColor: 'var(--border-subtle)' }}>
            {logs.map((log, idx) => (
              <div key={idx} className="relative group">
                {/* Visual marker dot */}
                <div 
                  className="absolute -left-[35px] top-1 p-1 rounded-full border-2 transition-colors"
                  style={{
                    background: 'var(--bg-app)',
                    borderColor: 'var(--accent)'
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }}></div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{log.Action_Value || 'Workflow Stage Logged'}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.Action_Date).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-semibold">{log.Employee_Name}</span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span>{log.Role_Name}</span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span>Dept: {log.Curr_Dept || 'TS'}</span>
                  </div>

                  {log.Remarks && (
                    <div 
                      className="p-3.5 border rounded-xl text-xs italic leading-relaxed mt-2"
                      style={{
                        background: 'var(--bg-surface-2)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {log.Remarks}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}

export default ComplaintDetail;
