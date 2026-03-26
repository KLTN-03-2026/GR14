import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '@/api';
import type { ChatSource } from '@/api/ai';

type Sender = 'user' | 'assistant';

interface ChatMessage {
    id: string;
    sender: Sender;
    content: string;
    sources?: ChatSource[];
    relatedSources?: ChatSource[];
}

const resolveDetailPath = (source: ChatSource): string | null => {
    if (!source.sourceId) return null;
    if (source.source === 'house') return `/houses/${source.sourceId}`;
    if (source.source === 'land') return `/lands/${source.sourceId}`;
    return null;
};

const ChatbotWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const sessionId = useMemo(() => {
        const key = 'real-estate-ai-session-id';
        const existing = localStorage.getItem(key);
        if (existing) return existing;

        const generated =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `session-${Date.now()}`;

        localStorage.setItem(key, generated);
        return generated;
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const renderMessageContent = (content: string) => {
        const urlRegex = /https?:\/\/[^\s]+/g;
        const detailLabel = 'Chi tiết tại đây';
        const isPropertyPath = (path: string): boolean => /^\/(houses|lands|posts)\/\d+$/i.test(path);
        const toInternalPath = (url: string): string | null => {
            try {
                const parsed = new URL(url);
                if (parsed.origin === window.location.origin) {
                    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
                }
                return null;
            } catch {
                return null;
            }
        };

        return content.split('\n').map((line, lineIndex) => {
            const chunks: ReactNode[] = [];
            let lastIndex = 0;
            let urlIndex = 0;
            urlRegex.lastIndex = 0;

            let match = urlRegex.exec(line);
            while (match) {
                const url = match[0];
                const start = match.index;
                const prefix = line.slice(0, start).toLowerCase();
                const isDetailLink = prefix.includes('xem chi tiet') || prefix.includes('xem chi tiết');

                if (start > lastIndex) {
                    const prefixTextRaw = line.slice(lastIndex, start);
                    const prefixText = isDetailLink
                        ? prefixTextRaw.replace(/xem\s+chi\s+ti[eế]t\s*:\s*/i, '')
                        : prefixTextRaw;

                    chunks.push(
                        <span key={`txt-${lineIndex}-${urlIndex}`}>
                            {prefixText}
                        </span>,
                    );
                }
                const internalPath = toInternalPath(url);

                if (internalPath) {
                    const useDetailLabel = isDetailLink || isPropertyPath(internalPath);
                    chunks.push(
                        <Link
                            key={`url-${lineIndex}-${urlIndex}`}
                            to={internalPath}
                            className="break-all text-blue-700 underline"
                            onClick={() => setIsOpen(false)}
                        >
                            {useDetailLabel ? detailLabel : internalPath}
                        </Link>,
                    );
                } else {
                    chunks.push(
                        <a
                            key={`url-${lineIndex}-${urlIndex}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-blue-700 underline"
                        >
                            {isDetailLink ? detailLabel : url}
                        </a>,
                    );
                }

                urlIndex += 1;
                lastIndex = start + url.length;
                match = urlRegex.exec(line);
            }

            if (lastIndex < line.length) {
                chunks.push(
                    <span key={`tail-${lineIndex}`}>
                        {line.slice(lastIndex)}
                    </span>,
                );
            }

            if (chunks.length === 0) {
                chunks.push(<span key={`full-${lineIndex}`}>{line}</span>);
            }

            return (
                <div key={`line-${lineIndex}`} className="whitespace-pre-wrap">
                    {chunks}
                </div>
            );
        });
    };

    const handleSend = async () => {
        const trimmed = query.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = {
            id: `u-${Date.now()}`,
            sender: 'user',
            content: trimmed,
        };

        setMessages((prev) => [...prev, userMessage]);
        setQuery('');
        setError(null);
        setLoading(true);

        try {
            const payload = await aiApi.chat(trimmed, sessionId);

            const assistantMessage: ChatMessage = {
                id: `a-${Date.now()}`,
                sender: 'assistant',
                content: payload?.answer || 'Xin lỗi, hiện chưa có phản hồi phù hợp.',
                sources: payload?.sources || [],
                relatedSources: payload?.relatedSources || [],
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (err) {
            console.error('AI chat error:', err);
            setError('Không thể kết nối AI lúc này. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-4 z-[120] sm:right-6">
            {isOpen && (
                <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
                        <div className="text-sm font-semibold">AI Tư Vấn Bất Động Sản</div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-md px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
                            aria-label="Đóng chatbot"
                        >
                            X
                        </button>
                    </div>

                    <div className="h-[30rem] space-y-3 overflow-y-auto bg-slate-50 p-3">
                        {messages.length === 0 && (
                            <p className="text-sm text-slate-500">
                                Ví dụ: Tìm nhà dưới 3 tỷ ở Đà Nẵng.
                            </p>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm ${msg.sender === 'user'
                                    ? 'ml-auto border-blue-100 bg-blue-50 text-slate-800'
                                    : 'border-slate-200 bg-white text-slate-800'
                                    }`}
                            >
                                <div className="mb-1 text-xs font-semibold text-slate-500">
                                    {msg.sender === 'user' ? 'Bạn' : 'AI'}
                                </div>
                                <div>{renderMessageContent(msg.content)}</div>
                                {msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {msg.sources
                                            .map((source) => ({ source, path: resolveDetailPath(source) }))
                                            .filter((item) => Boolean(item.path))
                                            .slice(0, 3)
                                            .map(({ source, path }) => (
                                                <div
                                                    key={`detail-${source.source ?? 'src'}-${source.sourceId ?? source.title}`}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2"
                                                >
                                                    <div className="text-xs text-slate-700">
                                                        {(source.source || 'item').toUpperCase()}: {source.title}
                                                    </div>
                                                    <Link
                                                        to={path as string}
                                                        className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:underline"
                                                        onClick={() => setIsOpen(false)}
                                                    >
                                                        Chi tiết tại đây
                                                    </Link>
                                                </div>
                                            ))}
                                    </div>
                                )}

                                {msg.sender === 'assistant' && msg.relatedSources && msg.relatedSources.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <div className="text-xs font-semibold text-slate-600">Bất động sản liên quan</div>
                                        {msg.relatedSources
                                            .map((source) => ({ source, path: resolveDetailPath(source) }))
                                            .filter((item) => Boolean(item.path))
                                            .slice(0, 3)
                                            .map(({ source, path }) => (
                                                <div
                                                    key={`related-${source.source ?? 'src'}-${source.sourceId ?? source.title}`}
                                                    className="rounded-lg border border-slate-200 bg-white px-2 py-2"
                                                >
                                                    <div className="text-xs text-slate-700">
                                                        {(source.source || 'item').toUpperCase()}: {source.title}
                                                    </div>
                                                    <Link
                                                        to={path as string}
                                                        className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:underline"
                                                        onClick={() => setIsOpen(false)}
                                                    >
                                                        Chi tiết tại đây
                                                    </Link>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-slate-200 bg-white p-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleSend();
                                    }
                                }}
                                disabled={loading}
                                placeholder="Nhập câu hỏi..."
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={loading}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                                {loading ? 'Đang gửi' : 'Gửi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
                aria-label="Mở chatbot"
            >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
                    <path d="M12 3C6.477 3 2 7.03 2 12c0 2.094.81 4.016 2.166 5.545L3 22l4.759-1.585A11.14 11.14 0 0 0 12 21c5.523 0 10-4.03 10-9s-4.477-9-10-9zm0 16a9.15 9.15 0 0 1-3.72-.785l-.324-.145-2.824.94.777-2.796-.202-.322A6.93 6.93 0 0 1 4 12c0-3.86 3.589-7 8-7s8 3.14 8 7-3.589 7-8 7zm-4-8h8v2H8v-2zm0-3h8v2H8V8zm0 6h5v2H8v-2z" />
                </svg>
            </button>
        </div>
    );
};

export default ChatbotWidget;
