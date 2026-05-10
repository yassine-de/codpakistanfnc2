import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PackageSearch } from 'lucide-react';

interface SourcingBadgeProps {
  sourcingId: string | null;
  shortRef: string | null;
}

export function SourcingBadge({ sourcingId, shortRef }: SourcingBadgeProps) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<any>(null);

  if (!sourcingId || !shortRef) return <span className="text-muted-foreground">-</span>;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { data } = await supabase
      .from('sourcing_requests')
      .select('*, sellers(name), accounts(name, currency)')
      .eq('id', sourcingId)
      .single();
    setEntry(data);
    setOpen(true);
  };

  const fmt2 = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const qty = entry ? Number(entry.quantity || 1) : 1;
  const landedUnit = entry ? Number(entry.product_cost || 0) + Number(entry.shipping_cost || 0) + Number(entry.other_costs || 0) : 0;
  const sellerUnit = entry ? Number(entry.seller_product_cost || 0) + Number(entry.seller_shipping_cost || 0) + Number(entry.seller_other_costs || 0) : 0;

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <PackageSearch className="h-3 w-3" />
        {shortRef}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5" />
              {shortRef}
            </DialogTitle>
          </DialogHeader>
          {entry ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Product</p><p className="font-medium">{entry.product_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Seller</p><p className="font-medium">{entry.sellers?.name || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p>{entry.date}</p></div>
                <div><p className="text-xs text-muted-foreground">Quantity</p><p>{entry.quantity}</p></div>
                <div><p className="text-xs text-muted-foreground">Account</p><p>{entry.accounts?.name || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Payment</p><p>{entry.payment}</p></div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_64px] gap-1 px-3 py-1.5 bg-muted/40 border-b text-[11px] font-medium text-muted-foreground">
                  <span/>
                  <span>Product</span><span>Shipping</span><span>Other</span><span className="text-right">Total</span>
                </div>
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_64px] gap-1 items-center px-3 py-2 border-b text-xs">
                  <span className="font-medium text-muted-foreground">Landed</span>
                  <span>{fmt2(Number(entry.product_cost||0))}</span>
                  <span>{fmt2(Number(entry.shipping_cost||0))}</span>
                  <span>{fmt2(Number(entry.other_costs||0))}</span>
                  <span className="text-right font-semibold">{fmt2(landedUnit)}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_64px] gap-1 items-center px-3 py-2 border-b text-xs">
                  <span className="font-medium text-muted-foreground">Seller</span>
                  <span>{fmt2(Number(entry.seller_product_cost||0))}</span>
                  <span>{fmt2(Number(entry.seller_shipping_cost||0))}</span>
                  <span>{fmt2(Number(entry.seller_other_costs||0))}</span>
                  <span className="text-right font-semibold">{fmt2(sellerUnit)}</span>
                </div>
                <div className={`grid grid-cols-[80px_1fr_1fr_1fr_64px] gap-1 items-center px-3 py-2 text-xs font-semibold ${(sellerUnit-landedUnit)>=0?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>
                  <span>Profit</span>
                  <span>{(Number(entry.seller_product_cost||0)-Number(entry.product_cost||0))>=0?'+':''}{fmt2(Number(entry.seller_product_cost||0)-Number(entry.product_cost||0))}</span>
                  <span>{(Number(entry.seller_shipping_cost||0)-Number(entry.shipping_cost||0))>=0?'+':''}{fmt2(Number(entry.seller_shipping_cost||0)-Number(entry.shipping_cost||0))}</span>
                  <span>{(Number(entry.seller_other_costs||0)-Number(entry.other_costs||0))>=0?'+':''}{fmt2(Number(entry.seller_other_costs||0)-Number(entry.other_costs||0))}</span>
                  <span className="text-right">{(sellerUnit-landedUnit)>=0?'+':''}{fmt2(sellerUnit-landedUnit)}</span>
                </div>
              </div>

              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Our Cost ({qty}×{fmt2(landedUnit)})</span><span className="font-semibold">{fmt2(qty*landedUnit)}</span></div>
                <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Seller Cost ({qty}×{fmt2(sellerUnit)})</span><span className="font-semibold">{fmt2(qty*sellerUnit)}</span></div>
                <div className={`flex justify-between px-3 py-2 font-bold ${qty*(sellerUnit-landedUnit)>=0?'text-green-700':'text-red-600'}`}>
                  <span>Sourcing Profit</span>
                  <span>{qty*(sellerUnit-landedUnit)>=0?'+':''}{fmt2(qty*(sellerUnit-landedUnit))}</span>
                </div>
              </div>

              {(Number(entry.paid_mad)||Number(entry.paid_usdt)||Number(entry.paid_usd)||Number(entry.paid_invoice)) > 0 && (
                <div className="rounded-lg border divide-y text-xs">
                  {Number(entry.paid_usd)     > 0 && <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">USD</span><span>{fmt2(entry.paid_usd)}</span></div>}
                  {Number(entry.paid_mad)     > 0 && <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">MAD</span><span>{Number(entry.paid_mad).toLocaleString()} MAD</span></div>}
                  {Number(entry.paid_usdt)    > 0 && <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">USDT</span><span>{fmt2(entry.paid_usdt)}</span></div>}
                  {Number(entry.paid_invoice) > 0 && <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">Invoice</span><span>{fmt2(entry.paid_invoice)}</span></div>}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">Loading...</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
