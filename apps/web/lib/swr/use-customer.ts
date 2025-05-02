import { fetcher } from "@dub/utils";
import useSWR from "swr";
import { z } from "zod";
import { CustomerEnriched, CustomerProps } from "../types";
import { getCustomersQuerySchema } from "../zod/schemas/customers";
import useWorkspace from "./use-workspace";

const partialQuerySchema = getCustomersQuerySchema.pick({
  includeExpandedFields: true,
});

export default function useCustomer<
  T extends CustomerProps | CustomerEnriched = CustomerProps,
>({
  customerId,
  query,
  enabled = true,
}: {
  customerId?: T["id"];
  query?: z.infer<typeof partialQuerySchema>;
  enabled?: boolean;
}) {
  const { id: workspaceId } = useWorkspace();

  // Don't make the API call if customerId is undefined or not a valid string
  const shouldFetch = enabled && 
    workspaceId && 
    customerId && 
    typeof customerId === 'string' && 
    customerId !== 'undefined';

  const { data, error, isLoading } = useSWR<T>(
    shouldFetch
      ? `/api/customers/${customerId}?${new URLSearchParams({
          workspaceId: workspaceId,
          ...query,
        } as Record<string, any>).toString()}`
      : null,
    fetcher,
  );

  return {
    data,
    isLoading,
    error,
  };
}
