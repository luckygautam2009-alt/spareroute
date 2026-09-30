import {
  Users,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';

export default function StatCards({ data }) {
  const customerCount = data?.customers?.length ?? 0;
  const goldCount = data?.customers?.filter((c) => String(c.tier).toLowerCase() === 'gold').length ?? 0;

  const orderCount = data?.orders?.length ?? 0;
  const deliveredCount = data?.orders?.filter((o) => String(o.status).toLowerCase() === 'delivered').length ?? 0;

  const paymentCount = data?.payments?.length ?? 0;
  const totalVolume = data?.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;

  const refundCount = data?.refunds?.length ?? 0;
  const ticketCount = data?.tickets?.length ?? 0;

  const stats = [
    {
      title: 'Enrolled Customers',
      value: customerCount,
      subtext: `${goldCount} Gold tier members`,
      icon: Users,
      badge: 'Active Base',
    },
    {
      title: 'Logged Orders',
      value: orderCount,
      subtext: `${deliveredCount} delivered successfully`,
      icon: ShoppingBag,
      badge: 'Fulfillment',
    },
    {
      title: 'Payment Transactions',
      value: paymentCount,
      subtext: `₹${totalVolume.toLocaleString('en-IN')} volume`,
      icon: CreditCard,
      badge: 'Settled',
    },
    {
      title: 'Refunds & Escalations',
      value: refundCount,
      subtext: `${ticketCount} support tickets`,
      icon: RotateCcw,
      badge: 'Audited',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4 shrink-0">
      {stats.map((stat, i) => {
        const Icon = stat.icon;

        return (
          <div
            key={i}
            className="bg-ink-light rounded-xl p-4 border border-border hover:border-amber/40 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-medium text-muted tracking-tight truncate">
                {stat.title}
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-dim text-amber flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-2xl font-bold font-sans text-paper tracking-tight leading-none">
                {stat.value}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber/70" />
                <span className="truncate">{stat.subtext}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
