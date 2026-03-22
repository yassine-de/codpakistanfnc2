import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, FileDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { format, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLORS = ['hsl(152, 69%, 31%)', 'hsl(210, 70%, 50%)', 'hsl(40, 90%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)', 'hsl(180, 60%, 40%)', 'hsl(330, 70%, 50%)', 'hsl(60, 80%, 45%)', 'hsl(120, 50%, 40%)', 'hsl(20, 80%, 50%)'];
const AD_COLORS: Record<string, string> = {
  Meta: 'hsl(210, 70%, 50%)',
  TikTok: 'hsl(340, 82%, 52%)',
  Snapchat: 'hsl(50, 100%, 50%)',
  Google: 'hsl(120, 60%, 40%)',
  WhatsApp: 'hsl(142, 70%, 45%)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Reports = () => {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [totalRev, setTotalRev] = useState(0);
  const [totalExp, setTotalExp] = useState(0);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [revByCat, setRevByCat] = useState<any[]>([]);
  const [expByCat, setExpByCat] = useState<any[]>([]);
  const [yearlyMonthData, setYearlyMonthData] = useState<any[]>([]);
  const [adSpendData, setAdSpendData] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('accounts').select('*').eq('status', 'active').then(({ data }) => setAccounts(data || []));
  }, []);

  useEffect(() => {
    if (viewMode === 'monthly') fetchMonthlyReport();
    else fetchYearlyReport();
  }, [month, year, filterAccount, filterCategory, viewMode]);

  const fetchAdSpend = async (startDate: string, endDate: string) => {
    let q = supabase.from('expense_entries').select('amount, ad_platform').eq('category', 'Ads').gte('date', startDate).lte('date', endDate);
    if (filterAccount !== 'all') q = q.eq('account_id', filterAccount);
    const { data } = await q;
    const platformMap: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      const platform = r.ad_platform || 'Other';
      platformMap[platform] = (platformMap[platform] || 0) + Number(r.amount);
    });
    setAdSpendData(Object.entries(platformMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  };

  const fetchMonthlyReport = async () => {
    const [y, m] = month.split('-');
    const ms = `${y}-${m}-01`;
    const me = format(endOfMonth(new Date(Number(y), Number(m) - 1, 1)), 'yyyy-MM-dd');

    let revQ = supabase.from('revenue_entries').select('amount, category').gte('date', ms).lte('date', me);
    let expQ = supabase.from('expense_entries').select('amount, category').gte('date', ms).lte('date', me);
    if (filterAccount !== 'all') { revQ = revQ.eq('account_id', filterAccount); expQ = expQ.eq('account_id', filterAccount); }
    if (filterCategory !== 'all') { expQ = expQ.eq('category', filterCategory); }

    const [rev, exp] = await Promise.all([revQ, expQ]);
    const revData = rev.data || [];
    const expData = exp.data || [];
    setTotalRev(revData.reduce((s, r) => s + Number(r.amount), 0));
    setTotalExp(expData.reduce((s, r) => s + Number(r.amount), 0));
    buildCategoryBreakdowns(revData, expData);
    fetchAdSpend(ms, me);

    const today = new Date();
    const trends: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const tms = format(d, 'yyyy-MM-dd');
      const tme = format(endOfMonth(d), 'yyyy-MM-dd');
      const label = format(d, 'MMM');
      let rq = supabase.from('revenue_entries').select('amount').gte('date', tms).lte('date', tme);
      let eq = supabase.from('expense_entries').select('amount').gte('date', tms).lte('date', tme);
      if (filterAccount !== 'all') { rq = rq.eq('account_id', filterAccount); eq = eq.eq('account_id', filterAccount); }
      const [tr, te] = await Promise.all([rq, eq]);
      trends.push({
        month: label,
        Revenue: (tr.data || []).reduce((s, r) => s + Number(r.amount), 0),
        Expenses: (te.data || []).reduce((s, r) => s + Number(r.amount), 0),
      });
    }
    setTrendData(trends);
  };

  const fetchYearlyReport = async () => {
    const ys = `${year}-01-01`;
    const ye = `${year}-12-31`;

    let revQ = supabase.from('revenue_entries').select('amount, category, date').gte('date', ys).lte('date', ye);
    let expQ = supabase.from('expense_entries').select('amount, category, date').gte('date', ys).lte('date', ye);
    if (filterAccount !== 'all') { revQ = revQ.eq('account_id', filterAccount); expQ = expQ.eq('account_id', filterAccount); }
    if (filterCategory !== 'all') { expQ = expQ.eq('category', filterCategory); }

    const [rev, exp] = await Promise.all([revQ, expQ]);
    const revData = rev.data || [];
    const expData = exp.data || [];
    setTotalRev(revData.reduce((s, r) => s + Number(r.amount), 0));
    setTotalExp(expData.reduce((s, r) => s + Number(r.amount), 0));
    buildCategoryBreakdowns(revData, expData);
    fetchAdSpend(ys, ye);

    const monthlyData = MONTHS.map((label, i) => {
      const mRev = revData.filter(r => new Date(r.date).getMonth() === i).reduce((s, r) => s + Number(r.amount), 0);
      const mExp = expData.filter(r => new Date(r.date).getMonth() === i).reduce((s, r) => s + Number(r.amount), 0);
      return { month: label, Revenue: mRev, Expenses: mExp, Profit: mRev - mExp };
    });
    setYearlyMonthData(monthlyData);
  };

  const buildCategoryBreakdowns = (revData: any[], expData: any[]) => {
    const revCatMap: Record<string, number> = {};
    revData.forEach(r => { revCatMap[r.category] = (revCatMap[r.category] || 0) + Number(r.amount); });
    setRevByCat(Object.entries(revCatMap).map(([name, value]) => ({ name, value })));

    const expCatMap: Record<string, number> = {};
    expData.forEach(r => { expCatMap[r.category] = (expCatMap[r.category] || 0) + Number(r.amount); });
    setExpByCat(Object.entries(expCatMap).map(([name, value]) => ({ name, value })));
  };

  const profit = totalRev - totalExp;
  const renderLabel = ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = viewMode === 'monthly' ? `Report - ${month}` : `Report - ${year}`;
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    // Summary
    autoTable(doc, {
      startY: 38,
      head: [['Metric', 'Value']],
      body: [
        ['Total Revenue', fmt(totalRev)],
        ['Total Expenses', fmt(totalExp)],
        ['Profit', fmt(profit)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 120, 180] },
    });

    // Expense by category
    if (expByCat.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || 70;
      doc.setFontSize(13);
      doc.text('Expenses by Category', 14, lastY + 10);
      autoTable(doc, {
        startY: lastY + 14,
        head: [['Category', 'Amount']],
        body: expByCat.map(c => [c.name, fmt(c.value)]),
        theme: 'grid',
        headStyles: { fillColor: [220, 53, 69] },
      });
    }

    // Ad Spend
    if (adSpendData.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || 120;
      doc.setFontSize(13);
      doc.text('Ad Spend by Platform', 14, lastY + 10);
      autoTable(doc, {
        startY: lastY + 14,
        head: [['Platform', 'Amount']],
        body: adSpendData.map(a => [a.name, fmt(a.value)]),
        theme: 'grid',
        headStyles: { fillColor: [108, 99, 255] },
      });
    }

    // Revenue by category
    if (revByCat.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || 170;
      if (lastY > 250) doc.addPage();
      const startY = lastY > 250 ? 20 : lastY + 10;
      doc.setFontSize(13);
      doc.text('Revenue by Category', 14, startY);
      autoTable(doc, {
        startY: startY + 4,
        head: [['Category', 'Amount']],
        body: revByCat.map(c => [c.name, fmt(c.value)]),
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69] },
      });
    }

    doc.save(`${title.replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPDF}>
            <FileDown className="h-4 w-4 mr-2" />PDF Export
          </Button>
          <Tabs value={viewMode} onValueChange={v => setViewMode(v as 'monthly' | 'yearly')}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {viewMode === 'monthly' ? (
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full sm:w-48" />
        ) : (
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Select Year" /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
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
            {['Ads', 'Product Cost', 'Shipping Cost', 'Packaging', 'Refund', 'Tools / Software', 'Salaries / Labor', 'Bank Fees', 'Partner Withdrawal', 'Other'].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title={viewMode === 'yearly' ? `Revenue ${year}` : 'Total Revenue'} value={fmt(totalRev)} icon={TrendingUp} trend="up" />
        <KpiCard title={viewMode === 'yearly' ? `Expenses ${year}` : 'Total Expenses'} value={fmt(totalExp)} icon={TrendingDown} trend="down" />
        <KpiCard title={viewMode === 'yearly' ? `Profit ${year}` : 'Profit'} value={fmt(profit)} icon={DollarSign} trend={profit >= 0 ? 'up' : 'down'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {viewMode === 'yearly' ? (
          <>
            <Card className="shadow-card lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Monthly Overview {year}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={yearlyMonthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="hsl(152, 69%, 31%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-card lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Monthly Profit {year}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yearlyMonthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="Profit" fill="hsl(210, 70%, 50%)" radius={[4, 4, 0, 0]}>
                      {yearlyMonthData.map((entry, i) => (
                        <Cell key={i} fill={entry.Profit >= 0 ? 'hsl(152, 69%, 31%)' : 'hsl(0, 72%, 51%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-lg">Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="Revenue" stroke="hsl(152, 69%, 31%)" strokeWidth={2} dot={{ fill: 'hsl(152, 69%, 31%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-lg">Expense Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="Expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ fill: 'hsl(0, 72%, 51%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            {revByCat.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No revenue data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={revByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderLabel}>
                    {revByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg">Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            {expByCat.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No expense data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={expByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderLabel}>
                    {expByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ad Spend by Platform Chart */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Ad Spend by Platform</CardTitle></CardHeader>
          <CardContent>
            {adSpendData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No ad spend data for this period</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={adSpendData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderLabel}>
                      {adSpendData.map((entry, i) => <Cell key={i} fill={AD_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={adSpendData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {adSpendData.map((entry, i) => <Cell key={i} fill={AD_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
