import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  Briefcase,
  MapPin,
  Tag,
  Calendar,
  ArrowRight,
  DollarSign,
  Clock,
  TrendingDown,
  Activity,
  Info,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DataQuality() {
  const [, setLocation] = useLocation();
  const { data: companies = [] } = trpc.company.list.useQuery();
  const companyId = companies[0]?.id ?? 1;

  const { data: dq, isLoading } = trpc.cascade.dataQuality.useQuery({ companyId });
  const { data: history, isLoading: histLoading } = trpc.cascade.dataQualityHistory.useQuery({ companyId, limit: 10 });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </DashboardLayout>
    );
  }

  if (!dq) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Quality</h1>
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No data quality reports yet. Run a HubSpot sync first.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const pct = dq.coveragePct;
  const isGood = pct >= 90;
  const isWarning = pct >= 70 && pct < 90;
  const report = dq.report;
  const unmappedRegions = report?.unmappedRegionValues ?? {};
  const unmappedSqlTypes = report?.unmappedSqlTypeValues ?? {};
  const dealUnmappedRegions = report?.dealsUnmappedRegionValues ?? {};
  const dealUnmappedSqlTypes = report?.dealsUnmappedSqlTypeValues ?? {};
  const hasUnmapped = Object.keys(unmappedRegions).length > 0 || Object.keys(unmappedSqlTypes).length > 0
    || Object.keys(dealUnmappedRegions).length > 0 || Object.keys(dealUnmappedSqlTypes).length > 0;

  const StatusIcon = isGood ? CheckCircle2 : pct >= 70 ? AlertTriangle : AlertCircle;
  const statusColor = isGood ? "text-green-600" : isWarning ? "text-amber-600" : "text-red-600";
  const statusBg = isGood ? "bg-green-50" : isWarning ? "bg-amber-50" : "bg-red-50";
  const progressColor = isGood ? "[&>div]:bg-green-500" : isWarning ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";

  const syncTime = dq.syncTimestamp ? new Date(dq.syncTimestamp).toLocaleString() : "Unknown";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Quality</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last sync: {syncTime}
          </p>
        </div>

        {/* Coverage Score */}
        <Card className={`border-2 ${isGood ? "border-green-200" : isWarning ? "border-amber-200" : "border-red-200"}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`rounded-full p-3 ${statusBg}`}>
                <StatusIcon className={`h-8 w-8 ${statusColor}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{pct.toFixed(1)}% Data Coverage</h2>
                <p className="text-sm text-muted-foreground">
                  {isGood
                    ? "Excellent data quality. Most contacts are being processed."
                    : isWarning
                      ? "Moderate data quality. Some contacts are missing required fields."
                      : "Low data quality. Many contacts are being skipped. Action recommended."}
                </p>
              </div>
            </div>
            <Progress value={pct} className={`h-3 ${progressColor}`} />
          </CardContent>
        </Card>

        {/* Contact Data Flow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Contact Data Flow
              <span className="text-xs text-muted-foreground font-normal ml-1">
                How HubSpot contacts flow into the cascade model
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <WaterfallRow label="Contacts with SQL date in HubSpot" value={dq.contactsFetched} total={dq.contactsFetched} variant="neutral" />
              {report && (report.skippedNoRegion ?? 0) > 0 && (
                <WaterfallRow label="No region (Contact Pod) set" value={-(report.skippedNoRegion ?? 0)} total={dq.contactsFetched} variant="loss"
                  detail="These contacts have an SQL date but the Contact Pod field is empty in HubSpot." />
              )}
              {report && (report.skippedUnmappedRegion ?? 0) > 0 && (
                <WaterfallRow label="Unmapped region value" value={-(report.skippedUnmappedRegion ?? 0)} total={dq.contactsFetched} variant="loss"
                  detail="Contact Pod value doesn't match any configured region mapping." />
              )}
              {report && (report.skippedNoSqlType ?? 0) > 0 && (
                <WaterfallRow label="No SQL type set" value={-(report.skippedNoSqlType ?? 0)} total={dq.contactsFetched} variant="loss"
                  detail="Contact has a region but is missing the Type of SQL field." />
              )}
              {report && (report.skippedUnmappedSqlType ?? 0) > 0 && (
                <WaterfallRow label="Unmapped SQL type value" value={-(report.skippedUnmappedSqlType ?? 0)} total={dq.contactsFetched} variant="loss"
                  detail="Type of SQL value doesn't match any configured motion mapping." />
              )}
              {report && (report.skippedNoSqlDate ?? 0) > 0 && (
                <WaterfallRow label="No SQL date" value={-(report.skippedNoSqlDate ?? 0)} total={dq.contactsFetched} variant="loss"
                  detail="Contact has no SQL date or create date for quarter assignment." />
              )}
              <WaterfallRow label="Used in cascade model" value={dq.contactsUsed} total={dq.contactsFetched} variant="result" />
            </div>
            {report && (report.contactsMissingOppDate ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Of the {dq.contactsUsed.toLocaleString()} used contacts, {(report.contactsWithOppDate ?? 0).toLocaleString()} have
                    an Opportunity date (used for timing distributions) and {(report.contactsMissingOppDate ?? 0).toLocaleString()} do not.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deal Data Flow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-purple-500" />
              Deal Data Flow
              <span className="text-xs text-muted-foreground font-normal ml-1">
                How closed-won deals flow into actuals and revenue
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <WaterfallRow label="Closed-won deals in HubSpot" value={dq.dealsFetched} total={dq.dealsFetched} variant="neutral" />
              {report && (report.dealsSkippedNoRegion ?? 0) > 0 && (
                <WaterfallRow label="No region (Deal Pod) set" value={-(report.dealsSkippedNoRegion ?? 0)} total={dq.dealsFetched} variant="loss"
                  detail="Deal has no Deal Pod value. This is the most common reason deals are excluded." />
              )}
              {report && (report.dealsSkippedUnmappedRegion ?? 0) > 0 && (
                <WaterfallRow label="Unmapped region value" value={-(report.dealsSkippedUnmappedRegion ?? 0)} total={dq.dealsFetched} variant="loss"
                  detail="Deal Pod value doesn't match any configured region." />
              )}
              {report && (report.dealsSkippedNoSqlType ?? 0) > 0 && (
                <WaterfallRow label="No SQL type set" value={-(report.dealsSkippedNoSqlType ?? 0)} total={dq.dealsFetched} variant="loss"
                  detail="Deal is missing the Type of SQL Associated to Deal field." />
              )}
              {report && (report.dealsSkippedUnmappedSqlType ?? 0) > 0 && (
                <WaterfallRow label="Unmapped SQL type value" value={-(report.dealsSkippedUnmappedSqlType ?? 0)} total={dq.dealsFetched} variant="loss"
                  detail="SQL type value on the deal doesn't match any configured motion." />
              )}
              {report && (report.dealsSkippedNoCloseDate ?? 0) > 0 && (
                <WaterfallRow label="No close date" value={-(report.dealsSkippedNoCloseDate ?? 0)} total={dq.dealsFetched} variant="loss"
                  detail="Deal has no close date for quarter assignment." />
              )}
              <WaterfallRow label="Used in actuals & revenue" value={dq.dealsUsed} total={dq.dealsFetched} variant="result" />
            </div>
            {dq.dealsFetched > 0 && dq.dealsUsed < dq.dealsFetched && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Deals require both a Deal Pod (region) and Type of SQL to be mapped. Only {((dq.dealsUsed / dq.dealsFetched) * 100).toFixed(1)}% of
                    closed-won deals have both fields populated. Improving deal property coverage in HubSpot will increase the accuracy of revenue actuals and conversion rates.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Where the Discrepancies Come From */}
        {report && dq.contactsSkipped > 0 && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Understanding the Discrepancies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">Why don't the numbers match HubSpot reports exactly?</h4>
                  <p className="text-muted-foreground">
                    Cascata fetches all contacts that have an SQL date set in HubSpot, regardless of their current lifecycle stage.
                    This includes contacts who were once SQLs but have since progressed to Opportunity, Customer, or other stages.
                    The total fetched ({dq.contactsFetched.toLocaleString()}) should match your HubSpot SQL report total.
                  </p>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="rounded-lg border bg-white p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Contact Discrepancy</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {(report.skippedNoRegion ?? 0) > 0 && (
                        <p>
                          <span className="font-medium text-foreground">{((report.skippedNoRegion ?? 0) / dq.contactsFetched * 100).toFixed(0)}%</span> of
                          contacts have no Contact Pod set in HubSpot. These appear as "(No value)" in HubSpot reports and are excluded from the cascade model.
                        </p>
                      )}
                      {dq.contactsUsed > 0 && (
                        <p className="mt-2">
                          The remaining <span className="font-medium text-foreground">{dq.contactsUsed.toLocaleString()}</span> contacts
                          with valid region and SQL type mappings are used to calculate SQL volumes per quarter.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-sm">Deal Discrepancy</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {(report.dealsSkippedNoRegion ?? 0) > 0 && (
                        <p>
                          <span className="font-medium text-foreground">{((report.dealsSkippedNoRegion ?? 0) / Math.max(dq.dealsFetched, 1) * 100).toFixed(0)}%</span> of
                          closed-won deals have no Deal Pod set. Deal Pod and SQL type fields have lower
                          coverage than contact fields, which limits revenue and conversion rate accuracy.
                        </p>
                      )}
                      {(report.dealsSkippedNoSqlType ?? 0) > 0 && (
                        <p className="mt-2">
                          <span className="font-medium text-foreground">{((report.dealsSkippedNoSqlType ?? 0) / Math.max(dq.dealsFetched, 1) * 100).toFixed(0)}%</span> of
                          closed-won deals are missing the SQL type field, making it the biggest gap in deal data.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> How to Improve
                  </h4>
                  <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                    {(report.skippedNoRegion ?? 0) > 0 && (
                      <li>Populate the <span className="font-mono text-foreground">Contact Pod</span> field on all SQL contacts in HubSpot to improve contact coverage from {pct.toFixed(0)}%.</li>
                    )}
                    {(report.dealsSkippedNoSqlType ?? 0) > 0 && (
                      <li>Populate the <span className="font-mono text-foreground">Type of SQL Associated to Deal</span> field on closed-won deals to improve deal coverage.</li>
                    )}
                    {(report.dealsSkippedNoRegion ?? 0) > 0 && (
                      <li>Populate the <span className="font-mono text-foreground">Deal Pod</span> field on closed-won deals for accurate regional revenue tracking.</li>
                    )}
                    <li>Alternatively, set fallback region/SQL type values on the <button className="text-blue-600 underline" onClick={() => setLocation("/configure-cascata")}>Configure page</button> to assign defaults to records with missing fields.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unmapped Values */}
        {hasUnmapped && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Unmapped Values
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  These HubSpot values don't match any configured mapping
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.keys(unmappedRegions).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Unmapped Region Values
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(unmappedRegions)
                        .sort(([, a], [, b]) => b - a)
                        .map(([value, count]) => (
                          <Badge key={value} variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                            "{value}" ({count} contacts)
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Add these as aliases in the Configure page to include them in the cascade calculation, or set a fallback region.
                    </p>
                  </div>
                )}
                {Object.keys(unmappedSqlTypes).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Unmapped SQL Type Values (Contacts)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(unmappedSqlTypes)
                        .sort(([, a], [, b]) => b - a)
                        .map(([value, count]) => (
                          <Badge key={value} variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                            "{value}" ({count} contacts)
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Add these as aliases in the Configure page to include them in the cascade calculation, or set a fallback SQL type.
                    </p>
                  </div>
                )}
                {Object.keys(dealUnmappedRegions).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Unmapped Region Values (Deals)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dealUnmappedRegions)
                        .sort(([, a], [, b]) => b - a)
                        .map(([value, count]) => (
                          <Badge key={value} variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                            "{value}" ({count} deals)
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
                {Object.keys(dealUnmappedSqlTypes).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Unmapped SQL Type Values (Deals)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dealUnmappedSqlTypes)
                        .sort(([, a], [, b]) => b - a)
                        .map(([value, count]) => (
                          <Badge key={value} variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                            "{value}" ({count} deals)
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button size="sm" variant="outline" onClick={() => setLocation("/configure-cascata")}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                  Go to Configure page to add aliases
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timing Distribution Gaps */}
        {report && (report.contactsMissingOppDate > 0 || Object.keys(report.timingSamplesByMotion ?? {}).length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Timing Distribution Quality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.contactsMissingOppDate > 0 && (
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Contacts without Opportunity date</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {report.contactsMissingOppDate.toLocaleString()} of {report.contactsWithSqlDate?.toLocaleString() ?? "?"} with SQL date
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These contacts have an SQL date but no Opportunity date. Timing distributions only use contacts with both dates.
                    </p>
                    {report.contactsWithSqlDate > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={((report.contactsWithOppDate ?? 0) / report.contactsWithSqlDate) * 100}
                          className="h-2 flex-1 [&>div]:bg-blue-500"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {(((report.contactsWithOppDate ?? 0) / report.contactsWithSqlDate) * 100).toFixed(0)}% have both
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {Object.keys(report.timingSamplesByMotion ?? {}).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Timing Samples by Motion
                    </h4>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {Object.entries(report.timingSamplesByMotion!)
                        .sort(([, a], [, b]) => b - a)
                        .map(([motion, count]) => (
                          <div key={motion} className="flex items-center justify-between rounded border px-3 py-2">
                            <span className="text-sm">{motion}</span>
                            <Badge variant={count >= 20 ? "default" : count >= 5 ? "secondary" : "destructive"}
                              className={`text-xs ${count >= 20 ? "bg-green-100 text-green-800" : ""}`}>
                              {count} sample{count !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Motions need at least 5 samples for reliable timing distributions. 20+ is recommended.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deal Economics Quality */}
        {report && (report.dealsClosedWon > 0 || report.dealsNoAmount > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Deal Economics Quality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <div className="text-center p-2 rounded-lg bg-muted/60">
                    <div className="text-lg font-bold">{(report.dealsClosedWon ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Closed-Won Deals</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/60">
                    <div className="text-lg font-bold">${(report.dealAmountMedian ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Median Deal Size</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/60">
                    <div className="text-lg font-bold">${(report.dealAmountMin ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Smallest Deal</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/60">
                    <div className="text-lg font-bold">${(report.dealAmountMax ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Largest Deal</div>
                  </div>
                </div>

                {((report.dealsNoAmount ?? 0) > 0 || (report.dealsZeroAmount ?? 0) > 0 || (report.dealsNoDealType ?? 0) > 0 || (report.dealAmountOutliers ?? 0) > 0) && (
                  <div className="space-y-2">
                    {(report.dealsNoAmount ?? 0) > 0 && (
                      <SkipReasonRow
                        icon={<DollarSign className="h-4 w-4 text-red-500" />}
                        label="Deals with no amount"
                        description="Closed-won deals missing the deal amount field entirely."
                        count={report.dealsNoAmount!}
                        total={report.dealsClosedWon ?? 0}
                        fix="Populate the amount field on all closed-won deals in HubSpot."
                      />
                    )}
                    {(report.dealsZeroAmount ?? 0) > 0 && (
                      <SkipReasonRow
                        icon={<DollarSign className="h-4 w-4 text-amber-500" />}
                        label="Deals with zero amount"
                        description="Closed-won deals with an amount of $0."
                        count={report.dealsZeroAmount!}
                        total={report.dealsClosedWon ?? 0}
                        fix="Verify if $0 deals are correct or if amounts need updating."
                      />
                    )}
                    {(report.dealsNoDealType ?? 0) > 0 && (
                      <SkipReasonRow
                        icon={<Tag className="h-4 w-4 text-amber-500" />}
                        label="Deals with no deal type"
                        description="Closed-won deals missing the deal type classification (new vs upsell)."
                        count={report.dealsNoDealType!}
                        total={report.dealsClosedWon ?? 0}
                        fix="Set the deal type on all closed-won deals in HubSpot."
                      />
                    )}
                    {(report.dealAmountOutliers ?? 0) > 0 && (
                      <SkipReasonRow
                        icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
                        label="Deal amount outliers"
                        description={`Deals with values >3x or <0.1x the median ($${(report.dealAmountMedian ?? 0).toLocaleString()}).`}
                        count={report.dealAmountOutliers!}
                        total={report.dealsClosedWon ?? 0}
                        fix="Verify that outlier deal amounts are accurate."
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Anomalies */}
        {report && ((report.contactsFutureSqlDate ?? 0) > 0 || (report.contactsOldSqlDate ?? 0) > 0 || (report.dealsFutureCloseDate ?? 0) > 0 || (report.dealsOldCloseDate ?? 0) > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                Date Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(report.contactsFutureSqlDate ?? 0) > 0 && (
                  <SkipReasonRow
                    icon={<Calendar className="h-4 w-4 text-red-500" />}
                    label="Contacts with future SQL dates"
                    description="SQL dates set in the future. These may indicate data entry errors."
                    count={report.contactsFutureSqlDate!}
                    total={dq.contactsUsed + dq.contactsSkipped}
                    fix="Review and correct SQL dates that are set in the future."
                  />
                )}
                {(report.contactsOldSqlDate ?? 0) > 0 && (
                  <SkipReasonRow
                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                    label="Contacts with very old SQL dates"
                    description="SQL dates before 2015. These may be test or legacy records."
                    count={report.contactsOldSqlDate!}
                    total={dq.contactsUsed + dq.contactsSkipped}
                    fix="Check if pre-2015 contacts should be excluded from the cascade model."
                  />
                )}
                {(report.dealsFutureCloseDate ?? 0) > 0 && (
                  <SkipReasonRow
                    icon={<Calendar className="h-4 w-4 text-red-500" />}
                    label="Deals with future close dates"
                    description="Closed-won deals with close dates in the future."
                    count={report.dealsFutureCloseDate!}
                    total={dq.dealsFetched}
                    fix="Review deals with future close dates for accuracy."
                  />
                )}
                {(report.dealsOldCloseDate ?? 0) > 0 && (
                  <SkipReasonRow
                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                    label="Deals with very old close dates"
                    description="Deals with close dates before 2015."
                    count={report.dealsOldCloseDate!}
                    total={dq.dealsFetched}
                    fix="Check if pre-2015 deals should be included in the model."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sparse Combinations */}
        {report && report.sparseCombinations && report.sparseCombinations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-500" />
                Low-Volume Combinations
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  Region/motion pairs with fewer than 5 SQLs
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="text-left p-2 font-semibold">Motion</th>
                      <th className="text-left p-2 font-semibold">Region</th>
                      <th className="text-right p-2 font-semibold">SQL Count</th>
                      <th className="text-left p-2 font-semibold">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sparseCombinations
                      .sort((a: { sqlCount: number }, b: { sqlCount: number }) => a.sqlCount - b.sqlCount)
                      .map((combo: { motion: string; region: string; sqlCount: number }, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{combo.motion}</td>
                          <td className="p-2">{combo.region}</td>
                          <td className="text-right p-2 font-mono">
                            <Badge variant="destructive" className="text-[10px]">{combo.sqlCount}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {combo.sqlCount <= 2 ? "Very unreliable forecasts" : "Marginally reliable"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Combinations with very few SQLs produce unreliable conversion rates and forecasts. Consider merging small regions or ensuring data is being captured correctly.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Coverage Trend */}
        {history && history.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coverage Trend (Last {history.length} Syncs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="text-left p-2 font-semibold">Sync Time</th>
                      <th className="text-right p-2 font-semibold">Contacts</th>
                      <th className="text-right p-2 font-semibold">Used</th>
                      <th className="text-right p-2 font-semibold">Skipped</th>
                      <th className="text-right p-2 font-semibold">Coverage</th>
                      <th className="text-right p-2 font-semibold">Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, i) => {
                      const rowPct = row.coveragePct;
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2 text-muted-foreground">
                            {new Date(row.syncTimestamp).toLocaleString()}
                          </td>
                          <td className="text-right p-2 font-mono">{row.contactsFetched}</td>
                          <td className="text-right p-2 font-mono text-green-600">{row.contactsUsed}</td>
                          <td className="text-right p-2 font-mono text-red-600">{row.contactsSkipped}</td>
                          <td className="text-right p-2">
                            <Badge variant={rowPct >= 90 ? "default" : rowPct >= 70 ? "secondary" : "destructive"}
                              className={`text-[10px] ${rowPct >= 90 ? "bg-green-100 text-green-800" : ""}`}
                            >
                              {rowPct.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="text-right p-2 font-mono">{row.dealsFetched}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Good */}
        {isGood && !hasUnmapped && dq.contactsSkipped === 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800 mb-1">Excellent Data Quality</h3>
              <p className="text-sm text-green-700">
                All contacts and deals are being processed. No action required.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function SkipReasonRow({
  icon,
  label,
  description,
  count,
  total,
  fix,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  count: number;
  total: number;
  fix: string;
}) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {count.toLocaleString()} ({pct}%)
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <p className="text-xs text-blue-600 font-medium">Fix: {fix}</p>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  total,
  variant,
  detail,
}: {
  label: string;
  value: number;
  total: number;
  variant: "neutral" | "loss" | "result";
  detail?: string;
}) {
  const pct = total > 0 ? Math.abs((value / total) * 100).toFixed(1) : "0";
  const isLoss = variant === "loss";
  const isResult = variant === "result";

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
      isResult ? "bg-green-50 border border-green-200" : isLoss ? "bg-red-50/50" : "bg-muted/40"
    }`}>
      {isLoss && <ChevronRight className="h-3.5 w-3.5 text-red-400 shrink-0" />}
      {isResult && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
      {!isLoss && !isResult && <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className={isResult ? "font-medium text-green-800" : isLoss ? "text-red-700" : ""}>{label}</span>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      <div className="text-right shrink-0">
        <span className={`font-mono font-semibold ${isLoss ? "text-red-600" : isResult ? "text-green-700" : ""}`}>
          {isLoss ? "" : ""}{Math.abs(value).toLocaleString()}
        </span>
        {variant !== "neutral" && (
          <span className={`text-[10px] ml-1 ${isLoss ? "text-red-400" : "text-green-500"}`}>
            ({pct}%)
          </span>
        )}
      </div>
    </div>
  );
}
