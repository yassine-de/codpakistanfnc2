import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataTable } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

const ENTITIES = ['revenue_entries', 'expense_entries', 'seller_debts', 'accounts', 'user'];

const HistoryPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const pageSize = 20;

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []));
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      let q = supabase.from('audit_logs').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (filterUser && filterUser !== 'all') q = q.eq('user_id', filterUser);
      if (filterEntity && filterEntity !== 'all') q = q.eq('entity', filterEntity);
      if (filterDate) q = q.gte('created_at', `${filterDate}T00:00:00`).lte('created_at', `${filterDate}T23:59:59`);

      const { data, count } = await q;
      setLogs(data || []);
      setTotal(count || 0);
    };
    fetchLogs();
  }, [page, filterUser, filterEntity, filterDate]);

  const filtered = logs.filter(l =>
    (l.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.entity || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.field_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'created_at', label: 'Date', render: (r: any) => format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') },
    { key: 'user_name', label: 'User', render: (r: any) => r.user_name || r.user_email || '-' },
    { key: 'action', label: 'Action', render: (r: any) => (
      <Badge variant={r.action === 'create' ? 'default' : r.action === 'delete' ? 'destructive' : 'secondary'}>
        {r.action}
      </Badge>
    )},
    { key: 'entity', label: 'Entity', render: (r: any) => r.entity.replace('_', ' ') },
    { key: 'entity_id', label: 'Record ID', render: (r: any) => r.entity_id ? r.entity_id.substring(0, 8) + '...' : '-' },
    { key: 'field_name', label: 'Field', render: (r: any) => r.field_name || '-' },
    { key: 'old_value', label: 'Old Value', render: (r: any) => r.old_value || '-' },
    { key: 'new_value', label: 'New Value', render: (r: any) => r.new_value || '-' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">History</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterUser} onValueChange={v => { setFilterUser(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Users" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {ENTITIES.map(e => <SelectItem key={e} value={e}>{e.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }} className="w-full sm:w-48" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
};

export default HistoryPage;
