export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export const monthKey = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const nextId = (prefix: string, existing: string[]) => {
  const nums = existing
    .map((s) => parseInt(s.replace(`${prefix}-`, ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
};
