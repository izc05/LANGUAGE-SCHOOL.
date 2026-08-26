import { useEffect } from 'react'
import {
  CLOUD_PORTAL_DURATION_MS,
  CLOUD_PORTAL_REDUCED_DURATION_MS,
  CLOUD_PORTAL_REDUCED_WHITEOUT_MS,
  CLOUD_PORTAL_WHITEOUT_MS,
} from '../features/transitions/CloudPortalProvider'
import '../styles/cloud-portal-transition.css'

type CloudPortalTransitionProps = {
  onWhiteout: () => void
  onComplete: () => void
  reducedMotion: boolean
}

export default function CloudPortalTransition({ onWhiteout, onComplete, reducedMotion }: CloudPortalTransitionProps) {
  useEffect(() => {
    const whiteoutTimer = window.setTimeout(
      onWhiteout,
      reducedMotion ? CLOUD_PORTAL_REDUCED_WHITEOUT_MS : CLOUD_PORTAL_WHITEOUT_MS,
    )
    const completeTimer = window.setTimeout(
      onComplete,
      reducedMotion ? CLOUD_PORTAL_REDUCED_DURATION_MS : CLOUD_PORTAL_DURATION_MS,
    )

    return () => {
      window.clearTimeout(whiteoutTimer)
      window.clearTimeout(completeTimer)
    }
  }, [onComplete, onWhiteout, reducedMotion])

  return (
    <div
      className={`cloud-portal-transition${reducedMotion ? ' cloud-portal-transition-reduced' : ''}`}
      data-cloud-portal="active"
      data-cloud-portal-motion={reducedMotion ? 'reduced' : 'full'}
      aria-hidden="true"
    >
      <div className="cloud-portal-sky" />
      <div className="cloud-portal-cloud cloud-portal-cloud-left" />
      <div className="cloud-portal-cloud cloud-portal-cloud-right" />
      <div className="cloud-portal-cloud cloud-portal-cloud-top" />
      <div className="cloud-portal-cloud cloud-portal-cloud-bottom" />
      <div className="cloud-portal-ribbon cloud-portal-ribbon-one" />
      <div className="cloud-portal-ribbon cloud-portal-ribbon-two" />
      <div className="cloud-portal-glow" />
      <div className="cloud-portal-whiteout" />
    </div>
  )
}
