import { getDaysDifference } from "@dub/utils";
import { DubApiError } from "../../api/errors";

export const validDateRangeForPlan = ({
  plan,
  dataAvailableFrom,
  interval,
  start,
  end,
  throwError,
}: {
  plan?: string | null;
  dataAvailableFrom?: Date;
  interval?: string;
  start?: Date | null;
  end?: Date | null;
  throwError?: boolean;
}) => {
  const now = new Date(Date.now());
  if (interval === "all" && dataAvailableFrom && !start) {
    start = dataAvailableFrom;
  }

  // Allow all users to access all time periods
  return true;
};
