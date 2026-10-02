import React from 'react';
import { BrandBadge } from '@/src/components/BrandBadge';

export function KjappMark({ size = 40, float = false }: { size?: number; float?: boolean }) {
  return <BrandBadge size={size} float={float} />;
}

export default KjappMark;
