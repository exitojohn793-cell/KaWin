import React, { useState } from 'react';
import { getQrSvgUrl } from '../api.ts';

interface QRCodeCardProps {
  pin: string;
  joinUrl: string;
}

export const QRCodeCard: React.FC<QRCodeCardProps> = ({ pin, joinUrl }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      data-testid="presenter-qr-card"
      className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#131B31] p-6 text-center"
    >
      <div className="rounded-2xl bg-white p-3.5 shadow-xl">
        {hasError ? (
          <div className="flex h-48 w-48 flex-col items-center justify-center rounded-xl bg-slate-100 p-4 text-slate-900">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              PIN DE SALA
            </span>
            <span className="mt-1 font-mono-num text-3xl font-extrabold text-slate-950">
              {pin}
            </span>
          </div>
        ) : (
          <img
            src={getQrSvgUrl(joinUrl)}
            alt={`Código QR para unirse a la partida ${pin}`}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="h-48 w-48 object-contain"
          />
        )}
      </div>

      <h2 className="mt-4 font-display text-lg font-bold text-white">
        Escanea desde el móvil
      </h2>
      <p className="mt-1 max-w-xs break-all text-xs text-slate-400">
        {joinUrl}
      </p>
    </div>
  );
};
