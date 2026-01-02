import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, TrendingDown } from "lucide-react";

interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
  color: string;
  revenuePerSQL?: number; // Optional: for Revenue stage to show revenue per SQL instead of percentage
}

interface ConversionFunnelProps {
  stages: FunnelStage[];
}

/**
 * ConversionFunnel Component
 * 
 * Displays a visual funnel representation of the sales conversion process.
 * Shows stages from SQLs through Opportunities to Revenue with percentage
 * conversion rates and color-coded bars.
 * 
 * @param stages - Array of funnel stages, each containing name, value, percentage, and color
 * 
 * @returns A card component displaying the conversion funnel visualization
 */
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
            
            // Calculate drop-off and conversion rates
            // Note: We can't calculate drop-off/conversion between Opportunities and Revenue
            // because they're different units (count vs dollars)
            let dropOffRate = 0;
            let conversionRate = 0;
            
            if (nextStage) {
              // Only calculate conversion/drop-off if both stages are the same unit type
              // SQLs → Opportunities: both are counts, so we can calculate
              // Opportunities → Revenue: different units, skip calculation
              if (stage.name === 'SQLs' && nextStage.name === 'Opportunities') {
                dropOffRate = ((stage.value - nextStage.value) / stage.value) * 100;
                conversionRate = (nextStage.value / stage.value) * 100;
              } else if (stage.name === 'Opportunities' && nextStage.name === 'Revenue') {
                // Can't calculate percentage between count and dollars
                // Instead, show revenue per opportunity
                conversionRate = 0; // Will be handled separately
                dropOffRate = 0;
              }
            }

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
                      {stage.name === 'Revenue' && stage.revenuePerSQL !== undefined ? (
                        <>
                          <div className="text-sm opacity-90">per SQL</div>
                          <div className="text-xl font-semibold">{formatCurrency(stage.revenuePerSQL)}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm opacity-90">of total</div>
                          <div className="text-xl font-semibold">{stage.percentage.toFixed(1)}%</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drop-off Indicator */}
                {nextStage && (
                  <div className="flex items-center justify-center py-2">
                    {stage.name === 'Opportunities' && nextStage.name === 'Revenue' ? (
                      // Show revenue per opportunity instead of percentage (different units)
                      <div className="flex items-center gap-3 text-sm">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Avg Deal Size: <span className="font-semibold text-green-600">
                            {nextStage.value > 0 && stage.value > 0 
                              ? formatCurrency(nextStage.value / stage.value)
                              : '$0'}
                          </span>
                        </span>
                      </div>
                    ) : conversionRate > 0 || dropOffRate > 0 ? (
                      // Show conversion and drop-off for SQLs → Opportunities
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
                    ) : null}
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
              {stages.length >= 2 && stages[0].value > 0 
                ? ((stages[1].value / stages[0].value) * 100).toFixed(1) 
                : '0.0'}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Overall Conversion</div>
            <div className="text-xs text-muted-foreground mt-1">SQLs → Opportunities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stages.length >= 2 && stages[0].value > 0 
                ? (100 - (stages[1].value / stages[0].value) * 100).toFixed(1) 
                : '0.0'}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Total Drop-off</div>
            <div className="text-xs text-muted-foreground mt-1">SQLs → Opportunities</div>
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
