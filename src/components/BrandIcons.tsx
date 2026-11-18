import React from 'react';
import type { IconKind } from '../data/services';

export function PlatformIcon({ kind, size = 46 }: { kind: IconKind; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size };

  if (kind === 'instagram') {
    return (
      <svg
        viewBox="0 0 64 64"
        style={style}
        className="rounded-[12px] shrink-0"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="igGrad" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#igGrad)" />
        <rect
          x="14"
          y="14"
          width="36"
          height="36"
          rx="10"
          fill="none"
          stroke="#fff"
          strokeWidth="4.2"
        />
        <circle cx="32" cy="32" r="8.8" fill="none" stroke="#fff" strokeWidth="4.2" />
        <circle cx="42.5" cy="21.5" r="2.6" fill="#fff" />
      </svg>
    );
  }

  if (kind === 'facebook') {
    return (
      <svg viewBox="0 0 64 64" style={style} className="shrink-0" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="#1877F2" />
        <path
          d="M41.5 34.8l1.3-8.4h-8v-5.4c0-2.3 1.1-4.5 4.7-4.5h3.7V9.4s-3.3-.6-6.5-.6c-6.6 0-11 4-11 11.3v6.3h-7.4v8.4h7.4v20.4c1.5.2 3 .4 4.5.4s3-.1 4.5-.4V34.8h6.8z"
          fill="#fff"
        />
      </svg>
    );
  }

  if (kind === 'telegram') {
    return (
      <svg viewBox="0 0 64 64" style={style} className="shrink-0" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="#229ED9" />
        <path
          d="M45.8 19.8L15.4 31.5c-2.1.8-2.1 2-.4 2.5l7.8 2.4 18-11.3c.9-.5 1.6-.2 1 .3l-14.6 13.2-.5 8.1c.8 0 1.2-.4 1.6-.8l3.9-3.8 8.1 6c1.5.8 2.6.4 3-1.4l5.3-25.2c.5-2.2-.8-3.2-2.8-2.5z"
          fill="#fff"
        />
      </svg>
    );
  }

  if (kind === 'youtube') {
    return (
      <svg viewBox="0 0 64 64" style={style} className="shrink-0" aria-hidden="true">
        <rect x="4" y="13" width="56" height="38" rx="11" fill="#FF0000" />
        <polygon points="26,23 26,41 43,32" fill="#fff" />
      </svg>
    );
  }

  // bluetick
  return (
    <svg viewBox="0 0 64 64" style={style} className="shrink-0" aria-hidden="true">
      <path
        d="M32 4l6.2 4.8 7.7-1.4 2.6 7.4 7.3 2.9-1.1 7.7 5 6-5 6 1.1 7.7-7.3 2.9-2.6 7.4-7.7-1.4L32 60l-6.2-4.8-7.7 1.4-2.6-7.4-7.3-2.9 1.1-7.7-5-6 5-6-1.1-7.7 7.3-2.9 2.6-7.4 7.7 1.4L32 4z"
        fill="#3897F0"
      />
      <path
        d="M22.5 32.5l6.2 6.2L42 25.4"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GPayLogo() {
  return (
    <svg viewBox="0 0 110 42" className="h-[34px] w-auto mx-auto" aria-label="Google Pay">
      <path
        d="M27.6 21.4c0-.9-.1-1.7-.2-2.5H16.2v4.7h6.4c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
        fill="#4285F4"
      />
      <path
        d="M16.2 33c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1C7.6 30.4 11.6 33 16.2 33z"
        fill="#34A853"
      />
      <path
        d="M9.6 23.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4v-3.1h-4C4.7 17.2 4.2 19 4.2 21s.5 3.8 1.4 5.5l4-3.1z"
        fill="#FBBC05"
      />
      <path
        d="M16.2 13.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C22.1 10.1 19.4 9 16.2 9 11.6 9 7.6 11.6 5.6 15.5l4 3.1c.9-2.8 3.5-4.9 6.6-4.9z"
        fill="#EA4335"
      />
      <text
        x="35"
        y="27.5"
        fill="#3c4043"
        fontSize="19"
        fontWeight="600"
        fontFamily="Poppins, sans-serif"
      >
        Pay
      </text>
    </svg>
  );
}

export function PhonePeLogo() {
  return (
    <svg viewBox="0 0 124 42" className="h-[34px] w-auto mx-auto" aria-label="PhonePe">
      <circle cx="21" cy="21" r="14" fill="#5F259F" />
      <text
        x="21"
        y="26.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="16"
        fontWeight="700"
        fontFamily="Poppins, sans-serif"
      >
        पे
      </text>
      <text
        x="41"
        y="26"
        fill="#5F259F"
        fontSize="15.5"
        fontWeight="700"
        fontFamily="Poppins, sans-serif"
      >
        PhonePe
      </text>
    </svg>
  );
}

export function BhimUpiLogo() {
  return (
    <svg viewBox="0 0 116 42" className="h-[34px] w-auto mx-auto" aria-label="UPI">
      <text
        x="16"
        y="26"
        fill="#4D4D4D"
        fontSize="21"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="Poppins, sans-serif"
      >
        UPI
      </text>
      <polygon points="62,10 73,21 62,32 62,25 57,21 62,17" fill="#F37920" />
      <polygon points="69,10 80,21 69,32 69,25 64,21 69,17" fill="#138808" />
      <text
        x="14"
        y="36"
        fill="#555"
        fontSize="5.4"
        fontWeight="700"
        fontFamily="Poppins, sans-serif"
        letterSpacing="0.3"
      >
        UNIFIED PAYMENTS INTERFACE
      </text>
    </svg>
  );
}

export function QrCodeGraphic({ seedText }: { seedText: string }) {
  // Deterministic 15x15 QR-style matrix based on seedText so it visually renders cleanly without external CDN
  const size = 15;
  const cells: boolean[] = [];
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 5 && c < 5;
      const inTopRight = r < 5 && c >= size - 5;
      const inBottomLeft = r >= size - 5 && c < 5;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = inBottomLeft ? r - (size - 5) : r;
        const lc = inTopRight ? c - (size - 5) : c;
        const border = lr === 0 || lr === 4 || lc === 0 || lc === 4;
        const center = lr === 2 && lc === 2;
        cells.push(border || center);
      } else {
        const bit = ((hash >>> ((r * size + c) % 24)) ^ (r * 7 + c * 13)) & 1;
        cells.push(bit === 1);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size + 2} ${size + 2}`}
      className="w-40 h-40 mx-auto rounded-xl border-2 border-[#e9dffc] bg-white p-2"
      role="img"
      aria-label="Instant UPI QR Code"
    >
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / size);
        const c = idx % size;
        return (
          <rect
            key={idx}
            x={c + 1}
            y={r + 1}
            width="0.92"
            height="0.92"
            rx="0.15"
            fill="#1a1033"
          />
        );
      })}
    </svg>
  );
}
