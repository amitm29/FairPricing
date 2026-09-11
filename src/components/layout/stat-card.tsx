import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * A dashboard metric. The value is the hero; the icon sits in a tinted chip so it
 * reads as a label rather than competing with the number.
 */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  isLoading,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  isLoading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        {href && (
          <ArrowUpRight
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        )}
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-1.5 h-9 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </>
  );

  if (!href) return <div className="rounded-xl border bg-card p-5">{body}</div>;

  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      {body}
    </Link>
  );
}
