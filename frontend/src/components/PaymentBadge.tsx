export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PAID: ["Төлөгдсөн", "text-green-400"],
    PENDING: ["Хүлээгдэж буй", "text-gold"],
    FAILED: ["Амжилтгүй", "text-brand"],
    REFUNDED: ["Буцаагдсан", "text-white/50"],
  };
  const [label, cls] = map[status] ?? [status, "text-white/50"];
  return <span className={`text-xs font-semibold ${cls}`}>{label}</span>;
}
