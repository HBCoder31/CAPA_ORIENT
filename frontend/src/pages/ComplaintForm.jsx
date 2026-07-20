import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import { 
  Search, 
  Trash2, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Ban
} from 'lucide-react';
import { gsap } from 'gsap';

function ComplaintForm() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isCustomer = user.role === 'Customer';

  // State values
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(isCustomer ? user.id : '');
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState([]);
  
  // Complaint header fields
  const [priorityId, setPriorityId] = useState('');
  const [reportedChannel, setReportedChannel] = useState(isCustomer ? 'Portal' : 'Sales');

  // Lookups
  const [lookups, setLookups] = useState({ categories: [], natures: [], priorities: [] });
  
  // Selected complaint line items
  const [selectedItems, setSelectedItems] = useState({}); // { lineItemKey: { ... } }

  const handleItemFileChange = (key, e) => {
    const files = Array.from(e.target.files);
    setError(null);
    const item = selectedItems[key];
    if (!item) return;
    
    if (item.images.length + files.length > 5) {
      setError(`Maximum 5 files allowed for upload per item (Item ${item.lineItem}).`);
      return;
    }

    files.forEach(file => {
      const isMimeImage = file.type && file.type.startsWith('image/');
      const ext = file.name.split('.').pop().toLowerCase();
      const isExtImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);

      if (!isMimeImage && !isExtImage) {
        setError(`Only image files (JPG, JPEG, PNG, etc.) are allowed. Selected file: "${file.name}"`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`Each file must be under 20MB. File "${file.name}" exceeds limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedItems(prev => {
          const currentItem = prev[key];
          if (!currentItem) return prev;
          return {
            ...prev,
            [key]: {
              ...currentItem,
              images: [
                ...currentItem.images,
                {
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                  content: reader.result
                }
              ]
            }
          };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeItemImage = (key, idx) => {
    setSelectedItems(prev => {
      const currentItem = prev[key];
      if (!currentItem) return prev;
      return {
        ...prev,
        [key]: {
          ...currentItem,
          images: currentItem.images.filter((_, i) => i !== idx)
        }
      };
    });
  };
  
  // General status
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [portalDisabled, setPortalDisabled] = useState(false);

  const formRef = useRef(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setInitialLoading(true);
        // Load lookups
        const lookupRes = await api.get('/complaints/lookups');
        setLookups(lookupRes.data.data);
        if (lookupRes.data.data.priorities.length > 0) {
          // Set default priority to medium (ID 32) or first option
          const medPrio = lookupRes.data.data.priorities.find(p => p.Lookup_Value === 'Medium');
          setPriorityId(medPrio ? medPrio.Lookup_ID : lookupRes.data.data.priorities[0].Lookup_ID);
        }

        // Load customers if employee
        if (!isCustomer) {
          const custRes = await api.get('/complaints/customers');
          setCustomers(custRes.data.data);
        } else {
          // Check if complaint submission is enabled for customers
          try {
            const configRes = await api.get('/auth/config/customer-portal');
            if (!configRes.data.data.enabled) {
              setPortalDisabled(true);
              return;
            }
          } catch (_e) {
            // If config endpoint fails (non-admin), proceed normally
          }
          // Load customer invoices directly
          const invRes = await api.get('/complaints/invoices');
          setInvoices(invRes.data.data);
        }
      } catch (err) {
        setError('Failed to load form lookup data.');
      } finally {
        setInitialLoading(false);
      }
    }
    loadInitialData();
  }, [isCustomer]);

  // Load invoices when customer changes (for employees)
  useEffect(() => {
    if (!isCustomer && selectedCustomerId) {
      async function loadCustomerInvoices() {
        try {
          setInvoices([]);
          setSelectedInvoiceNo('');
          setInvoiceLineItems([]);
          setSelectedItems({});
          const res = await api.get(`/complaints/invoices?customerId=${selectedCustomerId}`);
          setInvoices(res.data.data);
        } catch (err) {
          setError('Failed to load customer invoices.');
        }
      }
      loadCustomerInvoices();
    }
  }, [selectedCustomerId, isCustomer]);

  // Load invoice line items when invoice selection changes
  const handleInvoiceChange = async (e) => {
    const invoiceNo = e.target.value;
    setSelectedInvoiceNo(invoiceNo);
    setInvoiceLineItems([]);
    
    if (!invoiceNo) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/complaints/invoices/${invoiceNo}`);
      setInvoiceLineItems(res.data.data);
    } catch (err) {
      setError('Failed to load invoice items.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle item selection
  const handleItemToggle = (item) => {
    const key = `${selectedInvoiceNo}-${item.Line_Item}`;
    if (selectedItems[key]) {
      const updated = { ...selectedItems };
      delete updated[key];
      setSelectedItems(updated);
    } else {
      setSelectedItems({
        ...selectedItems,
        [key]: {
          invoiceNo: selectedInvoiceNo,
          lineItem: item.Line_Item,
          productName: item.Product_Name,
          productCode: item.Product_Code,
          invoiceQty: parseFloat(item.Invoice_Qty),
          price: parseFloat(item.Price),
          unitOfMeasure: item.Unit_Of_Measure,
          defectiveQty: '',
          categoryId: lookups.categories[0]?.Lookup_ID || '',
          defectNatureId: lookups.natures[0]?.Lookup_ID || '',
          customerRemarks: '',
          title: '',
          images: [],
          errors: {}
        }
      });
    }
  };

  // Update specific line item property
  const handleItemFieldChange = (key, field, value) => {
    const item = selectedItems[key];
    if (!item) return;

    const updatedItem = { ...item, [field]: value };

    // Inline validation
    const errors = { ...item.errors };
    if (field === 'defectiveQty') {
      const val = parseFloat(value);
      if (isNaN(val) || val <= 0) {
        errors.defectiveQty = 'Quantity must be greater than 0';
      } else if (val > item.invoiceQty) {
        errors.defectiveQty = `Cannot exceed invoice quantity (${item.invoiceQty})`;
      } else {
        delete errors.defectiveQty;
      }
    }

    updatedItem.errors = errors;

    setSelectedItems({
      ...selectedItems,
      [key]: updatedItem
    });
  };

  // Calculate total estimated complaint value
  const totalValue = Object.values(selectedItems).reduce((sum, item) => {
    const qty = parseFloat(item.defectiveQty) || 0;
    return sum + (qty * item.price);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    if (Object.keys(selectedItems).length === 0) {
      setError('Please select at least one invoice line item to report.');
      return;
    }

    // Validate line item fields
    let hasItemErrors = false;
    const validatedItems = { ...selectedItems };

    Object.keys(validatedItems).forEach((key) => {
      const item = validatedItems[key];
      const errors = {};
      const qty = parseFloat(item.defectiveQty);

      if (isNaN(qty) || qty <= 0) {
        errors.defectiveQty = 'Required';
        hasItemErrors = true;
      } else if (qty > item.invoiceQty) {
        errors.defectiveQty = `Exceeds max (${item.invoiceQty})`;
        hasItemErrors = true;
      }

      if (!item.title || !item.title.trim()) {
        errors.title = 'Title is required';
        hasItemErrors = true;
      }

      if (!item.customerRemarks || !item.customerRemarks.trim()) {
        errors.customerRemarks = 'Remarks/Description are required';
        hasItemErrors = true;
      }

      validatedItems[key].errors = errors;
    });

    if (hasItemErrors) {
      setSelectedItems(validatedItems);
      setError('Please correct validation errors on the selected items.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        customerId: selectedCustomerId,
        priorityId,
        reportedChannel: isCustomer ? 'Portal' : ((user.role === 'KAM' || user.isKam) ? 'KAM' : 'Sales'),
        lineItems: Object.values(selectedItems).map(item => ({
          invoiceNo: item.invoiceNo,
          lineItem: item.lineItem,
          defectiveQty: parseFloat(item.defectiveQty),
          categoryId: item.categoryId,
          defectNatureId: item.defectNatureId,
          title: item.title.trim(),
          description: item.customerRemarks.trim(),
          customerRemarks: item.customerRemarks.trim(),
          attachments: item.images || []
        }))
      };

      const res = await api.post('/complaints', payload);
      setSuccessData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit the complaint. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialLoading && !successData) {
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
          stagger: 0.1,
          ease: 'power3.out',
          delay: 0.1
        });
      }, formRef);
      return () => ctx.revert();
    }
  }, [initialLoading, successData]);

  if (initialLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
        </div>
      </Layout>
    );
  }

  if (portalDisabled) {
    return (
      <Layout>
        <div 
          className="max-w-2xl mx-auto p-8 md:p-12 rounded-3xl text-center space-y-6 my-10 animate-scale-up"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px var(--shadow-color)'
          }}
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-full border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
              <Ban className="w-16 h-16" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Complaint Submission Disabled</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Online complaint submission is currently turned off by the administrator. Please contact your assigned Key Account Manager (KAM) to lodge complaints on your behalf.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full max-w-xs py-4 rounded-2xl font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 btn-sheen cursor-pointer"
            style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
          >
            Go to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const fieldStyle = {
    background: 'var(--bg-surface-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  if (successData) {
    return (
      <Layout>
        <div 
          className="max-w-2xl mx-auto p-8 md:p-12 rounded-3xl text-center space-y-6 my-10 animate-scale-up"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px var(--shadow-color)'
          }}
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-full border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#34d399' }}>
              <CheckCircle2 className="w-16 h-16" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-gradient">Complaint Submitted!</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              The complaint has been successfully created and initial workflows have been triggered.
            </p>
          </div>

          <div 
            className="p-6 border rounded-2xl inline-block max-w-sm mx-auto space-y-2 text-left w-full"
            style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Complaint Number:</span>
              <span className="font-bold font-mono" style={{ color: 'var(--accent)' }}>{successData.complaintNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Initial Queue:</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{successData.initialQueue || 'Submitted (Pending KAM Review)'}</span>
            </div>
            {successData.assignedKamName && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Assigned KAM:</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{successData.assignedKamName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2 mt-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estimated Settlement:</span>
              <span className="font-bold text-emerald-500 font-mono">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full max-w-xs py-4 rounded-2xl font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 btn-sheen cursor-pointer"
            style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
          >
            Go to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div ref={formRef} className="space-y-8">
        <div className="reveal-header">
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Log Customer <span className="text-gradient">Complaint</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Initiate a formal product defect report from customer invoices.
          </p>
        </div>

        {error && (
          <div 
            className="p-4 border rounded-2xl flex items-start space-x-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-8">
          {/* Left panel: Info logs */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. Customer Selector (if admin/KAM) */}
            {!isCustomer && (
              <div 
                className="reveal-card p-6 rounded-3xl space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 10px 30px var(--shadow-color)'
                }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>1. Select Target Customer</h3>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
                    <Search className="w-5 h-5" />
                  </span>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    style={fieldStyle}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-all appearance-none"
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <option value="" className="text-slate-800 dark:text-white">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.Customer_ID} value={c.Customer_ID} className="text-slate-800 dark:text-white">
                        {c.Customer_Name} ({c.Customer_ID})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 2. Invoice and line items selector */}
            <div 
              className="reveal-card p-6 rounded-3xl space-y-6"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {isCustomer ? '1. Select Source Invoice' : '2. Select Source Invoice'}
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Invoice Number</label>
                  <select
                    value={selectedInvoiceNo}
                    onChange={handleInvoiceChange}
                    required={Object.keys(selectedItems).length === 0}
                    disabled={!selectedCustomerId}
                    style={fieldStyle}
                    className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all"
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <option value="" className="text-slate-800 dark:text-white">-- Choose Invoice --</option>
                    {invoices.map((inv) => (
                      <option key={inv.Invoice_No} value={inv.Invoice_No} className="text-slate-800 dark:text-white">
                        {inv.Invoice_No} ({inv.Invoice_Date} - {inv.Division})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Channel Reported</label>
                  <select
                    value={reportedChannel}
                    onChange={(e) => setReportedChannel(e.target.value)}
                    disabled={isCustomer}
                    style={fieldStyle}
                    className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all"
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <option value="Portal" className="text-slate-800 dark:text-white">Customer Portal</option>
                    <option value="KAM" className="text-slate-800 dark:text-white">Key Account Manager (KAM)</option>
                    <option value="Sales" className="text-slate-800 dark:text-white">Sales Office</option>
                    <option value="Phone" className="text-slate-800 dark:text-white">Telephone</option>
                    <option value="Email" className="text-slate-800 dark:text-white">Email Request</option>
                  </select>
                </div>
              </div>

              {/* Line Items Selection Panel */}
              {selectedInvoiceNo && (
                <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Invoice Line Items</h4>
                  
                  {loading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                    </div>
                  ) : invoiceLineItems.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No items found for this invoice.</p>
                  ) : (
                    <div className="divide-y space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
                      {invoiceLineItems.map((item) => {
                        const key = `${selectedInvoiceNo}-${item.Line_Item}`;
                        const isChecked = !!selectedItems[key];
                        return (
                          <div key={item.Line_Item} className="pt-3 flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleItemToggle(item)}
                              id={`item-${item.Line_Item}`}
                              className="mt-1 w-5 h-5 rounded focus:ring-[var(--accent)] border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--accent)] cursor-pointer"
                            />
                            <label htmlFor={`item-${item.Line_Item}`} className="flex-1 cursor-pointer select-none">
                              <div className="flex flex-col md:flex-row md:justify-between">
                                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.Product_Name}</span>
                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Item Code: {item.Product_Code}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                <span>Pos: {item.Line_Item}</span>
                                <span>Qty: {item.Invoice_Qty} {item.Unit_Of_Measure}</span>
                                <span className="text-right">Price: ₹{parseFloat(item.Price).toFixed(2)}</span>
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Detailed configurations for selected line items */}
            {Object.keys(selectedItems).length > 0 && (
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Line Item Defect Information</h3>
                
                {Object.keys(selectedItems).map((key) => {
                  const item = selectedItems[key];
                  return (
                    <div 
                      key={key} 
                      className="p-6 rounded-3xl space-y-4 relative border transition-shadow duration-300"
                      style={{
                        background: 'var(--bg-surface)',
                        borderColor: 'var(--accent-soft)',
                        boxShadow: '0 10px 30px var(--shadow-color)'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--accent)' }}>Line {item.lineItem} Details</span>
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.productName}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...selectedItems };
                            delete updated[key];
                            setSelectedItems(updated);
                          }}
                          className="p-2 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Complaint Title</label>
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => handleItemFieldChange(key, 'title', e.target.value)}
                          style={fieldStyle}
                          className={`w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all ${
                            item.errors.title ? 'border-red-500!' : ''
                          }`}
                          placeholder="e.g. Low GSM, Moisture wrinkles..."
                          onFocus={(e) => { e.target.style.borderColor = item.errors.title ? '#ef4444' : 'var(--accent)'; }}
                          onBlur={(e) => { e.target.style.borderColor = item.errors.title ? '#ef4444' : 'var(--border-subtle)'; }}
                        />
                        {item.errors.title && (
                          <span className="text-xs text-red-400 font-semibold">{item.errors.title}</span>
                        )}
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Defective Qty</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              required
                              value={item.defectiveQty}
                              onChange={(e) => handleItemFieldChange(key, 'defectiveQty', e.target.value)}
                              style={fieldStyle}
                              className={`w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all ${
                                item.errors.defectiveQty ? 'border-red-500!' : ''
                              }`}
                              placeholder={`Max ${item.invoiceQty}`}
                              onFocus={(e) => { e.target.style.borderColor = item.errors.defectiveQty ? '#ef4444' : 'var(--accent)'; }}
                              onBlur={(e) => { e.target.style.borderColor = item.errors.defectiveQty ? '#ef4444' : 'var(--border-subtle)'; }}
                            />
                            <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                              {item.unitOfMeasure}
                            </span>
                          </div>
                          {item.errors.defectiveQty && (
                            <span className="text-xs text-red-400 font-semibold">{item.errors.defectiveQty}</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Complaint Category</label>
                          <select
                            value={item.categoryId}
                            onChange={(e) => handleItemFieldChange(key, 'categoryId', e.target.value)}
                            style={fieldStyle}
                            className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                          >
                            {lookups.categories.map((c) => (
                              <option key={c.Lookup_ID} value={c.Lookup_ID} className="text-slate-800 dark:text-white">{c.Lookup_Value}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nature of Defect</label>
                          <select
                            value={item.defectNatureId}
                            onChange={(e) => handleItemFieldChange(key, 'defectNatureId', e.target.value)}
                            style={fieldStyle}
                            className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                          >
                            {lookups.natures.map((n) => (
                              <option key={n.Lookup_ID} value={n.Lookup_ID} className="text-slate-800 dark:text-white">{n.Lookup_Value}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Defect Narrative / Remarks (Description)</label>
                        <textarea
                          rows="3"
                          required
                          value={item.customerRemarks}
                          onChange={(e) => handleItemFieldChange(key, 'customerRemarks', e.target.value)}
                          style={fieldStyle}
                          className={`w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all ${
                            item.errors.customerRemarks ? 'border-red-500!' : ''
                          }`}
                          placeholder="Describe specific defect observation in detail..."
                          onFocus={(e) => { e.target.style.borderColor = item.errors.customerRemarks ? '#ef4444' : 'var(--accent)'; }}
                          onBlur={(e) => { e.target.style.borderColor = item.errors.customerRemarks ? '#ef4444' : 'var(--border-subtle)'; }}
                        />
                        {item.errors.customerRemarks && (
                          <span className="text-xs text-red-400 font-semibold">{item.errors.customerRemarks}</span>
                        )}
                      </div>

                      {/* Item Image Attachments */}
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Attach Defect Photos</label>
                        <div className="space-y-3">
                          <input 
                            type="file"
                            multiple
                            accept="image/*,image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp,.JPG,.JPEG,.PNG,.GIF,.WEBP"
                            onChange={(e) => handleItemFileChange(key, e)}
                            id={`photos-${key}`}
                            className="hidden"
                          />
                          <label 
                            htmlFor={`photos-${key}`}
                            className="w-full py-4 border border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[var(--bg-surface-2)]"
                            style={{ borderColor: 'var(--border-subtle)' }}
                          >
                            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>Upload Defect Images for this Item</span>
                            <span className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>JPEG, PNG (Max 5 files, 20MB total)</span>
                          </label>

                          {item.images && item.images.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 pt-1">
                              {item.images.map((img, idx) => (
                                <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border" style={{ borderColor: 'var(--border-subtle)' }}>
                                  <img src={img.content} alt={img.fileName} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removeItemImage(key, idx)}
                                    className="absolute top-0.5 right-0.5 p-1 bg-red-600 rounded-full text-white opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                                  >
                                    <span className="text-[8px] font-black leading-none block">✕</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estimated Value for this line item */}
                      <div className="flex justify-between items-center p-4 rounded-2xl border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.12)' }}>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Item Est. Settlement Value</span>
                          <span className="text-[9px] block leading-none" style={{ color: 'var(--text-muted)' }}>
                            Calculated as: {parseFloat(item.defectiveQty) || 0} {item.unitOfMeasure} × ₹{parseFloat(item.price).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-1 text-emerald-500">
                          <span className="text-xs font-semibold">₹</span>
                          <span className="text-base font-black font-mono">
                            {((parseFloat(item.defectiveQty) || 0) * item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Meta controls and submission summary */}
          <div className="lg:col-span-4 space-y-6">
            <div 
              className="reveal-card p-6 rounded-3xl space-y-6 sticky top-6"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 30px var(--shadow-color)'
              }}
            >
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Complaint Submission</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Severity Level</label>
                  {isCustomer ? (
                    <div 
                      className="w-full px-4 py-3.5 rounded-2xl text-sm font-semibold border"
                      style={{ background: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      To be verified by assigned KAM
                    </div>
                  ) : (
                    <select
                      value={priorityId}
                      onChange={(e) => setPriorityId(e.target.value)}
                      style={fieldStyle}
                      className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none transition-all font-semibold"
                      onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                    >
                      {lookups.priorities.map((p) => (
                        <option key={p.Lookup_ID} value={p.Lookup_ID} className="text-slate-800 dark:text-white">
                          {p.Lookup_Value === 'Critical' ? 'Critical (1 Day)' : p.Lookup_Value === 'High' ? 'High (3 Days)' : p.Lookup_Value === 'Medium' ? 'Medium (7 Days)' : p.Lookup_Value === 'Low' ? 'Low (14 Days)' : p.Lookup_Value}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Estimate Settlement Card */}
              {Object.keys(selectedItems).length > 0 && (
                <div className="p-4 rounded-2xl space-y-2 border" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' }}>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block">Est. Settlement Value</span>
                  <div className="flex items-baseline space-x-1 text-emerald-500">
                    <span className="text-sm font-semibold">₹</span>
                    <span className="text-2xl font-black font-mono">
                      {totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-[10px] block leading-tight" style={{ color: 'var(--text-muted)' }}>
                    * Calculated as defective quantity multiplied by invoice unit price.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 btn-sheen cursor-pointer animate-none"
                style={{ background: 'var(--accent)', boxShadow: '0 12px 30px var(--accent-soft)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>Submit Complaint</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default ComplaintForm;
