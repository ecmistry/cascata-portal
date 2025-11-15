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
          year: z.number(),
          quarter: z.number().min(1).max(4),
          volume: z.number().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
        const { companyId, records } = input;
        
        // Get region and sqlType mappings
        const regions = await db.getRegionsByCompany(companyId);
        const sqlTypes = await db.getSqlTypesByCompany(companyId);
        
        const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
        const sqlTypeMap = new Map(sqlTypes.map(s => [s.name.toLowerCase(), s.id]));
        
        let imported = 0;
        for (const record of records) {
          const regionId = regionMap.get(record.region.toLowerCase());
          const sqlTypeId = sqlTypeMap.get(record.sqlType.toLowerCase());
          
          if (!regionId || !sqlTypeId) continue;
          
          await db.upsertSqlHistory({
            companyId,
            regionId,
            sqlTypeId,
            year: record.year,
            quarter: record.quarter,
            volume: record.volume,
          });
          imported++;
        }
        
        return { imported };
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
});

export type AppRouter = typeof appRouter;
