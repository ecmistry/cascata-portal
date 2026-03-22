import { z } from "zod";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, companyProtectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import bcrypt from "bcrypt";
import { emailOrUsernameSchema } from "./_core/validation";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        email: emailOrUsernameSchema,
        password: z.string().min(1), // Password validation happens server-side for existing users
      }))
      .mutation(async ({ ctx, input }) => {
        // Find user by email (which can be username for simple login)
        const user = await db.getUserByEmail(input.email);
        
        if (!user || !user.passwordHash) {
          // Use generic error message to prevent user enumeration
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Verify password
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          // Use generic error message to prevent user enumeration
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Create session token with reduced duration (30 days instead of 1 year)
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.email || "",
          expiresInMs: SESSION_DURATION_MS,
        });

        // Removed sensitive logging - only log success without user details
        if (process.env.NODE_ENV === "development") {
          console.log("[Login] User logged in successfully");
        }

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

        // Update last signed in
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        return {
          success: true,
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Company management
  company: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255).trim(),
        description: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
        }
        const companyId = await db.createCompany({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
        });
        return { id: companyId };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCompaniesByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.id);
        if (!company) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        }
        // Verify user owns the company
        if (company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return company;
      }),
  }),

  // Region management
  region: router({
    create: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        name: z.string().max(100).trim(),
        displayName: z.string().max(100).trim(),
      }))
      .mutation(async ({ input }) => {
        const regionId = await db.createRegion({
          companyId: input.companyId,
          name: input.name,
          displayName: input.displayName,
          enabled: true,
        });
        return { id: regionId };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getRegionsByCompany(input.companyId);
      }),
  }),

  // SQL Type management
  sqlType: router({
    create: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        name: z.string().max(100).trim(),
        displayName: z.string().max(100).trim(),
      }))
      .mutation(async ({ input }) => {
        const sqlTypeId = await db.createSqlType({
          companyId: input.companyId,
          name: input.name,
          displayName: input.displayName,
          enabled: true,
        });
        return { id: sqlTypeId };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSqlTypesByCompany(input.companyId);
      }),
  }),

  // SQL History management
  sqlHistory: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        sqlTypeId: z.number(),
        year: z.number(),
        quarter: z.number().min(1).max(4),
        volume: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.upsertSqlHistory(input);
        return { success: true };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSqlHistoryByCompany(input.companyId);
      }),

    importCSV: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        records: z.array(z.object({
          region: z.string().max(100),
          sqlType: z.string().max(100),
          year: z.number().int().min(2000).max(2100),
          quarter: z.number().int().min(1).max(4),
          volume: z.number().int().min(0).max(1000000),
        })),
      }))
      .mutation(async ({ input }) => {
        const { companyId, records } = input;
        
        // Validation: Check for duplicates
        const recordKeys = new Set<string>();
        const duplicates: string[] = [];
        const currentYear = new Date().getFullYear();
        const minYear = currentYear - 10; // Allow 10 years in past
        const maxYear = currentYear + 10; // Allow 10 years in future
        
        // Get region and sqlType mappings
        const regions = await db.getRegionsByCompany(companyId);
        const sqlTypes = await db.getSqlTypesByCompany(companyId);
        
        const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
        const sqlTypeMap = new Map(sqlTypes.map(s => [s.name.toLowerCase(), s.id]));
        
        // Validate and prepare records for batch insert
        const validRecords: Array<{
          companyId: number;
          regionId: number;
          sqlTypeId: number;
          year: number;
          quarter: number;
          volume: number;
        }> = [];
        const skippedRecords: Array<{
          record: typeof records[0];
          reason: string;
        }> = [];
        
        for (const record of records) {
          // Check for duplicates
          const recordKey = `${record.region.toLowerCase()}-${record.sqlType.toLowerCase()}-${record.year}-${record.quarter}`;
          if (recordKeys.has(recordKey)) {
            duplicates.push(recordKey);
            skippedRecords.push({
              record,
              reason: "Duplicate record",
            });
            continue;
          }
          recordKeys.add(recordKey);
          
          // Validate year range
          if (record.year < minYear || record.year > maxYear) {
            skippedRecords.push({
              record,
              reason: `Year ${record.year} is outside valid range (${minYear}-${maxYear})`,
            });
            continue;
          }
          
          // Validate region and SQL type
          const regionId = regionMap.get(record.region.toLowerCase());
          const sqlTypeId = sqlTypeMap.get(record.sqlType.toLowerCase());
          
          if (!regionId) {
            skippedRecords.push({
              record,
              reason: `Region "${record.region}" not found`,
            });
            continue;
          }
          
          if (!sqlTypeId) {
            skippedRecords.push({
              record,
              reason: `SQL Type "${record.sqlType}" not found`,
            });
            continue;
          }
          
          // Validate volume
          if (record.volume < 0 || record.volume > 1000000) {
            skippedRecords.push({
              record,
              reason: `Volume ${record.volume} is outside valid range (0-1,000,000)`,
            });
            continue;
          }
          
          validRecords.push({
            companyId,
            regionId,
            sqlTypeId,
            year: record.year,
            quarter: record.quarter,
            volume: record.volume,
          });
        }
        
        // Batch insert valid records
        let imported = 0;
        if (validRecords.length > 0) {
          // Process in batches of 100 for better performance
          const batchSize = 100;
          for (let i = 0; i < validRecords.length; i += batchSize) {
            const batch = validRecords.slice(i, i + batchSize);
            await Promise.all(
              batch.map(record => db.upsertSqlHistory(record))
            );
            imported += batch.length;
          }
        }
        
        return {
          imported,
          skipped: skippedRecords.length,
          skippedRecords: skippedRecords.slice(0, 50), // Limit to first 50 for response size
          duplicates: duplicates.length,
          warnings: duplicates.length > 0 ? [`${duplicates.length} duplicate records found`] : [],
        };
      }),
  }),

  // Conversion rates management
  conversionRate: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        sqlTypeId: z.number(),
        oppCoverageRatio: z.number().min(0), // basis points
        winRateNew: z.number().min(0).max(10000), // basis points
        winRateUpsell: z.number().min(0).max(10000), // basis points
      }))
      .mutation(async ({ input }) => {
        await db.upsertConversionRate(input);
        return { success: true };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getConversionRatesByCompany(input.companyId);
      }),
  }),

  // Deal economics management
  dealEconomics: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        acvNew: z.number().min(0), // in cents
        acvUpsell: z.number().min(0), // in cents
      }))
      .mutation(async ({ input }) => {
        await db.upsertDealEconomics(input);
        return { success: true };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDealEconomicsByCompany(input.companyId);
      }),
  }),

  // Time distribution management
  timeDistribution: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        sqlTypeId: z.number(),
        sameQuarterPct: z.number().min(0).max(10000), // basis points
        nextQuarterPct: z.number().min(0).max(10000), // basis points
        twoQuarterPct: z.number().min(0).max(10000), // basis points
      }))
      .mutation(async ({ input }) => {
        await db.upsertTimeDistribution(input);
        return { success: true };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTimeDistributionsByCompany(input.companyId);
      }),
  }),

  // Forecast management
  forecast: router({
    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getForecastsByCompany(input.companyId);
      }),
    calculate: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .mutation(async ({ input }) => {
        const { runCascadeForecast } = await import("./cascadeEngine");
        const count = await runCascadeForecast(input.companyId);
        return { success: true, count, message: `Generated ${count} forecast entries` };
      }),
  }),

  // Actuals management
  actual: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        sqlTypeId: z.number(),
        year: z.number(),
        quarter: z.number().min(1).max(4),
        actualSqls: z.number().min(0),
        actualOpps: z.number().min(0),
        actualRevenue: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.upsertActual(input);
        return { success: true };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getActualsByCompany(input.companyId);
      }),
  }),

  // What-If Analysis
  whatif: router({
    calculate: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        adjustments: z.object({
          conversionRateMultiplier: z.number().optional(),
          acvAdjustments: z.object({
            newBusinessAcv: z.number().optional(),
            upsellAcv: z.number().optional(),
          }).optional(),
          timeDistributionAdjustments: z.object({
            sameQuarter: z.number().optional(),
            nextQuarter: z.number().optional(),
            twoQuarter: z.number().optional(),
          }).optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const { calculateWhatIfScenario } = await import("./calculations/whatif");
        return await calculateWhatIfScenario(input.companyId, input.adjustments);
      }),
  }),

  // Scenario Management
  scenario: router({
    create: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        name: z.string().min(1).max(255).trim(),
        description: z.string().max(5000).optional(),
        conversionRateMultiplier: z.number().optional(),
        acvNewAdjustment: z.number().optional(),
        acvUpsellAdjustment: z.number().optional(),
        sameQuarterAdjustment: z.number().optional(),
        nextQuarterAdjustment: z.number().optional(),
        twoQuarterAdjustment: z.number().optional(),
        totalRevenueChange: z.number().optional(),
        totalRevenueChangePercent: z.number().optional(),
        totalOpportunitiesChange: z.number().optional(),
        totalOpportunitiesChangePercent: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
        }
        const scenarioId = await db.createScenario({
          companyId: input.companyId,
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          conversionRateMultiplier: input.conversionRateMultiplier || null,
          acvNewAdjustment: input.acvNewAdjustment || null,
          acvUpsellAdjustment: input.acvUpsellAdjustment || null,
          sameQuarterAdjustment: input.sameQuarterAdjustment || null,
          nextQuarterAdjustment: input.nextQuarterAdjustment || null,
          twoQuarterAdjustment: input.twoQuarterAdjustment || null,
          totalRevenueChange: input.totalRevenueChange || null,
          totalRevenueChangePercent: input.totalRevenueChangePercent || null,
          totalOpportunitiesChange: input.totalOpportunitiesChange || null,
          totalOpportunitiesChangePercent: input.totalOpportunitiesChangePercent || null,
        });
        return { id: scenarioId };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getScenariosByCompany(input.companyId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const scenario = await db.getScenarioById(input.id);
        if (!scenario) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
        }
        // Verify user owns the company that owns this scenario
        const company = await db.getCompanyById(scenario.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return scenario;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).trim().optional(),
        description: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        // Verify user owns the scenario
        const scenario = await db.getScenarioById(id);
        if (!scenario) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
        }
        const company = await db.getCompanyById(scenario.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        await db.updateScenario(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify user owns the scenario
        const scenario = await db.getScenarioById(input.id);
        if (!scenario) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
        }
        const company = await db.getCompanyById(scenario.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        await db.deleteScenario(input.id);
        return { success: true };
      }),
  }),

  // BigQuery integration
  bigquery: router({  
    updateConfig: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        bigqueryEnabled: z.boolean().optional(),
        bigqueryProjectId: z.string().max(255).optional(),
        bigqueryDatasetId: z.string().max(255).optional(),
        bigqueryCredentials: z.string().optional(), // Should be encrypted in production
        bigquerySqlHistoryTable: z.string().max(255).optional(),
        bigqueryConversionRatesTable: z.string().max(255).optional(),
        bigqueryActualsTable: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const { companyId, ...config } = input;
        await db.updateCompanyBigQueryConfig(companyId, config);
        return { success: true };
      }),

    testConnection: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .mutation(async ({ input }) => {
        const bigquerySync = await import('./bigquerySync');
        return await bigquerySync.testConnection(input.companyId);
      }),

    listTables: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const bigquerySync = await import('./bigquerySync');
        return await bigquerySync.listTables(input.companyId);
      }),

    sync: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .mutation(async ({ input }) => {
        const bigquerySync = await import('./bigquerySync');
        return await bigquerySync.syncCompanyData(input.companyId);
      }),
  }),

  // Dashboard router
  dashboard: router({
    rScores: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const { computeRScores } = await import("./pearsonEngine");
        return await computeRScores(input.companyId);
      }),

    rScoreHistory: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const rows = await db.getRScoreHistoryByCompany(input.companyId);
        return rows
          .filter(r => r.regionId === null && r.metricType === "overall")
          .map(r => ({
            year: r.year,
            quarter: r.quarter,
            rScore: parseFloat(r.rScore as any),
            label: `Q${r.quarter} ${r.year}`,
          }))
          .sort((a, b) => a.year * 4 + a.quarter - (b.year * 4 + b.quarter));
      }),

    dataCoverage: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const latest = await db.getLatestDataQualityReport(input.companyId);
        if (!latest) return null;
        let report: any = null;
        try { report = JSON.parse(latest.reportJson ?? "{}"); } catch { /* ignore */ }
        return {
          contactsFetched: latest.contactsFetched,
          contactsUsed: latest.contactsUsed,
          contactsCoveragePct: latest.coveragePct / 100,
          dealsFetched: latest.dealsFetched ?? 0,
          dealsUsed: latest.dealsUsed ?? 0,
          dealsCoveragePct: (latest.dealsFetched ?? 0) > 0 ? Math.round(((latest.dealsUsed ?? 0) / (latest.dealsFetched ?? 0)) * 10000) / 100 : 0,
          syncTimestamp: latest.syncTimestamp,
          unmappedRegions: report?.unmappedRegionValues ?? {},
          unmappedSqlTypes: report?.unmappedSqlTypeValues ?? {},
        };
      }),

    hierarchicalData: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const { companyId } = input;
        const { computeRScores } = await import("./pearsonEngine");
        const { computeRag, computeAttainment } = await import("./ragEngine");

        const [regionsList, sqlTypesList, forecastsData, actualsData, qMetricsData, rScores, targetData] = await Promise.all([
          db.getRegionsByCompany(companyId).then(r => r.filter(x => x.enabled)),
          db.getSqlTypesByCompany(companyId).then(s => s.filter(x => x.enabled)),
          db.getForecastsByCompany(companyId),
          db.getActualsByCompany(companyId),
          db.getQuarterlyMetricsByCompany(companyId),
          computeRScores(companyId),
          db.getRevenueTargetsByCompany(companyId),
        ]);

        const now = new Date();
        const curYear = now.getFullYear();
        const curQ = Math.ceil((now.getMonth() + 1) / 3);

        type RagStatus = "green" | "amber" | "red";
        interface MetricCell {
          model: number;
          actual: number | null;
          rag: RagStatus | null;
        }
        interface HierarchyQuarter {
          year: number;
          quarter: number;
          label: string;
          isHistorical: boolean;
          sql: MetricCell;
          ocr: MetricCell;
          owr: MetricCell;
          revenueNew: number;
          revenueUpsell: number;
          actualRevenueNew: number | null;
          actualRevenueUpsell: number | null;
          customerCount: number;
          attachRate: number;
          target: {
            sqls: number;
            opps: number;
            wins: number;
            revenueNew: number;
            revenueUpsell: number;
            revenueTotal: number;
          } | null;
          targetRag: {
            sql: RagStatus | null;
            ocr: RagStatus | null;
            revenue: RagStatus | null;
          } | null;
        }
        interface HierarchyRow {
          id: string;
          label: string;
          level: 1 | 2 | 3;
          regionId?: number;
          sqlTypeId?: number;
          quarters: HierarchyQuarter[];
          rScore?: number;
        }

        // Collect unique quarters
        const quarterSet = new Set<string>();
        for (const f of forecastsData) quarterSet.add(`${f.year}-${f.quarter}`);
        for (const a of actualsData) quarterSet.add(`${a.year}-${a.quarter}`);
        const quarters = Array.from(quarterSet)
          .sort()
          .map(k => {
            const [y, q] = k.split("-").map(Number);
            return { year: y, quarter: q, label: `Q${q} ${String(y).slice(2)}` };
          });

        // Build forecast/actual/quarterly-metrics lookup maps
        const fMap = new Map<string, typeof forecastsData[0]>();
        for (const f of forecastsData) fMap.set(`${f.regionId}-${f.sqlTypeId}-${f.year}-${f.quarter}`, f);
        const aMap = new Map<string, typeof actualsData[0]>();
        for (const a of actualsData) aMap.set(`${a.regionId}-${a.sqlTypeId}-${a.year}-${a.quarter}`, a);
        const qmMap = new Map<string, typeof qMetricsData[0]>();
        for (const qm of qMetricsData) qmMap.set(`${qm.regionId}-${qm.sqlTypeId}-${qm.year}-${qm.quarter}`, qm);

        const OPPS_MULT = 100; // OPPORTUNITY_PRECISION_MULTIPLIER

        // Target data lookup: keyed by "regionId-year-quarter"
        const tMap = new Map<string, typeof targetData[0]>();
        for (const t of targetData) tMap.set(`${t.regionId}-${t.year}-${t.quarter}`, t);

        function buildQuarters(regionIds: number[], sqlTypeIds: number[]): HierarchyQuarter[] {
          return quarters.map(q => {
            const isHist = q.year < curYear || (q.year === curYear && q.quarter < curQ);
            let mSql = 0, mOcr = 0, aSql = 0, aOcr = 0, aOwr = 0;
            let revNew = 0, revUpsell = 0, custCount = 0;
            let upsellWonSum = 0;
            let aRevNew = 0, aRevUpsell = 0;
            let tSqls = 0, tOpps = 0, tWins = 0, tRevNew = 0, tRevUpsell = 0, tRevTotal = 0;
            let hasTarget = false;

            for (const rid of regionIds) {
              // Sum targets per region (targets are per-region, not per-sqlType)
              const tk = `${rid}-${q.year}-${q.quarter}`;
              const t = tMap.get(tk);
              if (t) {
                hasTarget = true;
                tSqls += t.targetSqls;
                tOpps += t.targetOpps;
                tWins += t.targetWins;
                tRevNew += t.targetNewBiz;
                tRevUpsell += t.targetUpsell;
                tRevTotal += t.targetTotal;
              }

              for (const sid of sqlTypeIds) {
                const fk = `${rid}-${sid}-${q.year}-${q.quarter}`;
                const f = fMap.get(fk);
                const a = aMap.get(fk);
                const qm = qmMap.get(fk);
                if (f) {
                  mSql += f.predictedSqls;
                  mOcr += f.predictedOpps / OPPS_MULT;
                  revNew += f.predictedRevenueNew;
                  revUpsell += f.predictedRevenueUpsell;
                }
                if (a) {
                  aSql += a.actualSqls;
                  aOcr += a.actualOpps;
                  aOwr += a.actualWins;
                  aRevNew += a.actualRevenueNew;
                  aRevUpsell += a.actualRevenueUpsell;
                }
                if (qm) {
                  custCount += qm.customerCount;
                  upsellWonSum += qm.totalUpsellWon;
                }
              }
            }

            const attachRate = custCount > 0 ? Math.round((upsellWonSum / custCount) * 10000) / 10000 : 0;
            const actualRevTotal = aRevNew + aRevUpsell;

            let targetRag: HierarchyQuarter["targetRag"] = null;
            if (hasTarget && isHist) {
              targetRag = {
                sql: tSqls > 0 ? computeRag(aSql, tSqls) : null,
                ocr: tOpps > 0 ? computeRag(aOcr, tOpps) : null,
                revenue: tRevTotal > 0 ? computeRag(actualRevTotal, tRevTotal) : null,
              };
            }

            return {
              year: q.year,
              quarter: q.quarter,
              label: q.label,
              isHistorical: isHist,
              sql: { model: mSql, actual: isHist ? aSql : null, rag: isHist ? computeRag(aSql, mSql) : null },
              ocr: { model: mOcr, actual: isHist ? aOcr : null, rag: isHist ? computeRag(aOcr, mOcr) : null },
              owr: { model: 0, actual: isHist ? aOwr : null, rag: null },
              revenueNew: revNew,
              revenueUpsell: revUpsell,
              actualRevenueNew: isHist ? aRevNew : null,
              actualRevenueUpsell: isHist ? aRevUpsell : null,
              customerCount: custCount,
              attachRate,
              target: hasTarget ? { sqls: tSqls, opps: tOpps, wins: tWins, revenueNew: tRevNew, revenueUpsell: tRevUpsell, revenueTotal: tRevTotal } : null,
              targetRag,
            };
          });
        }

        // Level 3: Motion rows
        const motions: HierarchyRow[][] = [];
        for (const region of regionsList) {
          const regionMotions: HierarchyRow[] = [];
          for (const st of sqlTypesList) {
            regionMotions.push({
              id: `motion-${region.name}-${st.name}`,
              label: st.displayName || st.name,
              level: 3,
              regionId: region.id,
              sqlTypeId: st.id,
              quarters: buildQuarters([region.id], [st.id]),
            });
          }
          motions.push(regionMotions);
        }

        // Level 2: Region rows
        const allSqlTypeIds = sqlTypesList.map(s => s.id);
        const regionRows: HierarchyRow[] = regionsList.map((region, ri) => {
          const rScoreEntry = rScores.perRegion.find(r => r.regionId === region.id && r.metricType === "overall");
          return {
            id: `region-${region.name}`,
            label: region.displayName || region.name,
            level: 2,
            regionId: region.id,
            quarters: buildQuarters([region.id], allSqlTypeIds),
            rScore: rScoreEntry && isFinite(rScoreEntry.rScore) ? rScoreEntry.rScore : undefined,
          };
        });

        // Level 1: Global row
        const allRegionIds = regionsList.map(r => r.id);
        const globalRow: HierarchyRow = {
          id: "global",
          label: "All Regions",
          level: 1,
          quarters: buildQuarters(allRegionIds, allSqlTypeIds),
          rScore: isFinite(rScores.global.overall) ? rScores.global.overall : undefined,
        };

        return {
          quarters: quarters.map(q => ({ year: q.year, quarter: q.quarter, label: q.label })),
          global: globalRow,
          regions: regionRows,
          motions,
          rScores,
        };
      }),

    playground: router({
      cascataTest: publicProcedure
        .input(
          z
            .object({
              page: z.number().int().min(1).default(1),
              pageSize: z.number().int().min(1).max(100).default(25),
              bypassCache: z.boolean().optional(),
            })
            .optional()
        )
        .query(async ({ input }) => {
          const hubspot = await import('./hubspot-client');
          const page = input?.page ?? 1;
          const pageSize = input?.pageSize ?? 25;
          const bypassCache = input?.bypassCache ?? false;
          return await hubspot.getHubSpotContacts(page, pageSize, bypassCache);
        }),

      cascataTestDeals: publicProcedure
        .input(
          z
            .object({
              page: z.number().int().min(1).default(1),
              pageSize: z.number().int().min(1).max(100).default(25),
              bypassCache: z.boolean().optional(),
            })
            .optional()
        )
        .query(async ({ input }) => {
          const hubspot = await import('./hubspot-client');
          const page = input?.page ?? 1;
          const pageSize = input?.pageSize ?? 25;
          const bypassCache = input?.bypassCache ?? false;
          return await hubspot.getHubSpotDeals(page, pageSize, bypassCache);
        }),
    }),
  }),

  // Revenue Targets management
  revenueTarget: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        year: z.number().int().min(2000).max(2100),
        quarter: z.number().int().min(1).max(4),
        targetSqls: z.number().int().min(0).default(0),
        targetOpps: z.number().int().min(0).default(0),
        targetWins: z.number().int().min(0).default(0),
        targetNewBiz: z.number().int().min(0),
        targetUpsell: z.number().int().min(0),
        targetTotal: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.upsertRevenueTarget(input);
        return { success: true };
      }),

    bulkUpsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        targets: z.array(z.object({
          regionId: z.number(),
          year: z.number().int().min(2000).max(2100),
          quarter: z.number().int().min(1).max(4),
          targetSqls: z.number().int().min(0).default(0),
          targetOpps: z.number().int().min(0).default(0),
          targetWins: z.number().int().min(0).default(0),
          targetNewBiz: z.number().int().min(0),
          targetUpsell: z.number().int().min(0),
          targetTotal: z.number().int().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
        for (const t of input.targets) {
          await db.upsertRevenueTarget({ companyId: input.companyId, ...t });
        }
        return { success: true, count: input.targets.length };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getRevenueTargetsByCompany(input.companyId);
      }),
  }),

  // Churn Data management
  churnData: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        year: z.number().int().min(2000).max(2100),
        quarter: z.number().int().min(1).max(4),
        churnAmount: z.number().int().min(0),
        maaArr: z.number().int().min(0).default(0),
        adjustment: z.number().int().default(0),
      }))
      .mutation(async ({ input }) => {
        await db.upsertChurnData(input);
        return { success: true };
      }),

    bulkUpsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        entries: z.array(z.object({
          regionId: z.number(),
          year: z.number().int().min(2000).max(2100),
          quarter: z.number().int().min(1).max(4),
          churnAmount: z.number().int().min(0),
          maaArr: z.number().int().min(0).default(0),
          adjustment: z.number().int().default(0),
        })),
      }))
      .mutation(async ({ input }) => {
        for (const e of input.entries) {
          await db.upsertChurnData({ companyId: input.companyId, ...e });
        }
        return { success: true, count: input.entries.length };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getChurnDataByCompany(input.companyId);
      }),
  }),

  // Headcount management
  headcount: router({
    upsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        regionId: z.number(),
        year: z.number().int().min(2000).max(2100),
        quarter: z.number().int().min(1).max(4),
        amCount: z.number().int().min(0),
        aeCount: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.upsertHeadcount(input);
        return { success: true };
      }),

    bulkUpsert: companyProtectedProcedure
      .input(z.object({
        companyId: z.number(),
        entries: z.array(z.object({
          regionId: z.number(),
          year: z.number().int().min(2000).max(2100),
          quarter: z.number().int().min(1).max(4),
          amCount: z.number().int().min(0),
          aeCount: z.number().int().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
        for (const e of input.entries) {
          await db.upsertHeadcount({ companyId: input.companyId, ...e });
        }
        return { success: true, count: input.entries.length };
      }),

    list: companyProtectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getHeadcountByCompany(input.companyId);
      }),
  }),

  // CARR (Contracted ARR) summary
  carr: router({
    summary: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const { computeCarrSummary } = await import("./carrEngine");
        return await computeCarrSummary(input.companyId);
      }),
  }),

  cascade: router({
    getSyncConfig: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        const config = db.parseSyncConfig(company);
        return config ?? {
          contactSqlDateProperty: "admin___first_became_a_sql_date",
          contactRegionProperty: "contact_pod",
          contactSqlTypeProperty: "type_of_sql",
          contactOppDateProperty: "admin___first_became_an_opportunity_date",
          dealRegionProperty: "deal_pod",
          dealSqlTypeProperty: "type_of_sql_associated_to_deal",
          dealAmountProperty: "amount",
          dealCloseDateProperty: "closedate",
          dealCreatedDateProperty: "createdate",
          closedWonStageIds: ["closedwon", "19291292", "96740205"],
          newDealTypeValues: ["newbusiness"],
          upsellDealTypeValues: ["existingbusiness", "customerrenewal"],
          regionAliases: {},
          sqlTypeAliases: {},
          fallbackRegion: "",
          fallbackSqlType: "",
          defaultSqlTimingSameQ: 8900,
          defaultSqlTimingNextQ: 1000,
          defaultSqlTimingTwoQ: 100,
          defaultOppTiming: [0.14, 0.33, 0.25, 0.15, 0.07, 0.04, 0.02],
          defaultConversionRate: 5000,
          companyCustomerField: "",
          companyCustomerValues: [],
          companyRegionProperty: "",
        };
      }),

    saveSyncConfig: protectedProcedure
      .input(z.object({
        companyId: z.number().int().min(1),
        config: z.object({
          contactSqlDateProperty: z.string().min(1),
          contactRegionProperty: z.string().min(1),
          contactSqlTypeProperty: z.string().min(1),
          contactOppDateProperty: z.string().min(1),
          dealRegionProperty: z.string().min(1),
          dealSqlTypeProperty: z.string().min(1),
          dealAmountProperty: z.string().min(1),
          dealCloseDateProperty: z.string().min(1),
          dealCreatedDateProperty: z.string().min(1),
          closedWonStageIds: z.array(z.string()).min(1),
          newDealTypeValues: z.array(z.string()),
          upsellDealTypeValues: z.array(z.string()),
          regionAliases: z.record(z.string(), z.string()).optional(),
          sqlTypeAliases: z.record(z.string(), z.string()).optional(),
          fallbackRegion: z.string().optional(),
          fallbackSqlType: z.string().optional(),
          defaultSqlTimingSameQ: z.number().int().min(0).max(10000).optional(),
          defaultSqlTimingNextQ: z.number().int().min(0).max(10000).optional(),
          defaultSqlTimingTwoQ: z.number().int().min(0).max(10000).optional(),
          defaultOppTiming: z.array(z.number().min(0).max(1)).optional(),
          defaultConversionRate: z.number().int().min(0).max(10000).optional(),
          companyCustomerField: z.string().optional(),
          companyCustomerValues: z.array(z.string()).optional(),
          companyRegionProperty: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await db.updateSyncConfig(input.companyId, input.config);
        return { success: true };
      }),

    sheet: protectedProcedure
      .input(z.object({
        companyId: z.number().int().min(1),
        motion: z.string().min(1),
        region: z.string().min(1),
      }))
      .query(async ({ input }) => {
        const { calculateCascadeSheet } = await import("./cascadeSheet");
        const regionNames = input.region.split("+");
        return await calculateCascadeSheet(input.companyId, input.motion, regionNames);
      }),

    triggerSync: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .mutation(async ({ input }) => {
        const { syncFromHubSpot } = await import("./hubspotSync");
        const stats = await syncFromHubSpot(input.companyId, { fullSync: false });
        return {
          success: stats.errors.length === 0,
          contactsFetched: stats.contactsFetched,
          dealsFetched: stats.dealsFetched,
          sqlHistoryUpserted: stats.sqlHistoryUpserted,
          actualsUpserted: stats.actualsUpserted,
          timingDistributionsUpserted: stats.timingDistributionsUpserted,
          durationMs: stats.durationMs,
          errors: stats.errors,
          dataQuality: stats.dataQuality,
        };
      }),

    dataQuality: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const latest = await db.getLatestDataQualityReport(input.companyId);
        if (!latest) return null;
        let report = null;
        try { report = JSON.parse(latest.reportJson); } catch { /* noop */ }
        return {
          syncTimestamp: latest.syncTimestamp,
          contactsFetched: latest.contactsFetched,
          contactsUsed: latest.contactsUsed,
          contactsSkipped: latest.contactsSkipped,
          coveragePct: latest.coveragePct / 100,
          dealsFetched: latest.dealsFetched,
          dealsUsed: latest.dealsUsed,
          dealsSkipped: latest.dealsSkipped,
          report,
        };
      }),

    dataQualityHistory: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1), limit: z.number().int().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        const rows = await db.getDataQualityHistory(input.companyId, input.limit);
        return rows.map(r => ({
          syncTimestamp: r.syncTimestamp,
          contactsFetched: r.contactsFetched,
          contactsUsed: r.contactsUsed,
          contactsSkipped: r.contactsSkipped,
          coveragePct: r.coveragePct / 100,
          dealsFetched: r.dealsFetched,
          dealsUsed: r.dealsUsed,
          dealsSkipped: r.dealsSkipped,
        }));
      }),

    availableSheets: protectedProcedure
      .input(z.object({ companyId: z.number().int().min(1) }))
      .query(async ({ input }) => {
        const sqlTypes = await db.getSqlTypesByCompany(input.companyId);
        const regions = await db.getRegionsByCompany(input.companyId);
        const history = await db.getSqlHistoryByCompany(input.companyId);

        const combosWithData = new Set<string>();
        for (const h of history) {
          if ((h.volume ?? 0) > 0) combosWithData.add(`${h.sqlTypeId}|${h.regionId}`);
        }

        const sheets: Array<{ motion: string; motionDisplay: string; region: string; regionDisplay: string; label: string }> = [];
        for (const st of sqlTypes) {
          for (const r of regions) {
            if (combosWithData.has(`${st.id}|${r.id}`)) {
              const motionDisplay = st.displayName || st.name;
              const regionDisplay = r.displayName || r.name;
              sheets.push({
                motion: st.name,
                motionDisplay,
                region: r.name,
                regionDisplay,
                label: `${motionDisplay} ${regionDisplay}`,
              });
            }
          }
        }

        return { sheets };
      }),
  }),
});

export type AppRouter = typeof appRouter;
