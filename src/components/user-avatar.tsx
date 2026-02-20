"use client";

import Avatar from "boring-avatars";

// Cool-tone palette — blues, indigos & teals matching the dark UI
const DEFAULT_COLORS = [
  "#b2d9f7", 
  "#487aa1",
  "#3d3c3b", 
  "#2a2c74", 
  "#aed5db",
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
        variant="beam"
        colors={colors}
        square={square}
      />
    </span>
  );
}
