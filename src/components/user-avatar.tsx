"use client";

import Avatar from "boring-avatars";

// High-contrast palette — each color is visually distinct
const DEFAULT_COLORS = [
  "#0d9488", // teal-600
  "#f97316", // orange-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
];

export interface UserAvatarProps {
  /** Seed string — typically user name, email, or ID. */
  name: string;
  /** Pixel size of the rendered avatar. */
  size?: number;
  /** Use a square mask instead of circular. */
  square?: boolean;
  /** Custom color palette (5 hex colors recommended). */
  colors?: string[];
  /** Extra CSS class names applied to the wrapper. */
  className?: string;
}

export function UserAvatar({
  name,
  size = 36,
  square = false,
  colors = DEFAULT_COLORS,
  className,
}: UserAvatarProps) {
  return (
    <span className={className} style={{ display: "inline-flex", lineHeight: 0 }}>
      <Avatar
        name={name || "?"}
        size={size}
        variant="bauhaus"
        colors={colors}
        square={square}
      />
    </span>
  );
}
