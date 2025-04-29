"use client";

import { DUB_PARTNERS_ANALYTICS_INTERVAL, intervals } from "@/lib/analytics/constants";
import { formatDateTooltip } from "@/lib/analytics/format-date-tooltip";
import { IntervalOptions } from "@/lib/analytics/types";
import { EarningsTimeseriesItem, useWorkspaceEarningsTimeseries } from "@/lib/swr/use-workspace-earnings-timeseries";
import SimpleDateRangePicker from "@/ui/shared/simple-date-range-picker";
import { Filter, LoadingSpinner, ToggleGroup, useRouterStuff } from "@dub/ui";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@dub/ui/charts";
import { Hyperlink, Sliders } from "@dub/ui/icons";
import { cn, currencyFormatter } from "@dub/utils";
import { endOfDay, startOfDay } from "date-fns";
import { Fragment, useMemo } from "react";

const LINE_COLORS = [
  "text-teal-500",
  "text-purple-500",
  "text-blue-500",
  "text-green-500",
  "text-orange-500",
];

const EVENT_TYPE_LINE_COLORS = {
  sale: "text-teal-500",
  lead: "text-purple-500",
  click: "text-blue-500",
};

// Interface for chart data point
interface ChartDataPoint {
  date: Date;
  values: {
    total: number;
    [key: string]: number;
  };
}

// Interface for chart series
interface ChartSeries {
  id: string;
  isActive: boolean;
  valueAccessor: (d: ChartDataPoint) => number;
  colorClassName: string;
}

export function EarningsChart() {
  const { queryParams, searchParamsObj } = useRouterStuff();

  const {
    start,
    end,
    interval = DUB_PARTNERS_ANALYTICS_INTERVAL,
    groupBy = "linkId",
  } = searchParamsObj as {
    start?: string;
    end?: string;
    interval?: IntervalOptions;
    groupBy?: "linkId" | "type";
  };

  // Get real earnings data from the API
  const { data, isLoading, error } = useWorkspaceEarningsTimeseries({
    interval,
    groupBy,
    start: start ? startOfDay(new Date(start)) : undefined,
    end: end ? endOfDay(new Date(end)) : undefined,
  });

  // Process data for the chart
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data) return [];
    return data.map(item => ({
      date: new Date(item.start),
      values: {
        total: item.earnings,
        ...(item.data || {})
      },
    }));
  }, [data]);

  // Create series for the chart
  const series = useMemo<ChartSeries[]>(() => {
    if (!data || data.length === 0 || !data[0]?.data) {
      // Add a default series to prevent the error
      return [{
        id: 'total',
        isActive: true,
        valueAccessor: (d: ChartDataPoint) => ((d.values.total || 0) / 100),
        colorClassName: LINE_COLORS[0],
      }];
    }
    
    // Get unique keys from all data points (excluding 'earnings' which is the total)
    const keys = new Set<string>();
    data.forEach(item => {
      if (item.data) {
        Object.keys(item.data).forEach(key => {
          if (key !== 'earnings') keys.add(key);
        });
      }
    });
    
    // If no keys were found, use a fallback
    if (keys.size === 0) {
      return [{
        id: 'total',
        isActive: true,
        valueAccessor: (d: ChartDataPoint) => ((d.values.total || 0) / 100),
        colorClassName: LINE_COLORS[0],
      }];
    }
    
    // Create series for each key
    return Array.from(keys).map((key, index) => ({
      id: key,
      isActive: true,
      valueAccessor: (d: ChartDataPoint) => ((d.values[key] || 0) / 100),
      colorClassName: groupBy === "type" 
        ? EVENT_TYPE_LINE_COLORS[key as keyof typeof EVENT_TYPE_LINE_COLORS] || LINE_COLORS[index % LINE_COLORS.length]
        : LINE_COLORS[index % LINE_COLORS.length],
    }));
  }, [data, groupBy]);

  // Calculate total earnings
  const total = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((acc, item) => acc + item.earnings, 0);
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <EarningsChartControls />
      <div className="rounded-lg border border-neutral-200 p-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-500">Total Earnings</span>
            <div className="mt-1">
              {isLoading ? (
                <div className="h-7 w-24 animate-pulse rounded-md bg-neutral-200" />
              ) : (
                <span className="text-lg font-medium leading-none text-neutral-800">
                  {currencyFormatter(total / 100)}
                </span>
              )}
            </div>
          </div>

          <ToggleGroup
            className="flex w-fit shrink-0 items-center gap-1 border-neutral-100 bg-neutral-100"
            optionClassName="h-8 px-2.5 flex items-center justify-center"
            indicatorClassName="border border-neutral-200 bg-white"
            options={[
              {
                label: (
                  <div className="flex items-center gap-1.5 text-neutral-600">
                    <Hyperlink className="size-4" />
                    <span className="text-sm">Link</span>
                  </div>
                ),
                value: "linkId",
              },
              {
                label: (
                  <div className="flex items-center gap-1.5 text-neutral-600">
                    <Sliders className="size-4" />
                    <span className="text-sm">Type</span>
                  </div>
                ),
                value: "type",
              },
            ]}
            selected={groupBy}
            selectAction={(option) => {
              queryParams({
                set: { groupBy: option },
                scroll: false,
              });
            }}
          />
        </div>
        <div className="mt-5 h-80">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-sm text-neutral-500">Failed to load earnings data.</p>
            </div>
          ) : chartData.length ? (
            <TimeSeriesChart
              data={chartData || []}
              series={series || []}
              tooltipClassName="p-0"
              tooltipContent={(d) => {
                return (
                  <>
                    <div className="flex justify-between border-b border-neutral-200 p-3 text-xs">
                      <p className="font-medium leading-none text-neutral-900">
                        {formatDateTooltip(d.date, {
                          interval,
                          start,
                          end,
                        })}
                      </p>
                      <p className="text-right leading-none text-neutral-500">
                        {currencyFormatter((d.values.total || 0) / 100)}
                      </p>
                    </div>
                    <div className="grid max-w-64 grid-cols-[minmax(0,1fr),min-content] gap-x-6 gap-y-2 px-4 py-3 text-xs">
                      {(series || []).filter(s => s && s.id).map(({ id, colorClassName, valueAccessor }) => (
                        <Fragment key={id}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                colorClassName,
                                "size-2 shrink-0 rounded-sm bg-current opacity-50 shadow-[inset_0_0_0_1px_#0003]",
                              )}
                            />
                            <span className="min-w-0 truncate font-medium text-neutral-700">
                              {id}
                            </span>
                          </div>
                          <p className="text-right text-neutral-500">
                            {currencyFormatter(valueAccessor(d))}
                          </p>
                        </Fragment>
                      ))}
                    </div>
                  </>
                );
              }}
            >
              <Areas
                seriesStyles={series.map(s => ({
                  id: s.id,
                  gradientClassName: s.colorClassName,
                  lineClassName: s.colorClassName
                }))}
              />
              <XAxis
                tickFormat={(d) =>
                  formatDateTooltip(d, {
                    interval,
                    start,
                    end,
                  })
                }
              />
              <YAxis
                showGridLines
                tickFormat={(v) => `${currencyFormatter(v)}`}
              />
            </TimeSeriesChart>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-sm text-neutral-500">No earnings data available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EarningsChartControls() {
  const { queryParams, searchParamsObj } = useRouterStuff();
  
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row">
        <SimpleDateRangePicker
          className="w-full sm:min-w-[200px] md:w-fit"
          align="start"
        />
      </div>
    </div>
  );
} 