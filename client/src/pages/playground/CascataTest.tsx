import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Columns, Save, Check, AlertTriangle, MapPin, Tag } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";

interface ColumnPickerProps {
  label: string;
  columns: string[];
  value: string;
  onChange: (v: string) => void;
  isLoading?: boolean;
}

function ColumnPicker({ label, columns, value, onChange, isLoading }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return columns;
    const s = search.toLowerCase();
    return columns.filter(c => c.toLowerCase().includes(s));
  }, [columns, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs">
          <Columns className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span className="truncate">{value || "Select..."}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3">
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            <RadioGroup value={value} onValueChange={(v) => { onChange(v); setOpen(false); }}>
              {filtered.length > 0 ? filtered.map((col) => (
                <div key={col} className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent cursor-pointer">
                  <RadioGroupItem value={col} id={`${label}-${col}`} />
                  <label htmlFor={`${label}-${col}`} className="text-xs cursor-pointer flex-1 font-mono">{col}</label>
                </div>
              )) : (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  {isLoading ? "Loading..." : "No properties found"}
                </div>
              )}
            </RadioGroup>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface TagInputProps {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}

function TagInput({ values, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const v = input.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
      setInput("");
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        {values.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs gap-1">
            {tag}
            <button
              onClick={() => onChange(values.filter(v => v !== tag))}
              className="ml-0.5 hover:text-destructive"
            >
              &times;
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
        />
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addTag}>Add</Button>
      </div>
    </div>
  );
}

interface AliasEditorProps {
  aliases: Record<string, string>;
  onChange: (aliases: Record<string, string>) => void;
  fromLabel: string;
  toLabel: string;
  toOptions: string[];
}

function AliasEditor({ aliases, onChange, fromLabel, toLabel, toOptions }: AliasEditorProps) {
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");

  const addAlias = () => {
    const from = newFrom.trim().toLowerCase();
    const to = newTo.trim();
    if (from && to) {
      onChange({ ...aliases, [from]: to });
      setNewFrom("");
      setNewTo("");
    }
  };

  return (
    <div className="space-y-2">
      {Object.keys(aliases).length > 0 && (
        <div className="space-y-1">
          {Object.entries(aliases).map(([from, to]) => (
            <div key={from} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
              <span className="font-mono text-amber-700">"{from}"</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="font-semibold text-green-700">{to}</span>
              <button
                onClick={() => {
                  const next = { ...aliases };
                  delete next[from];
                  onChange(next);
                }}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 items-end">
        <div className="flex-1">
          <Label className="text-[10px] text-muted-foreground">{fromLabel}</Label>
          <Input
            value={newFrom}
            onChange={(e) => setNewFrom(e.target.value)}
            placeholder="e.g. apac"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex-1">
          <Label className="text-[10px] text-muted-foreground">{toLabel}</Label>
          {toOptions.length > 0 ? (
            <select
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              className="h-7 w-full text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="">Select...</option>
              {toOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <Input
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              placeholder="e.g. NORAM"
              className="h-7 text-xs"
            />
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addAlias}>Add</Button>
      </div>
    </div>
  );
}

export default function CascataTest() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: companies = [] } = trpc.company.list.useQuery();
  const companyId = companies[0]?.id ?? 1;

  const [, setLocation] = useLocation();
  const { data: contactsData, isLoading: contactsLoading } = trpc.dashboard.playground.cascataTest.useQuery({ page: 1, pageSize: 25 });
  const { data: dealsData, isLoading: dealsLoading } = trpc.dashboard.playground.cascataTestDeals.useQuery({ page: 1, pageSize: 25 });
  const { data: savedConfig, isLoading: configLoading } = trpc.cascade.getSyncConfig.useQuery({ companyId });
  const { data: dqData } = trpc.cascade.dataQuality.useQuery({ companyId });
  const { data: regionsData } = trpc.region.list.useQuery({ companyId });
  const { data: sqlTypesData } = trpc.sqlType.list.useQuery({ companyId });

  const existingRegions = useMemo(() => (regionsData ?? []).map(r => r.name), [regionsData]);
  const existingSqlTypes = useMemo(() => (sqlTypesData ?? []).map(s => s.name), [sqlTypesData]);

  const saveMutation = trpc.cascade.saveSyncConfig.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      utils.cascade.getSyncConfig.invalidate({ companyId });
    },
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Config state
  const [contactSqlDateProperty, setContactSqlDateProperty] = useState("");
  const [contactRegionProperty, setContactRegionProperty] = useState("");
  const [contactSqlTypeProperty, setContactSqlTypeProperty] = useState("");
  const [contactOppDateProperty, setContactOppDateProperty] = useState("");
  const [dealRegionProperty, setDealRegionProperty] = useState("");
  const [dealSqlTypeProperty, setDealSqlTypeProperty] = useState("");
  const [dealAmountProperty, setDealAmountProperty] = useState("");
  const [dealCloseDateProperty, setDealCloseDateProperty] = useState("");
  const [dealCreatedDateProperty, setDealCreatedDateProperty] = useState("");
  const [closedWonStageIds, setClosedWonStageIds] = useState<string[]>([]);
  const [newDealTypeValues, setNewDealTypeValues] = useState<string[]>([]);
  const [upsellDealTypeValues, setUpsellDealTypeValues] = useState<string[]>([]);
  const [regionAliases, setRegionAliases] = useState<Record<string, string>>({});
  const [sqlTypeAliases, setSqlTypeAliases] = useState<Record<string, string>>({});
  const [fallbackRegion, setFallbackRegion] = useState("");
  const [fallbackSqlType, setFallbackSqlType] = useState("");
  const [defaultSqlTimingSameQ, setDefaultSqlTimingSameQ] = useState(8900);
  const [defaultSqlTimingNextQ, setDefaultSqlTimingNextQ] = useState(1000);
  const [defaultSqlTimingTwoQ, setDefaultSqlTimingTwoQ] = useState(100);
  const [defaultOppTiming, setDefaultOppTiming] = useState("14, 33, 25, 15, 7, 4, 2");
  const [defaultConversionRate, setDefaultConversionRate] = useState(5000);
  const [companyCustomerField, setCompanyCustomerField] = useState("");
  const [companyCustomerValues, setCompanyCustomerValues] = useState<string[]>([]);
  const [companyRegionProperty, setCompanyRegionProperty] = useState("");

  // Initialize from saved config
  useEffect(() => {
    if (savedConfig) {
      setContactSqlDateProperty(savedConfig.contactSqlDateProperty);
      setContactRegionProperty(savedConfig.contactRegionProperty);
      setContactSqlTypeProperty(savedConfig.contactSqlTypeProperty);
      setContactOppDateProperty(savedConfig.contactOppDateProperty);
      setDealRegionProperty(savedConfig.dealRegionProperty);
      setDealSqlTypeProperty(savedConfig.dealSqlTypeProperty);
      setDealAmountProperty(savedConfig.dealAmountProperty);
      setDealCloseDateProperty(savedConfig.dealCloseDateProperty);
      setDealCreatedDateProperty(savedConfig.dealCreatedDateProperty ?? "createdate");
      setClosedWonStageIds(savedConfig.closedWonStageIds);
      setNewDealTypeValues(savedConfig.newDealTypeValues);
      setUpsellDealTypeValues(savedConfig.upsellDealTypeValues);
      setRegionAliases(savedConfig.regionAliases ?? {});
      setSqlTypeAliases(savedConfig.sqlTypeAliases ?? {});
      setFallbackRegion(savedConfig.fallbackRegion ?? "");
      setFallbackSqlType(savedConfig.fallbackSqlType ?? "");
      setDefaultSqlTimingSameQ(savedConfig.defaultSqlTimingSameQ ?? 8900);
      setDefaultSqlTimingNextQ(savedConfig.defaultSqlTimingNextQ ?? 1000);
      setDefaultSqlTimingTwoQ(savedConfig.defaultSqlTimingTwoQ ?? 100);
      if (savedConfig.defaultOppTiming) {
        setDefaultOppTiming(savedConfig.defaultOppTiming.map((v: number) => Math.round(v * 100)).join(", "));
      }
      setDefaultConversionRate(savedConfig.defaultConversionRate ?? 5000);
      setCompanyCustomerField(savedConfig.companyCustomerField ?? "");
      setCompanyCustomerValues(savedConfig.companyCustomerValues ?? []);
      setCompanyRegionProperty(savedConfig.companyRegionProperty ?? "");
    }
  }, [savedConfig]);

  const contactColumns = useMemo(() => {
    if (!contactsData?.data?.length) return [];
    const cols = new Set<string>();
    contactsData.data.forEach(row => Object.keys(row).forEach(k => {
      cols.add(k.startsWith("property_") ? k.slice(9) : k);
    }));
    return Array.from(cols).sort();
  }, [contactsData]);

  const dealColumns = useMemo(() => {
    if (!dealsData?.data?.length) return [];
    const cols = new Set<string>();
    dealsData.data.forEach(row => Object.keys(row).forEach(k => {
      cols.add(k.startsWith("property_") ? k.slice(9) : k);
    }));
    return Array.from(cols).sort();
  }, [dealsData]);

  const handleSave = () => {
    setSaveStatus("saving");
    saveMutation.mutate({
      companyId,
      config: {
        contactSqlDateProperty,
        contactRegionProperty,
        contactSqlTypeProperty,
        contactOppDateProperty,
        dealRegionProperty,
        dealSqlTypeProperty,
        dealAmountProperty,
        dealCloseDateProperty,
        dealCreatedDateProperty,
        closedWonStageIds,
        newDealTypeValues,
        upsellDealTypeValues,
        regionAliases: Object.keys(regionAliases).length > 0 ? regionAliases : undefined,
        sqlTypeAliases: Object.keys(sqlTypeAliases).length > 0 ? sqlTypeAliases : undefined,
        fallbackRegion: fallbackRegion || undefined,
        fallbackSqlType: fallbackSqlType || undefined,
        defaultSqlTimingSameQ,
        defaultSqlTimingNextQ,
        defaultSqlTimingTwoQ,
        defaultOppTiming: defaultOppTiming.split(",").map(v => parseFloat(v.trim()) / 100).filter(v => !isNaN(v)),
        defaultConversionRate,
        companyCustomerField: companyCustomerField || undefined,
        companyCustomerValues: companyCustomerValues.length > 0 ? companyCustomerValues : undefined,
        companyRegionProperty: companyRegionProperty || undefined,
      },
    });
  };

  if (configLoading || contactsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configure Cascata Environment</h1>
            <p className="text-sm text-muted-foreground mt-1">Map your HubSpot properties to the Cascata model</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="gap-2 w-full sm:w-auto"
          >
            {saveStatus === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Configuration"}
          </Button>
        </div>

        {/* Contact Properties */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { q: "Which field determines when someone became an SQL?", purpose: "Assigns SQLs to quarters", label: "sqlDate", value: contactSqlDateProperty, onChange: setContactSqlDateProperty },
              { q: "How do you identify contact teams/regions?", purpose: "Groups SQLs by region/pod", label: "contactRegion", value: contactRegionProperty, onChange: setContactRegionProperty },
              { q: "What field tracks the type of SQL?", purpose: "Splits cascade by motion", label: "sqlType", value: contactSqlTypeProperty, onChange: setContactSqlTypeProperty },
              { q: "What date field tracks conversion to opportunity?", purpose: "Calculates SQL→Opp timing", label: "oppDate", value: contactOppDateProperty, onChange: setContactOppDateProperty },
            ] as const).map((item) => (
              <div key={item.label} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{item.q}</p>
                <ColumnPicker
                  label={item.label}
                  columns={contactColumns}
                  value={item.value}
                  onChange={item.onChange}
                  isLoading={contactsLoading}
                />
                <p className="text-xs text-muted-foreground">{item.purpose}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Deal Properties */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deal Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { q: "How do you identify deal teams/regions?", purpose: "Groups deals by region/pod", label: "dealRegion", value: dealRegionProperty, onChange: setDealRegionProperty },
              { q: "Where do you track the SQL type on deals?", purpose: "Links deals back to SQL motion", label: "dealSqlType", value: dealSqlTypeProperty, onChange: setDealSqlTypeProperty },
              { q: "What field captures deal value (ARR/ACV)?", purpose: "Calculates average deal value", label: "dealAmount", value: dealAmountProperty, onChange: setDealAmountProperty },
              { q: "What field tracks the close date?", purpose: "Determines deal timing for actuals", label: "closeDate", value: dealCloseDateProperty, onChange: setDealCloseDateProperty },
              { q: "What field tracks when a deal was created?", purpose: "Determines when a deal entered the pipeline for timing analysis", label: "createdDate", value: dealCreatedDateProperty, onChange: setDealCreatedDateProperty },
            ] as const).map((item) => (
              <div key={item.label} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{item.q}</p>
                <ColumnPicker
                  label={item.label}
                  columns={dealColumns}
                  value={item.value}
                  onChange={item.onChange}
                  isLoading={dealsLoading}
                />
                <p className="text-xs text-muted-foreground">{item.purpose}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Deal Stage & Type Classification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deal Classification</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              These settings control how deals in your HubSpot pipeline are categorised for the cascade model.
              They determine which deals count as revenue, and how win rates and ACV are split between new business and upsell.
              <a href="/how-it-works#deal-classification" className="text-blue-600 hover:underline ml-1">Learn more</a>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 bg-red-50/30">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Closed-Won Stage IDs
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-1">
                The internal HubSpot deal stage values that mean "deal is won." Only deals in these stages are counted as
                actual revenue and used to calculate win rates and ACV.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                <strong>How to find:</strong> In HubSpot go to Settings → Objects → Deals → Pipelines, or check the
                "dealstage" values in your deal data above. Some portals use names like "closedwon", others use numeric pipeline stage IDs.
              </p>
              <TagInput
                values={closedWonStageIds}
                onChange={setClosedWonStageIds}
                placeholder="e.g. closedwon or 19291292"
              />
            </div>

            <div className="rounded-lg border p-4 bg-blue-50/30">
              <Label className="text-sm font-medium">New Business Deal Types</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-1">
                Values from HubSpot's "Deal Type" (dealtype) property that represent new logos / first-time customers.
                Cascata calculates a separate win rate and ACV for new business.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                <strong>Typical values:</strong> "newbusiness", "New Business". If unset, all non-upsell won deals default to new business.
              </p>
              <TagInput
                values={newDealTypeValues}
                onChange={setNewDealTypeValues}
                placeholder="e.g. newbusiness"
              />
            </div>

            <div className="rounded-lg border p-4 bg-green-50/30">
              <Label className="text-sm font-medium">Upsell / Renewal Deal Types</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-1">
                Values from "Deal Type" that represent expansion revenue -- upsells, cross-sells, or renewals within
                existing customers. Gets its own win rate and ACV in the cascade.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                <strong>Typical values:</strong> "existingbusiness", "customerrenewal", "Existing Business", "Renewal"
              </p>
              <TagInput
                values={upsellDealTypeValues}
                onChange={setUpsellDealTypeValues}
                placeholder="e.g. existingbusiness"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Quality & Mapping */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Data Quality Mapping
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Configure how unmapped HubSpot values are handled. Add aliases to map unexpected values to known regions/motions,
              or set a fallback to catch everything else.
              {dqData && dqData.contactsSkipped > 0 && (
                <button
                  onClick={() => setLocation("/data-quality")}
                  className="text-blue-600 hover:underline ml-1"
                >
                  View full data quality report ({dqData.coveragePct.toFixed(0)}% coverage)
                </button>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Unmapped values hint */}
            {dqData?.report && (
              <>
                {Object.keys(dqData.report.unmappedRegionValues ?? {}).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-medium text-amber-800">Unmapped region values found in last sync</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(dqData.report.unmappedRegionValues!).sort(([,a],[,b]) => b - a).map(([val, count]) => (
                        <Badge key={val} variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                          "{val}" ({count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(dqData.report.unmappedSqlTypeValues ?? {}).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-medium text-amber-800">Unmapped SQL type values found in last sync</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(dqData.report.unmappedSqlTypeValues!).sort(([,a],[,b]) => b - a).map(([val, count]) => (
                        <Badge key={val} variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                          "{val}" ({count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="rounded-lg border p-4">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Region Aliases
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Map unexpected region values from HubSpot to known Cascata regions. Keys are case-insensitive.
              </p>
              <AliasEditor
                aliases={regionAliases}
                onChange={setRegionAliases}
                fromLabel="HubSpot value"
                toLabel="Maps to region"
                toOptions={existingRegions}
              />
            </div>

            <div className="rounded-lg border p-4">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> SQL Type Aliases
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Map unexpected SQL type values from HubSpot to known Cascata motions. Keys are case-insensitive.
              </p>
              <AliasEditor
                aliases={sqlTypeAliases}
                onChange={setSqlTypeAliases}
                fromLabel="HubSpot value"
                toLabel="Maps to motion"
                toOptions={existingSqlTypes}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-medium">Fallback Region</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  If a contact/deal has a region value that doesn't match any mapping or alias, assign it to this region instead of skipping it.
                </p>
                {existingRegions.length > 0 ? (
                  <select
                    value={fallbackRegion}
                    onChange={(e) => setFallbackRegion(e.target.value)}
                    className="h-8 w-full text-xs rounded-md border border-input bg-background px-2"
                  >
                    <option value="">None (skip unmapped)</option>
                    {existingRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Input
                    value={fallbackRegion}
                    onChange={(e) => setFallbackRegion(e.target.value)}
                    placeholder="e.g. NORAM"
                    className="h-8 text-xs"
                  />
                )}
              </div>

              <div className="rounded-lg border p-4">
                <Label className="text-sm font-medium">Fallback SQL Type</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  If a contact has a SQL type value that doesn't match any mapping or alias, assign it to this motion instead of skipping it.
                </p>
                {existingSqlTypes.length > 0 ? (
                  <select
                    value={fallbackSqlType}
                    onChange={(e) => setFallbackSqlType(e.target.value)}
                    className="h-8 w-full text-xs rounded-md border border-input bg-background px-2"
                  >
                    <option value="">None (skip unmapped)</option>
                    {existingSqlTypes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <Input
                    value={fallbackSqlType}
                    onChange={(e) => setFallbackSqlType(e.target.value)}
                    placeholder="e.g. INBOUND"
                    className="h-8 text-xs"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Object (Upsell/Customer Tracking) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Object (Upsell &amp; Customer Tracking)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Configure how Cascata identifies current customers from HubSpot Companies.
              This enables the upsell cascade: <strong>attach rate &times; customer count &times; avg upsell ACV</strong>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Which Company property identifies customer status?</p>
              <Input
                value={companyCustomerField}
                onChange={(e) => setCompanyCustomerField(e.target.value)}
                placeholder="e.g. hs_lead_status or customer_status"
                className="h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                The HubSpot Company property name whose value indicates the company is a current customer.
              </p>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">What values mean "is a customer"?</p>
              <TagInput
                values={companyCustomerValues}
                onChange={setCompanyCustomerValues}
                placeholder="e.g. customer or active"
              />
              <p className="text-xs text-muted-foreground">
                Property values that indicate a company is an active customer. The sync will count companies matching any of these values.
              </p>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Which Company property maps to a region?</p>
              <Input
                value={companyRegionProperty}
                onChange={(e) => setCompanyRegionProperty(e.target.value)}
                placeholder="e.g. industry or company_pod"
                className="h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                The HubSpot Company property used to assign companies to regions. Values are matched using the same region alias/mapping rules.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Model Defaults */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Model Defaults</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Fallback values used when there isn't enough historical data to derive timing distributions or conversion rates
              (e.g. fewer than 5 data points for a motion). These are overridden by real data when available.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4">
              <Label className="text-sm font-medium">SQL Timing Distribution (SQL &rarr; Opportunity)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Default probability of an SQL converting to an opportunity in the same quarter, next quarter, or two quarters later.
                Values are in basis points (8900 = 89%). Must sum to 10000.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Same Quarter</Label>
                  <Input
                    type="number"
                    value={defaultSqlTimingSameQ}
                    onChange={(e) => setDefaultSqlTimingSameQ(Number(e.target.value))}
                    className="h-8 text-xs"
                    min={0} max={10000}
                  />
                  <span className="text-[10px] text-muted-foreground">{(defaultSqlTimingSameQ / 100).toFixed(1)}%</span>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Next Quarter</Label>
                  <Input
                    type="number"
                    value={defaultSqlTimingNextQ}
                    onChange={(e) => setDefaultSqlTimingNextQ(Number(e.target.value))}
                    className="h-8 text-xs"
                    min={0} max={10000}
                  />
                  <span className="text-[10px] text-muted-foreground">{(defaultSqlTimingNextQ / 100).toFixed(1)}%</span>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">+2 Quarters</Label>
                  <Input
                    type="number"
                    value={defaultSqlTimingTwoQ}
                    onChange={(e) => setDefaultSqlTimingTwoQ(Number(e.target.value))}
                    className="h-8 text-xs"
                    min={0} max={10000}
                  />
                  <span className="text-[10px] text-muted-foreground">{(defaultSqlTimingTwoQ / 100).toFixed(1)}%</span>
                </div>
              </div>
              {defaultSqlTimingSameQ + defaultSqlTimingNextQ + defaultSqlTimingTwoQ !== 10000 && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Sum is {defaultSqlTimingSameQ + defaultSqlTimingNextQ + defaultSqlTimingTwoQ} bp (should be 10000)
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <Label className="text-sm font-medium">Opp Win Timing Distribution (Opportunity &rarr; Deal Won)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Default probability of an opportunity closing as won in each quarter after creation.
                Enter comma-separated percentages (e.g. "14, 33, 25, 15, 7, 4, 2" means 14% same quarter,
                33% next quarter, etc.). These should sum to approximately 100.
              </p>
              <Input
                value={defaultOppTiming}
                onChange={(e) => setDefaultOppTiming(e.target.value)}
                placeholder="14, 33, 25, 15, 7, 4, 2"
                className="h-8 text-xs"
              />
              {(() => {
                const vals = defaultOppTiming.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                const sum = vals.reduce((s, v) => s + v, 0);
                return (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {vals.length} quarters, sum = {sum.toFixed(1)}%
                    {Math.abs(sum - 100) > 1 && <span className="text-amber-600 ml-1">(should be ~100%)</span>}
                  </p>
                );
              })()}
            </div>

            <div className="rounded-lg border p-4">
              <Label className="text-sm font-medium">Default Conversion Rate (SQL &rarr; Opportunity)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Fallback SQL-to-Opportunity conversion rate used for quarters with no actual data.
                Value in basis points (5000 = 50%).
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={defaultConversionRate}
                  onChange={(e) => setDefaultConversionRate(Number(e.target.value))}
                  className="h-8 text-xs w-32"
                  min={0} max={10000}
                />
                <span className="text-sm text-muted-foreground">{(defaultConversionRate / 100).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
