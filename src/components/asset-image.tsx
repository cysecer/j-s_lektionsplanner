import type { ComponentProps } from "react";

/**
 * An uploaded image of the club, served by the auth-checked /api/assets
 * route. A plain <img> on purpose: next/image's optimizer would fetch the
 * file without the user's session and cache private images.
 */
export function AssetImage({
  assetId,
  alt,
  ...props
}: Omit<ComponentProps<"img">, "src"> & { assetId: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- see comment above
  return <img src={`/api/assets/${assetId}`} alt={alt} {...props} />;
}
