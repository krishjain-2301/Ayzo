import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { WaveBackground } from "@/components/WaveBackground";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <WaveBackground opacity={0.6} />
      <div className="layout-wrapper" style={{ position: "relative", zIndex: 1 }}>
        <Sidebar />
        <div className="layout-main">
          <Header />
          <main className="layout-content">{children}</main>
        </div>
      </div>
    </>
  );
}
