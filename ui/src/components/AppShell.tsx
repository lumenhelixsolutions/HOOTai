import { BRAND } from "@/lib/brand";
import HootMark from "./H00tMark";

export function AppBootShell() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #090909 0%, #0d0d0d 100%)",
        color: "#ece8e1",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <HootMark size={72} />
        <div style={{ marginTop: 18, fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 22, color: "#f5e6d0", letterSpacing: "0.18em", fontWeight: 700 }}>{BRAND.name}</div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.5 }}>{BRAND.subtitle}</div>
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.4 }}>Starting…</div>
        <div className="spin" style={{ margin: "20px auto 0", width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,176,66,0.16)", borderTopColor: "#ffb042" }} />
      </div>
    </div>
  );
}

export function PageShell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: i === 1 ? 120 : 80,
            borderRadius: 16,
            background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,176,66,0.06) 50%, rgba(255,255,255,0.03) 100%)",
            backgroundSize: "200% 100%",
            animation: "hootShimmer 1.4s ease-in-out infinite",
          }}
        />
      ))}
      <style>{`@keyframes hootShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`}</style>
    </div>
  );
}