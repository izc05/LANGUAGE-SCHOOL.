import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback: ReactNode
  onSceneError?: () => void
}

type State = { failed: boolean }

export default class IntroSceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onSceneError?.()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
