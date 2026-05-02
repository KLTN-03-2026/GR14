import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '@/api';
import type { ChatIntent, ChatSource } from '@/api/ai';

type Sender = 'user' | 'assistant';

interface ChatMessage {
    id: string;
    sender: Sender;
    content: string;
    intent?: ChatIntent;
    sources?: ChatSource[];
    relatedSources?: ChatSource[];
    suggestedQuestions?: string[];
}

type CompareRow = {
    idx: number;
    source: ChatSource;
    title: string;
    location: string;
    price: number;
    area: number;
    pricePerM2: number;
};

type CompareModalState = {
    rows: CompareRow[];
    cheapestIdx: number;
    largestIdx: number;
    bestValueIdx: number;
} | null;

const STARTER_QUESTIONS = [
    'Tìm nhà dưới 3 tỷ',
    'Sổ hồng là gì?',
    'Tìm đất nền giá rẻ',
    'So sánh 2 BĐS phù hợp nhất',
    'Kinh nghiệm mua nhà lần đầu',
    'Quy trình vay mua nhà',
    'Gợi ý viết mô tả đăng bán nhà',
];

const SOURCE_TYPE_LABEL: Record<string, string> = { house: '🏠 Nhà', land: '🏗️ Đất', post: '📰 Tin' };
const PLACEHOLDER_GRADIENTS: Record<string, string> = {
    house: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    land: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    post: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};

const resolveDetailPath = (source: ChatSource): string | null => {
    if (!source.sourceId) return null;
    if (source.source === 'house') return `/houses/${source.sourceId}`;
    if (source.source === 'land') return `/lands/${source.sourceId}`;
    if (source.source === 'post') return `/posts/${source.sourceId}`;
    return null;
};

const formatVnd = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} VNĐ`;
const formatArea = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} m²`;

const toCompareRows = (sources: ChatSource[]): CompareRow[] =>
    sources
        .filter((s) => typeof s.price === 'number' && typeof s.area === 'number' && s.area > 0)
        .slice(0, 3)
        .map((s, i) => {
            const location = [s.street, s.ward, s.district, s.city].filter(Boolean).join(', ');
            const price = Number(s.price || 0);
            const area = Number(s.area || 0);
            const pricePerM2 = area > 0 ? Math.round(price / area) : 0;

            return {
                idx: i + 1,
                source: s,
                title: s.title || `Bất động sản ${i + 1}`,
                location: location || 'Chưa có vị trí',
                price,
                area,
                pricePerM2,
            };
        });

/* ─── Typing Indicator ─────────────────────────────────────────────────── */
const TypingIndicator: React.FC = () => (
    <div className="flex max-w-[85%] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-semibold text-slate-400">AI</span>
        <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="inline-block h-2 w-2 rounded-full bg-blue-400"
                    style={{
                        animation: 'chatbot-bounce 1.2s infinite ease-in-out',
                        animationDelay: `${i * 0.2}s`,
                    }}
                />
            ))}
        </span>
    </div>
);

/* ─── Rich Property Source Card ───────────────────────────────────────── */
const PropertyCard: React.FC<{ source: ChatSource; onClose: () => void }> = ({ source, onClose }) => {
    const path = resolveDetailPath(source);
    const imgUrl = source.imageUrl;
    const typeLabel = SOURCE_TYPE_LABEL[source.source || ''] || '📋 BĐS';
    const location = [source.ward, source.district, source.city].filter(Boolean).join(', ');
    return (
        <div className="group flex gap-2 rounded-lg border border-slate-200 bg-white p-2 transition hover:shadow-md">
            {/* Thumbnail */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md" style={imgUrl ? undefined : { background: PLACEHOLDER_GRADIENTS[source.source || 'house'] }}>
                {imgUrl ? (
                    <img src={imgUrl} alt={source.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-white/80">🏡</div>
                )}
            </div>
            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-indigo-600">{typeLabel}</span>
                    {source.sourceId && <span className="text-[9px] text-slate-400">#{source.sourceId}</span>}
                </div>
                <div className="text-xs font-medium text-slate-800 line-clamp-1">{source.title}</div>
                {location && <div className="text-[10px] text-slate-500 line-clamp-1">📍 {location}</div>}
                <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                    {source.price ? <span className="font-bold text-rose-600">{formatVnd(source.price)}</span> : null}
                    {source.area ? <span className="text-slate-500">{formatArea(source.area)}</span> : null}
                </div>
                {path && (
                    <Link to={path} className="mt-0.5 inline-block text-[10px] font-semibold text-blue-600 hover:underline" onClick={onClose}>
                        Xem chi tiết →
                    </Link>
                )}
            </div>
        </div>
    );
};

/* ─── Quick Reply Chip ─────────────────────────────────────────────────── */
const QuickReply: React.FC<{ text: string; onClick: (text: string) => void; disabled: boolean }> = ({
    text,
    onClick,
    disabled,
}) => (
    <button
        type="button"
        disabled={disabled}
        onClick={() => onClick(text)}
        className="rounded-full border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:from-blue-100 hover:to-indigo-100 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
    >
        {text}
    </button>
);

/* ─── Welcome / Empty State ────────────────────────────────────────────── */
const WelcomeCard: React.FC<{ onChipClick: (text: string) => void; loading: boolean }> = ({
    onChipClick,
    loading,
}) => (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-blue-600" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.477 3 2 7.03 2 12c0 2.094.81 4.016 2.166 5.545L3 22l4.759-1.585A11.14 11.14 0 0 0 12 21c5.523 0 10-4.03 10-9s-4.477-9-10-9zm-4 8h8v2H8v-2zm0-3h8v2H8V8zm0 6h5v2H8v-2z" />
            </svg>
        </div>
        <p className="mb-1 text-sm font-semibold text-slate-700">Trợ lý AI Bất Động Sản</p>
        <p className="mb-4 text-xs text-slate-500">
            Tìm nhà, đất, tư vấn giá và giải đáp thắc mắc — mình luôn sẵn sàng!
        </p>
        <div className="flex flex-wrap justify-center gap-2">
            {STARTER_QUESTIONS.map((q) => (
                <QuickReply key={q} text={q} onClick={onChipClick} disabled={loading} />
            ))}
        </div>
    </div>
);
const generateFallbackId = () => {
    return `session-${Date.now()}`;
};

/* ─── Main Widget ──────────────────────────────────────────────────────── */
const ChatbotWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [compareModal, setCompareModal] = useState<CompareModalState>(null);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Voice input via Web Speech API
    const startVoiceInput = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
            const transcript = event.results?.[0]?.[0]?.transcript || '';
            if (transcript) setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        };
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.start();
    }, []);

    const sessionId = useMemo(() => {
        const key = 'real-estate-ai-session-id';
        const existing = localStorage.getItem(key);
        if (existing) return existing;
        const generated =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : generateFallbackId();
        localStorage.setItem(key, generated);
        return generated;
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, loading]);

    const renderMessageContent = (content: string) => {
        // Check if content is HTML table (from compare answer)
        if (content.trim().startsWith('<div') && content.includes('<table')) {
            return (
                <div
                    className="compare-table-container"
                    dangerouslySetInnerHTML={{ __html: content }}
                    style={{
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: '#333',
                    }}
                />
            );
        }

        // Original text processing for non-HTML content
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

        // Parse markdown: **bold** and _italic_
        const parseMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
            const parts: ReactNode[] = [];
            // Combined regex for **bold** and _italic_
            const mdRegex = /\*\*(.+?)\*\*|_(.+?)_/g;
            let last = 0;
            let m: RegExpExecArray | null;
            while ((m = mdRegex.exec(text)) !== null) {
                if (m.index > last) parts.push(<span key={`${keyPrefix}-t${last}`}>{text.slice(last, m.index)}</span>);
                if (m[1]) {
                    parts.push(<strong key={`${keyPrefix}-b${m.index}`} className="font-semibold">{m[1]}</strong>);
                } else if (m[2]) {
                    parts.push(<em key={`${keyPrefix}-i${m.index}`} className="text-slate-500 not-italic text-[11px]">{m[2]}</em>);
                }
                last = m.index + m[0].length;
            }
            if (last < text.length) parts.push(<span key={`${keyPrefix}-e`}>{text.slice(last)}</span>);
            return parts.length > 0 ? parts : [<span key={`${keyPrefix}-f`}>{text}</span>];
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
                    chunks.push(...parseMarkdown(prefixText, `txt-${lineIndex}-${urlIndex}`));
                }

                const internalPath = toInternalPath(url);
                if (internalPath) {
                    const useDetailLabel = isDetailLink || isPropertyPath(internalPath);
                    chunks.push(
                        <Link key={`url-${lineIndex}-${urlIndex}`} to={internalPath} className="break-all text-blue-600 underline" onClick={() => setIsOpen(false)}>
                            {useDetailLabel ? detailLabel : internalPath}
                        </Link>,
                    );
                } else {
                    chunks.push(
                        <a key={`url-${lineIndex}-${urlIndex}`} href={url} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">
                            {isDetailLink ? detailLabel : url}
                        </a>,
                    );
                }

                urlIndex += 1;
                lastIndex = start + url.length;
                match = urlRegex.exec(line);
            }

            if (lastIndex < line.length) {
                chunks.push(...parseMarkdown(line.slice(lastIndex), `tail-${lineIndex}`));
            }
            if (chunks.length === 0) {
                chunks.push(...parseMarkdown(line, `full-${lineIndex}`));
            }

            return (
                <div key={`line-${lineIndex}`} className="whitespace-pre-wrap">
                    {chunks}
                </div>
            );
        });
    };

    const renderCompareTable = (sources: ChatSource[]) => {
        const rows = toCompareRows(sources);
        if (rows.length < 2) return null;

        const cheapest = rows.reduce((best, cur) => (cur.price < best.price ? cur : best), rows[0]);
        const largest = rows.reduce((best, cur) => (cur.area > best.area ? cur : best), rows[0]);
        const bestValue = rows.reduce((best, cur) => (cur.pricePerM2 < best.pricePerM2 ? cur : best), rows[0]);

        const getBadges = (row: CompareRow) => {
            const badges: Array<{ label: string; className: string }> = [];
            if (row.idx === cheapest.idx) {
                badges.push({ label: 'GIÁ TỐT NHẤT', className: 'bg-rose-100 text-rose-700 border border-rose-200' });
            }
            if (row.idx === largest.idx) {
                badges.push({ label: 'DIỆN TÍCH LỚN', className: 'bg-sky-100 text-sky-700 border border-sky-200' });
            }
            if (row.idx === bestValue.idx) {
                badges.push({ label: 'GIÁ/M² TỐT', className: 'bg-amber-100 text-amber-700 border border-amber-200' });
            }
            return badges;
        };

        return (
            <div className="space-y-2.5">
                {/* Mobile-first cards */}
                <div className="space-y-2 sm:hidden">
                    {rows.map((row) => {
                        const badges = getBadges(row);
                        const path = resolveDetailPath(row.source);
                        return (
                            <div
                                key={`m-${row.source.source}-${row.source.sourceId}-${row.idx}`}
                                className="rounded-lg border border-slate-200 bg-white p-2.5"
                            >
                                <div className="mb-1.5 flex items-start justify-between gap-2">
                                    <div className="text-xs font-semibold text-blue-700">Căn {row.idx}</div>
                                    <div className="text-[10px] text-slate-500">{String(row.source.source || '').toUpperCase()}</div>
                                </div>
                                <div className="mb-1.5 text-xs font-medium text-slate-800 line-clamp-2">{row.title}</div>
                                <div className="mb-2 text-[11px] text-slate-500 line-clamp-1">{row.location}</div>
                                {badges.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                        {badges.map((badge) => (
                                            <span key={`${row.idx}-${badge.label}`} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2">
                                    <div>
                                        <div className="text-[10px] text-slate-500">Giá</div>
                                        <div className="text-[11px] font-semibold text-rose-600">{formatVnd(row.price)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">Diện tích</div>
                                        <div className="text-[11px] font-semibold text-sky-700">{formatArea(row.area)}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="text-[10px] text-slate-500">Giá/m²</div>
                                        <div className="text-[11px] font-semibold text-amber-700">{formatVnd(row.pricePerM2)}</div>
                                    </div>
                                </div>
                                {path && (
                                    <Link
                                        to={path}
                                        className="mt-2 inline-block text-[11px] font-semibold text-blue-700 hover:underline"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Chi tiết tại đây
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop/tablet table */}
                <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
                    <table className="min-w-[560px] w-full text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-2 py-2 text-left font-semibold">Căn</th>
                                <th className="px-2 py-2 text-left font-semibold">Thông tin</th>
                                <th className="px-2 py-2 text-right font-semibold">Giá</th>
                                <th className="px-2 py-2 text-right font-semibold">Diện tích</th>
                                <th className="px-2 py-2 text-right font-semibold">Giá/m²</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const badges = getBadges(row);
                                const path = resolveDetailPath(row.source);
                                return (
                                    <tr key={`${row.source.source}-${row.source.sourceId}-${row.idx}`} className={badges.length > 0 ? 'bg-blue-50/50' : 'bg-white'}>
                                        <td className="px-2 py-2 align-top font-semibold text-blue-700">Căn {row.idx}</td>
                                        <td className="px-2 py-2 align-top">
                                            <div className="font-medium text-slate-800 line-clamp-2">{row.title}</div>
                                            <div className="text-[11px] text-slate-500 line-clamp-1">{row.location}</div>
                                            {badges.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {badges.map((badge) => (
                                                        <span key={`${row.idx}-d-${badge.label}`} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                                                            {badge.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {path && (
                                                <Link to={path} className="mt-1 inline-block text-[11px] font-semibold text-blue-700 hover:underline" onClick={() => setIsOpen(false)}>
                                                    Chi tiết tại đây
                                                </Link>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right align-top font-semibold text-rose-600">{formatVnd(row.price)}</td>
                                        <td className="px-2 py-2 text-right align-top text-slate-700">{formatArea(row.area)}</td>
                                        <td className="px-2 py-2 text-right align-top font-semibold text-blue-700">{formatVnd(row.pricePerM2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() =>
                            setCompareModal({
                                rows,
                                cheapestIdx: cheapest.idx,
                                largestIdx: largest.idx,
                                bestValueIdx: bestValue.idx,
                            })
                        }
                        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        So sánh chi tiết
                    </button>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-700">
                    <div><span className="font-semibold text-rose-700">Giá rẻ nhất:</span> Căn {cheapest.idx} ({formatVnd(cheapest.price)})</div>
                    <div><span className="font-semibold text-sky-700">Diện tích lớn:</span> Căn {largest.idx} ({formatArea(largest.area)})</div>
                    <div><span className="font-semibold text-amber-700">Giá/m² tốt nhất:</span> Căn {bestValue.idx} ({formatVnd(bestValue.pricePerM2)}/m²)</div>
                </div>
            </div>
        );
    };

    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
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
                    intent: payload?.intent,
                    sources: payload?.sources || [],
                    relatedSources: payload?.relatedSources || [],
                    suggestedQuestions: payload?.suggestedQuestions,
                };

                setMessages((prev) => [...prev, assistantMessage]);
            } catch (err) {
                console.error('AI chat error:', err);
                setError('Không thể kết nối AI lúc này. Vui lòng thử lại sau.');
            } finally {
                setLoading(false);
            }
        },
        [loading, sessionId],
    );

    const handleSend = useCallback(() => void sendMessage(query), [sendMessage, query]);
    const handleChipClick = useCallback((text: string) => void sendMessage(text), [sendMessage]);

    return (
        <>
            {/* Bounce keyframe injected once */}
            <style>{`
                @keyframes chatbot-bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
                    40% { transform: translateY(-6px); opacity: 1; }
                }
            `}</style>

            <div className="fixed bottom-6 right-4 z-[120] sm:right-6">
                {isOpen && (
                    <div className="mb-3 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        style={{ height: '32rem' }}
                    >
                        {/* Header — gradient design */}
                        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-3 text-white shadow-md">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm">🤖</div>
                                <div>
                                    <span className="text-sm font-bold">AI Bất Động Sản</span>
                                    <div className="flex items-center gap-1 text-[10px] text-white/70">
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-300" />
                                        Đang hoạt động
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-md px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
                                aria-label="Đóng chatbot"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 p-3">
                            {messages.length === 0 ? (
                                <WelcomeCard onChipClick={handleChipClick} loading={loading} />
                            ) : (
                                <div className="space-y-3">
                                    {messages.map((msg) => {
                                        const isCompareCard =
                                            msg.sender === 'assistant' &&
                                            msg.intent?.type === 'compare_property' &&
                                            (msg.sources?.length ?? 0) >= 2;

                                        return (
                                            <div key={msg.id}>
                                                <div
                                                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${msg.sender === 'user'
                                                        ? 'ml-auto bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm'
                                                        : 'border border-slate-100 bg-white text-slate-700 shadow-sm'
                                                        }`}
                                                >
                                                    {msg.sender === 'assistant' && (
                                                        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                            <span>🤖</span> Trợ lý AI
                                                        </div>
                                                    )}
                                                    <div>
                                                        {isCompareCard
                                                            ? renderCompareTable(msg.sources || [])
                                                            : renderMessageContent(msg.content)}
                                                    </div>

                                                    {/* Primary sources — Rich property cards */}
                                                    {msg.sender === 'assistant' && !isCompareCard && msg.sources && msg.sources.length > 0 && (
                                                        <div className="mt-3 space-y-1.5">
                                                            {msg.sources
                                                                .filter((s) => resolveDetailPath(s))
                                                                .slice(0, 3)
                                                                .map((source) => (
                                                                    <PropertyCard
                                                                        key={`src-${source.source}-${source.sourceId}`}
                                                                        source={source}
                                                                        onClose={() => setIsOpen(false)}
                                                                    />
                                                                ))}
                                                        </div>
                                                    )}

                                                    {/* Related sources */}
                                                    {msg.sender === 'assistant' && msg.relatedSources && msg.relatedSources.length > 0 && (
                                                        <div className="mt-3 space-y-1.5">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Có thể bạn quan tâm</div>
                                                            {msg.relatedSources
                                                                .filter((s) => resolveDetailPath(s))
                                                                .slice(0, 3)
                                                                .map((source) => (
                                                                    <PropertyCard
                                                                        key={`rel-${source.source}-${source.sourceId}`}
                                                                        source={source}
                                                                        onClose={() => setIsOpen(false)}
                                                                    />
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Quick reply chips — shown only on last assistant message */}
                                                {msg.sender === 'assistant' &&
                                                    msg.suggestedQuestions &&
                                                    msg.suggestedQuestions.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                                                            {msg.suggestedQuestions.map((q) => (
                                                                <QuickReply
                                                                    key={q}
                                                                    text={q}
                                                                    onClick={handleChipClick}
                                                                    disabled={loading}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>
                                        )
                                    })}

                                    {/* Typing indicator */}
                                    {loading && <TypingIndicator />}
                                </div>
                            )}

                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input bar with voice */}
                        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                            <div className="flex gap-1.5">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    disabled={loading}
                                    placeholder="Hỏi về bất động sản..."
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50"
                                />
                                {/* Voice input button */}
                                {typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                                    <button
                                        type="button"
                                        onClick={startVoiceInput}
                                        disabled={loading || isListening}
                                        className={`rounded-lg px-2.5 py-2 text-sm transition ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:cursor-not-allowed`}
                                        aria-label="Nhập giọng nói"
                                        title="Nhập bằng giọng nói"
                                    >
                                        🎤
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={loading || !query.trim()}
                                    className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-blue-300 disabled:to-blue-300"
                                >
                                    Gửi
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FAB button — premium with pulse */}
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
                    aria-label="Mở chatbot"
                >
                    {!isOpen && (
                        <span className="absolute inset-0 rounded-full bg-blue-500 opacity-30" style={{ animation: 'chatbot-bounce 2s infinite' }} />
                    )}
                    <span className="relative text-2xl">{isOpen ? '✕' : '🤖'}</span>
                </button>
            </div>

            {compareModal && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/55 p-4">
                    <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <h3 className="text-sm font-semibold text-slate-800">So sánh chi tiết bất động sản</h3>
                            <button
                                type="button"
                                onClick={() => setCompareModal(null)}
                                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                                Đóng
                            </button>
                        </div>
                        <div className="max-h-[calc(85vh-56px)] overflow-auto p-4">
                            <div className="space-y-3">
                                {compareModal.rows.map((row) => {
                                    const path = resolveDetailPath(row.source);
                                    const badges: string[] = [];
                                    if (row.idx === compareModal.cheapestIdx) badges.push('GIÁ TỐT NHẤT');
                                    if (row.idx === compareModal.largestIdx) badges.push('DIỆN TÍCH LỚN');
                                    if (row.idx === compareModal.bestValueIdx) badges.push('GIÁ/M² TỐT');
                                    return (
                                        <div key={`modal-${row.idx}-${row.source.sourceId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <div className="text-sm font-semibold text-blue-700">Căn {row.idx} {row.source.sourceId ? `(ID ${row.source.sourceId})` : ''}</div>
                                                {badges.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {badges.map((b) => (
                                                            <span key={`modal-badge-${row.idx}-${b}`} className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                                                {b}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs font-medium text-slate-800">{row.title}</div>
                                            <div className="mb-2 text-xs text-slate-600">{row.location}</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                                <div className="rounded-md bg-white p-2"><div className="text-[10px] text-slate-500">Loại</div><div className="font-semibold text-slate-700">{String(row.source.source || '').toUpperCase()}</div></div>
                                                <div className="rounded-md bg-white p-2"><div className="text-[10px] text-slate-500">Giá</div><div className="font-semibold text-rose-600">{formatVnd(row.price)}</div></div>
                                                <div className="rounded-md bg-white p-2"><div className="text-[10px] text-slate-500">Diện tích</div><div className="font-semibold text-sky-700">{formatArea(row.area)}</div></div>
                                                <div className="rounded-md bg-white p-2"><div className="text-[10px] text-slate-500">Giá/m²</div><div className="font-semibold text-amber-700">{formatVnd(row.pricePerM2)}</div></div>
                                            </div>
                                            {path && (
                                                <Link
                                                    to={path}
                                                    className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                                                    onClick={() => {
                                                        setCompareModal(null);
                                                        setIsOpen(false);
                                                    }}
                                                >
                                                    Mở trang chi tiết
                                                </Link>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotWidget;
