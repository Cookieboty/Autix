'use client';

import * as React from 'react';
import { buildImageUrl } from './url';

/** `<video>` 组件；`poster` 会自动过 CF Image Resizing 变换。 */
export interface CdnVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'poster' | 'src'> {
  src: string | null | undefined;
  poster?: string | null;
  posterWidth?: number;
  posterQuality?: number;
}

export const CdnVideo = React.forwardRef<HTMLVideoElement, CdnVideoProps>(function CdnVideo(
  { src, poster, posterWidth = 720, posterQuality = 75, ...rest },
  ref,
) {
  if (!src) return null;
  const finalPoster = poster
    ? buildImageUrl(poster, { width: posterWidth, quality: posterQuality })
    : undefined;
  return <video ref={ref} src={src} poster={finalPoster} {...rest} />;
});
