import { useEffect, useState } from 'react';
import { API_BASE } from './api';

export function useServiceFee() {
  const [fee, setFee] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/marketing/platform-config`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((config) => {
        const value = Number(config.service_fee_percent);
        if (Number.isFinite(value) && value >= 0 && value <= 50) setFee(value);
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  return fee;
}

export const serviceFeeLabel = (fee: number | null) => fee === null
  ? 'Avtalt serviceavgift'
  : `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(fee)} % serviceavgift`;
