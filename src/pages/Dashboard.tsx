import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DatePreset = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'this_year' | 'custom';

const getPresetDates = (preset: DatePreset): { from: Date; to: Date } => {
  const today = new Date();
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = subDays(today, 1); return { from: y, to: y }; }
    case 'this_month': return { from: startOfMonth(today), to: today };
    case 'last_month': { const lm = subMonths(today, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case 'this_year': return { from: startOfYear(today), to: today };
    default: return { from: startOfMonth(today), to: today };
  }
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EXPENSE_COLORS = [
  'hsl(var(--primary))',
  'hsl(0, 72%, 51%)',
  'hsl(45, 93%, 47%)',
  'hsl(199, 89%, 48%)',
  'hsl(271, 91%, 65%)',
  'hsl(142, 71%, 45%)',
  'hsl(24, 95%, 53%)',
  'hsl(330, 81%, 60%)',
];

const AD_COLORS: Record<string, string> = {
  Meta: 'hsl(210, 70%, 50%)',
  TikTok: 'hsl(340, 82%, 52%)',
  Snapchat: 'hsl(50, 100%, 50%)',
  Google: 'hsl(120, 60%, 40%)',
  WhatsApp: 'hsl(142, 70%, 45%)',
};

const Dashboard = () => {
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const handlePresetChange = (value: DatePreset) => {
    setPreset(value);
    if (value !== 'custom') {
      const { from, to } = getPresetDates(value);
      setDateFrom(from);
      setDateTo(to);
    }
  };
  const [stats, setStats] = useState({
    revenueFiltered: 0, expensesFiltered: 0, totalBalance: 0, unpaidDebts: 0, profitLastMonth: 0,
  });
  const [accountBalances, setAccountBalances] = useState<{ name: string; balance: number }[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseCategoryData, setExpenseCategoryData] = useState<any[]>([]);
  const [adSpendData, setAdSpendData] = useState<any[]>([]);
  const [latestTx, setLatestTx] = useState<any[]>([]);
  const [unpaidDebtsList, setUnpaidDebtsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '2000-01-01';
      const toStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '2099-12-31';

      const [revFiltered, expFiltered, accounts, debts, allRev, allExp] = await Promise.all([
        supabase.from('revenue_entries').select('amount').gte('date', fromStr).lte('date', toStr),
        supabase.from('expense_entries').select('amount, category, ad_platform').gte('date', fromStr).lte('date', toStr),
        supabase.from('accounts').select('*').eq('status', 'active'),
        supabase.from('seller_debts').select('*').eq('status', 'unpaid'),
        supabase.from('revenue_entries').select('amount, account_id'),
        supabase.from('expense_entries').select('amount, account_id'),
      ]);

      const sum = (data: any[] | null) => (data || []).reduce((s, r) => s + Number(r.amount), 0);
      const revFilteredSum = sum(revFiltered.data);
      const expFilteredSum = sum(expFiltered.data);
      const unpaidSum = sum(debts.data);

      // Account balances
      const accBals: { name: string; balance: number }[] = [];
      let totalBal = 0;
      (accounts.data || []).forEach(acc => {
        const accRev = (allRev.data || []).filter(r => r.account_id === acc.id).reduce((s: number, r: any) => s + Number(r.amount), 0);
        const accExp = (allExp.data || []).filter(r => r.account_id === acc.id).reduce((s: number, r: any) => s + Number(r.amount), 0);
        const bal = Number(acc.opening_balance) + accRev - accExp;
        totalBal += bal;
        accBals.push({ name: acc.name, balance: bal });
      });
      setAccountBalances(accBals);

      // Expense by category
      const catMap: Record<string, number> = {};
      (expFiltered.data || []).forEach((e: any) => {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
      });
      setExpenseCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Ad spend by platform
      const adMap: Record<string, number> = {};
      (expFiltered.data || []).filter((e: any) => e.category === 'Ads').forEach((e: any) => {
        const platform = e.ad_platform || 'Other';
        adMap[platform] = (adMap[platform] || 0) + Number(e.amount);
      });
      setAdSpendData(Object.entries(adMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Last month profit
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lmStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const lmEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
      const [revLM, expLM] = await Promise.all([
        supabase.from('revenue_entries').select('amount').gte('date', lmStart).lte('date', lmEnd),
        supabase.from('expense_entries').select('amount').gte('date', lmStart).lte('date', lmEnd),
      ]);
      const profitLM = sum(revLM.data) - sum(expLM.data);

      setStats({ revenueFiltered: revFilteredSum, expensesFiltered: expFilteredSum, totalBalance: totalBal, unpaidDebts: unpaidSum, profitLastMonth: profitLM });
      setUnpaidDebtsList((debts.data || []).slice(0, 5));

      // Chart data - last 6 months
      const chartMonths: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const ms = format(startOfMonth(d), 'yyyy-MM-dd');
        const me = format(endOfMonth(d), 'yyyy-MM-dd');
        const label = format(d, 'MMM yyyy');
        const [mr, me2] = await Promise.all([
          supabase.from('revenue_entries').select('amount').gte('date', ms).lte('date', me),
          supabase.from('expense_entries').select('amount').gte('date', ms).lte('date', me),
        ]);
        chartMonths.push({ month: label, Revenue: sum(mr.data), Expenses: sum(me2.data) });
      }
      setChartData(chartMonths);

      // Latest transactions
      const [latestRev, latestExp] = await Promise.all([
        supabase.from('revenue_entries').select('*, accounts(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('expense_entries').select('*, accounts(name)').order('created_at', { ascending: false }).limit(5),
      ]);
      const all = [
        ...(latestRev.data || []).map(r => ({ ...r, type: 'revenue' })),
        ...(latestExp.data || []).map(r => ({ ...r, type: 'expense' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);
      setLatestTx(all);
    };
    fetchData();
  }, [dateFrom, dateTo]);

  const profit = stats.revenueFiltered - stats.expensesFiltered;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : 'Von'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">–</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd.MM.yyyy') : 'Bis'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Total Balance */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
            <p className="text-4xl font-bold tracking-tight">{fmt(stats.totalBalance)}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {accountBalances.map(acc => (
              <div key={acc.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{acc.name}</span>
                </div>
                <span className="text-sm font-semibold">{fmt(acc.balance)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revenue (Period)" value={fmt(stats.revenueFiltered)} icon={TrendingUp} trend="up" />
        <KpiCard title="Expenses (Period)" value={fmt(stats.expensesFiltered)} icon={TrendingDown} trend="down" />
        <KpiCard title="Profit (Period)" value={fmt(profit)} icon={DollarSign} trend={profit >= 0 ? 'up' : 'down'} />
        <KpiCard title="Unpaid Debts" value={fmt(stats.unpaidDebts)} icon={Wallet} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Revenue" fill="hsl(152, 69%, 31%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            {expenseCategoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No expenses in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {expenseCategoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ad Spend Chart */}
      {adSpendData.length > 0 && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Ad Spend by Platform</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={adSpendData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {adSpendData.map((entry, i) => <Cell key={i} fill={AD_COLORS[entry.name] || EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={adSpendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {adSpendData.map((entry, i) => <Cell key={i} fill={AD_COLORS[entry.name] || EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Latest Transactions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {latestTx.length === 0 ? (
              <p className="text-muted-foreground text-sm">No transactions yet</p>
            ) : latestTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{tx.category || tx.description || 'Transaction'}</p>
                  <p className="text-xs text-muted-foreground">{tx.date} · {tx.accounts?.name}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'revenue' ? 'text-success' : 'text-destructive'}`}>
                  {tx.type === 'revenue' ? '+' : '-'}{fmt(Number(tx.amount))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Credit Seller</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {unpaidDebtsList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No unpaid debts</p>
            ) : unpaidDebtsList.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{d.seller_name}</p>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
                <Badge variant="destructive">{fmt(Number(d.amount))}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
