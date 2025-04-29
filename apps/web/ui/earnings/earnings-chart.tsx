"use client";

import { DUB_PARTNERS_ANALYTICS_INTERVAL, intervals } from "@/lib/analytics/constants";
import { formatDateTooltip } from "@/lib/analytics/format-date-tooltip";
import { IntervalOptions } from "@/lib/analytics/types";
import SimpleDateRangePicker from "@/ui/shared/simple-date-range-picker";
import { Filter, LoadingSpinner, ToggleGroup, useRouterStuff } from "@dub/ui";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@dub/ui/charts";
import { Hyperlink, Sliders } from "@dub/ui/icons";
import { cn, currencyFormatter } from "@dub/utils";
import { endOfDay, startOfDay } from "date-fns";
import { Fragment, useMemo, useState } from "react";

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

  // Mock data for earnings chart
  const mockData = useMemo(() => {
    const now = new Date();
    const dates = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      return date;
    });

    return dates.map((date) => ({
      date,
      values: {
        total: Math.floor(Math.random() * 10000),
        linkId1: Math.floor(Math.random() * 5000),
        linkId2: Math.floor(Math.random() * 3000),
      },
    }));
  }, []);

  const mockSeries = useMemo(
    () => [
      {
        id: "linkId1",
        isActive: true,
        valueAccessor: (d) => (d.values.linkId1 || 0) / 100,
        colorClassName: LINE_COLORS[0],
      },
      {
        id: "linkId2",
        isActive: true,
        valueAccessor: (d) => (d.values.linkId2 || 0) / 100,
        colorClassName: LINE_COLORS[1],
      },
    ],
    [],
  );

  // Mock total
  const total = useMemo(() => {
    return mockData.reduce((acc, { values }) => acc + values.total, 0);
  }, [mockData]);

  return (
    <div className="flex flex-col gap-6">
      <EarningsChartControls />
      <div className="rounded-lg border border-neutral-200 p-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-500">Total Earnings</span>
            <div className="mt-1">
              <span className="text-lg font-medium leading-none text-neutral-800">
                {currencyFormatter(total / 100)}
              </span>
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
          <TimeSeriesChart
            data={mockData}
            series={mockSeries}
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
                    {mockSeries.map(({ id, colorClassName, valueAccessor }) => (
                      <Fragment key={id}>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              colorClassName,
                              "size-2 shrink-0 rounded-sm bg-current opacity-50 shadow-[inset_0_0_0_1px_#0003]",
                            )}
                          />
                          <span className="min-w-0 truncate font-medium text-neutral-700">
                            {id === "linkId1" ? "Product Link 1" : "Product Link 2"}
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
            <Areas />
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