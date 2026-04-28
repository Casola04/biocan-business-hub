export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export const monthKey = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const formatMonthKey = (mk: string | null | undefined) => {
  if (!mk || mk.length !== 6) return mk ?? "—";
  const year = mk.slice(0, 4);
  const monthIdx = parseInt(mk.slice(4), 10) - 1;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[monthIdx] ?? mk.slice(4)} ${year}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const nextId = (prefix: string, existing: string[]) => {
  const nums = existing
    .map((s) => parseInt(s.replace(`${prefix}-`, ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
};
