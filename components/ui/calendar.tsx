"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type CalendarProps = {
  selected?: Date | null;
  onSelect: (date: Date | null) => void;
  minDate?: Date;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function addMonths(d: Date, n: number) { const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }

export function Calendar({ selected, onSelect, minDate }: CalendarProps): ReactNode {
  const today = useMemo(()=>startOfDay(new Date()),[]);
  const min = useMemo(()=> minDate ? startOfDay(minDate) : undefined,[minDate]);
  const [view, setView] = useState<Date>(()=> {
    const base = selected ? startOfDay(selected) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstOffset = (()=>{ const d=new Date(year,month,1).getDay(); return d===0?6:d-1; })();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells:{date:Date; current:boolean}[]=[];
  for(let i=firstOffset-1;i>=0;i--) cells.push({date:new Date(year,month-1,daysInPrev-i), current:false});
  for(let d=1; d<=daysInMonth; d++) cells.push({date:new Date(year,month,d), current:true});
  const rem= 35 - cells.length; // 5 rows is enough, keep 35 not 42 for compactness
  // ensure we show full weeks: if rem <0 then 42, else keep 35 minimal
  const total = cells.length <=35 ? 35 : 42;
  for(let d=1; cells.length < total; d++) cells.push({date:new Date(year,month+1,d), current:false});

  const prevDisabled = (()=>{ if(!min) return false; const last=new Date(year,month,0); return startOfDay(last) < min; })();

  return (
    <div className="w-full select-none rounded-2xl border border-border bg-bg-primary p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-heading text-sm font-semibold tracking-tight text-text-primary">{MONTHS[month]} {year}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous month" disabled={prevDisabled} onClick={()=>setView(v=>addMonths(v,-1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Next month" onClick={()=>setView(v=>addMonths(v,1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map(w=><div key={w} className="py-1 text-center font-heading text-[10px] font-medium tracking-widest text-text-muted">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map(({date, current})=>{
          const isToday=isSameDay(date,today);
          const isSelected=selected?isSameDay(date,selected):false;
          const disabled = (min ? startOfDay(date) < min : false) || !current;
          return (
            <button key={date.toISOString()} type="button" role="gridcell" aria-selected={isSelected} disabled={disabled}
              onClick={()=>onSelect(startOfDay(date))}
              className={[
                "relative flex h-8 w-full items-center justify-center rounded-full text-sm transition-colors focus-ring",
                isSelected ? "bg-accent text-text-on-accent font-semibold shadow-[0_0_10px_var(--accent-ring)]" :
                disabled ? "text-text-muted/30 cursor-not-allowed" : "text-text-primary hover:bg-bg-surface-hover font-medium",
                isToday && !isSelected ? "ring-1 ring-accent" : "",
              ].join(" ")}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
