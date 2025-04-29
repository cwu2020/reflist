import { CommissionStatus, EventType } from "@dub/prisma/client";
import z from "zod";
import { analyticsQuerySchema } from "./analytics";

export const getWorkspaceEarningsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(10),
    sortBy: z.enum(["createdAt", "amount", "earnings"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    type: z.nativeEnum(EventType).optional(),
    status: z.nativeEnum(CommissionStatus).optional(),
    linkId: z.string().optional(),
    customerId: z.string().optional(),
    payoutId: z.string().optional(),
  })
  .merge(analyticsQuerySchema.partial());

export const getWorkspaceEarningsCountQuerySchema = z
  .object({
    type: z.nativeEnum(EventType).optional(),
    status: z.nativeEnum(CommissionStatus).optional(),
    linkId: z.string().optional(),
    customerId: z.string().optional(),
    payoutId: z.string().optional(),
  })
  .merge(analyticsQuerySchema.partial()); 