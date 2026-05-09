import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExchangeRates {
  usd_mad_rate: number;
  usdt_usd_rate: number;
}

const DEFAULTS: ExchangeRates = { usd_mad_rate: 10.0, usdt_usd_rate: 1.0 };

export function useSettings() {
  const [rates, setRates] = useState<ExchangeRates>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    const { data } = await supabase.from('settings').select('key, value');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(r => { map[r.key] = r.value; });
      setRates({
        usd_mad_rate: parseFloat(map['usd_mad_rate'] ?? '10.0'),
        usdt_usd_rate: parseFloat(map['usdt_usd_rate'] ?? '1.0'),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const updateRate = async (key: keyof ExchangeRates, value: number) => {
    await supabase.from('settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    setRates(prev => ({ ...prev, [key]: value }));
  };

  // Convert any amount to USD based on account currency
  const toUSD = (amount: number, currency: string): number => {
    if (currency === 'MAD') return amount / rates.usd_mad_rate;
    if (currency === 'USDT') return amount * rates.usdt_usd_rate;
    return amount;
  };

  return { rates, loading, updateRate, toUSD, refetch: fetchRates };
}
