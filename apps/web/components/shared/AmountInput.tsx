'use client';

import React from 'react';
import type { AssetType } from '@/types';
import { ASSET_INFO } from '@/lib/assets';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  asset: AssetType;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showPreview?: boolean;
  previewValue?: number;
  previewLabel?: string;
}

export function AmountInput({
  value,
  onChange,
  asset,
  label,
  placeholder = '0.00',
  disabled = false,
  required = false,
  showPreview = false,
  previewValue,
  previewLabel,
}: AmountInputProps) {
  const assetInfo = ASSET_INFO[asset];
  const parsedValue = parseFloat(value.replace(/,/g, '')) || 0;

  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
        {label || `Amount (${assetInfo.label})`}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-500 font-mono">{assetInfo.label}</span>
        </div>
      </div>
      {showPreview && previewValue !== undefined && (
        <span className="text-[10px] font-mono text-slate-400 block mt-1">
          {previewLabel || `${parsedValue.toLocaleString()} ${assetInfo.label}`}
        </span>
      )}
    </div>
  );
}
