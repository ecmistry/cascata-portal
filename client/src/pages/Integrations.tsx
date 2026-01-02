import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, ExternalLink, Home } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Integrations() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [hubspotApiKey, setHubspotApiKey] = useState("");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authentication disabled for localhost development

  const handleSaveHubSpot = () => {
    if (!hubspotApiKey.trim()) {
      toast.error("Please enter a HubSpot API key");
      return;
    }
    
    // In production, this would save to database
    toast.success("HubSpot integration configured (demo mode)");
    setHubspotApiKey("");
  };

  const handleSyncData = () => {
    toast.info("Syncing data from HubSpot... (demo mode)");
    // In production, this would trigger actual API calls
    setTimeout(() => {
      toast.success("Successfully synced 150 SQLs from HubSpot");
    }, 2000);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-4 max-w-4xl">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect external data sources to automate your cascade model
          </p>
        </div>

        <div className="space-y-6">
          {/* HubSpot Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0-.21-3.35 2.202 2.202 0 0 0-3.352.21 2.198 2.198 0 0 0 .21 3.35c.288.23.618.38.968.44v2.21a4.25 4.25 0 0 0-2.654 1.25l-6.772-4.155a2.88 2.88 0 1 0-.83 1.354l6.769 4.153a4.244 4.244 0 1 0 6.871-1.604zM12.392 12a1.812 1.812 0 1 1 3.625 0 1.812 1.812 0 0 1-3.625 0z"/>
                    </svg>
                    HubSpot CRM
                  </CardTitle>
                  <CardDescription>
                    Automatically pull SQL data, contacts, and deal information
                  </CardDescription>
                </div>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hubspot-key">HubSpot Private App Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="hubspot-key"
                    type="password"
                    value={hubspotApiKey}
                    onChange={(e) => setHubspotApiKey(e.target.value)}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="flex-1"
                  />
                  <Button onClick={handleSaveHubSpot}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create a private app in HubSpot with <code>crm.objects.contacts.read</code> and <code>crm.objects.deals.read</code> scopes.{" "}
                  <a
                    href="https://developers.hubspot.com/docs/api/private-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Learn more
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Data Sync Features</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Automatically import SQL volumes by quarter</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Calculate conversion rates from historical deal data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Suggest average ACVs based on closed-won deals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Track actual vs predicted performance automatically</span>
                  </li>
                </ul>
              </div>

              <Button onClick={handleSyncData} variant="outline" className="w-full gap-2" disabled>
                <RefreshCw className="h-4 w-4" />
                Sync Data from HubSpot
              </Button>
            </CardContent>
          </Card>

          {/* Salesforce Integration (Coming Soon) */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10.006 5.413a4.142 4.142 0 0 0-3.5 6.226 3.992 3.992 0 0 0-2.077 3.508 4.002 4.002 0 0 0 4 4.001c.283.001.564-.03.84-.093a3.4 3.4 0 0 0 6.33-.969 3.633 3.633 0 0 0 3.186-3.613 3.627 3.627 0 0 0-2.094-3.3 3.995 3.995 0 0 0-.673-5.948 3.992 3.992 0 0 0-5.49.097 4.127 4.127 0 0 0-.522.091z"/>
                    </svg>
                    Salesforce CRM
                  </CardTitle>
                  <CardDescription>
                    Connect Salesforce for enterprise-grade data sync
                  </CardDescription>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Salesforce integration will be available in a future release. Contact support to request early access.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </DashboardLayout>
  );
}
