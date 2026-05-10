import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, CheckCircle, Download, Pencil, Trash2, History } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { EntryHistory } from '@/components/EntryHistory';

const SellerDebts = () => {
  const { canEdit, isAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const [debts, setDebts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [form, setForm] = useState({ seller_name: '', amount: '', description: '', status: 'unpaid' as 'paid' | 'unpaid', date: format(new Date(), 'yyyy-MM-dd') });

  const fetchData = async () => {
    let q = supabase.from('seller_debts').select('*').order('date', { ascending: false });
    if (filterStatus && filterStatus !== 'all') q = q.eq('status', filterStatus as 'paid' | 'unpaid');
    if (filterSeller && filterSeller !== 'all') q = q.eq('seller_name', filterSeller);
    const { data } = await q;
    setDebts(data || []);
  };

  useEffect(() => {
    supabase.from('sellers').select('name').eq('status', 'active').order('name').then(({ data }) => setSellers(data || []));
  }, []);

  useEffect(() => { fetchData(); }, [filterStatus, filterSeller]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };

    if (editItem) {
      const { error } = await supabase.from('seller_debts').update(payload).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
        if (String(editItem[key]) !== String(payload[key])) {
          await logAction({ action: 'update', entity: 'seller_debts', entityId: editItem.id, fieldName: key, oldValue: String(editItem[key]), newValue: String(payload[key]) });
        }
      }
      toast.success('Debt updated');
    } else {
      const { data, error } = await supabase.from('seller_debts').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAction({ action: 'create', entity: 'seller_debts', entityId: data.id, details: `Seller: ${payload.seller_name}, Amount: ${payload.amount}` });
      toast.success('Debt added');
    }
    resetForm();
    fetchData();
  };

  const markPaid = async (debt: any) => {
    const { error } = await supabase.from('seller_debts').update({ status: 'paid' }).eq('id', debt.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'update', entity: 'seller_debts', entityId: debt.id, fieldName: 'status', oldValue: 'unpaid', newValue: 'paid' });
    toast.success('Marked as paid');
    fetchData();
  };

  const resetForm = () => {
    setOpen(false);
    setEditItem(null);
    setForm({ seller_name: '', amount: '', description: '', status: 'unpaid', date: format(new Date(), 'yyyy-MM-dd') });
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ seller_name: item.seller_name, amount: String(item.amount), description: item.description || '', status: item.status, date: item.date });
    setOpen(true);
  };

  const filtered = debts.filter(d =>
    d.seller_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (item: any) => {
    const { error } = await supabase.from('seller_debts').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: 'delete', entity: 'seller_debts', entityId: item.id, details: `Seller: ${item.seller_name}, Amount: ${item.amount}` });
    toast.success('Debt deleted');
    fetchData();
  };

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'seller_name', label: 'Seller' },
    { key: 'amount', label: 'Amount', render: (r: any) => `$${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { key: 'description', label: 'Description', render: (r: any) => r.description || '-' },
    { key: 'status', label: 'Status', render: (r: any) => (
      <div className="flex flex-col gap-0.5">
        <Badge variant={r.status === 'paid' ? 'default' : 'destructive'}>
          {r.status}
        </Badge>
        {r.paid_date && <span className="text-xs text-muted-foreground">{r.paid_date}</span>}
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r: any) => (
      <div className="flex items-center gap-1">
        {canEdit && r.status === 'unpaid' && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e: React.MouseEvent) => { e.stopPropagation(); markPaid(r); }}>
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(r); }}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirm(r); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setHistoryItem(r); }}>
          <History className="h-4 w-4" />
        </Button>
      </div>
    )},
  ];

  const exportData = filtered.map(r => ({
    date: r.date,
    seller_name: r.seller_name,
    amount: r.amount,
    description: r.description || '',
    status: r.status,
  }));
  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'seller_name', label: 'Seller' },
    { key: 'amount', label: 'Amount' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Seller Credit</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToCSV(exportData, exportCols, 'seller-credit')}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(exportData, exportCols, 'seller-credit')}>Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Debt</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editItem ? 'Edit Debt' : 'Add Debt'}</DialogTitle></DialogHeader>
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
                    <Label>Seller Name</Label>
                    <Input value={form.seller_name} onChange={e => setForm({ ...form, seller_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  {editItem && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as 'paid' | 'unpaid' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full">{editItem ? 'Update' : 'Add'} Debt</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search seller..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSeller} onValueChange={setFilterSeller}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Sellers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sellers</SelectItem>
            {sellers.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={canEdit ? openEdit : undefined} />

      <EntryHistory
        entityId={historyItem?.id || null}
        entityLabel={historyItem ? `${historyItem.seller_name} · $${Number(historyItem.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the debt of ${Number(deleteConfirm?.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} for {deleteConfirm?.seller_name}? This action cannot be undone.
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

export default SellerDebts;
