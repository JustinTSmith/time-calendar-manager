'use client';

interface Props {
  color: string | null;
  onClick: () => void;
}

export function ColorDot({ color, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10 hover:scale-125 transition-transform"
      style={{ backgroundColor: color ?? '#94a3b8' }}
      aria-label="Change calendar color"
    />
  );
}
