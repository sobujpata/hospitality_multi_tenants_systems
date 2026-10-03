import {
    ArrowDown,
    ChevronDown,
    LoaderCircle,
    MessageCircle,
    Paperclip,
    Send,
    Search,
    X,
} from 'lucide-react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from 'react';
import MessageBubble, {
    formatMessageDate,
    groupMessagesByDate,
    type MessageBubbleData,
} from '@/components/MessageBubble';

type Conversation = {
    id: number;
    status: 'open' | 'active' | 'resolved' | string;
    unread_staff: number;
    unread_customer: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    customer: { id: number | null; name: string; avatar: string | null };
    booking: { id: number | null; booking_ref: string | null };
    branch: { id: number | null; name: string };
    assigned_staff: { id: number; name: string; avatar: string | null } | null;
    latest_message: MessageBubbleData | null;
};

type StaffMember = {
    id: number;
    name: string;
    avatar: string | null;
    branch_id: number | null;
};

type PaginatedConversations = {
    data: Conversation[];
    next_page_url: string | null;
};

type Props = {
    staff: StaffMember[];
    currentStaffId: number;
};

type ApiError = { message?: string; errors?: Record<string, string[]> };
type TypingEvent = { sender_name: string; is_typing: boolean };
type ReadEvent = { reader_type: 'customer' | 'staff' };

function isValidConversationId(id: unknown): id is number {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    const metaCsrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    const xsrfCookie = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.split('=')
        .slice(1)
        .join('=');

    if (metaCsrfToken) {
        headers.set('X-CSRF-TOKEN', metaCsrfToken);
    } else if (xsrfCookie) {
        headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfCookie));
    }
    if (init.body && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'same-origin',
    });

    if (!response.ok) {
        let details: ApiError = {};
        try {
            details = (await response.json()) as ApiError;
        } catch {
            // The server can return an empty or non-JSON error response.
        }
        const validationError = details.errors
            ? Object.values(details.errors).flat()[0]
            : undefined;
        throw new Error(
            validationError ?? details.message ?? `Request failed (${response.status}).`,
        );
    }

    return (await response.json()) as T;
}

function Avatar({
    name,
    src,
    size = 'size-10',
}: {
    name: string;
    src: string | null;
    size?: string;
}) {
    return src ? (
        <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
        <span
            className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600`}
            aria-hidden="true"
        >
            {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

function statusDot(status: string): string {
    if (status === 'active') return 'bg-emerald-500';
    if (status === 'open') return 'bg-amber-400';
    return 'bg-slate-400';
}

function conversationTime(timestamp: string | null): string {
    if (!timestamp) return '';
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
}

export default function StaffInbox({ staff, currentStaffId }: Props) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageBubbleData[]>([]);
    const [search, setSearch] = useState('');
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingName, setTypingName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
    const echoRef = useRef<Echo<'reverb'> | null>(null);
    const subscribedIdsRef = useRef(new Set<number>());
    const activeIdRef = useRef<number | null>(null);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSequenceRef = useRef(0);
    const pendingSendsRef = useRef(0);

    const activeConversation = conversations.find(
        (conversation) => conversation.id === activeConversationId,
    ) ?? null;

    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase();
        const latestFirst = [...conversations].sort((first, second) => {
            const firstTime = first.last_message_at ? parseISO(first.last_message_at).getTime() : 0;
            const secondTime = second.last_message_at ? parseISO(second.last_message_at).getTime() : 0;
            return secondTime - firstTime;
        });
        if (!query) return latestFirst;
        return latestFirst.filter((conversation) =>
            `${conversation.customer.name} ${conversation.booking.booking_ref ?? ''}`
                .toLowerCase()
                .includes(query),
        );
    }, [conversations, search]);

    const unreadTotal = conversations.reduce(
        (total, conversation) => total + conversation.unread_staff,
        0,
    );

    const scrollToBottom = useCallback(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const subscribeToConversation = useCallback((conversationId: number) => {
        const echo = echoRef.current;
        if (!echo || subscribedIdsRef.current.has(conversationId)) return;

        subscribedIdsRef.current.add(conversationId);
        echo.private(`conversation.${conversationId}`)
            .listen('.message.sent', (message: MessageBubbleData) => {
                setConversations((current) => {
                    const conversation = current.find((item) => item.id === conversationId);
                    if (!conversation) return current;
                    return [
                        {
                            ...conversation,
                            last_message_at: message.created_at,
                            last_message_preview: message.body ?? message.file_name ?? 'Attachment',
                            unread_staff:
                                message.sender.type === 'customer' &&
                                activeIdRef.current !== conversationId
                                    ? conversation.unread_staff + 1
                                    : conversation.unread_staff,
                        },
                        ...current.filter((item) => item.id !== conversationId),
                    ];
                });

                if (activeIdRef.current === conversationId) {
                    setMessages((current) =>
                        current.some((item) => item.id === message.id)
                            ? current
                            : [...current, message],
                    );
                    requestAnimationFrame(scrollToBottom);
                }
            })
            .listen('.message.read', (event: ReadEvent) => {
                if (event.reader_type === 'customer' && activeIdRef.current === conversationId) {
                    setMessages((current) =>
                        current.map((message) =>
                            message.sender.type === 'staff'
                                ? { ...message, is_read: true }
                                : message,
                        ),
                    );
                }
            })
            .listen('.user.typing', (event: TypingEvent) => {
                if (activeIdRef.current !== conversationId) return;
                setTypingName(event.sender_name);
                setIsTyping(event.is_typing);
                if (typingResetRef.current) clearTimeout(typingResetRef.current);
                if (event.is_typing) {
                    typingResetRef.current = setTimeout(() => setIsTyping(false), 3000);
                }
            });
    }, [scrollToBottom]);

    const loadConversations = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let page = await apiRequest<PaginatedConversations>('/api/conversations');
            let loadedConversations = page.data;
            if (!loadedConversations.every((conversation) => isValidConversationId(conversation.id))) {
                throw new Error('The inbox returned a conversation without a valid ID. Refresh and try again.');
            }
            setConversations(loadedConversations);
            setNextPageUrl(page.next_page_url);
            setIsLoadingMore(page.next_page_url !== null);
            page.data
                .filter((conversation) => conversation.status !== 'resolved')
                .forEach((conversation) => subscribeToConversation(conversation.id));

            setIsLoading(false);
            while (page.next_page_url) {
                page = await apiRequest<PaginatedConversations>(page.next_page_url);
                if (!page.data.every((conversation) => isValidConversationId(conversation.id))) {
                    throw new Error('The inbox returned a conversation without a valid ID. Refresh and try again.');
                }
                const knownIds = new Set(loadedConversations.map((conversation) => conversation.id));
                loadedConversations = [
                    ...loadedConversations,
                    ...page.data.filter((conversation) => !knownIds.has(conversation.id)),
                ];
                setConversations(loadedConversations);
                setNextPageUrl(page.next_page_url);
                page.data
                    .filter((conversation) => conversation.status !== 'resolved')
                    .forEach((conversation) => subscribeToConversation(conversation.id));
            }
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'Unable to load conversations.',
            );
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [subscribeToConversation]);

    useEffect(() => {
        const key = import.meta.env.VITE_REVERB_APP_KEY;
        if (key) {
            (window as typeof window & { Pusher: typeof Pusher }).Pusher = Pusher;
            echoRef.current = new Echo({
                broadcaster: 'reverb',
                key,
                wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
                wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
                wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
                forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
                enabledTransports: ['ws', 'wss'],
            });
        } else {
            setError('Real-time messaging is not configured.');
        }

        return () => {
            subscribedIdsRef.current.forEach((conversationId) => {
                echoRef.current?.leave(`conversation.${conversationId}`);
            });
            echoRef.current?.disconnect();
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
            if (typingResetRef.current) clearTimeout(typingResetRef.current);
        };
    }, []);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (messages.length > 0) scrollToBottom();
    }, [messages, scrollToBottom]);

    const selectConversation = async (conversation: Conversation) => {
        if (!isValidConversationId(conversation.id)) {
            setError('This conversation has an invalid ID. Refresh the inbox and try again.');
            return;
        }

        activeIdRef.current = conversation.id;
        setActiveConversationId(conversation.id);
        setMobileThreadOpen(true);
        setMessages(conversation.latest_message ? [conversation.latest_message] : []);
        setIsTyping(false);
        setError(null);
        setIsLoadingMessages(true);
        subscribeToConversation(conversation.id);
        const sequence = ++requestSequenceRef.current;

        try {
            const history = await apiRequest<MessageBubbleData[]>(
                `/api/conversations/${conversation.id}/messages`,
            );
            if (sequence === requestSequenceRef.current) {
                setMessages((current) => {
                    const merged = new Map(current.map((message) => [message.id, message]));
                    history.forEach((message) => merged.set(message.id, message));
                    return [...merged.values()].sort((first, second) =>
                        first.created_at.localeCompare(second.created_at),
                    );
                });
                setConversations((current) =>
                    current.map((item) =>
                        item.id === conversation.id ? { ...item, unread_staff: 0 } : item,
                    ),
                );
            }
        } catch (loadError) {
            if (sequence === requestSequenceRef.current) {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : 'Unable to load this conversation.',
                );
            }
        } finally {
            if (sequence === requestSequenceRef.current) setIsLoadingMessages(false);
        }
    };

    const loadMoreConversations = async () => {
        if (!nextPageUrl || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const page = await apiRequest<PaginatedConversations>(nextPageUrl);
            setConversations((current) => {
                const knownIds = new Set(current.map((conversation) => conversation.id));
                return [...current, ...page.data.filter((item) => !knownIds.has(item.id))];
            });
            setNextPageUrl(page.next_page_url);
            page.data
                .filter((conversation) => conversation.status !== 'resolved')
                .forEach((conversation) => subscribeToConversation(conversation.id));
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'Unable to load more conversations.',
            );
        } finally {
            setIsLoadingMore(false);
        }
    };

    const updateConversation = async (
        values: { status?: string; assigned_staff_id?: number | null },
    ) => {
        if (!activeConversation) return;
        setError(null);
        try {
            const updated = await apiRequest<{
                id: number;
                status: string;
                assigned_staff_id: number | null;
            }>(`/api/conversations/${activeConversation.id}`, {
                method: 'PUT',
                body: JSON.stringify(values),
            });
            const assignee = staff.find((member) => member.id === updated.assigned_staff_id);
            setConversations((current) =>
                current.map((conversation) =>
                    conversation.id === updated.id
                        ? {
                              ...conversation,
                              status: updated.status,
                              assigned_staff: assignee
                                  ? {
                                        id: assignee.id,
                                        name: assignee.name,
                                        avatar: assignee.avatar,
                                    }
                                  : null,
                          }
                        : conversation,
                ),
            );
        } catch (updateError) {
            setError(
                updateError instanceof Error
                    ? updateError.message
                    : 'Unable to update this conversation.',
            );
        }
    };

    const sendTyping = () => {
        const conversationId = activeConversation?.id;
        if (!isValidConversationId(conversationId)) return;

        if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = setTimeout(() => {
            void apiRequest<{ ok: boolean }>(
                `/api/conversations/${conversationId}/typing`,
                {
                    method: 'POST',
                    body: JSON.stringify({ is_typing: true }),
                },
            ).catch((typingError: unknown) => {
                setError(
                    typingError instanceof Error
                        ? typingError.message
                        : 'Unable to send typing status.',
                );
            });
        }, 300);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            void apiRequest<{ ok: boolean }>(
                `/api/conversations/${conversationId}/typing`,
                {
                    method: 'POST',
                    body: JSON.stringify({ is_typing: false }),
                },
            ).catch((typingError: unknown) => {
                setError(
                    typingError instanceof Error
                        ? typingError.message
                        : 'Unable to update typing status.',
                );
            });
        }, 1500);
    };

    const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeConversation || (!inputText.trim() && !selectedFile)) return;

        const body = inputText.trim();
        const file = selectedFile;
        const type = file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text';
        const optimisticId = -Date.now();
        const staffMember = staff.find((member) => member.id === currentStaffId);
        const previewUrl = file ? URL.createObjectURL(file) : null;
        const optimistic: MessageBubbleData = {
            id: optimisticId,
            conversation_id: activeConversation.id,
            type,
            body: body || null,
            file_url: previewUrl,
            file_name: file?.name ?? null,
            file_size: null,
            is_read: false,
            created_at: new Date().toISOString(),
            sender: {
                id: currentStaffId,
                name: staffMember?.name ?? 'You',
                avatar: staffMember?.avatar ?? null,
                type: 'staff',
            },
        };
        const formData = new FormData();
        if (body) formData.append('body', body);
        if (file) formData.append('file', file);
        formData.append('type', type);

        setError(null);
        setMessages((current) => [...current, optimistic]);
        setConversations((current) => [
            {
                ...activeConversation,
                last_message_at: optimistic.created_at,
                last_message_preview: body || file?.name || 'Attachment',
            },
            ...current.filter((conversation) => conversation.id !== activeConversation.id),
        ]);
        setInputText('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        requestAnimationFrame(scrollToBottom);
        pendingSendsRef.current += 1;
        setIsSending(true);

        try {
            const saved = await apiRequest<MessageBubbleData>(
                `/api/conversations/${activeConversation.id}/messages`,
                { method: 'POST', body: formData },
            );
            setMessages((current) => current
                .filter((message) => message.id !== optimisticId && message.id !== saved.id)
                .concat(saved)
                .sort((first, second) => first.created_at.localeCompare(second.created_at)));
            setConversations((current) => [
                {
                    ...activeConversation,
                    last_message_at: saved.created_at,
                    last_message_preview: saved.body ?? saved.file_name ?? 'Attachment',
                },
                ...current.filter((conversation) => conversation.id !== activeConversation.id),
            ]);
            requestAnimationFrame(scrollToBottom);
        } catch (sendError) {
            setMessages((current) => current.filter((message) => message.id !== optimisticId));
            setInputText((current) => current || body);
            setSelectedFile((current) => current || file);
            if (file && fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInputRef.current.files = dataTransfer.files;
            }
            setError(
                sendError instanceof Error ? sendError.message : 'Unable to send your message.',
            );
        } finally {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            pendingSendsRef.current = Math.max(0, pendingSendsRef.current - 1);
            setIsSending(pendingSendsRef.current > 0);
        }
    };

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files?.[0] ?? null);
    };

    const groupedMessages = groupMessagesByDate(messages);
    const assignableStaff = activeConversation
        ? staff.filter((member) => member.branch_id === activeConversation.branch.id)
        : [];

    return (
        <main className="mx-auto flex h-[calc(100dvh-4rem)] min-h-[34rem] max-w-[1600px] flex-col bg-slate-100 p-2 sm:p-4 lg:p-5">
            {error && (
                <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-white">
                <aside
                    className={`w-full shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[360px] ${
                        mobileThreadOpen ? 'hidden' : 'flex'
                    }`}
                >
                    <div className="border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-semibold text-slate-900">Chats</h1>
                                <p className="mt-0.5 text-xs text-slate-500">Customer conversations</p>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                {unreadTotal} unread
                            </span>
                        </div>
                        <label className="relative block">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search or start a new chat"
                                aria-label="Search customers and bookings"
                                className="w-full rounded-lg border-0 bg-slate-100 py-2.5 pr-3 pl-9 text-sm outline-none transition focus:bg-white focus:ring-1 focus:ring-emerald-500"
                            />
                        </label>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                Loading inbox…
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <p className="px-5 py-10 text-center text-sm text-slate-500">
                                {search ? 'No matching conversations.' : 'No conversations yet.'}
                            </p>
                        ) : (
                            <ul>
                                {filteredConversations.map((conversation) => (
                                    <li key={conversation.id}>
                                        <button
                                            type="button"
                                            onClick={() => void selectConversation(conversation)}
                                            className={`flex w-full gap-3 border-b border-slate-100 border-l-2 px-4 py-4 text-left transition-colors hover:bg-slate-50 ${
                                                activeConversationId === conversation.id
                                                    ? 'border-l-emerald-500 bg-emerald-50/80'
                                                    : 'border-transparent'
                                            }`}
                                        >
                                            <Avatar
                                                name={conversation.customer.name}
                                                src={conversation.customer.avatar}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-sm font-semibold text-slate-900">
                                                        {conversation.customer.name}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] text-slate-400">
                                                        {conversationTime(conversation.last_message_at)}
                                                    </span>
                                                </span>
                                                <span className="mt-1 flex items-center gap-1.5">
                                                    <span className="truncate text-xs text-slate-500">
                                                        {conversation.last_message_preview ?? 'No messages yet'}
                                                    </span>
                                                </span>
                                                <span className="mt-1.5 flex items-center justify-between gap-2">
                                                    <span className="flex min-w-0 items-center gap-1.5">
                                                        <span className={`size-1.5 shrink-0 rounded-full ${statusDot(conversation.status)}`} />
                                                        {conversation.booking.booking_ref && (
                                                            <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                                                {conversation.booking.booking_ref}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {conversation.unread_staff > 0 && (
                                                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                                                            {conversation.unread_staff > 99 ? '99+' : conversation.unread_staff}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {nextPageUrl && (
                            <button
                                type="button"
                                disabled={isLoadingMore}
                                onClick={() => void loadMoreConversations()}
                                className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-emerald-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {isLoadingMore && <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />}
                                Load older conversations
                            </button>
                        )}
                    </div>
                </aside>

                <section
                    className={`min-w-0 flex-1 flex-col ${
                        mobileThreadOpen ? 'flex' : 'hidden md:flex'
                    }`}
                    aria-label="Conversation thread"
                >
                    {!activeConversation ? (
                        <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-white via-slate-50 to-emerald-50/60 px-6 text-center">
                            <div className="grid size-20 place-items-center rounded-3xl bg-white text-emerald-600 shadow-lg shadow-emerald-900/5 ring-1 ring-slate-200/70">
                                <MessageCircle className="size-9" aria-hidden="true" />
                            </div>
                            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-800">Hospitality Messenger</h2>
                            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                                Select a customer from the list to view your conversation and reply.
                            </p>
                        </div>
                    ) : (
                        <>
                            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-5">
                                <button
                                    type="button"
                                    onClick={() => setMobileThreadOpen(false)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                                    aria-label="Back to conversations"
                                >
                                    <ArrowDown className="size-4 rotate-90" aria-hidden="true" />
                                </button>
                                <Avatar
                                    name={activeConversation.customer.name}
                                    src={activeConversation.customer.avatar}
                                />
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-sm font-semibold text-slate-900">
                                        {activeConversation.customer.name}
                                    </h2>
                                    <p className="truncate text-xs text-slate-500">
                                        {activeConversation.booking.booking_ref ?? 'No booking'} · {activeConversation.branch.name}
                                    </p>
                                </div>
                                <label className="relative">
                                    <span className="sr-only">Conversation status</span>
                                    <select
                                        value={activeConversation.status}
                                        onChange={(event) =>
                                            void updateConversation({ status: event.target.value })
                                        }
                                        className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
                                    >
                                        <option value="open">Open</option>
                                        <option value="active">Active</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                </label>
                                <label className="relative">
                                    <span className="sr-only">Assign conversation to staff</span>
                                    <select
                                        value={activeConversation.assigned_staff?.id ?? ''}
                                        onChange={(event) =>
                                            void updateConversation({
                                                assigned_staff_id: event.target.value
                                                    ? Number(event.target.value)
                                                    : null,
                                            })
                                        }
                                        className="max-w-36 appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Unassigned</option>
                                        {assignableStaff.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name}{member.id === currentStaffId ? ' (you)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                </label>
                            </header>

                                <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-emerald-50/50 px-3 py-5 sm:px-6">
                                {isLoadingMessages ? (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                                        Loading messages…
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                        No messages in this conversation yet.
                                    </div>
                                ) : (
                                    <div className="mx-auto max-w-3xl">
                                        {Object.entries(groupedMessages).map(([dateKey, datedMessages]) => (
                                            <div key={dateKey}>
                                                <div className="my-5 flex items-center gap-3">
                                                    <span className="h-px flex-1 bg-slate-200" />
                                                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-medium text-slate-400 shadow-sm">
                                                        {formatMessageDate(datedMessages[0].created_at)}
                                                    </span>
                                                    <span className="h-px flex-1 bg-slate-200" />
                                                </div>
                                                {datedMessages.map((message, index) => (
                                                    <MessageBubble
                                                        key={message.id}
                                                        message={message}
                                                        isMine={message.sender.type === 'staff'}
                                                        variant="whatsapp"
                                                        showSender={
                                                            index === 0 ||
                                                            datedMessages[index - 1].sender.id !== message.sender.id ||
                                                            datedMessages[index - 1].sender.type !== message.sender.type
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        ))}
                                        {isTyping && (
                                            <p className="ml-9 mt-2 text-xs text-slate-400">
                                                {typingName} is typing…
                                            </p>
                                        )}
                                        <div ref={messageEndRef} />
                                    </div>
                                )}
                            </div>

                            <form onSubmit={(event) => void sendMessage(event)} className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
                                {selectedFile && (
                                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                                        <Paperclip className="size-3.5" aria-hidden="true" />
                                        <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
                                        <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove attachment">
                                            <X className="size-3.5" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={onFileChange}
                                        className="sr-only"
                                        aria-label="Attach a file"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="rounded-full p-2.5 text-slate-500 hover:bg-slate-200"
                                        aria-label="Attach file"
                                    >
                                        <Paperclip className="size-5" aria-hidden="true" />
                                    </button>
                                    <textarea
                                        value={inputText}
                                        onChange={(event) => {
                                            setInputText(event.target.value);
                                            sendTyping();
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                event.currentTarget.form?.requestSubmit();
                                            }
                                        }}
                                        rows={1}
                                        maxLength={5000}
                                        placeholder="Write a message…"
                                        aria-label="Message"
                                        className="max-h-32 min-h-10 flex-1 resize-y rounded-full border-0 bg-white px-4 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputText.trim() && !selectedFile}
                                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="Send message"
                                    >
                                        {isSending ? (
                                            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <Send className="size-5" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-right text-[10px] text-slate-400">
                                    Enter to send · Shift + Enter for a new line
                                </p>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
