import { z } from "zod";
import os from "os";
import { execSync } from "child_process";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { sql } from "drizzle-orm";
import * as db from "../db";

const startTime = Date.now();

function getCpuUsage(): { percent: number; cores: number; model: string } {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  const percent = Math.round(((totalTick - totalIdle) / totalTick) * 100);
  return { percent, cores: cpus.length, model: cpus[0]?.model ?? "Unknown" };
}

function getDiskUsage(): { totalGb: number; usedGb: number; availGb: number; usedPercent: number } {
  try {
    const output = execSync("df -BG / | tail -1", { encoding: "utf-8" });
    const parts = output.trim().split(/\s+/);
    const totalGb = parseFloat(parts[1]) || 0;
    const usedGb = parseFloat(parts[2]) || 0;
    const availGb = parseFloat(parts[3]) || 0;
    const usedPercent = parseFloat(parts[4]) || 0;
    return { totalGb, usedGb, availGb, usedPercent };
  } catch {
    return { totalGb: 0, usedGb: 0, availGb: 0, usedPercent: 0 };
  }
}

function getLoadAverage(): { load1: number; load5: number; load15: number } {
  const [load1, load5, load15] = os.loadavg();
  return {
    load1: Math.round(load1 * 100) / 100,
    load5: Math.round(load5 * 100) / 100,
    load15: Math.round(load15 * 100) / 100,
  };
}

async function getDatabaseStats(): Promise<{
  sizeOnDiskMb: number;
  tableStats: Array<{ name: string; rows: number; sizeMb: number }>;
  totalRows: number;
}> {
  const database = await db.getDb();
  if (!database) return { sizeOnDiskMb: 0, tableStats: [], totalRows: 0 };

  try {
    const result = await database.execute(
      sql`SELECT TABLE_NAME as name, TABLE_ROWS as \`rows\`,
       ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as sizeMb
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`
    );

    const rows = (result as any)[0] as Array<{ name: string; rows: number; sizeMb: number }>;
    const tableStats = rows.map(r => ({
      name: String(r.name),
      rows: Number(r.rows) || 0,
      sizeMb: Number(r.sizeMb) || 0,
    }));

    const totalRows = tableStats.reduce((s, t) => s + t.rows, 0);
    const sizeOnDiskMb = tableStats.reduce((s, t) => s + t.sizeMb, 0);

    return { sizeOnDiskMb: Math.round(sizeOnDiskMb * 100) / 100, tableStats, totalRows };
  } catch {
    return { sizeOnDiskMb: 0, tableStats: [], totalRows: 0 };
  }
}

async function getLastSyncInfo(): Promise<{ lastSync: string | null; syncEnabled: boolean }> {
  const database = await db.getDb();
  if (!database) return { lastSync: null, syncEnabled: false };

  try {
    const result = await database.execute(
      sql`SELECT bigqueryLastSync, bigqueryEnabled FROM companies LIMIT 1`
    );
    const rows = (result as any)[0] as Array<{ bigqueryLastSync: Date | null; bigqueryEnabled: number }>;
    if (rows.length > 0) {
      const lastSync = rows[0].bigqueryLastSync;
      return {
        lastSync: lastSync && lastSync.getTime() > 0 ? lastSync.toISOString() : null,
        syncEnabled: true,
      };
    }
  } catch { /* ignore */ }
  return { lastSync: null, syncEnabled: false };
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  metrics: adminProcedure.query(async () => {
    const mem = process.memoryUsage();
    const cpu = getCpuUsage();
    const disk = getDiskUsage();
    const load = getLoadAverage();
    const dbStats = await getDatabaseStats();
    const syncInfo = await getLastSyncInfo();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return {
      process: {
        uptimeSeconds,
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
        nodeVersion: process.version,
        pid: process.pid,
      },
      system: {
        cpu,
        totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
        usedMemoryMb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        memoryUsedPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        disk,
        load,
        platform: os.platform(),
        hostname: os.hostname(),
        osUptime: os.uptime(),
      },
      database: dbStats,
      sync: syncInfo,
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
