import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c1034 0%, #4a041b 100%)',
        }}
      >
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: '50%',
            border: '6px solid white',
            display: 'flex',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 4,
              height: 39,
              background: 'white',
              borderRadius: 3,
              bottom: '50%',
              left: '50%',
              marginLeft: -2,
              transformOrigin: 'bottom center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 4,
              height: 28,
              background: 'white',
              borderRadius: 3,
              bottom: '50%',
              left: '50%',
              marginLeft: -2,
              transformOrigin: 'bottom center',
              transform: 'rotate(90deg)',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
