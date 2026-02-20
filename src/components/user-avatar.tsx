"use client";

import Avatar from "boring-avatars";

// Cool-tone palette — blues, indigos & teals matching the dark UI
const DEFAULT_COLORS = [
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#0ea5e9", // sky-500
  "#8b5cf6", // violet-500
  "#14b8a6", // teal-500
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
