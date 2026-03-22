import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function KpiCard({ title, value, icon: Icon, trend, className }: KpiCardProps) {
  return (
    <Card className={`shadow-card hover:shadow-card-hover transition-shadow ${className || ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${
              trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-foreground'
            }`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            trend === 'up' ? 'bg-success/10 text-success' : 
            trend === 'down' ? 'bg-destructive/10 text-destructive' : 
            'bg-primary/10 text-primary'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
