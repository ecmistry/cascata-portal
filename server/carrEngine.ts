import * as db from "./db";

export interface CarrQuarter {
  year: number;
  quarter: number;
  label: string;
  regionId: number;
  regionName: string;
  openingCarr: number;    // cents
  newBookings: number;    // cents (from forecast predictedRevenueNew)
  upsellBookings: number; // cents (from forecast predictedRevenueUpsell)
  churn: number;          // cents (from churnData, positive = lost)
  maaArr: number;         // cents (M&A additions)
  adjustment: number;     // cents (manual adj)
  closingCarr: number;    // cents = opening + new + upsell - churn + maa + adj
  targetTotal: number;    // cents (from revenueTargets)
  targetNewBiz: number;   // cents
  targetUpsell: number;   // cents
  attainment: number;     // basis points: totalBookings / target * 10000
  amCount: number;
  aeCount: number;
  bookingsPerHead: number; // cents per total headcount
}

export interface CarrSummary {
  quarters: { year: number; quarter: number; label: string }[];
  regions: {
    regionId: number;
    regionName: string;
    data: CarrQuarter[];
  }[];
  global: CarrQuarter[];
}

function qLabel(y: number, q: number): string {
  return `Q${q} ${String(y).slice(2)}`;
}

function qKey(y: number, q: number): string {
  return `${y}-${q}`;
}

function nextQ(y: number, q: number): [number, number] {
  return q === 4 ? [y + 1, 1] : [y, q + 1];
}

export async function computeCarrSummary(companyId: number): Promise<CarrSummary> {
  const [regionsList, forecastsData, churnRows, targetRows, headcountRows] = await Promise.all([
    db.getRegionsByCompany(companyId).then(r => r.filter(x => x.enabled)),
    db.getForecastsByCompany(companyId),
    db.getChurnDataByCompany(companyId),
    db.getRevenueTargetsByCompany(companyId),
    db.getHeadcountByCompany(companyId),
  ]);

  // Collect unique quarters from forecasts
  const quarterSet = new Set<string>();
  for (const f of forecastsData) quarterSet.add(qKey(f.year, f.quarter));
  const quarters = Array.from(quarterSet)
    .sort()
    .map(k => {
      const [y, q] = k.split("-").map(Number);
      return { year: y, quarter: q, label: qLabel(y, q) };
    });

  if (quarters.length === 0) {
    return { quarters: [], regions: [], global: [] };
  }

  // Build lookup maps per region per quarter
  const fMap = new Map<string, { revNew: number; revUpsell: number }>();
  for (const f of forecastsData) {
    const k = `${f.regionId}-${f.year}-${f.quarter}`;
    const prev = fMap.get(k) ?? { revNew: 0, revUpsell: 0 };
    prev.revNew += f.predictedRevenueNew;
    prev.revUpsell += f.predictedRevenueUpsell;
    fMap.set(k, prev);
  }

  const churnMap = new Map<string, { churn: number; maa: number; adj: number }>();
  for (const c of churnRows) {
    const k = `${c.regionId}-${c.year}-${c.quarter}`;
    churnMap.set(k, { churn: c.churnAmount, maa: c.maaArr, adj: c.adjustment });
  }

  const targetMap = new Map<string, { total: number; newBiz: number; upsell: number }>();
  for (const t of targetRows) {
    const k = `${t.regionId}-${t.year}-${t.quarter}`;
    targetMap.set(k, { total: t.targetTotal, newBiz: t.targetNewBiz, upsell: t.targetUpsell });
  }

  const hcMap = new Map<string, { am: number; ae: number }>();
  for (const h of headcountRows) {
    const k = `${h.regionId}-${h.year}-${h.quarter}`;
    hcMap.set(k, { am: h.amCount, ae: h.aeCount });
  }

  function buildRegionCarr(regionId: number, regionName: string): CarrQuarter[] {
    let prevClosing = 0;
    return quarters.map(q => {
      const fk = `${regionId}-${q.year}-${q.quarter}`;
      const rev = fMap.get(fk) ?? { revNew: 0, revUpsell: 0 };
      const ch = churnMap.get(fk) ?? { churn: 0, maa: 0, adj: 0 };
      const tgt = targetMap.get(fk) ?? { total: 0, newBiz: 0, upsell: 0 };
      const hc = hcMap.get(fk) ?? { am: 0, ae: 0 };

      const openingCarr = prevClosing;
      const totalBookings = rev.revNew + rev.revUpsell;
      const closingCarr = openingCarr + totalBookings - ch.churn + ch.maa + ch.adj;
      const totalHc = hc.am + hc.ae;
      const attainment = tgt.total > 0 ? Math.round((totalBookings / tgt.total) * 10000) : 0;

      prevClosing = closingCarr;

      return {
        year: q.year,
        quarter: q.quarter,
        label: q.label,
        regionId,
        regionName,
        openingCarr,
        newBookings: rev.revNew,
        upsellBookings: rev.revUpsell,
        churn: ch.churn,
        maaArr: ch.maa,
        adjustment: ch.adj,
        closingCarr,
        targetTotal: tgt.total,
        targetNewBiz: tgt.newBiz,
        targetUpsell: tgt.upsell,
        attainment,
        amCount: hc.am,
        aeCount: hc.ae,
        bookingsPerHead: totalHc > 0 ? Math.round(totalBookings / totalHc) : 0,
      };
    });
  }

  const regionResults = regionsList.map(r => ({
    regionId: r.id,
    regionName: r.displayName || r.name,
    data: buildRegionCarr(r.id, r.displayName || r.name),
  }));

  // Global aggregation
  const globalData: CarrQuarter[] = quarters.map((q, qi) => {
    let openingCarr = 0, newBookings = 0, upsellBookings = 0;
    let churn = 0, maaArr = 0, adjustment = 0, closingCarr = 0;
    let targetTotal = 0, targetNewBiz = 0, targetUpsell = 0;
    let amCount = 0, aeCount = 0;

    for (const rr of regionResults) {
      const rd = rr.data[qi];
      openingCarr += rd.openingCarr;
      newBookings += rd.newBookings;
      upsellBookings += rd.upsellBookings;
      churn += rd.churn;
      maaArr += rd.maaArr;
      adjustment += rd.adjustment;
      closingCarr += rd.closingCarr;
      targetTotal += rd.targetTotal;
      targetNewBiz += rd.targetNewBiz;
      targetUpsell += rd.targetUpsell;
      amCount += rd.amCount;
      aeCount += rd.aeCount;
    }

    const totalBookings = newBookings + upsellBookings;
    const totalHc = amCount + aeCount;

    return {
      year: q.year,
      quarter: q.quarter,
      label: q.label,
      regionId: 0,
      regionName: "All Regions",
      openingCarr,
      newBookings,
      upsellBookings,
      churn,
      maaArr,
      adjustment,
      closingCarr,
      targetTotal,
      targetNewBiz,
      targetUpsell,
      attainment: targetTotal > 0 ? Math.round((totalBookings / targetTotal) * 10000) : 0,
      amCount,
      aeCount,
      bookingsPerHead: totalHc > 0 ? Math.round(totalBookings / totalHc) : 0,
    };
  });

  return {
    quarters,
    regions: regionResults,
    global: globalData,
  };
}
