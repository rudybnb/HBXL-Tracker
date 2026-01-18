
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AiAssistantChatProps {
    fileId: string;
    open: boolean;
    onClose?: () => void;
}

export default function AiAssistantChat({ fileId, open }: AiAssistantChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am "New SKI", your drawing assistant. I have analyzed this drawing. Ask me anything about rooms, measurements, or materials!',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const mutation = useMutation({
        mutationFn: async (question: string) => {
            const res = await apiRequest('POST', `/api/chat/drawing/${fileId}`, { message: question });
            return await res.json();
        },
        onSuccess: (data) => {
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: data.answer,
                    timestamp: new Date()
                }
            ]);
        },
        onError: () => {
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'Sorry, I encountered an error processing your request.',
                    timestamp: new Date()
                }
            ]);
        }
    });

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        mutation.mutate(inputValue);
        setInputValue('');
    };

    if (!open) return null;

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-80 animate-in slide-in-from-right duration-200">
            <div className="p-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold text-slate-200">New SKI Assistant</h3>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {mutation.isPending && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                                <span className="text-xs text-slate-400">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-3 border-t border-slate-700 bg-slate-800">
                <div className="flex space-x-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about this drawing..."
                        className="bg-slate-900 border-slate-700 text-slate-200 focus-visible:ring-amber-500"
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={mutation.isPending || !inputValue.trim()}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
