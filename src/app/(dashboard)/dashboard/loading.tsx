export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-2xl p-6 shadow-sm border border-border h-32 flex flex-col justify-between">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 shadow-sm border border-border h-96">
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-6" />
          <div className="h-64 w-full bg-muted/50 rounded animate-pulse" />
        </div>
        <div className="glass rounded-2xl p-6 shadow-sm border border-border h-96">
          <div className="h-6 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="h-64 w-full bg-muted/50 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
