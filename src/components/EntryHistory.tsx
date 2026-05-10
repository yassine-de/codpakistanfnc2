import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { format } from 'date-fns';

interface EntryHistoryProps {
  entityId: string | null;
  entityLabel?: string;
  open: boolean;
  onClose: () => void;
}

export function EntryHistory({ entityId, entityLabel, open, onClose }: EntryHistoryProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    setLoading(true);
    supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [open, entityId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History {entityLabel ? `— ${entityLabel}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No history found.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="rounded-lg border px-3 py-2.5 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.action === 'create' ? 'default' : log.action === 'delete' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">{log.user_name || log.user_email || 'Unknown'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>

                {log.field_name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                    <span className="font-medium text-foreground">{log.field_name}</span>
                    {log.old_value && <><span className="line-through opacity-60">{log.old_value}</span><span>→</span></>}
                    {log.new_value && <span className="text-foreground">{log.new_value}</span>}
                  </div>
                )}

                {log.details && (
                  <p className="text-xs text-muted-foreground pl-1">{log.details}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
