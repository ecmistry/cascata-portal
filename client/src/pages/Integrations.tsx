import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, Eye, EyeOff, Trash2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Integrations() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [hubspotApiKey, setHubspotApiKey] = useState("");
  const [showToken, setShowToken] = useState(false);

  const { data: companies = [] } = trpc.company.list.useQuery(undefined, { enabled: isAuthenticated });
  const companyId = companies[0]?.id;
  const company = companies[0];
  const hasToken = !!(company as any)?.hubspotToken;

  const utils = trpc.useUtils();
  const saveMutation = trpc.company.saveHubspotToken.useMutation({
    onSuccess: () => {
      toast.success("HubSpot token saved successfully");
      setHubspotApiKey("");
      utils.company.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.company.removeHubspotToken.useMutation({
    onSuccess: () => {
      toast.success("HubSpot token removed");
      utils.company.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncMutation = trpc.cascade.triggerSync.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync complete — ${data.contactsFetched} contacts, ${data.dealsFetched} deals in ${(data.durationMs / 1000).toFixed(1)}s`);
      utils.invalidate();
    },
    onError: (err) => toast.error(`Sync failed: ${err.message}`),
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const handleSave = () => {
    if (!hubspotApiKey.trim()) { toast.error("Please enter a HubSpot Private App token"); return; }
    if (!companyId) { toast.error("No company found — please complete setup first"); return; }
    saveMutation.mutate({ companyId, token: hubspotApiKey.trim() });
  };

  const handleRemove = () => {
    if (!companyId) return;
    if (!confirm("Remove the saved HubSpot token? This will disable data sync until a new token is provided.")) return;
    removeMutation.mutate({ companyId });
  };

  const handleSync = () => {
    if (!companyId) return;
    toast.info("Syncing data from HubSpot...");
    syncMutation.mutate({ companyId });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="container py-6 max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-muted-foreground mt-1 text-sm">Connect your CRM to power the cascade model with live data.</p>
          </div>

          <div className="space-y-6">
            {/* HubSpot Integration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.164 7.93V5.084a2.198 2.198 0 0 0-.21-3.35 2.202 2.202 0 0 0-3.352.21 2.198 2.198 0 0 0 .21 3.35c.288.23.618.38.968.44v2.21a4.25 4.25 0 0 0-2.654 1.25l-6.772-4.155a2.88 2.88 0 1 0-.83 1.354l6.769 4.153a4.244 4.244 0 1 0 6.871-1.604zM12.392 12a1.812 1.812 0 1 1 3.625 0 1.812 1.812 0 0 1-3.625 0z"/></svg>
                      HubSpot CRM
                    </CardTitle>
                    <CardDescription>Pull contacts, deals, and company data automatically</CardDescription>
                  </div>
                  <Badge variant={hasToken ? "default" : "outline"} className={`gap-1 ${hasToken ? "bg-green-100 text-green-800 border-green-300" : ""}`}>
                    {hasToken ? <><CheckCircle2 className="h-3 w-3" /> Connected</> : <><XCircle className="h-3 w-3" /> Not Connected</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {hasToken ? (
                  <div className="rounded-lg border bg-green-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">Token saved securely</p>
                        <p className="text-xs text-green-600 mt-0.5">Your HubSpot Private App token is configured and ready for sync.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRemove} disabled={removeMutation.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="hubspot-key">HubSpot Private App Access Token</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="hubspot-key"
                          type={showToken ? "text" : "password"}
                          value={hubspotApiKey}
                          onChange={(e) => setHubspotApiKey(e.target.value)}
                          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button onClick={handleSave} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Create a private app in HubSpot with <code className="bg-muted px-1 rounded">crm.objects.contacts.read</code>, <code className="bg-muted px-1 rounded">crm.objects.deals.read</code>, and <code className="bg-muted px-1 rounded">crm.objects.companies.read</code> scopes.{" "}
                      <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Learn more <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-3">What gets synced</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      "SQL volumes by quarter, motion, and region",
                      "Conversion rates from historical contacts",
                      "Win rates and average ACVs from closed-won deals",
                      "Timing distributions (SQL→Opp and Opp→Won)",
                      "Upsell and churn data from deal types",
                      "Company/customer data for attach rates",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSync} variant="outline" className="w-full gap-2" disabled={!hasToken || syncMutation.isPending}>
                  <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing..." : "Sync Data from HubSpot"}
                </Button>

                {hasToken && (
                  <div className="text-center">
                    <Button variant="link" size="sm" onClick={() => setLocation("/configure-cascata")} className="text-xs gap-1">
                      Configure HubSpot Property Mapping <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Salesforce Coming Soon */}
            <Card className="opacity-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10.006 5.413a4.142 4.142 0 0 0-3.5 6.226 3.992 3.992 0 0 0-2.077 3.508 4.002 4.002 0 0 0 4 4.001c.283.001.564-.03.84-.093a3.4 3.4 0 0 0 6.33-.969 3.633 3.633 0 0 0 3.186-3.613 3.627 3.627 0 0 0-2.094-3.3 3.995 3.995 0 0 0-.673-5.948 3.992 3.992 0 0 0-5.49.097 4.127 4.127 0 0 0-.522.091z"/></svg>
                      Salesforce CRM
                    </CardTitle>
                    <CardDescription>Connect Salesforce for enterprise-grade data sync</CardDescription>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Salesforce integration will be available in a future release.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
