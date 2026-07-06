import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type PartySquareLogoProps = {
  logoUrl: string | null;
  partyColor: string | null;
  fallbackText?: string | null;
  className?: string;
  imgClassName?: string;
  title?: string;
};

function colorLuma(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function borderForColor(hex: string) {
  return colorLuma(hex) > 0.92 ? "#cbd5e1" : "transparent";
}

export function PartySquareLogo({
  logoUrl,
  partyColor,
  fallbackText,
  className,
  imgClassName,
  title,
}: PartySquareLogoProps) {
  const [showLogo, setShowLogo] = useState(Boolean(logoUrl));
  const color = partyColor?.trim() ? partyColor : "#999999";
  const fallback = (fallbackText ?? "").trim().slice(0, 3).toUpperCase();

  useEffect(() => {
    setShowLogo(Boolean(logoUrl));
  }, [logoUrl]);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] p-[1px]",
        className,
      )}
      style={{
        backgroundColor: color,
        border: `1.5px solid ${borderForColor(color)}`,
      }}
      title={title}
      aria-hidden
    >
      {showLogo && logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn("h-full w-full object-contain", imgClassName)}
          onError={() => setShowLogo(false)}
        />
      ) : fallback ? (
        <span className="text-[10px] font-bold leading-none text-white mix-blend-difference">{fallback}</span>
      ) : null}
    </span>
  );
}