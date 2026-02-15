import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onRetry?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                    <div className="bg-red-50 p-4 rounded-full mb-4">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Component Error</h3>
                    <p className="text-slate-500 mb-4 max-w-sm text-sm">
                        {this.state.error?.message || "Something went wrong in this component."}
                    </p>
                    {this.props.onRetry && (
                        <Button onClick={() => {
                            this.setState({ hasError: false, error: null });
                            this.props.onRetry!();
                        }}>
                            Retry
                        </Button>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
