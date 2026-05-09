import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSettings } from '@/hooks/useSettings';
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
import { Plus, Search, Download, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const CATEGORIES = ['Seller Payment'];

const Revenue = () => {
  const { user, canEdit, isAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const { toUSD, rates } = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', account_id: '', category: CATEGORIES[0], description: '', seller_id: 'none', notes: '' });

  const fetchData = async () => {
    let q = supabase.from('revenue_entries').select('*, accounts(name, currency), profiles:created_by(full_name), sellers(name)').order('date', { ascending: false });
    if (filterAccount && filterAccount !== 'all') q = q.eq('account_id', filterAccount);
    if (filterMonth) {
      const [y, m] = filterMonth.split('-');
      q = q.gte('date', `${y}-${m}-01`).lte('date', `${y}-${m}-31`);
    }
    const { data } = await q;
    setEntries(data || []);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('status', 'active');
    setAccounts(data || []);
  };

  const fetchSellers = async () => {
    const { data } = await supabase.from('sellers').select('*').eq('status', 'active').order('name');
    setSellers(data || []);
  };

  useEffect(() => { fetchData(); fetchAccounts(); fetchSellers(); }, [filterAccount, filterMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload: any = {
      date: form.date,
      amount: Number(form.amount),
      account_id: form.account_id,
      category: form.category,
      description: form.description || null,
      created_by: user.id,
      seller_id: form.seller_id && form.seller_id !== 'none' ? form.seller_id : null,
      notes: form.notes || null,
    };
    
    if (editItem) {
      const { error } = await supabase.from('revenue_entries').update(payload).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      for (const key of Object.keys(payload)) {
        if (String(editItem[key]) !== String(payload[key]) && key !== 'created_by') {
          await logAction({ action: 'update', entity: 'revenue_entries', entityId: editItem.id, fieldName: key, oldValue: String(editItem[key]), newValue: String(payload[key]) });
        }
      }
      toast.success('Revenue updated');
    } else {
      const { data, error } = await supabase.from('revenue_entries').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAction({ action: 'create', entity: 'revenue_entries', entityId: data.id, details: `Amount: ${payload.amount}` });
      toast.success('Revenue added');
    }
    setOpen(false);
    setEditItem(null);
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', account_id: '', category: CATEGORIES[0], description: '', seller_id: 'none', notes: '' });
    fetchData();
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ date: item.date, amount: String(item.amount), account_id: item.account_id, category: item.category, description: item.description || '', seller_id: item.seller_id || 'none', notes: item.notes || '' });
    setOpen(true);
  };

  const filtered = entries.filter(e =>
    (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.accounts?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.sellers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (item: any) => {
    const { error } = await supabase.from('revenue_entries').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'delete', entity: 'revenue_entries', entityId: item.id, details: `Amount: ${item.amount}` });
    toast.success('Revenue deleted');
    fetchData();
  };

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount', render: (r: any) => {
      const currency = r.accounts?.currency || 'USD';
      const amt = Number(r.amount);
      if (currency !== 'USD') {
        const usd = toUSD(amt, currency);
        return (
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}</span>
            <span className="text-xs text-muted-foreground">≈ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </span>
        );
      }
      return `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }},
    { key: 'account', label: 'Account', render: (r: any) => r.accounts?.name || '-' },
    { key: 'category', label: 'Category' },
    { key: 'seller', label: 'Seller', render: (r: any) => r.sellers?.name || '-' },
    { key: 'description', label: 'Description', render: (r: any) => r.description || '-' },
    { key: 'notes', label: 'Notes', render: (r: any) => r.notes || '-' },
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
    category: r.category,
    seller: r.sellers?.name || '',
    description: r.description || '',
    notes: r.notes || '',
    created_by: r.profiles?.full_name || '',
  }));
  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'account', label: 'Account' },
    { key: 'category', label: 'Category' },
    { key: 'seller', label: 'Seller' },
    { key: 'description', label: 'Description' },
    { key: 'notes', label: 'Notes' },
    { key: 'created_by', label: 'Created By' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Revenue</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToCSV(exportData, exportCols, 'revenue')}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(exportData, exportCols, 'revenue')}>Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditItem(null); setForm({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', account_id: '', category: CATEGORIES[0], description: '', seller_id: 'none', notes: '' }); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Revenue</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editItem ? 'Edit Revenue' : 'Add Revenue'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount ({accounts.find(a => a.id === form.account_id)?.currency || 'USD'})</Label>
                      <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                      {(() => {
                        const acc = accounts.find(a => a.id === form.account_id);
                        if (acc?.currency && acc.currency !== 'USD' && form.amount) {
                          const usd = toUSD(Number(form.amount), acc.currency);
                          return <p className="text-xs text-muted-foreground">≈ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>;
                        }
                        return null;
                      })()}
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
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Seller</Label>
                    <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select seller (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." />
                  </div>
                  <Button type="submit" className="w-full">{editItem ? 'Update' : 'Add'} Revenue</Button>
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
        <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full sm:w-48" />
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={canEdit ? openEdit : undefined} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revenue Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this revenue entry of ${Number(deleteConfirm?.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirm) handleDelete(deleteConfirm); setDeleteConfirm(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Revenue;
