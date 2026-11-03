import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
            width: 300,
            height: 300,
            borderRadius: '50%',
            border: '18px solid white',
            display: 'flex',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 10,
              height: 110,
              background: 'white',
              borderRadius: 6,
              bottom: '50%',
              left: '50%',
              marginLeft: -5,
              transformOrigin: 'bottom center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 10,
              height: 80,
              background: 'white',
              borderRadius: 6,
              bottom: '50%',
              left: '50%',
              marginLeft: -5,
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
