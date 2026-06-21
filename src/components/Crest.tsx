export function Crest({
  src,
  alt,
  size = 22,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span
        className="inline-block shrink-0 rounded-sm bg-black/10 dark:bg-white/10"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="inline-block shrink-0 object-contain"
    />
  );
}
