import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Wallet } from 'lucide-react';
import WiseImportDialog from '@/components/WiseImportDialog';

const Accounts = () => {
  const { canEdit, isAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: 'default', opening_balance: '0', status: 'active' });

  const fetchData = async () => {
    const { data } = await supabase.from('accounts').select('*').order('created_at');
    setAccounts(data || []);

    const [rev, exp] = await Promise.all([
      supabase.from('revenue_entries').select('amount, account_id'),
      supabase.from('expense_entries').select('amount, account_id'),
    ]);

    const bals: Record<string, number> = {};
    (data || []).forEach(acc => {
      const r = (rev.data || []).filter(x => x.account_id === acc.id).reduce((s, x) => s + Number(x.amount), 0);
      const e = (exp.data || []).filter(x => x.account_id === acc.id).reduce((s, x) => s + Number(x.amount), 0);
      bals[acc.id] = Number(acc.opening_balance) + r - e;
    });
    setBalances(bals);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, opening_balance: Number(form.opening_balance) };

    if (editItem) {
      const { error } = await supabase.from('accounts').update(payload).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
        if (String(editItem[key]) !== String(payload[key])) {
          await logAction({ action: 'update', entity: 'accounts', entityId: editItem.id, fieldName: key, oldValue: String(editItem[key]), newValue: String(payload[key]) });
        }
      }
      toast.success('Account updated');
    } else {
      const { data, error } = await supabase.from('accounts').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAction({ action: 'create', entity: 'accounts', entityId: data.id, details: `Account: ${payload.name}` });
      toast.success('Account created');
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setOpen(false);
    setEditItem(null);
    setForm({ name: '', type: 'default', opening_balance: '0', status: 'active' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Accounts</h1>
        {canEdit && (
          <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editItem ? 'Edit Account' : 'Add Account'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Opening Balance ($)</Label>
                  <Input type="number" step="0.01" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editItem ? 'Update' : 'Create'} Account</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <Card
            key={acc.id}
            className={`shadow-card hover:shadow-card-hover transition-shadow cursor-pointer ${acc.status === 'inactive' ? 'opacity-60' : ''}`}
            onClick={() => { if (canEdit) { setEditItem(acc); setForm({ name: acc.name, type: acc.type, opening_balance: String(acc.opening_balance), status: acc.status }); setOpen(true); } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{acc.name}</CardTitle>
                <Badge variant={acc.status === 'active' ? 'default' : 'secondary'}>{acc.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{acc.type}</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                ${(balances[acc.id] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              {isAdmin && acc.name.toLowerCase().includes('wise') && (
                <div className="mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
                  <WiseImportDialog accountId={acc.id} accountName={acc.name} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Accounts;
