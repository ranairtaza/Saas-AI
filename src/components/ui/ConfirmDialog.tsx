"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** If provided, renders a textarea and passes the entered value to onConfirm */
  reasonLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

/**
 * Accessible modal dialog using the native <dialog> element.
 * Replaces prompt() and confirm() throughout the executive UI.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  reasonLabel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setReason("");
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onCancel();
  }

  function handleConfirm() {
    if (reasonLabel && !reason.trim()) return; // require reason when field is present
    onConfirm(reasonLabel ? reason.trim() : undefined);
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onClick={handleDialogClick}
      className="rounded-2xl border border-border bg-card shadow-2xl p-0 max-w-md w-full backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
        <h2 className="text-sm font-bold text-card-foreground">{title}</h2>
        <button
          onClick={onCancel}
          aria-label="Close dialog"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}

        {reasonLabel && (
          <div className="space-y-1.5">
            <label
              htmlFor="dialog-reason"
              className="text-xs font-semibold text-card-foreground"
            >
              {reasonLabel}
            </label>
            <textarea
              id="dialog-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Enter reason..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-6 pb-5">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!!(reasonLabel && !reason.trim())}
          className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40 ${
            destructive
              ? "bg-red-600 hover:bg-red-500"
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
