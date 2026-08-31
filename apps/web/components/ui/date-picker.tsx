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
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-mono text-xs bg-[#080c10] border-border text-white min-h-[44px]",
            !value && "text-slate-500",
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : "Select due date"}
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
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date < today;
            }
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
