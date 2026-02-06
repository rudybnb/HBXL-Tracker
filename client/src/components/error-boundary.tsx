
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Uncaught error in ${this.props.componentName || 'component'}:`, error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Card className="w-full h-full border-red-500 bg-red-50 dark:bg-red-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            Something went wrong
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-red-600 dark:text-red-300">
                            {this.props.componentName ? `Error in ${this.props.componentName}:` : 'An unexpected error occurred.'}
                        </div>

                        {this.state.error && (
                            <pre className="p-4 bg-red-100 dark:bg-black/40 rounded-lg text-xs font-mono overflow-auto max-h-[200px] text-red-800 dark:text-red-200">
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        )}

                        <Button
                            variant="outline"
                            className="border-red-200 hover:bg-red-100 text-red-700"
                            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                        >
                            Try to recover
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        return this.props.children;
    }
}
