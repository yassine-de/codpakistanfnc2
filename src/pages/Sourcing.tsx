import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Download, Pencil, Trash2, ExternalLink, TrendingUp, TrendingDown, Paperclip, X, FileText, Image, File } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { format } from 'date-fns';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const PAYMENTS = ['Unpaid', 'Paid'];
const SHIPPING_METHODS = ['Not Selected', 'Air', 'Sea', 'Express', 'Land'];

const paymentColors: Record<string, string> = {
  'Unpaid': 'bg-red-100 text-red-800 border-red-200',
  'Paid':   'bg-green-100 text-green-800 border-green-200',
};

const fmt2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const emptyForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  seller_id: 'none',
  product_name: '',
  quantity: '1',
  shipping_method: 'Not Selected',
  product_url: '',
  notes: '',
  // Landed (our costs per unit)
  product_cost: '',
  shipping_cost: '',
  other_costs: '',
  // Seller costs per unit
  seller_product_cost: '',
  seller_shipping_cost: '',
  seller_other_costs: '',
  // Payment
  account_id: 'none',
  payment_date: '',
  paid_usd: '',
  paid_mad: '',
  paid_usdt: '',
  paid_invoice: '',
};

const Sourcing = () => {
  const { user, canEdit } = useAuth();
  const { logAction } = useAuditLog();
  const { toUSD, rates } = useSettings();
  const [entries, setEntries]   = useState<any[]>([]);
  const [sellers, setSellers]   = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen]         = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch]     = useState('');
  const [filterSeller, setFilterSeller]   = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [attachments, setAttachments]       = useState<any[]>([]);   // saved in DB
  const [pendingFiles, setPendingFiles]     = useState<File[]>([]);  // queued before save
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const fetchAttachments = async (sourcingId: string) => {
    const { data } = await supabase
      .from('sourcing_attachments')
      .select('*')
      .eq('sourcing_id', sourcingId)
      .order('created_at');
    setAttachments(data || []);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadPendingFiles = async (sourcingId: string) => {
    if (!user || pendingFiles.length === 0) return;
    setUploadingFiles(true);
    for (const file of pendingFiles) {
      const ext  = file.name.split('.').pop();
      const path = `${sourcingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('sourcing-attachments')
        .upload(path, file);
      if (upErr) { toast.error(`Upload failed: ${file.name}`); continue; }
      await supabase.from('sourcing_attachments').insert({
        sourcing_id: sourcingId,
        file_name:   file.name,
        file_path:   path,
        file_size:   file.size,
        file_type:   file.type,
        created_by:  user.id,
      });
    }
    setPendingFiles([]);
    setUploadingFiles(false);
  };

  const deleteAttachment = async (att: any) => {
    await supabase.storage.from('sourcing-attachments').remove([att.file_path]);
    await supabase.from('sourcing_attachments').delete().eq('id', att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    toast.success('Attachment deleted');
  };

  const getAttachmentUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('sourcing-attachments')
      .createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const fileIcon = (type: string) => {
    if (type?.startsWith('image/'))       return <Image className="h-4 w-4 text-blue-500" />;
    if (type === 'application/pdf')       return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const fmtSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  };

  const fetchData = async () => {
    let q = supabase
      .from('sourcing_requests')
      .select('*, sellers(name), accounts(name, currency), profiles:created_by(full_name), sourcing_attachments(id), revenue_entries!revenue_entries_sourcing_id_fkey(id), expense_entries!expense_entries_sourcing_id_fkey(id)')
      .order('created_at', { ascending: false });
    if (filterSeller  !== 'all') q = q.eq('seller_id', filterSeller);
    if (filterPayment !== 'all') q = q.eq('payment', filterPayment);
    const { data } = await q;
    const enriched = (data || []).map(r => ({
      ...r,
      _attachmentCount: r.sourcing_attachments?.length || 0,
      _hasEntries: (r.revenue_entries?.length || 0) > 0 || (r.expense_entries?.length || 0) > 0,
    }));
    setEntries(enriched);
  };

  const fetchSellers  = async () => {
    const { data } = await supabase.from('sellers').select('*').eq('status', 'active').order('name');
    setSellers(data || []);
  };
  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('status', 'active');
    setAccounts(data || []);
  };

  useEffect(() => { fetchData(); fetchSellers(); fetchAccounts(); }, [filterSeller, filterPayment]);

  const resetForm = () => { setForm({ ...emptyForm }); setEditItem(null); setAttachments([]); setPendingFiles([]); };

  // live calcs
  const qty = Number(form.quantity || 1);

  const landedUnit   = Number(form.product_cost || 0) + Number(form.shipping_cost || 0) + Number(form.other_costs || 0);
  const sellerUnit   = Number(form.seller_product_cost || 0) + Number(form.seller_shipping_cost || 0) + Number(form.seller_other_costs || 0);
  const ourCost      = qty * landedUnit;
  const sellerCost   = qty * sellerUnit;
  const profitUnit   = sellerUnit - landedUnit;
  const profitTotal  = qty * profitUnit;
  const profitPct    = landedUnit > 0 ? (profitUnit / landedUnit) * 100 : 0;

  // Payment totals (all converted to USD)
  const paidUSD     = Number(form.paid_usd     || 0);
  const paidMAD     = toUSD(Number(form.paid_mad  || 0), 'MAD');
  const paidUSDT    = Number(form.paid_usdt    || 0);  // 1:1 USD
  const paidInvoice = Number(form.paid_invoice || 0);
  const totalPaidUSD = paidUSD + paidMAD + paidUSDT + paidInvoice;
  const remaining    = ourCost - totalPaidUSD;
  const paymentStatus = totalPaidUSD <= 0 ? 'Unpaid' : remaining <= 0.01 ? 'Paid' : 'Partial';

  // Find best matching account by currency, fallback to given accountId
  const accountByCurrency = (currency: string, fallback: string | null) => {
    const match = accounts.find(a => a.currency === currency);
    return match?.id || fallback;
  };

  const shortRef = (id: string) => `SRC-${id.slice(0, 8).toUpperCase()}`;

  const generateDebt = async (sourcingId: string, p: any, sellerName: string | null) => {
    // Always delete existing linked debt first
    await supabase.from('seller_debts').delete().eq('sourcing_id', sourcingId);

    // Only create entry if Unpaid or Partial — Paid means the seller already settled
    if (p.payment === 'Paid') return;

    const q           = Number(p.quantity || 1);
    const sellerU     = Number(p.seller_product_cost || 0) + Number(p.seller_shipping_cost || 0) + Number(p.seller_other_costs || 0);
    const sellerTotal = q * sellerU;

    if (sellerTotal <= 0) return; // no seller cost to track

    // Calculate what seller already paid → only track the remaining difference
    const alreadyPaid = Number(p.paid_usd || 0)
      + toUSD(Number(p.paid_mad || 0), 'MAD')
      + Number(p.paid_usdt || 0)
      + Number(p.paid_invoice || 0);
    const remainingDebt = Math.max(0, sellerTotal - alreadyPaid);

    if (remainingDebt <= 0.01) return; // fully covered, no debt to record

    await supabase.from('seller_debts').insert({
      seller_name:  sellerName || 'Unknown',
      amount:       Math.round(remainingDebt * 100) / 100,
      description:  `${shortRef(sourcingId)}: ${p.product_name}`,
      date:         p.date,
      status:       'unpaid',
      paid_date:    null,
      sourcing_id:  sourcingId,
    });
  };

  const generateEntries = async (sourcingId: string, p: any) => {
    if (!user) return;

    await supabase.from('expense_entries').delete().eq('sourcing_id', sourcingId);
    await supabase.from('revenue_entries').delete().eq('sourcing_id', sourcingId);

    const ref         = shortRef(sourcingId);
    const refNote     = `Sourcing: ${p.product_name}`;
    const q           = Number(p.quantity || 1);
    const sellerId    = p.seller_id || null;
    const date        = p.date;
    const mainAccountId = p.account_id || null;
    // Expenses are always in USD (we pay China in USD) → use a USD account
    const usdAccountId = accountByCurrency('USD', mainAccountId);

    // --- EXPENSES: always on USD account ---
    const expensesToCreate = [
      { amount: q * Number(p.product_cost  || 0), category: 'Product Cost'  },
      { amount: q * Number(p.shipping_cost || 0), category: 'Shipping Cost' },
      { amount: q * Number(p.other_costs   || 0), category: 'Other'         },
    ].filter(e => e.amount > 0);

    if (expensesToCreate.length > 0) {
      await supabase.from('expense_entries').insert(
        expensesToCreate.map(e => ({
          date,
          amount:      e.amount,
          account_id:  usdAccountId,   // always USD account
          category:    e.category,
          description: refNote,
          seller_id:   sellerId,
          notes:       ref,
          created_by:  user.id,
          sourcing_id: sourcingId,
        }))
      );
    }

    // --- REVENUE: one entry per payment method, account matched by currency ---
    const revenuesToCreate: any[] = [];
    if (Number(p.paid_usd)     > 0) revenuesToCreate.push({ amount: Number(p.paid_usd),     account_id: accountByCurrency('USD',  mainAccountId), description: `${refNote} (USD)`     });
    if (Number(p.paid_mad)     > 0) revenuesToCreate.push({ amount: Number(p.paid_mad),     account_id: accountByCurrency('MAD',  mainAccountId), description: `${refNote} (MAD)`     });
    if (Number(p.paid_usdt)    > 0) revenuesToCreate.push({ amount: Number(p.paid_usdt),    account_id: accountByCurrency('USD',  mainAccountId), description: `${refNote} (USDT)`    });
    if (Number(p.paid_invoice) > 0) revenuesToCreate.push({ amount: Number(p.paid_invoice), account_id: mainAccountId,                            description: `${refNote} (Invoice)` });

    if (revenuesToCreate.length > 0) {
      await supabase.from('revenue_entries').insert(
        revenuesToCreate.map(r => ({
          date:        form.payment_date || date,
          amount:      r.amount,
          account_id:  r.account_id,
          category:    'Seller Payment',
          description: r.description,
          seller_id:   sellerId,
          notes:       ref,
          created_by:  user.id,
          sourcing_id: sourcingId,
        }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload: any = {
      date:                form.date,
      seller_id:           form.seller_id !== 'none' ? form.seller_id : null,
      product_name:        form.product_name,
      quantity:            qty,
      shipping_method:     form.shipping_method,
      product_url:         form.product_url  || null,
      notes:               form.notes        || null,
      product_cost:        Number(form.product_cost        || 0),
      shipping_cost:       Number(form.shipping_cost       || 0),
      other_costs:         Number(form.other_costs         || 0),
      seller_product_cost: Number(form.seller_product_cost || 0),
      seller_shipping_cost:Number(form.seller_shipping_cost|| 0),
      seller_other_costs:  Number(form.seller_other_costs  || 0),
      account_id:          form.account_id !== 'none' ? form.account_id : null,
      payment:             paymentStatus,
      payment_date:        form.payment_date || null,
      paid_usd:            paidUSD,
      paid_mad:            Number(form.paid_mad  || 0),
      paid_usdt:           paidUSDT,
      paid_invoice:        paidInvoice,
      created_by:          user.id,
    };
    const sellerName = sellers.find(s => s.id === payload.seller_id)?.name || null;

    if (editItem) {
      const { error } = await supabase.from('sourcing_requests').update(payload).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      await uploadPendingFiles(editItem.id);
      await generateEntries(editItem.id, payload);
      await generateDebt(editItem.id, payload, sellerName);
      await logAction({ action: 'update', entity: 'sourcing_requests', entityId: editItem.id, details: `Product: ${payload.product_name}` });
      toast.success('Sourcing request updated');
    } else {
      const { data, error } = await supabase.from('sourcing_requests').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await uploadPendingFiles(data.id);
      await generateEntries(data.id, payload);
      await generateDebt(data.id, payload, sellerName);
      await logAction({ action: 'create', entity: 'sourcing_requests', entityId: data.id, details: `Product: ${payload.product_name}` });
      toast.success('Sourcing request created');
    }
    setOpen(false); resetForm(); fetchData();
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      date:                item.date         || format(new Date(), 'yyyy-MM-dd'),
      seller_id:           item.seller_id    || 'none',
      product_name:        item.product_name || '',
      quantity:            String(item.quantity || 1),
      shipping_method:     item.shipping_method || 'Not Selected',
      product_url:         item.product_url  || '',
      notes:               item.notes        || '',
      product_cost:        item.product_cost         ? String(item.product_cost)         : '',
      shipping_cost:       item.shipping_cost        ? String(item.shipping_cost)        : '',
      other_costs:         item.other_costs          ? String(item.other_costs)          : '',
      seller_product_cost: item.seller_product_cost  ? String(item.seller_product_cost)  : '',
      seller_shipping_cost:item.seller_shipping_cost ? String(item.seller_shipping_cost) : '',
      seller_other_costs:  item.seller_other_costs   ? String(item.seller_other_costs)   : '',
      account_id:          item.account_id   || 'none',
      payment_date:        item.payment_date || '',
      paid_usd:            item.paid_usd     ? String(item.paid_usd)     : '',
      paid_mad:            item.paid_mad     ? String(item.paid_mad)     : '',
      paid_usdt:           item.paid_usdt    ? String(item.paid_usdt)    : '',
      paid_invoice:        item.paid_invoice ? String(item.paid_invoice) : '',
    });
    setPendingFiles([]);
    fetchAttachments(item.id);
    setOpen(true);
  };

  const handleDelete = async (item: any) => {
    const { error } = await supabase.from('sourcing_requests').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'delete', entity: 'sourcing_requests', entityId: item.id, details: `Product: ${item.product_name}` });
    toast.success('Sourcing request deleted');
    fetchData();
  };

  const filtered = entries.filter(e =>
    (e.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.sellers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const getRowCalcs = (r: any) => {
    const q  = Number(r.quantity || 1);
    const lu = Number(r.product_cost || 0) + Number(r.shipping_cost || 0) + Number(r.other_costs || 0);
    const su = Number(r.seller_product_cost || 0) + Number(r.seller_shipping_cost || 0) + Number(r.seller_other_costs || 0);
    return { q, lu, su, ourCost: q * lu, sellerCost: q * su, profitUnit: su - lu, profitTotal: q * (su - lu), profitPct: lu > 0 ? ((su - lu) / lu) * 100 : 0 };
  };

  const summary = filtered.reduce((acc, r) => {
    const { ourCost, sellerCost, profitTotal } = getRowCalcs(r);
    return { ourCost: acc.ourCost + ourCost, sellerCost: acc.sellerCost + sellerCost, profit: acc.profit + profitTotal };
  }, { ourCost: 0, sellerCost: 0, profit: 0 });

  const columns = [
    { key: 'date',    label: 'Date' },
    { key: 'product', label: 'Product', render: (r: any) => (
      <div className="flex flex-col leading-tight">
        <span className="font-medium">{r.product_name}</span>
        <span className="text-xs text-muted-foreground">Qty: {r.quantity} · {r.shipping_method !== 'Not Selected' ? r.shipping_method : '-'}</span>
        {r._hasEntries && (
          <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5 mt-0.5">
            ✓ Rev &amp; Exp generated
          </span>
        )}
      </div>
    )},
    { key: 'seller', label: 'Seller', render: (r: any) => r.sellers?.name || '-' },
    { key: 'breakdown', label: 'Landed / Seller (unit)', render: (r: any) => {
      const lp = Number(r.product_cost || 0), ls = Number(r.shipping_cost || 0), lo = Number(r.other_costs || 0);
      const sp = Number(r.seller_product_cost || 0), ss = Number(r.seller_shipping_cost || 0), so = Number(r.seller_other_costs || 0);
      const lu = lp + ls + lo, su = sp + ss + so;
      return (
        <div className="flex flex-col leading-tight text-xs gap-0.5">
          <div className="flex gap-3">
            <span className="text-muted-foreground w-14">Landed</span>
            <span>{lp > 0 ? `${fmt2(lp)}` : '—'} / {ls > 0 ? fmt2(ls) : '—'} / {lo > 0 ? fmt2(lo) : '—'}</span>
            <span className="font-semibold">=&nbsp;{fmt2(lu)}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-muted-foreground w-14">Seller</span>
            <span>{sp > 0 ? `${fmt2(sp)}` : '—'} / {ss > 0 ? fmt2(ss) : '—'} / {so > 0 ? fmt2(so) : '—'}</span>
            <span className="font-semibold">=&nbsp;{fmt2(su)}</span>
          </div>
        </div>
      );
    }},
    { key: 'totals', label: 'Our / Seller Cost', render: (r: any) => {
      const { ourCost, sellerCost } = getRowCalcs(r);
      return (
        <div className="flex flex-col leading-tight text-xs">
          <span>Our: <strong>{fmt2(ourCost)}</strong></span>
          <span>Seller: <strong>{fmt2(sellerCost)}</strong></span>
        </div>
      );
    }},
    { key: 'profit', label: 'Profit', render: (r: any) => {
      const { profitUnit, profitTotal, profitPct } = getRowCalcs(r);
      const pos = profitTotal >= 0;
      return (
        <div className={`flex flex-col leading-tight text-xs font-medium ${pos ? 'text-green-700' : 'text-red-600'}`}>
          <span>{pos ? '+' : ''}{fmt2(profitUnit)}/unit <span className="opacity-70">({profitPct.toFixed(1)}%)</span></span>
          <span>Total: {pos ? '+' : ''}{fmt2(profitTotal)}</span>
        </div>
      );
    }},
    { key: 'payment', label: 'Payment', render: (r: any) => {
      const usd  = Number(r.paid_usd     || 0);
      const mad  = Number(r.paid_mad     || 0);
      const usdt = Number(r.paid_usdt    || 0);
      const inv  = Number(r.paid_invoice || 0);
      return (
        <div className="flex flex-col gap-0.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${paymentColors[r.payment] || ''}`}>{r.payment}</span>
          {usd  > 0 && <span className="text-xs text-muted-foreground">USD: {fmt2(usd)}</span>}
          {mad  > 0 && <span className="text-xs text-muted-foreground">MAD: {mad.toLocaleString()} MAD</span>}
          {usdt > 0 && <span className="text-xs text-muted-foreground">USDT: {fmt2(usdt)}</span>}
          {inv  > 0 && <span className="text-xs text-muted-foreground">Invoice: {fmt2(inv)}</span>}
          {r.payment_date && <span className="text-xs text-muted-foreground">{r.payment_date}</span>}
        </div>
      );
    }},
    { key: 'link', label: 'Link', render: (r: any) => (
      <div className="flex items-center gap-2">
        {r.product_url && (
          <a href={r.product_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {r._attachmentCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />{r._attachmentCount}
          </span>
        )}
        {!r.product_url && !r._attachmentCount && '-'}
      </div>
    )},
    ...(canEdit ? [{
      key: 'actions', label: 'Actions', render: (r: any) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(r); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirm(r); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  const exportData = filtered.map(r => {
    const { q, lu, su, ourCost, sellerCost, profitTotal, profitPct } = getRowCalcs(r);
    return {
      date: r.date, product_name: r.product_name, quantity: q, seller: r.sellers?.name || '',
      landed_product: r.product_cost || 0, landed_shipping: r.shipping_cost || 0, landed_other: r.other_costs || 0, landed_unit: lu,
      seller_product: r.seller_product_cost || 0, seller_shipping: r.seller_shipping_cost || 0, seller_other: r.seller_other_costs || 0, seller_unit: su,
      our_cost: ourCost, seller_cost: sellerCost, profit: profitTotal,
      account: r.accounts?.name || '', payment: r.payment, payment_date: r.payment_date || '', notes: r.notes || '',
    };
  });
  const exportCols = [
    { key: 'date', label: 'Date' }, { key: 'product_name', label: 'Product' }, { key: 'quantity', label: 'Qty' }, { key: 'seller', label: 'Seller' },
    { key: 'landed_product', label: 'Landed Product/unit' }, { key: 'landed_shipping', label: 'Landed Shipping/unit' }, { key: 'landed_other', label: 'Landed Other/unit' }, { key: 'landed_unit', label: 'Landed Total/unit' },
    { key: 'seller_product', label: 'Seller Product/unit' }, { key: 'seller_shipping', label: 'Seller Shipping/unit' }, { key: 'seller_other', label: 'Seller Other/unit' }, { key: 'seller_unit', label: 'Seller Total/unit' },
    { key: 'our_cost', label: 'Our Cost' }, { key: 'seller_cost', label: 'Seller Cost' }, { key: 'profit', label: 'Profit' },
    { key: 'account', label: 'Account' }, { key: 'payment', label: 'Payment' }, { key: 'payment_date', label: 'Payment Date' }, { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Sourcing</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToCSV(exportData, exportCols, 'sourcing')}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(exportData, exportCols, 'sourcing')}>Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canEdit && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />New Request</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editItem ? 'Edit Sourcing Request' : 'New Sourcing Request'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">

                  {/* Date + Seller */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Seller</Label>
                      <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select Seller" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Product + Qty */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product Name <span className="text-destructive">*</span></Label>
                      <Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder="e.g. Smart Video Doorbell" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity <span className="text-destructive">*</span></Label>
                      <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                    </div>
                  </div>

                  {/* Cost breakdowns — each in one row */}
                  <div className="rounded-lg border bg-muted/20 overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_72px] gap-2 px-3 py-1.5 bg-muted/40 border-b">
                      <span />
                      <span className="text-[11px] font-medium text-muted-foreground">Product ($)</span>
                      <span className="text-[11px] font-medium text-muted-foreground">Shipping ($)</span>
                      <span className="text-[11px] font-medium text-muted-foreground">Other ($)</span>
                      <span className="text-[11px] font-medium text-muted-foreground text-right">Total</span>
                    </div>
                    {/* Landed row */}
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_72px] gap-2 items-center px-3 py-2 border-b">
                      <span className="text-xs font-semibold text-muted-foreground">Landed</span>
                      <Input type="number" step="0.01" min="0" value={form.product_cost}
                        onChange={e => setForm({ ...form, product_cost: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <Input type="number" step="0.01" min="0" value={form.shipping_cost}
                        onChange={e => setForm({ ...form, shipping_cost: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <Input type="number" step="0.01" min="0" value={form.other_costs}
                        onChange={e => setForm({ ...form, other_costs: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <span className="text-xs font-semibold text-right">{fmt2(landedUnit)}</span>
                    </div>
                    {/* Seller row */}
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_72px] gap-2 items-center px-3 py-2 border-b">
                      <span className="text-xs font-semibold text-muted-foreground">Seller</span>
                      <Input type="number" step="0.01" min="0" value={form.seller_product_cost}
                        onChange={e => setForm({ ...form, seller_product_cost: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <Input type="number" step="0.01" min="0" value={form.seller_shipping_cost}
                        onChange={e => setForm({ ...form, seller_shipping_cost: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <Input type="number" step="0.01" min="0" value={form.seller_other_costs}
                        onChange={e => setForm({ ...form, seller_other_costs: e.target.value })} placeholder="0.00" className="h-8 text-sm" />
                      <span className="text-xs font-semibold text-right">{fmt2(sellerUnit)}</span>
                    </div>
                    {/* Profit row */}
                    {(() => {
                      const pp = Number(form.seller_product_cost  || 0) - Number(form.product_cost  || 0);
                      const ps = Number(form.seller_shipping_cost || 0) - Number(form.shipping_cost || 0);
                      const po = Number(form.seller_other_costs   || 0) - Number(form.other_costs   || 0);
                      const pt = sellerUnit - landedUnit;
                      const pos = pt >= 0;
                      const cl = (n: number) => n >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold';
                      const sign = (n: number) => (n >= 0 ? '+' : '') + fmt2(n);
                      return (
                        <div className={`grid grid-cols-[80px_1fr_1fr_1fr_72px] gap-2 items-center px-3 py-2 ${pos ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                          <span className="text-xs font-semibold text-muted-foreground">Profit</span>
                          <span className={`text-xs ${cl(pp)}`}>{sign(pp)}</span>
                          <span className={`text-xs ${cl(ps)}`}>{sign(ps)}</span>
                          <span className={`text-xs ${cl(po)}`}>{sign(po)}</span>
                          <span className={`text-xs text-right ${cl(pt)}`}>{sign(pt)}</span>
                        </div>
                      );
                    })()}
                  </div>


                  {/* Calculated totals */}
                  {(landedUnit > 0 || sellerUnit > 0) && (
                    <div className="rounded-lg border bg-muted/30 divide-y text-sm overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-2">
                        <span className="text-muted-foreground">Our Cost <span className="text-xs">({qty} × {fmt2(landedUnit)})</span></span>
                        <span className="font-semibold">{fmt2(ourCost)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2">
                        <span className="text-muted-foreground">Seller Cost <span className="text-xs">({qty} × {fmt2(sellerUnit)})</span></span>
                        <span className="font-semibold">{fmt2(sellerCost)}</span>
                      </div>
                      <div className={`flex justify-between items-center px-4 py-2.5 ${profitTotal >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                        <span className="font-medium text-muted-foreground">Sourcing Profit</span>
                        <div className="text-right">
                          <span className={`font-bold ${profitTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {profitTotal >= 0 ? '+' : ''}{fmt2(profitUnit)}/unit
                          </span>
                          <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${profitTotal >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {profitPct.toFixed(1)}%
                          </span>
                          <div className={`text-xs font-medium ${profitTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            Total: {profitTotal >= 0 ? '+' : ''}{fmt2(profitTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Shipping + Account row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Shipping Method</Label>
                      <Select value={form.shipping_method} onValueChange={v => setForm({ ...form, shipping_method: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHIPPING_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Account</Label>
                      <Select value={form.account_id} onValueChange={v => setForm({ ...form, account_id: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Account" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Payment breakdown */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${paymentColors[paymentStatus]}`}>
                        {paymentStatus}
                      </span>
                    </div>
                    {/* Currency rows */}
                    <div className="divide-y">
                      {[
                        { label: 'USD',     field: 'paid_usd',     suffix: 'USD',  usdVal: paidUSD },
                        { label: 'MAD',     field: 'paid_mad',     suffix: 'MAD',  usdVal: paidMAD, rate: `1 USD = ${rates.usd_mad_rate} MAD` },
                        { label: 'USDT',    field: 'paid_usdt',    suffix: 'USDT', usdVal: paidUSDT },
                        { label: 'Invoice', field: 'paid_invoice', suffix: 'USD',  usdVal: paidInvoice, hint: 'deducted from invoice' },
                      ].map(({ label, field, suffix, usdVal, rate, hint }) => (
                        <div key={field} className="grid grid-cols-[72px_1fr_80px] gap-2 items-center px-3 py-2">
                          <span className="text-xs font-medium text-muted-foreground">{label}</span>
                          <div>
                            <Input
                              type="number" step="0.01" min="0"
                              value={(form as any)[field]}
                              onChange={e => setForm({ ...form, [field]: e.target.value })}
                              placeholder="0.00"
                              className="h-8 text-sm"
                            />
                            {rate && <p className="text-[10px] text-muted-foreground mt-0.5">{rate}</p>}
                            {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
                          </div>
                          <span className="text-xs text-right text-muted-foreground">
                            {usdVal > 0 ? `≈ ${fmt2(usdVal)}` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Totals */}
                    <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Our Cost</span>
                        <span className="font-semibold">{fmt2(ourCost)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Paid (≈ USD)</span>
                        <span className="font-semibold text-green-700">{fmt2(totalPaidUSD)}</span>
                      </div>
                      <div className={`flex justify-between text-xs font-bold ${remaining > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                        <span>Remaining</span>
                        <span>{remaining > 0.01 ? fmt2(remaining) : '✓ Paid'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Date */}
                  {totalPaidUSD > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Payment Date</Label>
                      <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="h-9" />
                    </div>
                  )}

                  {/* Product URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Product URL</Label>
                    <Input value={form.product_url} onChange={e => setForm({ ...form, product_url: e.target.value })} placeholder="https://www.alibaba.com/product/..." />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes</Label>
                    <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Add any notes..." className="resize-none" />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" /> Attachments
                      </Label>
                      <label className="cursor-pointer">
                        <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
                        <span className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add files
                        </span>
                      </label>
                    </div>

                    {/* Saved attachments (edit mode) */}
                    {attachments.length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {attachments.map(att => (
                          <div key={att.id} className="flex items-center gap-2 px-3 py-2">
                            {fileIcon(att.file_type)}
                            <button type="button" onClick={() => getAttachmentUrl(att.file_path)}
                              className="flex-1 text-left text-xs text-primary hover:underline truncate">
                              {att.file_name}
                            </button>
                            <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(att.file_size)}</span>
                            <button type="button" onClick={() => deleteAttachment(att)}
                              className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pending files (queued for upload) */}
                    {pendingFiles.length > 0 && (
                      <div className="rounded-lg border divide-y border-dashed border-primary/40">
                        {pendingFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2">
                            {fileIcon(f.type)}
                            <span className="flex-1 text-xs truncate text-muted-foreground">{f.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                            <button type="button" onClick={() => removePending(i)}
                              className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
                          {pendingFiles.length} file(s) will be uploaded on save
                        </div>
                      </div>
                    )}

                    {attachments.length === 0 && pendingFiles.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-lg">
                        No attachments yet
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={uploadingFiles}>
                    {uploadingFiles ? 'Uploading...' : editItem ? 'Update Request' : 'Create Request'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Our Cost</p>
          <p className="text-lg font-bold">{fmt2(summary.ourCost)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Seller Cost</p>
          <p className="text-lg font-bold">{fmt2(summary.sellerCost)}</p>
        </div>
        <div className={`border rounded-lg p-4 ${summary.profit >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground mb-1">Sourcing Profit</p>
          <p className={`text-lg font-bold ${summary.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {summary.profit >= 0 ? '+' : ''}{fmt2(summary.profit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search product or seller..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSeller} onValueChange={setFilterSeller}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Sellers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sellers</SelectItem>
            {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Payments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {PAYMENTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={canEdit ? openEdit : undefined} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sourcing Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the sourcing request for "<strong>{deleteConfirm?.product_name}</strong>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirm) handleDelete(deleteConfirm); setDeleteConfirm(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Sourcing;
