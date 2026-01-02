import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Database, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function BigQueryConfig() {
  const { id } = useParams<{ id: string }>();
  const companyId = parseInt(id || "0");
  const [, setLocation] = useLocation();

  const { data: company } = trpc.company.get.useQuery({ id: companyId });
  const updateConfig = trpc.bigquery.updateConfig.useMutation();
  const testConnection = trpc.bigquery.testConnection.useMutation();
  const syncData = trpc.bigquery.sync.useMutation();

  const [config, setConfig] = useState({
    bigqueryEnabled: company?.bigqueryEnabled || false,
    bigqueryProjectId: company?.bigqueryProjectId || "",
    bigqueryDatasetId: company?.bigqueryDatasetId || "",
    bigqueryCredentials: company?.bigqueryCredentials || "",
    bigquerySqlHistoryTable: company?.bigquerySqlHistoryTable || "",
    bigqueryConversionRatesTable: company?.bigqueryConversionRatesTable || "",
    bigqueryActualsTable: company?.bigqueryActualsTable || "",
  });

  const handleSaveConfig = async () => {
    try {
      await updateConfig.mutateAsync({
        companyId,
        ...config,
      });
      toast.success("BigQuery configuration saved successfully");
    } catch (error: any) {
      toast.error(`Failed to save configuration: ${error.message}`);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync({ companyId });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncData.mutateAsync({ companyId });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-4">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">BigQuery Integration</h1>
          <p className="text-muted-foreground">
            Connect to your BigQuery data warehouse to sync cascade model data
          </p>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>
                Enable or disable BigQuery data synchronization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable BigQuery Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync data from your BigQuery warehouse
                  </p>
                </div>
                <Switch
                  checked={config.bigqueryEnabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, bigqueryEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Connection Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Settings</CardTitle>
              <CardDescription>
                Configure your BigQuery project and dataset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID</Label>
                <Input
                  id="projectId"
                  placeholder="my-gcp-project"
                  value={config.bigqueryProjectId}
                  onChange={(e) =>
                    setConfig({ ...config, bigqueryProjectId: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Your Google Cloud Platform project ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="datasetId">Dataset ID</Label>
                <Input
                  id="datasetId"
                  placeholder="cascade_data"
                  value={config.bigqueryDatasetId}
                  onChange={(e) =>
                    setConfig({ ...config, bigqueryDatasetId: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  The BigQuery dataset containing your cascade data
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentials">Service Account Credentials (JSON)</Label>
                <Textarea
                  id="credentials"
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  value={config.bigqueryCredentials}
                  onChange={(e) =>
                    setConfig({ ...config, bigqueryCredentials: e.target.value })
                  }
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Paste the JSON key file content from your GCP service account
                </p>
              </div>

              <Button onClick={handleTestConnection} disabled={testConnection.isPending}>
                {testConnection.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Table Mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Table Mapping</CardTitle>
              <CardDescription>
                Map your BigQuery tables to cascade model data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sqlHistoryTable">SQL History Table</Label>
                <Input
                  id="sqlHistoryTable"
                  placeholder="sql_history"
                  value={config.bigquerySqlHistoryTable}
                  onChange={(e) =>
                    setConfig({ ...config, bigquerySqlHistoryTable: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Table with columns: region, sql_type, year, quarter, volume
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversionRatesTable">Conversion Rates Table</Label>
                <Input
                  id="conversionRatesTable"
                  placeholder="conversion_rates"
                  value={config.bigqueryConversionRatesTable}
                  onChange={(e) =>
                    setConfig({ ...config, bigqueryConversionRatesTable: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Table with columns: region, sql_type, opp_coverage_ratio, win_rate_new, win_rate_upsell
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actualsTable">Actuals Table</Label>
                <Input
                  id="actualsTable"
                  placeholder="actuals"
                  value={config.bigqueryActualsTable}
                  onChange={(e) =>
                    setConfig({ ...config, bigqueryActualsTable: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Table with columns: year, quarter, region, sql_type, actual_revenue
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sync Status */}
          {company?.bigqueryLastSync && (
            <Card>
              <CardHeader>
                <CardTitle>Last Sync</CardTitle>
                <CardDescription>
                  Most recent data synchronization from BigQuery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>
                    {new Date(company.bigqueryLastSync).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={handleSaveConfig} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? "Saving..." : "Save Configuration"}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncData.isPending || !config.bigqueryEnabled}
            >
              {syncData.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>

          {/* Documentation */}
          <Card>
            <CardHeader>
              <CardTitle>BigQuery Schema Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">SQL History Table</h4>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
{`CREATE TABLE sql_history (
  region STRING,        -- e.g., "North America", "EMESA North"
  sql_type STRING,      -- e.g., "Inbound", "Outbound", "ILO"
  year INT64,           -- e.g., 2024
  quarter INT64,        -- 1, 2, 3, or 4
  volume INT64          -- Number of SQLs
);`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Conversion Rates Table</h4>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
{`CREATE TABLE conversion_rates (
  region STRING,
  sql_type STRING,
  opp_coverage_ratio FLOAT64,  -- e.g., 0.058 for 5.8%
  win_rate_new FLOAT64,         -- e.g., 0.28 for 28%
  win_rate_upsell FLOAT64       -- e.g., 0.35 for 35%
);`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Actuals Table</h4>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
{`CREATE TABLE actuals (
  year INT64,
  quarter INT64,
  region STRING,
  sql_type STRING,
  actual_revenue FLOAT64  -- Revenue in dollars
);`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
