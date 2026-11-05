export function toMinorUnits(decimal: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim());
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] || "").padEnd(2, "0"));
  const result = whole * 100 + fraction;
  return Number.isSafeInteger(result) ? sign * result : 0;
}

export function formatIls(value: string | number): string {
  const minor = typeof value === "number" ? value : toMinorUnits(value);
  const shekels = Math.trunc(Math.abs(minor) / 100);
  const agorot = Math.abs(minor) % 100;
  const formatted = new Intl.NumberFormat("ar-PS", { maximumFractionDigits: 0 }).format(shekels);
  const amount = agorot ? `${formatted}.${String(agorot).padStart(2, "0")}` : formatted;
  return `${minor < 0 ? "−" : ""}${amount} ₪`;
}
