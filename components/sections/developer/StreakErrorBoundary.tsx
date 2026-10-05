import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Contains failures from the lazy lottie chunk (stale hashed chunk after a
 * redeploy is the common case) so a failed animation fetch can't blank the
 * Developer section. Falls back to the static Flame icon.
 */
class StreakErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.info('[StreakErrorBoundary] Contained render error:', error?.message, info?.componentStack);
    }

    render() {
        if (this.state.hasError) return this.props.fallback ?? null;
        return this.props.children;
    }
}

export default StreakErrorBoundary;
