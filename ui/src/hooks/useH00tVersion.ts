import { useEffect, useState } from "react";
import { api, type HootVersionInfo } from "@/lib/api";

export function useHootVersion() {
  const [info, setInfo] = useState<HootVersionInfo | null>(null);

  useEffect(() => {
    api.getStatus().then((res) => setInfo(res.info || null)).catch(() => {});
  }, []);

  return info;
}