import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

const Settings = () => {
  const { isAdmin } = useAuth();
  const { rates, loading, updateRate } = useSettings();
  const [usdMad, setUsdMad] = useState('');
  const [usdtUsd, setUsdtUsd] = useState('');

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const currentUsdMad = usdMad !== '' ? usdMad : String(rates.usd_mad_rate);
  const currentUsdtUsd = usdtUsd !== '' ? usdtUsd : String(rates.usdt_usd_rate);

  const handleSave = async () => {
    const madVal = parseFloat(currentUsdMad);
    const usdtVal = parseFloat(currentUsdtUsd);

    if (isNaN(madVal) || madVal <= 0 || isNaN(usdtVal) || usdtVal <= 0) {
      toast.error('Please enter valid positive numbers');
      return;
    }

    await Promise.all([
      updateRate('usd_mad_rate', madVal),
      updateRate('usdt_usd_rate', usdtVal),
    ]);
    setUsdMad('');
    setUsdtUsd('');
    toast.success('Exchange rates updated');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Exchange Rates
          </CardTitle>
          <CardDescription>
            Used to convert CIH (MAD) and USDT balances to USD across the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>1 USD = ? MAD</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={currentUsdMad}
                onChange={e => setUsdMad(e.target.value)}
                disabled={!isAdmin}
                className="max-w-[180px]"
              />
              <span className="text-sm text-muted-foreground">MAD per USD</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: if 1 USD = {currentUsdMad} MAD, then 100 MAD ≈ {(100 / parseFloat(currentUsdMad || '1')).toFixed(2)} USD
            </p>
          </div>

          <div className="space-y-2">
            <Label>1 USDT = ? USD</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={currentUsdtUsd}
                onChange={e => setUsdtUsd(e.target.value)}
                disabled={!isAdmin}
                className="max-w-[180px]"
              />
              <span className="text-sm text-muted-foreground">USD per USDT</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: if 1 USDT = {currentUsdtUsd} USD, then 100 USDT ≈ {(100 * parseFloat(currentUsdtUsd || '1')).toFixed(2)} USD
            </p>
          </div>

          {isAdmin && (
            <Button onClick={handleSave} className="w-full">Save Exchange Rates</Button>
          )}
          {!isAdmin && (
            <p className="text-sm text-muted-foreground text-center">Only admins can change exchange rates.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
