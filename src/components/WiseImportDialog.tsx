import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { RefreshCw, Download, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface WiseTransaction {
  wise_id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  type: string;
  status: string;
  card_last4?: string | null;
  raw?: any;
}

interface WiseImportDialogProps {
  accountId: string;
  accountName: string;
}

const WiseImportDialog = ({ accountId, accountName }: WiseImportDialogProps) => {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [transactions, setTransactions] = useState<WiseTransaction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [cardFilterApplied, setCardFilterApplied] = useState(false);
  const [cardFilterNote, setCardFilterNote] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    setTransactions([]);
    setSelected(new Set());
    setCardFilterApplied(false);
    setCardFilterNote(null);

    try {
      const { data: latestEntries } = await supabase
        .from('expense_entries')
        .select('date, created_at')
        .eq('account_id', accountId)
        .eq('category', 'Ads')
        .order('date', { ascending: false })
        .limit(1);

      const latestEntry = latestEntries?.[0] || null;
      const sinceDate = latestEntry
        ? new Date(latestEntry.date + 'T00:00:00Z').toISOString()
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wise-transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ sinceDate }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transactions');
      }

      setCardFilterApplied(result.cardFilterApplied === true);
      setCardFilterNote(result.cardFilterNote || null);

      // Filter out transactions that are already in the DB
      const { data: existingEntries } = await supabase
        .from('expense_entries')
        .select('date, amount, description')
        .eq('account_id', accountId)
        .eq('category', 'Ads');

      const existingSet = new Set(
        (existingEntries || []).map(e => `${e.date}_${Number(e.amount).toFixed(2)}_${e.description || ''}`)
      );

      const newTransactions = (result.transactions || []).filter((tx: WiseTransaction) => {
        const txDate = tx.date ? format(new Date(tx.date), 'yyyy-MM-dd') : '';
        const key = `${txDate}_${Number(tx.amount).toFixed(2)}_${tx.description}`;
        return !existingSet.has(key);
      });

      setTransactions(newTransactions);
      setSelected(new Set(newTransactions.map((tx: WiseTransaction) => tx.wise_id)));

      if (newTransactions.length === 0) {
        toast.info('No new transactions found');
      }
    } catch (err: any) {
      console.error('Wise fetch error:', err);
      setError(err.message || 'Error fetching transactions');
      toast.error('Error fetching Wise transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchTransactions();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map(tx => tx.wise_id)));
    }
  };

  const handleImport = async () => {
    if (!user || selected.size === 0) return;
    setImporting(true);

    try {
      const toImport = transactions.filter(tx => selected.has(tx.wise_id));
      const entries = toImport.map(tx => ({
        date: tx.date ? format(new Date(tx.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        amount: tx.amount,
        account_id: accountId,
        category: 'Ads',
        description: tx.description,
        created_by: user.id,
      }));

      const { error } = await supabase.from('expense_entries').insert(entries);
      if (error) throw error;

      await logAction({
        action: 'create',
        entity: 'expense_entries',
        details: `Wise import: ${entries.length} transactions imported for ${accountName}`,
      });

      toast.success(`${entries.length} transactions imported`);
      setOpen(false);
      setTransactions([]);
      setSelected(new Set());
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Import error: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); }}>
        <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Wise Transactions</DialogTitle>
          </DialogHeader>


          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Fetching transactions...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-destructive text-sm mb-4">{error}</p>
              <Button variant="outline" onClick={fetchTransactions}>
                <RefreshCw className="h-4 w-4 mr-2" />Retry
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No new transactions found.
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === transactions.length}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Card (last 4)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.wise_id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(tx.wise_id)}
                            onCheckedChange={() => toggleSelect(tx.wise_id)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {tx.date ? format(new Date(tx.date), 'dd.MM.yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{tx.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{tx.type || '-'}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.card_last4 ? `•••• ${tx.card_last4}` : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="mt-4">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm text-muted-foreground">
                    {selected.size} of {transactions.length} selected
                  </span>
                  <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                    {importing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import {selected.size} transactions
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WiseImportDialog;
