export default function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 bg-[var(--card)] border border-dashed border-[var(--border)] rounded-lg text-[var(--muted)] text-sm">
      {label}
    </div>
  );
}
