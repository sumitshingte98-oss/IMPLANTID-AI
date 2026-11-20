interface DriverBitSchematicProps {
  profile: 'torx' | 'hex' | 'unigrip' | 'square' | 'slot';
  size?: number;
  className?: string;
}

export function DriverBitSchematic({
  profile,
  size = 56,
  className = '',
}: DriverBitSchematicProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${profile} screwdriver bit cross-section`}
      role="img"
    >
      {/* Subtle clinical blueprint axes */}
      <line x1="32" y1="4" x2="32" y2="60" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 3" />
      <line x1="4" y1="32" x2="60" y2="32" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 3" />

      {/* Outer cylindrical shank collar */}
      <circle cx="32" cy="32" r="24" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="20" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />

      {profile === 'torx' && (
        <path
          d="M32 15.5C34.2 15.5 35.1 18.6 37.1 19.6C39.1 20.6 42.2 19.4 43.9 21.1C45.6 22.8 44.4 25.9 45.4 27.9C46.4 29.9 49.5 30.8 49.5 32C49.5 33.2 46.4 34.1 45.4 36.1C44.4 38.1 45.6 41.2 43.9 42.9C42.2 44.6 39.1 43.4 37.1 44.4C35.1 45.4 34.2 48.5 32 48.5C29.8 48.5 28.9 45.4 26.9 44.4C24.9 43.4 21.8 44.6 20.1 42.9C18.4 41.2 19.6 38.1 18.6 36.1C17.6 34.1 14.5 33.2 14.5 32C14.5 30.8 17.6 29.9 18.6 27.9C19.6 25.9 18.4 22.8 20.1 21.1C21.8 19.4 24.9 20.6 26.9 19.6C28.9 18.6 29.8 15.5 32 15.5Z"
          fill="#1E3A8A"
          fillOpacity="0.1"
          stroke="#1D4ED8"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {profile === 'hex' && (
        <polygon
          points="32,15 46.7,23.5 46.7,40.5 32,49 17.3,40.5 17.3,23.5"
          fill="#1E3A8A"
          fillOpacity="0.1"
          stroke="#1D4ED8"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {profile === 'unigrip' && (
        <g>
          <polygon
            points="32,14.5 36.2,23.5 45.8,22.2 41,30.8 47.6,37.8 38.1,39.2 35.8,48.6 28.2,42.6 19.4,46.2 21.2,36.8 14.4,30.2 23.6,27.8 24.8,18.2 32,22.5"
            fill="#1E3A8A"
            fillOpacity="0.1"
            stroke="#1D4ED8"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="5" fill="#FFFFFF" stroke="#1D4ED8" strokeWidth="1.5" />
        </g>
      )}

      {profile === 'square' && (
        <rect
          x="20"
          y="20"
          width="24"
          height="24"
          rx="2"
          fill="#1E3A8A"
          fillOpacity="0.1"
          stroke="#1D4ED8"
          strokeWidth="2"
        />
      )}

      {profile === 'slot' && (
        <rect
          x="15"
          y="28.5"
          width="34"
          height="7"
          rx="1.5"
          fill="#1E3A8A"
          fillOpacity="0.12"
          stroke="#1D4ED8"
          strokeWidth="2"
        />
      )}

      {/* Center registration dot */}
      <circle cx="32" cy="32" r="1.5" fill="#1D4ED8" />
    </svg>
  );
}
