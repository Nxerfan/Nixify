"use client";

import * as React from "react";

interface NixifyLogoProps {
  /** Size of the icon mark (in px). Default: 24 */
  size?: number;
  /** Whether to show the "Nixify" wordmark next to the icon. Default: false */
  showWordmark?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * The Nixify Mark — a bold verification checkmark with an @-node.
 *
 *   • The checkmark = ✓ = verified, trusted, approved
 *   • The dot/node  = @ = email, connection, digital identity
 *   • Together      = verified email = Nixify
 *
 * Use standalone (`showWordmark=false`) for the icon anywhere you need
 * the brand mark (header, favicon, loading states). Use with
 * `showWordmark=true` for the full horizontal logo.
 */
export function NixifyLogo({
  size = 24,
  showWordmark = false,
  className = "",
}: NixifyLogoProps) {
  const iconSize = showWordmark ? size * 0.8 : size;

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      style={{ height: size }}
    >
      {/* ── Icon mark ── */}
      <svg
        viewBox="0 0 100 100"
        width={iconSize}
        height={iconSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`check-grad-${size}`}
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <radialGradient id={`dot-grad-${size}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="45%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>
        </defs>

        {/* Soft ambient glow behind the dot */}
        <circle cx="50" cy="70" r="18" fill="#34d399" opacity="0.06" />
        {/* Ambient glow behind the entire mark */}
        <ellipse
          cx="50"
          cy="52"
          rx="42"
          ry="32"
          fill="#34d399"
          opacity="0.03"
        />

        {/* Bold checkmark strokes — the verification sweep */}
        <path
          d="M 22 28 L 44 70"
          stroke={`url(#check-grad-${size})`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 56 70 L 78 34"
          stroke={`url(#check-grad-${size})`}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* The node — @ = email, the connection point */}
        {/* Outer glow ring */}
        <circle cx="50" cy="70" r="13" fill="#34d399" opacity="0.12" />
        {/* Main dot with 3D radial gradient */}
        <circle cx="50" cy="70" r="11" fill={`url(#dot-grad-${size})`} />
        {/* Spherical highlight — glossy surface */}
        <ellipse
          cx="46"
          cy="66"
          rx="4.5"
          ry="3"
          fill="#a7f3d0"
          opacity="0.35"
          transform="rotate(-25 46 66)"
        />
        {/* Soft secondary highlight */}
        <ellipse
          cx="44.5"
          cy="68.5"
          rx="2"
          ry="1.5"
          fill="#d1fae5"
          opacity="0.2"
          transform="rotate(-30 44.5 68.5)"
        />
      </svg>

      {/* ── Wordmark (optional, for horizontal logo) ── */}
      {showWordmark && (
        <span className="flex flex-col">
          <span
            className="flex items-baseline gap-0.5 font-semibold tracking-tight"
            style={{ fontSize: size * 0.42, lineHeight: 1.1 }}
          >
            <span style={{ color: "#f1f5f9" }}>Nixify</span>
            {/* Mini checkmark accent */}
            <svg
              viewBox="0 0 20 20"
              width={size * 0.22}
              height={size * 0.22}
              fill="none"
              className="ml-0.5"
              style={{ marginBottom: size * 0.02 }}
            >
              <path
                d="M2 10 L8 16 L18 4"
                stroke="#34d399"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className="text-[0.55em] font-medium tracking-[0.2em]"
            style={{ color: "#4b5563", marginTop: -1 }}
          >
            EMAIL OTP VERIFICATION
          </span>
        </span>
      )}
    </span>
  );
}
