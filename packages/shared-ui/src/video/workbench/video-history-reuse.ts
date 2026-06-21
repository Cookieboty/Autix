import {
  createLocalVideoProject,
  type VideoProject,
} from '@autix/shared-store';

export function buildReusableVideoProject(source: VideoProject): VideoProject {
  const sourceClips = [...(source.clips ?? [])].sort((a, b) => a.order - b.order);
  const reusableProject = createLocalVideoProject(
    source.title,
    sourceClips.map((clip) => ({
      title: clip.title ?? undefined,
      prompt: clip.prompt ?? undefined,
      params: { ...(clip.params ?? {}) },
      chainFromPrev: clip.chainFromPrev,
    })),
    source.coverImage,
  );

  return {
    ...reusableProject,
    clips: reusableProject.clips.map((clip, index) => {
      const sourceClip = sourceClips[index];
      return {
        ...clip,
        materials: (sourceClip?.materials ?? []).map((material) => ({
          ...material,
          id: `local-video-material-${clip.id}-${material.role}-${index}`,
          clipId: clip.id,
          sourceId: material.sourceId ?? undefined,
        })),
      };
    }),
  };
}
