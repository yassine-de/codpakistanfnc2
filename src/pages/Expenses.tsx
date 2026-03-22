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
import { Plus, Search, Upload, ExternalLink, Download, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const CATEGORIES = ['Ads', 'Product Cost', 'Shipping Cost', 'Packaging', 'Refund', 'Tools / Software', 'Salaries / Labor', 'Bank Fees', 'Partner Withdrawal', 'Other'];
const AD_PLATFORMS = ['Meta', 'TikTok', 'Snapchat', 'Google', 'WhatsApp'];

const Expenses = () => {
  const { user, canEdit, isAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', account_id: '', category: '', description: '', ad_platform: '', notes: '' });

  const fetchData = async () => {
    let q = supabase.from('expense_entries').select('*, accounts(name), profiles:created_by(full_name)').order('date', { ascending: false });
    if (filterAccount && filterAccount !== 'all') q = q.eq('account_id', filterAccount);
    if (filterCategory && filterCategory !== 'all') q = q.eq('category', filterCategory);
    const { data } = await q;
    setEntries(data || []);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('status', 'active');
    setAccounts(data || []);
  };

  useEffect(() => { fetchData(); fetchAccounts(); }, [filterAccount, filterCategory]);

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return editItem?.receipt_url || null;
    const ext = receiptFile.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, receiptFile);
    if (error) { toast.error('Upload failed: ' + error.message); return null; }
    const { data } = supabase.storage.from('receipts').getPublicUrl(path);
    return data.publicUrl;
  };

  const deleteReceipt = async () => {
    if (!editItem?.receipt_url) return;
    const url = editItem.receipt_url;
    const parts = url.split('/receipts/');
    if (parts.length > 1) {
      const filePath = parts[1].split('?')[0];
      await supabase.storage.from('receipts').remove([filePath]);
    }
    const { error } = await supabase.from('expense_entries').update({ receipt_url: null }).eq('id', editItem.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'update', entity: 'expense_entries', entityId: editItem.id, fieldName: 'receipt_url', oldValue: 'file', newValue: 'removed' });
    toast.success('Receipt deleted');
    setEditItem({ ...editItem, receipt_url: null });
    fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const receipt_url = await uploadReceipt();
    const payload: any = {
      date: form.date,
      amount: Number(form.amount),
      account_id: form.account_id,
      category: form.category,
      description: form.description || null,
      created_by: user.id,
      receipt_url,
      ad_platform: form.category === 'Ads' ? form.ad_platform || null : null,
      notes: form.notes || null,
    };

    if (editItem) {
      const { error } = await supabase.from('expense_entries').update(payload).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      for (const key of Object.keys(payload)) {
        if (String(editItem[key]) !== String(payload[key]) && key !== 'created_by') {
          await logAction({ action: 'update', entity: 'expense_entries', entityId: editItem.id, fieldName: key, oldValue: String(editItem[key]), newValue: String(payload[key]) });
        }
      }
      toast.success('Expense updated');
    } else {
      const { data, error } = await supabase.from('expense_entries').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAction({ action: 'create', entity: 'expense_entries', entityId: data.id, details: `Amount: ${payload.amount}, Category: ${payload.category}${payload.ad_platform ? ', Platform: ' + payload.ad_platform : ''}` });
      toast.success('Expense added');
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setOpen(false);
    setEditItem(null);
    setReceiptFile(null);
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', account_id: '', category: '', description: '', ad_platform: '', notes: '' });
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      date: item.date,
      amount: String(item.amount),
      account_id: item.account_id,
      category: item.category,
      description: item.description || '',
      ad_platform: item.ad_platform || '',
      notes: item.notes || '',
    });
    setOpen(true);
  };

  const filtered = entries.filter(e =>
    (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.accounts?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.ad_platform || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteEntry = async (item: any) => {
    if (item.receipt_url) {
      const parts = item.receipt_url.split('/receipts/');
      if (parts.length > 1) {
        const filePath = parts[1].split('?')[0];
        await supabase.storage.from('receipts').remove([filePath]);
      }
    }
    const { error } = await supabase.from('expense_entries').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'delete', entity: 'expense_entries', entityId: item.id, details: `Amount: ${item.amount}, Category: ${item.category}` });
    toast.success('Expense deleted');
    fetchData();
  };

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount', render: (r: any) => `$${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'account', label: 'Account', render: (r: any) => r.accounts?.name || '-' },
    { key: 'category', label: 'Category', render: (r: any) => {
      if (r.category === 'Ads' && r.ad_platform) return `Ads (${r.ad_platform})`;
      return r.category;
    }},
    { key: 'description', label: 'Description', render: (r: any) => r.description || '-' },
    { key: 'notes', label: 'Notes', render: (r: any) => r.notes || '-' },
    { key: 'receipt', label: 'Receipt', render: (r: any) => r.receipt_url ? (
      <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <ExternalLink className="h-3 w-3" />View
      </a>
    ) : '-' },
    { key: 'created_by', label: 'Created By', render: (r: any) => r.profiles?.full_name || '-' },
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

  const exportData = filtered.map(r => ({
    date: r.date,
    amount: r.amount,
    account: r.accounts?.name || '',
    category: r.category === 'Ads' && r.ad_platform ? `Ads (${r.ad_platform})` : r.category,
    description: r.description || '',
    notes: r.notes || '',
    created_by: r.profiles?.full_name || '',
  }));
  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'account', label: 'Account' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'notes', label: 'Notes' },
    { key: 'created_by', label: 'Created By' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToCSV(exportData, exportCols, 'expenses')}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(exportData, exportCols, 'expenses')}>Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editItem ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount ($)</Label>
                      <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={form.account_id} onValueChange={v => setForm({ ...form, account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, ad_platform: v !== 'Ads' ? '' : form.ad_platform })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.category === 'Ads' && (
                    <div className="space-y-2">
                      <Label>Ad Platform</Label>
                      <Select value={form.ad_platform} onValueChange={v => setForm({ ...form, ad_platform: v })}>
                        <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                        <SelectContent>
                          {AD_PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Receipt</Label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                    </div>
                    {editItem?.receipt_url && !receiptFile && (
                      <div className="flex items-center gap-2">
                        <a href={editItem.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Current receipt</a>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-destructive hover:text-destructive" onClick={deleteReceipt}>
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full">{editItem ? 'Update' : 'Add'} Expense</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={canEdit ? openEdit : undefined} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense of ${Number(deleteConfirm?.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({deleteConfirm?.category})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirm) handleDeleteEntry(deleteConfirm); setDeleteConfirm(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Expenses;
