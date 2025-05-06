import z from "../zod";
import { commissionDeletedEventSchemaTB } from "../zod/schemas/sales";
import { tb } from "./client";

export const recordCommissionDeleted = tb.buildIngestEndpoint({
  datasource: "dub_commission_deleted_events",
  event: commissionDeletedEventSchemaTB,
});

export const recordCommissionDeletedWithTimestamp = tb.buildIngestEndpoint({
  datasource: "dub_commission_deleted_events",
  event: commissionDeletedEventSchemaTB.extend({
    timestamp: z.string(),
  }),
}); 