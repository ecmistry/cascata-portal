import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, TrendingUp, Users, Target, ArrowDownRight } from "lucide-react";

function fmtDollars(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function parseDollars(val: string): number {
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export default function RevenuePlanning() {
  const { isAuthenticated } = useAuth();
  const { data: companies = [] } = trpc.company.list.useQuery(undefined, { enabled: isAuthenticated });
  const companyId = companies[0]?.id ?? 1;

  const { data: regionsList = [] } = trpc.region.list.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );
  const regions = useMemo(() => regionsList.filter((r: any) => r.enabled), [regionsList]);

  const { data: targetsList = [], refetch: refetchTargets } = trpc.revenueTarget.list.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );

  const { data: churnList = [], refetch: refetchChurn } = trpc.churnData.list.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );

  const { data: headcountList = [], refetch: refetchHc } = trpc.headcount.list.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );

  const { data: forecastsList = [] } = trpc.forecast.list.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );

  const bulkTargetsMut = trpc.revenueTarget.bulkUpsert.useMutation({
    onSuccess: () => { toast.success("Targets saved"); refetchTargets(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const bulkChurnMut = trpc.churnData.bulkUpsert.useMutation({
    onSuccess: () => { toast.success("Churn data saved"); refetchChurn(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const bulkHcMut = trpc.headcount.bulkUpsert.useMutation({
    onSuccess: () => { toast.success("Headcount saved"); refetchHc(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  // Determine quarters from forecasts
  const quarters = useMemo(() => {
    const qSet = new Set<string>();
    for (const f of forecastsList) qSet.add(`${f.year}-${f.quarter}`);
    return Array.from(qSet)
      .sort()
      .map(k => {
        const [y, q] = k.split("-").map(Number);
        return { year: y, quarter: q, label: `Q${q} ${y}` };
      });
  }, [forecastsList]);

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Please sign in.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set revenue targets, churn estimates, and headcount by region and quarter.
          </p>
        </div>

        <Tabs defaultValue="targets">
          <TabsList>
            <TabsTrigger value="targets" className="gap-1.5">
              <Target className="h-4 w-4" />
              Targets / Quotas
            </TabsTrigger>
            <TabsTrigger value="churn" className="gap-1.5">
              <ArrowDownRight className="h-4 w-4" />
              Churn & Adjustments
            </TabsTrigger>
            <TabsTrigger value="headcount" className="gap-1.5">
              <Users className="h-4 w-4" />
              Headcount
            </TabsTrigger>
          </TabsList>

          <TabsContent value="targets">
            <TargetsTab
              companyId={companyId}
              regions={regions}
              quarters={quarters}
              existingTargets={targetsList}
              onSave={(targets) => bulkTargetsMut.mutate({ companyId, targets })}
              isSaving={bulkTargetsMut.isPending}
            />
          </TabsContent>

          <TabsContent value="churn">
            <ChurnTab
              companyId={companyId}
              regions={regions}
              quarters={quarters}
              existingChurn={churnList}
              onSave={(entries) => bulkChurnMut.mutate({ companyId, entries })}
              isSaving={bulkChurnMut.isPending}
            />
          </TabsContent>

          <TabsContent value="headcount">
            <HeadcountTab
              companyId={companyId}
              regions={regions}
              quarters={quarters}
              existingHc={headcountList}
              onSave={(entries) => bulkHcMut.mutate({ companyId, entries })}
              isSaving={bulkHcMut.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// Targets Tab
// ============================================================================

interface TargetsTabProps {
  companyId: number;
  regions: any[];
  quarters: { year: number; quarter: number; label: string }[];
  existingTargets: any[];
  onSave: (targets: any[]) => void;
  isSaving: boolean;
}

function TargetsTab({ companyId, regions, quarters, existingTargets, onSave, isSaving }: TargetsTabProps) {
  type CellKey = string;
  const buildKey = (regionId: number, year: number, quarter: number): CellKey =>
    `${regionId}-${year}-${quarter}`;

  const initial = useMemo(() => {
    const map = new Map<CellKey, { sqls: number; opps: number; wins: number; newBiz: number; upsell: number; total: number }>();
    for (const t of existingTargets) {
      map.set(buildKey(t.regionId, t.year, t.quarter), {
        sqls: t.targetSqls ?? 0,
        opps: t.targetOpps ?? 0,
        wins: t.targetWins ?? 0,
        newBiz: t.targetNewBiz,
        upsell: t.targetUpsell,
        total: t.targetTotal,
      });
    }
    return map;
  }, [existingTargets]);

  type TargetVal = { sqls: number; opps: number; wins: number; newBiz: number; upsell: number; total: number };
  const [values, setValues] = useState<Map<CellKey, TargetVal>>(new Map());
  const emptyVal: TargetVal = { sqls: 0, opps: 0, wins: 0, newBiz: 0, upsell: 0, total: 0 };

  const getVal = useCallback((regionId: number, year: number, quarter: number) => {
    const k = buildKey(regionId, year, quarter);
    return values.get(k) ?? initial.get(k) ?? emptyVal;
  }, [values, initial]);

  const setVal = useCallback((regionId: number, year: number, quarter: number, field: keyof TargetVal, val: number) => {
    const k = buildKey(regionId, year, quarter);
    setValues(prev => {
      const next = new Map(prev);
      const cur = next.get(k) ?? initial.get(k) ?? { ...emptyVal };
      const updated = { ...cur, [field]: val };
      if (field === "newBiz" || field === "upsell") {
        updated.total = updated.newBiz + updated.upsell;
      }
      next.set(k, updated);
      return next;
    });
  }, [initial]);

  const handleSave = () => {
    const allKeys = new Set([...initial.keys(), ...values.keys()]);
    const targets: any[] = [];
    for (const k of allKeys) {
      const v = values.get(k) ?? initial.get(k);
      if (!v || (v.newBiz === 0 && v.upsell === 0 && v.total === 0 && v.sqls === 0 && v.opps === 0 && v.wins === 0)) continue;
      const [rid, yr, qt] = k.split("-").map(Number);
      targets.push({
        regionId: rid,
        year: yr,
        quarter: qt,
        targetSqls: v.sqls,
        targetOpps: v.opps,
        targetWins: v.wins,
        targetNewBiz: v.newBiz,
        targetUpsell: v.upsell,
        targetTotal: v.total,
      });
    }
    onSave(targets);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Revenue Targets by Region & Quarter</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1.5" />
          {isSaving ? "Saving..." : "Save Targets"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 w-32 sticky left-0 bg-muted/40 z-10">Region</th>
                <th className="text-left p-2 w-16 sticky left-32 bg-muted/40 z-10">Type</th>
                {quarters.map(q => (
                  <th key={q.label} className="text-center p-2 min-w-[100px] border-l">{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map(region => (
                <>
                  <tr key={`${region.id}-sqls`} className="border-b hover:bg-slate-50/30">
                    <td className="p-2 font-medium sticky left-0 bg-white z-10" rowSpan={6}>
                      {region.displayName || region.name}
                    </td>
                    <td className="p-2 text-xs text-slate-600 sticky left-32 bg-white z-10">SQLs</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-sqls-${q.label}`} className="p-1 border-l">
                          <Input type="number" className="h-7 text-xs text-right w-full" defaultValue={v.sqls > 0 ? v.sqls.toString() : ""} placeholder="0" min={0}
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "sqls", parseInt(e.target.value) || 0)} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-opps`} className="border-b hover:bg-purple-50/30">
                    <td className="p-2 text-xs text-purple-600 sticky left-32 bg-white z-10">Opps</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-opps-${q.label}`} className="p-1 border-l">
                          <Input type="number" className="h-7 text-xs text-right w-full" defaultValue={v.opps > 0 ? v.opps.toString() : ""} placeholder="0" min={0}
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "opps", parseInt(e.target.value) || 0)} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-wins`} className="border-b hover:bg-emerald-50/30">
                    <td className="p-2 text-xs text-emerald-600 sticky left-32 bg-white z-10">Wins</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-wins-${q.label}`} className="p-1 border-l">
                          <Input type="number" className="h-7 text-xs text-right w-full" defaultValue={v.wins > 0 ? v.wins.toString() : ""} placeholder="0" min={0}
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "wins", parseInt(e.target.value) || 0)} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-nb`} className="border-b hover:bg-blue-50/30">
                    <td className="p-2 text-xs text-blue-600 sticky left-32 bg-white z-10">$ New Biz</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-nb-${q.label}`} className="p-1 border-l">
                          <Input className="h-7 text-xs text-right w-full" defaultValue={v.newBiz > 0 ? (v.newBiz / 100).toString() : ""} placeholder="0"
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "newBiz", parseDollars(e.target.value))} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-up`} className="border-b hover:bg-violet-50/30">
                    <td className="p-2 text-xs text-violet-600 sticky left-32 bg-white z-10">$ Upsell</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-up-${q.label}`} className="p-1 border-l">
                          <Input className="h-7 text-xs text-right w-full" defaultValue={v.upsell > 0 ? (v.upsell / 100).toString() : ""} placeholder="0"
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "upsell", parseDollars(e.target.value))} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-tot`} className="border-b bg-muted/20">
                    <td className="p-2 text-xs font-semibold sticky left-32 bg-muted/20 z-10">$ Total</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-tot-${q.label}`} className="p-2 text-right text-xs font-semibold border-l">
                          {fmtDollars(v.total)}
                        </td>
                      );
                    })}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Enter pipeline targets (SQLs, Opps, Wins) and revenue targets ($). New Biz + Upsell auto-sums to Total.
          Target RAG indicators compare actuals against these targets on the Dashboard.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Churn Tab
// ============================================================================

interface ChurnTabProps {
  companyId: number;
  regions: any[];
  quarters: { year: number; quarter: number; label: string }[];
  existingChurn: any[];
  onSave: (entries: any[]) => void;
  isSaving: boolean;
}

function ChurnTab({ companyId, regions, quarters, existingChurn, onSave, isSaving }: ChurnTabProps) {
  type CellKey = string;
  const buildKey = (regionId: number, year: number, quarter: number): CellKey =>
    `${regionId}-${year}-${quarter}`;

  const initial = useMemo(() => {
    const map = new Map<CellKey, { churn: number; maa: number; adj: number }>();
    for (const c of existingChurn) {
      map.set(buildKey(c.regionId, c.year, c.quarter), {
        churn: c.churnAmount,
        maa: c.maaArr,
        adj: c.adjustment,
      });
    }
    return map;
  }, [existingChurn]);

  const [values, setValues] = useState<Map<CellKey, { churn: number; maa: number; adj: number }>>(new Map());

  const getVal = useCallback((regionId: number, year: number, quarter: number) => {
    const k = buildKey(regionId, year, quarter);
    return values.get(k) ?? initial.get(k) ?? { churn: 0, maa: 0, adj: 0 };
  }, [values, initial]);

  const setVal = useCallback((regionId: number, year: number, quarter: number, field: "churn" | "maa" | "adj", cents: number) => {
    const k = buildKey(regionId, year, quarter);
    setValues(prev => {
      const next = new Map(prev);
      const cur = next.get(k) ?? initial.get(k) ?? { churn: 0, maa: 0, adj: 0 };
      next.set(k, { ...cur, [field]: cents });
      return next;
    });
  }, [initial]);

  const handleSave = () => {
    const allKeys = new Set([...initial.keys(), ...values.keys()]);
    const entries: any[] = [];
    for (const k of allKeys) {
      const v = values.get(k) ?? initial.get(k);
      if (!v || (v.churn === 0 && v.maa === 0 && v.adj === 0)) continue;
      const [rid, yr, qt] = k.split("-").map(Number);
      entries.push({
        regionId: rid,
        year: yr,
        quarter: qt,
        churnAmount: v.churn,
        maaArr: v.maa,
        adjustment: v.adj,
      });
    }
    onSave(entries);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Churn, M&A & Adjustments</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1.5" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 w-32 sticky left-0 bg-muted/40 z-10">Region</th>
                <th className="text-left p-2 w-16 sticky left-32 bg-muted/40 z-10">Type</th>
                {quarters.map(q => (
                  <th key={q.label} className="text-center p-2 min-w-[100px] border-l">{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map(region => (
                <>
                  <tr key={`${region.id}-churn`} className="border-b hover:bg-red-50/30">
                    <td className="p-2 font-medium sticky left-0 bg-white z-10" rowSpan={3}>
                      {region.displayName || region.name}
                    </td>
                    <td className="p-2 text-xs text-red-600 sticky left-32 bg-white z-10">Churn</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-churn-${q.label}`} className="p-1 border-l">
                          <Input
                            className="h-7 text-xs text-right w-full"
                            defaultValue={v.churn > 0 ? (v.churn / 100).toString() : ""}
                            placeholder="0"
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "churn", parseDollars(e.target.value))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-maa`} className="border-b hover:bg-green-50/30">
                    <td className="p-2 text-xs text-green-600 sticky left-32 bg-white z-10">M&A ARR</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-maa-${q.label}`} className="p-1 border-l">
                          <Input
                            className="h-7 text-xs text-right w-full"
                            defaultValue={v.maa > 0 ? (v.maa / 100).toString() : ""}
                            placeholder="0"
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "maa", parseDollars(e.target.value))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-adj`} className="border-b hover:bg-amber-50/30">
                    <td className="p-2 text-xs text-amber-600 sticky left-32 bg-white z-10">Adjust.</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-adj-${q.label}`} className="p-1 border-l">
                          <Input
                            className="h-7 text-xs text-right w-full"
                            defaultValue={v.adj !== 0 ? (v.adj / 100).toString() : ""}
                            placeholder="0"
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "adj", parseDollars(e.target.value))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Churn = lost revenue (positive $). M&A ARR = acquisition additions. Adjustment = manual +/- correction.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Headcount Tab
// ============================================================================

interface HeadcountTabProps {
  companyId: number;
  regions: any[];
  quarters: { year: number; quarter: number; label: string }[];
  existingHc: any[];
  onSave: (entries: any[]) => void;
  isSaving: boolean;
}

function HeadcountTab({ companyId, regions, quarters, existingHc, onSave, isSaving }: HeadcountTabProps) {
  type CellKey = string;
  const buildKey = (regionId: number, year: number, quarter: number): CellKey =>
    `${regionId}-${year}-${quarter}`;

  const initial = useMemo(() => {
    const map = new Map<CellKey, { am: number; ae: number }>();
    for (const h of existingHc) {
      map.set(buildKey(h.regionId, h.year, h.quarter), {
        am: h.amCount,
        ae: h.aeCount,
      });
    }
    return map;
  }, [existingHc]);

  const [values, setValues] = useState<Map<CellKey, { am: number; ae: number }>>(new Map());

  const getVal = useCallback((regionId: number, year: number, quarter: number) => {
    const k = buildKey(regionId, year, quarter);
    return values.get(k) ?? initial.get(k) ?? { am: 0, ae: 0 };
  }, [values, initial]);

  const setVal = useCallback((regionId: number, year: number, quarter: number, field: "am" | "ae", count: number) => {
    const k = buildKey(regionId, year, quarter);
    setValues(prev => {
      const next = new Map(prev);
      const cur = next.get(k) ?? initial.get(k) ?? { am: 0, ae: 0 };
      next.set(k, { ...cur, [field]: count });
      return next;
    });
  }, [initial]);

  const handleSave = () => {
    const allKeys = new Set([...initial.keys(), ...values.keys()]);
    const entries: any[] = [];
    for (const k of allKeys) {
      const v = values.get(k) ?? initial.get(k);
      if (!v || (v.am === 0 && v.ae === 0)) continue;
      const [rid, yr, qt] = k.split("-").map(Number);
      entries.push({
        regionId: rid,
        year: yr,
        quarter: qt,
        amCount: v.am,
        aeCount: v.ae,
      });
    }
    onSave(entries);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Headcount by Region & Quarter</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1.5" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 w-32 sticky left-0 bg-muted/40 z-10">Region</th>
                <th className="text-left p-2 w-16 sticky left-32 bg-muted/40 z-10">Role</th>
                {quarters.map(q => (
                  <th key={q.label} className="text-center p-2 min-w-[80px] border-l">{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map(region => (
                <>
                  <tr key={`${region.id}-am`} className="border-b hover:bg-sky-50/30">
                    <td className="p-2 font-medium sticky left-0 bg-white z-10" rowSpan={3}>
                      {region.displayName || region.name}
                    </td>
                    <td className="p-2 text-xs text-sky-600 sticky left-32 bg-white z-10">AM</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-am-${q.label}`} className="p-1 border-l">
                          <Input
                            type="number"
                            className="h-7 text-xs text-right w-full"
                            defaultValue={v.am > 0 ? v.am.toString() : ""}
                            placeholder="0"
                            min={0}
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "am", parseInt(e.target.value) || 0)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-ae`} className="border-b hover:bg-indigo-50/30">
                    <td className="p-2 text-xs text-indigo-600 sticky left-32 bg-white z-10">AE</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-ae-${q.label}`} className="p-1 border-l">
                          <Input
                            type="number"
                            className="h-7 text-xs text-right w-full"
                            defaultValue={v.ae > 0 ? v.ae.toString() : ""}
                            placeholder="0"
                            min={0}
                            onBlur={(e) => setVal(region.id, q.year, q.quarter, "ae", parseInt(e.target.value) || 0)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr key={`${region.id}-hctotal`} className="border-b bg-muted/20">
                    <td className="p-2 text-xs font-semibold sticky left-32 bg-muted/20 z-10">Total</td>
                    {quarters.map(q => {
                      const v = getVal(region.id, q.year, q.quarter);
                      return (
                        <td key={`${region.id}-hctotal-${q.label}`} className="p-2 text-right text-xs font-semibold border-l">
                          {v.am + v.ae}
                        </td>
                      );
                    })}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          AM = Account Managers, AE = Account Executives. Used for bookings-per-head productivity metrics.
        </p>
      </CardContent>
    </Card>
  );
}
