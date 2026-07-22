'use client';

import * as React from 'react';
import { buildTieredImageUrl } from './url';

/** `<video>` 组件；`poster` 会复用与 <CdnImage> 相同的 pad 档变换 URL。 */
export interface CdnVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'poster' | 'src'> {
  src: string | null | undefined;
  poster?: string | null;
}

export const CdnVideo = React.forwardRef<HTMLVideoElement, CdnVideoProps>(function CdnVideo(
  { src, poster, ...rest },
  ref,
) {
  if (!src) return null;
  const finalPoster = poster ? buildTieredImageUrl(poster, 'pad') : undefined;
  return <video ref={ref} src={src} poster={finalPoster} {...rest} />;
});
