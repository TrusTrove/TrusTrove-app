"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minDate?: Date;
  /** Id for the trigger button, so an external `<label htmlFor>` can target it. */
  id?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  minDate,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-labelledby={ariaLabelledBy}
          variant="outline"
          className={cn(
            "w-full min-w-0 justify-start text-left font-mono text-xs bg-[#080c10] border-border text-white min-h-[44px]",
            !value && "text-slate-500",
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {/* Truncate long formatted dates instead of widening the form (#999). */}
          <span className="min-w-0 truncate">
            {selectedDate ? format(selectedDate, "PPP") : "Select due date"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          disabled={(date) => {
            if (minDate) {
              const min = new Date(minDate);
              min.setHours(0, 0, 0, 0);
              const candidate = new Date(date);
              candidate.setHours(0, 0, 0, 0);
              return candidate < min;
            }
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
