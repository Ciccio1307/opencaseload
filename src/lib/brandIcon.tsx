import { ImageResponse } from 'next/og';

/**
 * App icon: the OpenCaseload mark (see docs/logo/mark.svg).
 *
 * The ring is the caseload, the gap a missed session, the red dot the
 * recovery that fills it. Drawn full-bleed (no rounded corners): iOS and
 * Android apply their own mask, and the glyph sits well inside the
 * maskable-icon safe zone.
 */
export function brandIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0A0A0A',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 512 512">
          <path
            d="M383.5 244.8 A128 128 0 1 1 267.2 128.5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={56}
            strokeLinecap="round"
          />
          <circle cx={346.5} cy={165.5} r={40} fill="#F5333F" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
