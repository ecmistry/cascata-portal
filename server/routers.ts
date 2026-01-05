import { z } from "zod";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, companyProtectedProcedure, adminProcedure, router } from "./_core/trpc";
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

  // Dashboard router
  dashboard: router({
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
          const mariadbPlayground = await import('./mariadb-playground');
          const page = input?.page ?? 1;
          const pageSize = input?.pageSize ?? 25;
          const bypassCache = input?.bypassCache ?? false;
          return await mariadbPlayground.getHubSpotContacts(page, pageSize, bypassCache);
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
          const mariadbPlayground = await import('./mariadb-playground');
          const page = input?.page ?? 1;
          const pageSize = input?.pageSize ?? 25;
          const bypassCache = input?.bypassCache ?? false;
          return await mariadbPlayground.getHubSpotDeals(page, pageSize, bypassCache);
        }),

      getAllContactColumns: publicProcedure
        .query(async () => {
          const mariadbPlayground = await import('./mariadb-playground');
          return await mariadbPlayground.getAllContactPropertyKeys();
        }),

      getAllDealColumns: publicProcedure
        .query(async () => {
          const mariadbPlayground = await import('./mariadb-playground');
          return await mariadbPlayground.getAllDealPropertyKeys();
        }),

      syncHubSpot: adminProcedure
        .mutation(async () => {
          // Trigger manual sync by running the connector in --once mode
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          try {
            // Run the connector script directly with --once flag
            const connectorPath = '/home/ec2-user/cascade_portal/hubspot-connector/hubspot-mariadb-connector';
            const command = `cd ${connectorPath} && npm run start:once`;
            
            // Run in background and don't wait for completion
            exec(command, { 
              cwd: connectorPath,
              env: {
                ...process.env,
                // Environment variables should be set in the system or PM2 config
                // HUBSPOT_API_KEY, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD are inherited from process.env
                DB_NAME: 'cascade_portal',
                SYNC_INTERVAL_MINUTES: '15',
                SYNC_BUFFER_MINUTES: '5',
                RATE_LIMIT_REQUESTS: '90',
                LOG_LEVEL: 'info',
              }
            }, (error, stdout, stderr) => {
              if (error) {
                console.error('[HubSpot Sync] Error:', error);
              }
              if (stdout) {
                console.log('[HubSpot Sync] Output:', stdout);
              }
              if (stderr) {
                console.error('[HubSpot Sync] Stderr:', stderr);
              }
            });
            
            return {
              success: true,
              message: 'HubSpot sync triggered successfully. The sync is running in the background.',
            };
          } catch (error: any) {
            console.error('[HubSpot Sync] Error triggering sync:', error);
            return {
              success: false,
              message: error.message || 'Failed to trigger sync',
            };
          }
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
