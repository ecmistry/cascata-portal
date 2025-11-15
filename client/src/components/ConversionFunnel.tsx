import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, TrendingDown } from "lucide-react";

interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ConversionFunnelProps {
  stages: FunnelStage[];
}

export function ConversionFunnel({ stages }: ConversionFunnelProps) {
  const maxValue = stages.length > 0 ? stages[0].value : 1;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card style={{ overflow: 'hidden' }}>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>Sales pipeline drop-off analysis</CardDescription>
      </CardHeader>
      <CardContent className="w-full" style={{ overflow: 'hidden' }}>
        <div className="space-y-6 w-full" style={{ overflow: 'hidden' }}>
          {stages.map((stage, index) => {
            const width = Math.min((stage.value / maxValue) * 100, 100);
            const nextStage = stages[index + 1];
            const dropOffRate = nextStage 
              ? ((stage.value - nextStage.value) / stage.value) * 100 
              : 0;
            const conversionRate = nextStage 
              ? (nextStage.value / stage.value) * 100 
              : 0;

            return (
              <div key={stage.name} className="w-full" style={{ overflow: 'hidden' }}>
                {/* Funnel Stage */}
                <div className="relative w-full" style={{ overflow: 'hidden' }}>
                  <div 
                    className="h-20 rounded-lg flex items-center justify-between px-4 sm:px-6 transition-all hover:shadow-lg"
                    style={{ 
                      width: `${Math.max(Math.min(width, 100), 20)}%`,
                      backgroundColor: stage.color,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="text-white min-w-0 flex-shrink">
                      <div className="text-sm font-medium opacity-90 truncate">{stage.name}</div>
                      <div className="text-2xl font-bold truncate">
                        {stage.name === 'Revenue' 
                          ? formatCurrency(stage.value)
                          : formatNumber(stage.value)
                        }
                      </div>
                    </div>
                    <div className="text-white text-right flex-shrink-0 ml-4">
                      <div className="text-sm opacity-90">of total</div>
                      <div className="text-xl font-semibold">{stage.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Drop-off Indicator */}
                {nextStage && (
                  <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-3 text-sm">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          Conversion: <span className="font-semibold text-green-600">{conversionRate.toFixed(1)}%</span>
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-600" />
                          <span className="text-muted-foreground">
                            Drop-off: <span className="font-semibold text-red-600">{dropOffRate.toFixed(1)}%</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 pt-6 border-t grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {stages.length > 1 ? ((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Overall Conversion</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stages.length > 1 ? (100 - (stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Total Drop-off</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stages.length > 0 ? formatCurrency(stages[stages.length - 1].value) : '$0'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Final Revenue</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
