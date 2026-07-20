"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export type DateRange = { from: Date | undefined; to: Date | undefined };

export const DateRangePicker = ({ dateRange, onChange }: { dateRange: DateRange; onChange: (range: DateRange | undefined) => void }) => {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange.from ? (
            dateRange.to ? (
              `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
            ) : (
              format(dateRange.from, "dd/MM/yyyy")
            )
          ) : (
            <span>{t("pickADate")}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={onChange}
          numberOfMonths={2}
          toDate={new Date()}
        />
      </PopoverContent>
    </Popover>
  );
};
