import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/DataTable';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const Sellers = () => {
  const { isAdmin } = useAuth();
  const [sellers, setSellers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ name: '', status: 'active' });

  const fetchSellers = async () => {
    const { data } = await supabase.from('sellers').select('*').order('name');
    setSellers(data || []);
  };

  useEffect(() => { fetchSellers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem) {
      const { error } = await supabase.from('sellers').update(form).eq('id', editItem.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Seller updated');
    } else {
      const { error } = await supabase.from('sellers').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Seller created');
    }
    resetForm();
    fetchSellers();
  };

  const handleDelete = async (item: any) => {
    const { error } = await supabase.from('sellers').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Seller deleted');
    fetchSellers();
  };

  const resetForm = () => {
    setOpen(false);
    setEditItem(null);
    setForm({ name: '', status: 'active' });
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ name: item.name, status: item.status });
    setOpen(true);
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge> },
    { key: 'created_at', label: 'Created', render: (r: any) => format(new Date(r.created_at), 'dd.MM.yyyy') },
    ...(isAdmin ? [{
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sellers</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Seller</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editItem ? 'Edit Seller' : 'Add Seller'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Seller name" />
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
                <Button type="submit" className="w-full">{editItem ? 'Update' : 'Create'} Seller</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable columns={columns} data={sellers} onRowClick={isAdmin ? openEdit : undefined} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Seller</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
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

export default Sellers;
