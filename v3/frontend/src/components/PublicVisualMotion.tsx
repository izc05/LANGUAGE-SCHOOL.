import { useEffect } from 'react'
import { useLocation } from 'react-router'

const selectors = [
  'main > section',
  'main article',
  '.page-hero > .container',
  '.programs-path-wrap',
  '.method-premium-art',
  '.platform-dashboard-wrap',
  '.blog-journal-art',
].join(',')

export default function PublicVisualMotion() {
  const location = useLocation()

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors))

    nodes.forEach((node, index) => {
      node.classList.add('public-reveal')
      node.dataset.revealIndex = String(index % 5)
    })

    if (reducedMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' })

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [location.pathname])

  return null
}
