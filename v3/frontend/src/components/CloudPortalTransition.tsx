import { useEffect } from 'react'
import {
  CLOUD_PORTAL_DURATION_MS,
  CLOUD_PORTAL_WHITEOUT_MS,
} from '../features/transitions/CloudPortalProvider'
import '../styles/cloud-portal-transition.css'

type CloudPortalTransitionProps = {
  onWhiteout: () => void
  onComplete: () => void
}

export default function CloudPortalTransition({ onWhiteout, onComplete }: CloudPortalTransitionProps) {
  useEffect(() => {
    const whiteoutTimer = window.setTimeout(onWhiteout, CLOUD_PORTAL_WHITEOUT_MS)
    const completeTimer = window.setTimeout(onComplete, CLOUD_PORTAL_DURATION_MS)

    return () => {
      window.clearTimeout(whiteoutTimer)
      window.clearTimeout(completeTimer)
    }
  }, [onComplete, onWhiteout])

  return (
    <div className="cloud-portal-transition" data-cloud-portal="active" aria-hidden="true">
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
