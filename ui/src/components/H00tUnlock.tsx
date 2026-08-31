import { useEffect, useState } from "react";
import HootLogo from '@/lib/h00t-logo';
import { moodFrameInterval } from '@/lib/h00t-ascii';
import { setHootToken } from "@/lib/api";
import { BRAND_COLORS } from "@/lib/brand";

export default function HootUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), moodFrameInterval("monitoring"));
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setHootToken(token.trim());
    try {
      const res = await fetch("/api/auth/status", { headers: { "X-HOOT-Token": token.trim() } });
      const data = await res.json();
      if (data.authenticated) {
        onUnlocked();
      } else {
        setError("Invalid token — check Settings on the HOOT host.");
        setHootToken(null);
      }
    } catch {
      setError("Could not reach HOOT server.");
      setHootToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
          borderRadius: 18,
          border: `1px solid ${BRAND_COLORS.glow}`,
          background: "linear-gradient(160deg, rgba(18,18,22,0.98), rgba(8,8,10,0.95))",
          boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <HootLogo mood="monitoring" size={220} frame={frame} showWordmark trackMouse={false} />
        <p style={{ margin: 0, fontSize: 13, opacity: 0.65, lineHeight: 1.5, textAlign: "center" }}>
          LAN access requires your HOOT token. Localhost on the host PC does not need this.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="HOOT token"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.35)",
            color: "#f5f5f5",
            fontSize: 14,
          }}
        />
        {error && <div style={{ fontSize: 12, color: "#f87171", width: "100%" }}>{error}</div>}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !token.trim()}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: `1px solid ${BRAND_COLORS.gold}`,
            background: `linear-gradient(145deg, ${BRAND_COLORS.goldDark}, ${BRAND_COLORS.goldLight})`,
            color: "#0a0a0a",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Unlocking…" : "Unlock H00T"}
        </button>
      </div>
    </div>
  );
}
