"use client";

import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
        <AlertCircle size={24} />
      </div>
      <h2 className="text-xl font-semibold">Failed to load dashboard metrics</h2>
      <p className="text-muted-foreground max-w-md text-center">
        {error.message || "There was a problem securely fetching your workspace data. Please try again."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity font-medium text-sm"
      >
        Try again
      </button>
    </div>
  );
}
