// Hook exclusivo desta secao — nenhuma outra secao reproduz video
// (Especificacao Funcional, secao 6.6).
import { useRef } from 'react'
import { useTracking } from '../../../hooks/useTracking'

const MILESTONES = [25, 50, 75, 100]

export function useVideoTracking(videoId: string) {
  const { track } = useTracking()
  const reachedMilestones = useRef<Set<number>>(new Set())

  function handlePlay() {
    track('video_start', { video_id: videoId })
  }

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget
    if (!video.duration) return

    const percentPlayed = (video.currentTime / video.duration) * 100

    for (const milestone of MILESTONES) {
      if (percentPlayed >= milestone && !reachedMilestones.current.has(milestone)) {
        reachedMilestones.current.add(milestone)
        track('video_progress', { video_id: videoId, percent: milestone })
      }
    }
  }

  function reset() {
    reachedMilestones.current.clear()
  }

  return { handlePlay, handleTimeUpdate, reset }
}
