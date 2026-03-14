import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Columns, Save, Check } from "lucide-react";
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

export default function CascataTest() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: companies = [] } = trpc.company.list.useQuery();
  const companyId = companies[0]?.id ?? 1;

  const { data: contactsData, isLoading: contactsLoading } = trpc.dashboard.playground.cascataTest.useQuery({ page: 1, pageSize: 25 });
  const { data: dealsData, isLoading: dealsLoading } = trpc.dashboard.playground.cascataTestDeals.useQuery({ page: 1, pageSize: 25 });
  const { data: savedConfig, isLoading: configLoading } = trpc.cascade.getSyncConfig.useQuery({ companyId });

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
    }
  }, [savedConfig]);

  const contactColumns = useMemo(() => {
    if (!contactsData?.data?.length) return [];
    const cols = new Set<string>();
    contactsData.data.forEach(row => Object.keys(row).forEach(k => cols.add(k)));
    return Array.from(cols).sort();
  }, [contactsData]);

  const dealColumns = useMemo(() => {
    if (!dealsData?.data?.length) return [];
    const cols = new Set<string>();
    dealsData.data.forEach(row => Object.keys(row).forEach(k => cols.add(k)));
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
      </div>
    </DashboardLayout>
  );
}
