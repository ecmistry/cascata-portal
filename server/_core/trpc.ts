import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG, ACCESS_DENIED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Middleware to verify user has access to a company
 * Extracts companyId from input and verifies ownership
 */
export const verifyCompanyAccess = t.middleware(async ({ ctx, next, input }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  /**
   * Type guard to check if input has companyId
   */
  function hasCompanyId(input: unknown): input is { companyId: number } {
    return typeof input === 'object' && input !== null && 'companyId' in input && typeof (input as { companyId: unknown }).companyId === 'number';
  }

  const companyId = hasCompanyId(input) ? input.companyId : undefined;
  if (companyId !== undefined) {
    const company = await db.getCompanyById(companyId);
    if (!company) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    }
    if (company.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: ACCESS_DENIED_ERR_MSG });
    }
  }

  return next({ ctx });
});

/**
 * Procedure that requires authentication AND company access verification
 */
export const companyProtectedProcedure = protectedProcedure.use(verifyCompanyAccess);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
