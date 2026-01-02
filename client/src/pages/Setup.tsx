import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Check, Sparkles, Home } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";

const STEPS = [
  { id: 1, name: "Company Info", description: "Basic information about your company" },
  { id: 2, name: "Regions & SQL Types", description: "Select your territories and lead types" },
  { id: 3, name: "Historical Data", description: "Enter past SQL volumes" },
  { id: 4, name: "Conversion Rates", description: "Set conversion and win rates" },
  { id: 5, name: "Deal Economics", description: "Configure average contract values" },
  { id: 6, name: "Review & Create", description: "Review and generate your cascade model" },
];

const DEFAULT_REGIONS = [
  { name: "NORAM", displayName: "North America" },
  { name: "EMESA_NORTH", displayName: "EMESA North" },
  { name: "EMESA_SOUTH", displayName: "EMESA South" },
];

const DEFAULT_SQL_TYPES = [
  { name: "INBOUND", displayName: "Inbound" },
  { name: "OUTBOUND", displayName: "Outbound" },
  { name: "ILO", displayName: "ILO (Inside Lead Owned)" },
  { name: "EVENT", displayName: "Event" },
  { name: "PARTNER", displayName: "Partner" },
];

// Demo data templates
const DEMO_TEMPLATES = {
  saas: {
    name: "SaaS Company Demo",
    description: "Typical SaaS company with inbound-heavy lead generation",
    sqlVolumes: {
      "2024-Q4": { NORAM: { INBOUND: 150, OUTBOUND: 80, ILO: 40 }, EMESA_NORTH: { INBOUND: 100, OUTBOUND: 60 }, EMESA_SOUTH: { INBOUND: 50, OUTBOUND: 30 } },
      "2025-Q1": { NORAM: { INBOUND: 180, OUTBOUND: 90, ILO: 50 }, EMESA_NORTH: { INBOUND: 120, OUTBOUND: 70 }, EMESA_SOUTH: { INBOUND: 60, OUTBOUND: 35 } },
      "2025-Q2": { NORAM: { INBOUND: 200, OUTBOUND: 100, ILO: 60 }, EMESA_NORTH: { INBOUND: 140, OUTBOUND: 80 }, EMESA_SOUTH: { INBOUND: 70, OUTBOUND: 40 } },
    },
    conversionRates: {
      NORAM: { INBOUND: 8.5, OUTBOUND: 5.2, ILO: 6.8, winRate: 28 },
      EMESA_NORTH: { INBOUND: 7.2, OUTBOUND: 4.5, ILO: 5.5, winRate: 25 },
      EMESA_SOUTH: { INBOUND: 6.0, OUTBOUND: 3.8, ILO: 4.2, winRate: 22 },
    },
    dealEconomics: {
      NORAM: { newBusinessACV: 50000, upsellACV: 25000 },
      EMESA_NORTH: { newBusinessACV: 45000, upsellACV: 22000 },
      EMESA_SOUTH: { newBusinessACV: 35000, upsellACV: 18000 },
    },
  },
  enterprise: {
    name: "Enterprise Sales Demo",
    description: "Enterprise-focused with longer sales cycles and higher ACVs",
    sqlVolumes: {
      "2024-Q4": { NORAM: { OUTBOUND: 120, PARTNER: 40, EVENT: 30 }, EMESA_NORTH: { OUTBOUND: 80, PARTNER: 25 }, EMESA_SOUTH: { OUTBOUND: 50, PARTNER: 15 } },
      "2025-Q1": { NORAM: { OUTBOUND: 140, PARTNER: 50, EVENT: 35 }, EMESA_NORTH: { OUTBOUND: 95, PARTNER: 30 }, EMESA_SOUTH: { OUTBOUND: 60, PARTNER: 18 } },
      "2025-Q2": { NORAM: { OUTBOUND: 160, PARTNER: 60, EVENT: 40 }, EMESA_NORTH: { OUTBOUND: 110, PARTNER: 35 }, EMESA_SOUTH: { OUTBOUND: 70, PARTNER: 22 } },
    },
    conversionRates: {
      NORAM: { OUTBOUND: 12.5, PARTNER: 15.0, EVENT: 18.0, winRate: 35 },
      EMESA_NORTH: { OUTBOUND: 10.8, PARTNER: 13.5, EVENT: 16.0, winRate: 32 },
      EMESA_SOUTH: { OUTBOUND: 9.2, PARTNER: 11.0, EVENT: 14.0, winRate: 28 },
    },
    dealEconomics: {
      NORAM: { newBusinessACV: 150000, upsellACV: 75000 },
      EMESA_NORTH: { newBusinessACV: 130000, upsellACV: 65000 },
      EMESA_SOUTH: { newBusinessACV: 100000, upsellACV: 50000 },
    },
  },
};

export default function Setup() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  // Step 2: Regions & SQL Types
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["NORAM", "EMESA_NORTH"]);
  const [selectedSqlTypes, setSelectedSqlTypes] = useState<string[]>(["INBOUND", "OUTBOUND", "ILO"]);

  // Step 3: Historical Data (simplified - 3 quarters)
  const [sqlVolumes, setSqlVolumes] = useState<Record<string, Record<string, Record<string, number>>>>({
    "2024-Q4": {},
    "2025-Q1": {},
    "2025-Q2": {},
  });

  // Step 4: Conversion Rates (by region and SQL type)
  const [conversionRates, setConversionRates] = useState<Record<string, Record<string, number>>>({});
  const [winRates, setWinRates] = useState<Record<string, number>>({});

  // Step 5: Deal Economics
  const [dealEconomics, setDealEconomics] = useState<Record<string, { newBusinessACV: number; upsellACV: number }>>({});

  // Mutations
  const createCompanyMutation = trpc.company.create.useMutation();
  const createRegionMutation = trpc.region.create.useMutation();
  const createSqlTypeMutation = trpc.sqlType.create.useMutation();
  const createSqlHistoryMutation = trpc.sqlHistory.upsert.useMutation();
  const createConversionRateMutation = trpc.conversionRate.upsert.useMutation();
  const createDealEconomicsMutation = trpc.dealEconomics.upsert.useMutation();
  const createTimeDistributionMutation = trpc.timeDistribution.upsert.useMutation();
  const calculateForecastMutation = trpc.forecast.calculate.useMutation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Require authentication
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const fillDemoData = (template: keyof typeof DEMO_TEMPLATES) => {
    const data = DEMO_TEMPLATES[template];
    setCompanyName(data.name);
    setCompanyDescription(data.description);
    setSqlVolumes(data.sqlVolumes);
    setConversionRates(data.conversionRates);
    setWinRates(Object.fromEntries(Object.entries(data.conversionRates).map(([region, rates]) => [region, rates.winRate])));
    setDealEconomics(data.dealEconomics);
    toast.success(`Filled with ${data.name} template data`);
  };

  const handleNext = () => {
    // Validation
    if (currentStep === 1 && !companyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }
    if (currentStep === 2 && (selectedRegions.length === 0 || selectedSqlTypes.length === 0)) {
      toast.error("Please select at least one region and one SQL type");
      return;
    }
    
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      toast.info("Creating cascade model...");

      // 1. Create company
      const companyResult = await createCompanyMutation.mutateAsync({
        name: companyName,
        description: companyDescription,
      });
      const companyId = companyResult.id;

      // 2. Create regions
      const regionIds: Record<string, number> = {};
      for (const regionName of selectedRegions) {
        const region = DEFAULT_REGIONS.find(r => r.name === regionName);
        if (region) {
          const result = await createRegionMutation.mutateAsync({
            companyId,
            name: region.name,
            displayName: region.displayName,
          });
          regionIds[region.name] = result.id;
        }
      }

      // 3. Create SQL types
      const sqlTypeIds: Record<string, number> = {};
      for (const sqlTypeName of selectedSqlTypes) {
        const sqlType = DEFAULT_SQL_TYPES.find(st => st.name === sqlTypeName);
        if (sqlType) {
          const result = await createSqlTypeMutation.mutateAsync({
            companyId,
            name: sqlType.name,
            displayName: sqlType.displayName,
          });
          sqlTypeIds[sqlType.name] = result.id;
        }
      }

      // 4. Create SQL history
      for (const [quarter, regions] of Object.entries(sqlVolumes)) {
        for (const [regionName, sqlTypes] of Object.entries(regions)) {
          // Skip if region wasn't created (not in selectedRegions)
          if (!regionIds[regionName]) {
            console.warn(`Skipping SQL history for unselected region: ${regionName}`);
            continue;
          }
          for (const [sqlTypeName, volume] of Object.entries(sqlTypes)) {
            // Skip if SQL type wasn't created (not in selectedSqlTypes)
            if (!sqlTypeIds[sqlTypeName]) {
              console.warn(`Skipping SQL history for unselected SQL type: ${sqlTypeName}`);
              continue;
            }
            if (volume > 0) {
              const [year, q] = quarter.split('-Q');
              await createSqlHistoryMutation.mutateAsync({
                companyId,
                regionId: regionIds[regionName],
                sqlTypeId: sqlTypeIds[sqlTypeName],
                year: parseInt(year),
                quarter: parseInt(q),
                volume,
              });
            }
          }
        }
      }

      // 5. Create conversion rates
      for (const [regionName, rates] of Object.entries(conversionRates)) {
        // Skip if region wasn't created (not in selectedRegions)
        if (!regionIds[regionName]) {
          console.warn(`Skipping conversion rates for unselected region: ${regionName}`);
          continue;
        }
        for (const [sqlTypeName, coverageRatio] of Object.entries(rates)) {
          // Skip if SQL type wasn't created (not in selectedSqlTypes)
          if (!sqlTypeIds[sqlTypeName]) {
            console.warn(`Skipping conversion rates for unselected SQL type: ${sqlTypeName}`);
            continue;
          }
          if (sqlTypeName !== 'winRate' && coverageRatio > 0) {
            await createConversionRateMutation.mutateAsync({
              companyId,
              regionId: regionIds[regionName],
              sqlTypeId: sqlTypeIds[sqlTypeName],
              oppCoverageRatio: Math.round(coverageRatio * 100), // Convert to basis points
              winRateNew: Math.round((winRates[regionName] || 25) * 100), // Convert to basis points
              winRateUpsell: Math.round((winRates[regionName] || 25) * 100), // Convert to basis points
            });
          }
        }
      }

      // 6. Create deal economics
      for (const [regionName, economics] of Object.entries(dealEconomics)) {
        // Skip if region wasn't created (not in selectedRegions)
        if (!regionIds[regionName]) {
          console.warn(`Skipping deal economics for unselected region: ${regionName}`);
          continue;
        }
        if (economics.newBusinessACV > 0) {
          await createDealEconomicsMutation.mutateAsync({
            companyId,
            regionId: regionIds[regionName],
            acvNew: Math.round(economics.newBusinessACV * 100), // Convert to cents
            acvUpsell: Math.round(economics.upsellACV * 100), // Convert to cents
          });
        }
      }

      // 7. Create default time distributions (89/10/1%)
      for (const sqlTypeName of selectedSqlTypes) {
        await createTimeDistributionMutation.mutateAsync({
          companyId,
          sqlTypeId: sqlTypeIds[sqlTypeName],
          sameQuarterPct: 8900, // 89%
          nextQuarterPct: 1000, // 10%
          twoQuarterPct: 100, // 1%
        });
      }

      // 8. Calculate forecasts
      toast.info("Calculating forecasts...");
      await calculateForecastMutation.mutateAsync({ companyId });

      toast.success("Cascade model created successfully!");
      setLocation(`/model/${companyId}`);
    } catch (error) {
      toast.error("Failed to create model. Please try again.");
      console.error(error);
    }
  };

  const toggleRegion = (regionName: string) => {
    setSelectedRegions(prev =>
      prev.includes(regionName)
        ? prev.filter(r => r !== regionName)
        : [...prev, regionName]
    );
  };

  const toggleSqlType = (sqlTypeName: string) => {
    setSelectedSqlTypes(prev =>
      prev.includes(sqlTypeName)
        ? prev.filter(st => st !== sqlTypeName)
        : [...prev, sqlTypeName]
    );
  };

  const updateSqlVolume = (quarter: string, region: string, sqlType: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setSqlVolumes(prev => ({
      ...prev,
      [quarter]: {
        ...prev[quarter],
        [region]: {
          ...(prev[quarter]?.[region] || {}),
          [sqlType]: numValue,
        },
      },
    }));
  };

  const updateConversionRate = (region: string, sqlType: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setConversionRates(prev => ({
      ...prev,
      [region]: {
        ...(prev[region] || {}),
        [sqlType]: numValue,
      },
    }));
  };

  const updateWinRate = (region: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWinRates(prev => ({
      ...prev,
      [region]: numValue,
    }));
  };

  const updateDealEconomics = (region: string, field: 'newBusinessACV' | 'upsellACV', value: string) => {
    const numValue = parseInt(value) || 0;
    setDealEconomics(prev => ({
      ...prev,
      [region]: {
        ...(prev[region] || { newBusinessACV: 0, upsellACV: 0 }),
        [field]: numValue,
      },
    }));
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fillDemoData('saas')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Fill SaaS Demo
            </Button>
            <Button variant="outline" size="sm" onClick={() => fillDemoData('enterprise')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Fill Enterprise Demo
            </Button>
          </div>
          </div>
        </header>

      {/* Progress Steps */}
      <div className="border-b bg-muted/30">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep > step.id
                        ? "bg-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <div className="mt-2 text-xs font-medium text-center hidden sm:block">
                    {step.name}
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-12 mx-2 ${
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
              <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Company Info */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      placeholder="e.g., Acme Corporation"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyDescription">Description (Optional)</Label>
                    <Textarea
                      id="companyDescription"
                      placeholder="Brief description of your cascade model..."
                      value={companyDescription}
                      onChange={(e) => setCompanyDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Regions & SQL Types */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Geographic Regions</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the regions where you operate
                    </p>
                    {DEFAULT_REGIONS.map((region) => (
                      <div key={region.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={region.name}
                          checked={selectedRegions.includes(region.name)}
                          onCheckedChange={() => toggleRegion(region.name)}
                        />
                        <label
                          htmlFor={region.name}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {region.displayName}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold">SQL Types</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the types of Sales Qualified Leads you track
                    </p>
                    {DEFAULT_SQL_TYPES.map((sqlType) => (
                      <div key={sqlType.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={sqlType.name}
                          checked={selectedSqlTypes.includes(sqlType.name)}
                          onCheckedChange={() => toggleSqlType(sqlType.name)}
                        />
                        <label
                          htmlFor={sqlType.name}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {sqlType.displayName}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Historical SQL Volumes */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter historical SQL volumes for the last 3 quarters. This data will be used to generate forecasts.
                  </p>
                  {Object.keys(sqlVolumes).map((quarter) => (
                    <div key={quarter} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold">{quarter}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedRegions.map((region) => (
                          <div key={region} className="space-y-2">
                            <Label className="text-xs font-semibold">{DEFAULT_REGIONS.find(r => r.name === region)?.displayName}</Label>
                            {selectedSqlTypes.map((sqlType) => (
                              <div key={sqlType} className="flex items-center gap-2">
                                <Label className="text-xs w-20">{DEFAULT_SQL_TYPES.find(st => st.name === sqlType)?.displayName}</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={sqlVolumes[quarter]?.[region]?.[sqlType] || ''}
                                  onChange={(e) => updateSqlVolume(quarter, region, sqlType, e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: Conversion Rates */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Set conversion rates (SQL → Opportunity) and win rates (Opportunity → Revenue) for each region and SQL type.
                  </p>
                  {selectedRegions.map((region) => (
                    <div key={region} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold">{DEFAULT_REGIONS.find(r => r.name === region)?.displayName}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedSqlTypes.map((sqlType) => (
                          <div key={sqlType} className="flex items-center gap-2">
                            <Label className="text-sm w-24">{DEFAULT_SQL_TYPES.find(st => st.name === sqlType)?.displayName}</Label>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="5.0"
                              value={conversionRates[region]?.[sqlType] || ''}
                              onChange={(e) => updateConversionRate(region, sqlType, e.target.value)}
                              className="h-9"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 col-span-full">
                          <Label className="text-sm w-24 font-semibold">Win Rate</Label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="25.0"
                            value={winRates[region] || ''}
                            onChange={(e) => updateWinRate(region, e.target.value)}
                            className="h-9"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 5: Deal Economics */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter average contract values (ACVs) for new business and upsells in each region.
                  </p>
                  {selectedRegions.map((region) => (
                    <div key={region} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold">{DEFAULT_REGIONS.find(r => r.name === region)?.displayName}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${region}-new`}>New Business ACV</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              id={`${region}-new`}
                              type="number"
                              placeholder="50000"
                              value={dealEconomics[region]?.newBusinessACV || ''}
                              onChange={(e) => updateDealEconomics(region, 'newBusinessACV', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${region}-upsell`}>Upsell ACV</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              id={`${region}-upsell`}
                              type="number"
                              placeholder="25000"
                              value={dealEconomics[region]?.upsellACV || ''}
                              onChange={(e) => updateDealEconomics(region, 'upsellACV', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 6: Review */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="rounded-lg bg-muted p-4 space-y-3">
                    <h4 className="font-semibold">Company Information</h4>
                    <p className="text-sm"><strong>Name:</strong> {companyName}</p>
                    {companyDescription && <p className="text-sm"><strong>Description:</strong> {companyDescription}</p>}
                  </div>
                  <div className="rounded-lg bg-muted p-4 space-y-3">
                    <h4 className="font-semibold">Configuration</h4>
                    <p className="text-sm"><strong>Regions:</strong> {selectedRegions.map(r => DEFAULT_REGIONS.find(reg => reg.name === r)?.displayName).join(', ')}</p>
                    <p className="text-sm"><strong>SQL Types:</strong> {selectedSqlTypes.map(st => DEFAULT_SQL_TYPES.find(type => type.name === st)?.displayName).join(', ')}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 space-y-3">
                    <h4 className="font-semibold">Data Summary</h4>
                    <p className="text-sm"><strong>Historical Quarters:</strong> {Object.keys(sqlVolumes).length}</p>
                    <p className="text-sm"><strong>Total SQL Volume:</strong> {Object.values(sqlVolumes).reduce((total, quarter) => 
                      total + Object.values(quarter).reduce((qTotal, region) => 
                        qTotal + Object.values(region).reduce((rTotal, vol) => rTotal + vol, 0), 0), 0)}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 border-2 border-primary p-4">
                    <p className="text-sm font-medium">
                      Ready to create your cascade model! Click "Create Model" to generate forecasts and visualizations.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                {currentStep < STEPS.length ? (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={createCompanyMutation.isPending}
                  >
                    {createCompanyMutation.isPending ? "Creating..." : "Create Model"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </DashboardLayout>
  );
}
