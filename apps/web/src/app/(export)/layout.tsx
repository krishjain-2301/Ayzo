export default function ExportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen !bg-white !text-black font-sans selection:bg-black/10">
      {/* We strip out the dark mode sidebar and wrapper entirely.
          This layout forces a clean, light-mode foundation for printing. */}
      {children}
    </div>
  );
}
