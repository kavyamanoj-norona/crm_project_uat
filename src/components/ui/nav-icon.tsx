"use client";

import { Circle, type LucideProps } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

const known = new Set<string>(iconNames);

type NavIconProps = Omit<LucideProps, "ref" | "name"> & { name: string | null | undefined };

/** Renders a lucide icon by the kebab-case name stored in the database. */
export function NavIcon({ name, ...props }: NavIconProps) {
  if (!name || !known.has(name)) return <Circle {...props} />;
  return <DynamicIcon name={name as IconName} fallback={() => <Circle {...props} />} {...props} />;
}
