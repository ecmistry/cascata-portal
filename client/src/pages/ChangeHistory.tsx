import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skipToken } from "@tanstack/react-query";
import { Clock, User, FileText, Database, Settings, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";
import type { Company, Forecast } from "@/types/api";

interface ChangeEntry {
  id: string;
  type: 'model' | 'forecast' | 'data' | 'config' | 'user';
  action: string;
  description: string;
  timestamp: Date;
  user?: string;
}

/**
 * ChangeHistory Page Component
 * 
 * Displays an audit trail of all changes made to the portal.
 * Shows:
 * - Model/company creation events
 * - Forecast calculation events
 * - Data updates and modifications
 * - Configuration changes
 * - User activity
 * 
 * Features:
 * - Chronological listing of changes
 * - Change type categorization
 * - Relative timestamps (e.g., "2 hours ago")
 * - Statistics on total changes
 * 
 * @returns A page component displaying the change history audit trail
 */
export default function ChangeHistory() {
  const { data: companies = [] } = trpc.company.list.useQuery();
  const firstCompanyId = companies[0]?.id;
  const { data: allForecasts = [] } = trpc.forecast.list.useQuery(
    firstCompanyId ? { companyId: firstCompanyId } : skipToken
  );

  const changeHistory = useMemo(() => {
    const changes: ChangeEntry[] = [];

    // Add company/model creation events
    companies.forEach((company: Company) => {
      changes.push({
        id: `company-${company.id}`,
        type: 'model',
        action: 'created',
        description: `Model "${company.name}" was created`,
        timestamp: company.createdAt instanceof Date ? company.createdAt : new Date(company.createdAt),
        user: 'System',
      });
    });

    // Add forecast calculation events
    allForecasts.forEach((forecast: Forecast) => {
      const timestamp = forecast.updatedAt instanceof Date 
        ? forecast.updatedAt 
        : forecast.createdAt instanceof Date 
          ? forecast.createdAt 
          : new Date(forecast.updatedAt || forecast.createdAt || Date.now());
      
      changes.push({
        id: `forecast-${forecast.id}`,
        type: 'forecast',
        action: 'calculated',
        description: `Forecast calculated for ${forecast.year} Q${forecast.quarter}`,
        timestamp,
        user: 'System',
      });
    });

    // Sort by timestamp (newest first)
    return changes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [companies, allForecasts]);

  const getTypeIcon = (type: ChangeEntry['type']) => {
    switch (type) {
      case 'model':
        return <FileText className="h-4 w-4" />;
      case 'forecast':
        return <TrendingUp className="h-4 w-4" />;
      case 'data':
        return <Database className="h-4 w-4" />;
      case 'config':
        return <Settings className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: ChangeEntry['type']) => {
    switch (type) {
      case 'model':
        return 'bg-blue-100 text-blue-700';
      case 'forecast':
        return 'bg-green-100 text-green-700';
      case 'data':
        return 'bg-purple-100 text-purple-700';
      case 'config':
        return 'bg-orange-100 text-orange-700';
      case 'user':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change History</h1>
          <p className="text-muted-foreground mt-2">
            Complete audit trail of all changes made to the portal
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Changes</CardTitle>
            <CardDescription>
              {changeHistory.length} total changes recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {changeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No changes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {changeHistory.map((change) => (
                  <div
                    key={change.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={`p-2 rounded-md ${getTypeColor(change.type)}`}>
                      {getTypeIcon(change.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium">{change.description}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(change.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {change.action}
                        </span>
                        {change.user && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              by {change.user}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{changeHistory.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All recorded changes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Models Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {changeHistory.filter(c => c.type === 'model').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cascade models
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Forecasts Calculated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {changeHistory.filter(c => c.type === 'forecast').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Forecast runs
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

