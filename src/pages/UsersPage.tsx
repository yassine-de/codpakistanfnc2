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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const UsersPage = () => {
  const { isAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'editor', password: '', status: 'active' });
  const [resetConfirm, setResetConfirm] = useState<{ email: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at');
    const { data: roles } = await supabase.from('user_roles').select('*');
    const merged = (profiles || []).map(p => ({
      ...p,
      role: (roles || []).find(r => r.user_id === p.id)?.role || 'viewer',
    }));
    setUsers(merged);
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editUser) {
      // Update profile (name, email, status)
      const updates: any = { full_name: form.full_name, status: form.status as any };
      
      // Update email if changed
      if (form.email !== editUser.email) {
        updates.email = form.email;
      }
      
      const { error } = await supabase.from('profiles').update(updates).eq('id', editUser.id);
      if (error) { toast.error(error.message); return; }

      // Update role
      if (form.role !== editUser.role) {
        await supabase.from('user_roles').delete().eq('user_id', editUser.id);
        await supabase.from('user_roles').insert({ user_id: editUser.id, role: form.role as any });
        await logAction({ action: 'update', entity: 'user', entityId: editUser.id, fieldName: 'role', oldValue: editUser.role, newValue: form.role });
      }

      // Log field changes
      for (const key of ['full_name', 'email', 'status'] as const) {
        if (editUser[key] !== (updates as any)[key] && (updates as any)[key] !== undefined) {
          await logAction({ action: 'update', entity: 'user', entityId: editUser.id, fieldName: key, oldValue: editUser[key], newValue: (updates as any)[key] });
        }
      }

      // Update password if provided
      if (form.password) {
        const { error: pwError } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (pwError) {
          toast.error(`Password reset failed: ${pwError.message}`);
        } else {
          toast.info('Password reset email sent to user');
        }
      }

      toast.success('User updated');
    } else {
      // Create new user via Edge Function (email auto-confirmed, no confirmation email)
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role },
      });
      if (fnError || data?.error) { toast.error(data?.error || fnError?.message || 'Failed to create user'); return; }

      await logAction({ action: 'create', entity: 'user', entityId: data.user.id, details: `User: ${form.full_name}, Role: ${form.role}` });
      toast.success('User created — can log in immediately');
    }
    resetForm();
    fetchUsers();
  };

  const resetForm = () => {
    setOpen(false);
    setEditUser(null);
    setForm({ full_name: '', email: '', role: 'editor', password: '', status: 'active' });
  };

  const openEdit = (item: any) => {
    setEditUser(item);
    setForm({ full_name: item.full_name, email: item.email, role: item.role, password: '', status: item.status });
    setOpen(true);
  };

  const handleResetPassword = async (email: string, name: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Password reset email sent to ${name}`);
    }
  };

  const handleDeleteUser = async (user: any) => {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: user.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to delete user');
      return;
    }
    await logAction({ action: 'delete', entity: 'user', entityId: user.id, details: `User: ${user.full_name}` });
    toast.success('User deleted');
    fetchUsers();
  };

  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (r: any) => <Badge variant={r.role === 'admin' ? 'default' : 'secondary'}>{r.role}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status === 'active' ? 'default' : 'destructive'}>{r.status}</Badge> },
    { key: 'actions', label: 'Actions', render: (r: any) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setResetConfirm({ email: r.email, name: r.full_name }); }}>
          <KeyRound className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required disabled={!editUser && false} />
              </div>
              <div className="space-y-2">
                <Label>{editUser ? 'New Password (optional)' : 'Password'}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  minLength={8}
                  placeholder={editUser ? 'Leave empty to keep current' : ''}
                />
                {editUser && form.password && (
                  <p className="text-xs text-muted-foreground">A password reset email will be sent to the user.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editUser && (
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
              )}
              <Button type="submit" className="w-full">{editUser ? 'Update' : 'Create'} User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={users} onRowClick={openEdit} />

      <AlertDialog open={!!resetConfirm} onOpenChange={(v) => { if (!v) setResetConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Password Reset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a password reset email to <strong>{resetConfirm?.name}</strong> ({resetConfirm?.email})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (resetConfirm) handleResetPassword(resetConfirm.email, resetConfirm.name);
              setResetConfirm(null);
            }}>
              Send Reset Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.full_name}</strong> ({deleteConfirm?.email})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirm) handleDeleteUser(deleteConfirm); setDeleteConfirm(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
