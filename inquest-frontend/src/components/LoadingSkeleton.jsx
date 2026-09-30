export default function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Evidence Graph skeleton */}
      <div className="rounded-2xl border border-border-strong bg-ink-light overflow-hidden shadow-sm" style={{ height: 540 }}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-2 h-6 rounded-full" />
            <div className="space-y-1.5">
              <div className="skeleton h-5 w-36 rounded-md" />
              <div className="skeleton h-3 w-48 rounded" />
            </div>
          </div>
          <div className="skeleton h-7 w-28 rounded-lg" />
        </div>
        <div className="p-8 flex gap-8 items-center h-[420px] overflow-hidden">
          {[220, 240, 220, 240, 230].map((w, i) => (
            <div key={i} className="shrink-0 space-y-3">
              <div
                className="skeleton rounded-xl border border-border"
                style={{ width: w, height: 86, opacity: 1 - i * 0.12 }}
              />
              {i % 2 === 1 && (
                <div
                  className="skeleton rounded-xl border border-border"
                  style={{ width: w, height: 86, opacity: 1 - i * 0.12 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decision banner skeleton */}
      <div className="rounded-2xl border-2 border-border p-6 sm:p-7 bg-ink-light shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="skeleton w-12 h-12 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-7 w-56 rounded-md" />
          </div>
          <div className="skeleton h-8 w-32 rounded-full" />
        </div>
        <div className="border-t border-border pt-4 space-y-2.5">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
          <div className="skeleton h-4 w-3/5 rounded" />
        </div>
      </div>

      {/* Two-col grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border p-6 bg-ink-light space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <div className="skeleton w-6 h-6 rounded-md" />
              <div className="skeleton h-3.5 w-28 rounded" />
            </div>
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="skeleton h-14 rounded-lg" />
              <div className="skeleton h-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
