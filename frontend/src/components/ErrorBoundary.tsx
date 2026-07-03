import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-zinc-300">
          <p className="text-lg font-medium">問題が発生しました</p>
          <button
            onClick={() => window.location.assign('/')}
            className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm transition-colors"
          >
            トップに戻る
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
