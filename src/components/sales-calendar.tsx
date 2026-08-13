import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Divider, Empty, Row } from "@/components/kit";
import { money, shortTime } from "@/lib/format";
import type { Sale } from "@/lib/queries";

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const keyOf = (y: number, m: number, day: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const monthName = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** monday-first weekday index of the first of the month */
const leadingBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

const WEEKDAYS = ["m", "t", "w", "t", "f", "s", "s"] as const;

/**
 * The month laid out as a calendar: every day shows what was taken that day and
 * tapping one opens the sales made on it.
 */
export function SalesCalendar({ sales }: { sales: Sale[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [picked, setPicked] = useState<string>(localDay(today.toISOString()));

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const s of sales) {
      const day = localDay(s.sold_at);
      const cell = map.get(day) ?? { total: 0, count: 0 };
      cell.total += Number(s.sold_price);
      cell.count += 1;
      map.set(day, cell);
    }
    return map;
  }, [sales]);

  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const blanks = leadingBlanks(cursor.y, cursor.m);
  const todayKey = localDay(today.toISOString());

  const step = (by: number) => {
    const d = new Date(cursor.y, cursor.m + by, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pickedRows = sales
    .filter((s) => localDay(s.sold_at) === picked)
    .sort((a, b) => (a.sold_at < b.sold_at ? 1 : -1));
  const pickedTotal = pickedRows.reduce((sum, s) => sum + Number(s.sold_price), 0);
  const monthTotal = [...byDay.entries()]
    .filter(([k]) => k.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`))
    .reduce((sum, [, v]) => sum + v.total, 0);

  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={() => step(-1)}
          aria-label="previous month"
          className="press text-muted-foreground"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[15px]">{monthName(cursor.y, cursor.m).toLowerCase()}</p>
          <p className="text-xs text-muted-foreground">{money(monthTotal)} this month</p>
        </div>
        <button
          onClick={() => step(1)}
          aria-label="next month"
          className="press text-muted-foreground"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}${i}`} className="py-1 text-center text-xs text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = keyOf(cursor.y, cursor.m, day);
          const cell = byDay.get(key);
          const isPicked = key === picked;
          return (
            <button
              key={key}
              onClick={() => setPicked(key)}
              className={`press flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${
                isPicked
                  ? "bg-primary text-primary-foreground"
                  : cell
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground"
              } ${key === todayKey && !isPicked ? "ring-1 ring-foreground/40" : ""}`}
            >
              <span>{day}</span>
              {cell ? (
                <span className={`text-[10px] ${isPicked ? "" : "text-muted-foreground"}`}>
                  {cell.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="px-4 pb-4 pt-5">
        <p className="text-xs text-muted-foreground">
          {picked === todayKey
            ? "today"
            : new Date(`${picked}T12:00:00`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{money(pickedTotal)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pickedRows.length} {pickedRows.length === 1 ? "sale" : "sales"}
        </p>
      </section>
      <Divider />

      {pickedRows.length === 0 ? (
        <Empty text="nothing was sold on this day." />
      ) : (
        pickedRows.map((s) => (
          <Row key={s.id}>
            <Link
              to="/receipt/$group"
              params={{ group: s.group_id ?? s.id }}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-[15px]">{s.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {s.receipt_no} · {shortTime(s.sold_at)} · {s.method}
                {s.sold_by_name ? ` · ${s.sold_by_name.toLowerCase()}` : ""}
              </p>
            </Link>
            <span className="text-[15px]">{money(s.sold_price)}</span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </Row>
        ))
      )}
    </>
  );
}
