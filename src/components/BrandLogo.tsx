import React from 'react';
import { Leaf } from 'lucide-react';

export function BrandLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <Leaf 
      className={`${className} text-emerald-500`}
      fill="currentColor"
      fillOpacity={0.2}
    />
  );
}
