import {
    ChatBubbleLeftRightIcon,
    PaperAirplaneIcon,
    PaperClipIcon,
    StarIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { format } from 'date-fns';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import MessageBubble, {
    formatMessageDate,
    groupMessagesByDate,
    type MessageBubbleData,
} from '@/components/MessageBubble';

type MessageType = MessageBubbleData;

type ConversationType = {
    id: number;
    status: string;
    unread_staff: number;
    unread_customer: number;
    branch?: { name: string; cover_image?: string | null };
};

type Booking = {
    id: number;
    booking_ref: string;
    branch_id: number;
    status: string;
    branch: { name: string; cover_image?: string | null };
};

type ReviewData = {
    rating: number;
    cleanliness: number;
    service: number;
    location: number;
    value: number;
    title: string;
    comment: string;
};

type Props = {
    booking: Booking;
    customerId: number;
    customerName: string;
    hasExistingReview: boolean;
};

type ApiError = { message?: string; errors?: Record<string, string[]> };
type TypingEvent = { sender_name: string; is_typing: boolean };
type ReadEvent = { reader_type: 'customer' | 'staff' };

function isValidConversationId(id: unknown): id is number {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

const emptyReview: ReviewData = {
    rating: 0,
    cleanliness: 0,
    service: 0,
    location: 0,
    value: 0,
    title: '',
    comment: '',
};

const ratingLabels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

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

function RatingStars({
    value,
    onChange,
    label,
    small = false,
}: {
    value: number;
    onChange: (rating: number) => void;
    label: string;
    small?: boolean;
}) {
    return (
        <div className="flex items-center gap-0.5" aria-label={label}>
            {Array.from({ length: 5 }, (_, index) => {
                const rating = index + 1;
                return (
                    <button
                        key={rating}
                        type="button"
                        aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                        aria-pressed={value === rating}
                        onClick={() => onChange(rating)}
                        className="rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                    >
                        <StarIcon
                            className={`${small ? 'size-4' : 'size-7'} ${
                                value >= rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300'
                            }`}
                            aria-hidden="true"
                        />
                    </button>
                );
            })}
        </div>
    );
}

export default function MessengerBubble({
    booking,
    customerId,
    customerName,
    hasExistingReview,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [conversation, setConversation] = useState<ConversationType | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingName, setTypingName] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [reviewData, setReviewData] = useState<ReviewData>(emptyReview);
    const [reviewSubmitted, setReviewSubmitted] = useState(hasExistingReview);
    const [error, setError] = useState<string | null>(null);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const isSendingRef = useRef(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const echoRef = useRef<Echo<'reverb'> | null>(null);
    const isOpenRef = useRef(isOpen);
    const activeChannelRef = useRef<number | null>(null);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const subscribeToConversation = useCallback((conversationId: number) => {
        if (!echoRef.current || activeChannelRef.current === conversationId) {
            return;
        }

        if (activeChannelRef.current !== null) {
            echoRef.current.leave(`conversation.${activeChannelRef.current}`);
        }

        activeChannelRef.current = conversationId;
        echoRef.current
            .private(`conversation.${conversationId}`)
            .listen('.message.sent', (message: MessageType) => {
                setMessages((current) => {
                    if (current.some((item) => item.id === message.id)) {
                        return current;
                    }
                    return [...current, message];
                });
                if (!isOpenRef.current) {
                    setUnreadCount((count) => count + 1);
                }
                requestAnimationFrame(scrollToBottom);
            })
            .listen('.message.read', (event: ReadEvent) => {
                if (event.reader_type === 'staff') {
                    setMessages((current) =>
                        current.map((message) =>
                            message.sender.type === 'customer'
                                ? { ...message, is_read: true }
                                : message,
                        ),
                    );
                }
            })
            .listen('.user.typing', (event: TypingEvent) => {
                setTypingName(event.sender_name);
                setIsTyping(event.is_typing);
                if (typingTimerRef.current) {
                    clearTimeout(typingTimerRef.current);
                }
                if (event.is_typing) {
                    typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
                }
            });
    }, [scrollToBottom]);

    useEffect(() => {
        const key = import.meta.env.VITE_REVERB_APP_KEY;
        if (!key) {
            setError('Real-time messaging is not configured.');
            return;
        }

        (window as typeof window & { Pusher: typeof Pusher }).Pusher = Pusher;
        echoRef.current = new Echo({
            broadcaster: 'reverb',
            key,
            wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT || 80),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
            enabledTransports: ['ws', 'wss'],
        });

        return () => {
            if (activeChannelRef.current !== null) {
                echoRef.current?.leave(`conversation.${activeChannelRef.current}`);
            }
            echoRef.current?.disconnect();
            if (typingTimerRef.current) {
                clearTimeout(typingTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (messages.length > 0 && isOpen && !showReview) {
            scrollToBottom();
        }
    }, [messages, isOpen, showReview, scrollToBottom]);

    const loadMessages = async (conversationId: number) => {
        const history = await apiRequest<MessageType[]>(
            `/api/conversations/${conversationId}/messages`,
        );
        setMessages(history);
        setUnreadCount(0);
    };

    const openChat = async () => {
        setIsOpen(true);
        setShowReview(false);
        setUnreadCount(0);
        setError(null);

        if (conversation) {
            subscribeToConversation(conversation.id);
        } else {
            setIsLoading(true);
            try {
                const existing = await apiRequest<ConversationType | null>(
                    `/api/bookings/${booking.id}/conversation`,
                );
                if (existing) {
                    if (!isValidConversationId(existing.id)) {
                        throw new Error('The conversation response did not include a valid ID.');
                    }
                    setConversation(existing);
                    await loadMessages(existing.id);
                    subscribeToConversation(existing.id);
                }
            } catch (requestError) {
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to load this conversation.',
                );
            } finally {
                setIsLoading(false);
            }
        }

        window.setTimeout(scrollToBottom, 100);
        window.setTimeout(() => inputRef.current?.focus(), 150);
    };

    const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if ((!inputText.trim() && !selectedFile) || isSendingRef.current) {
            return;
        }

        isSendingRef.current = true;
        setIsSending(true);
        setError(null);
        const body = inputText.trim();
        const file = selectedFile;
        const fileType = file
            ? file.type.startsWith('image/')
                ? 'image'
                : 'file'
            : 'text';
        const formData = new FormData();
        if (body) {
            formData.append('body', body);
        }
        if (file) {
            formData.append('file', file);
        }
        formData.append('type', fileType);
        const requestHeaders = new Headers();
        const socketId = echoRef.current?.socketId();
        if (socketId) {
            requestHeaders.set('X-Socket-ID', socketId);
        }

        try {
            if (!conversation) {
                formData.append('branch_id', String(booking.branch_id));
                formData.append('booking_id', String(booking.id));
                const result = await apiRequest<{
                    conversation: ConversationType;
                    message: MessageType;
                }>('/api/conversations', { method: 'POST', body: formData, headers: requestHeaders });
                if (!isValidConversationId(result.conversation?.id)) {
                    throw new Error('The conversation response did not include a valid ID.');
                }
                setConversation(result.conversation);
                setMessages((current) =>
                    current.some((message) => message.id === result.message.id)
                        ? current
                        : [...current, result.message],
                );
                subscribeToConversation(result.conversation.id);
            } else {
                const previewUrl = file ? URL.createObjectURL(file) : null;
                const optimistic: MessageType = {
                    id: -Date.now(),
                    conversation_id: conversation.id,
                    type: fileType,
                    body: body || null,
                    file_url: previewUrl,
                    file_name: file?.name ?? null,
                    file_size: null,
                    is_read: false,
                    created_at: new Date().toISOString(),
                    sender: {
                        id: customerId,
                        name: customerName,
                        avatar: null,
                        type: 'customer',
                    },
                };
                setMessages((current) => [...current, optimistic]);

                try {
                    const saved = await apiRequest<MessageType>(
                        `/api/conversations/${conversation.id}/messages`,
                        { method: 'POST', body: formData, headers: requestHeaders },
                    );
                    setMessages((current) =>
                        current.map((message) =>
                            message.id === optimistic.id ? saved : message,
                        ),
                    );
                } catch (requestError) {
                    setMessages((current) =>
                        current.filter((message) => message.id !== optimistic.id),
                    );
                    throw requestError;
                } finally {
                    if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                    }
                }
            }

            setInputText('');
            setSelectedFile(null);
            requestAnimationFrame(scrollToBottom);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'Unable to send the message.',
            );
        } finally {
            isSendingRef.current = false;
            setIsSending(false);
        }
    };

    const handleTyping = (value: string) => {
        setInputText(value);
        if (!conversation || !isValidConversationId(conversation.id)) {
            return;
        }

        const conversationId = conversation.id;
        void apiRequest<{ ok: boolean }>(
            `/api/conversations/${conversationId}/typing`,
            {
                method: 'POST',
                body: JSON.stringify({ is_typing: true }),
            },
        ).catch((requestError: unknown) => {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'Unable to send typing status.',
            );
        });

        if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
        }
        typingTimerRef.current = setTimeout(() => {
            void apiRequest<{ ok: boolean }>(
                `/api/conversations/${conversationId}/typing`,
                {
                    method: 'POST',
                    body: JSON.stringify({ is_typing: false }),
                },
            ).catch((requestError: unknown) => {
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to update typing status.',
                );
            });
        }, 1500);
    };

    const updateReview = (field: keyof ReviewData, value: number | string) => {
        setReviewData((current) => ({ ...current, [field]: value }));
    };

    const submitReview = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (reviewData.rating === 0 || isSubmittingReview) {
            return;
        }

        setIsSubmittingReview(true);
        setError(null);
        const review = {
            booking_id: booking.id,
            branch_id: booking.branch_id,
            rating: reviewData.rating,
            title: reviewData.title,
            comment: reviewData.comment,
            ...Object.fromEntries(
                (['cleanliness', 'service', 'location', 'value'] as const)
                    .filter((field) => reviewData[field] > 0)
                    .map((field) => [field, reviewData[field]]),
            ),
        };

        try {
            await apiRequest('/api/reviews', {
                method: 'POST',
                body: JSON.stringify(review),
            });
            setReviewSubmitted(true);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'Unable to submit your review.',
            );
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const reviewAllowed = ['checked_out', 'completed'].includes(booking.status);
    const groupedMessages = groupMessagesByDate(messages);

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
            {reviewAllowed && !hasExistingReview && (
                <button
                    type="button"
                    onClick={() => {
                        setShowReview(true);
                        setIsOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600"
                >
                    <StarIcon className="size-4 fill-current" aria-hidden="true" />
                    Leave a Review
                </button>
            )}

            {isOpen && (
                <section
                    aria-label={`Chat with ${booking.branch.name}`}
                    className="fixed bottom-20 right-4 flex max-h-[min(600px,calc(100dvh-7rem))] w-[min(370px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition duration-200 ease-out sm:right-6"
                >
                    <header className="flex items-center gap-3 bg-blue-600 px-4 py-3 text-white">
                        <div className="relative size-9 shrink-0">
                            {booking.branch.cover_image ? (
                                <img
                                    src={booking.branch.cover_image}
                                    alt=""
                                    className="size-9 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex size-9 items-center justify-center rounded-full bg-blue-400 font-semibold">
                                    {booking.branch.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-blue-600 bg-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{booking.branch.name}</p>
                            <p className="text-xs text-white/75">Typically replies in minutes</p>
                        </div>
                        {reviewAllowed && !hasExistingReview && (
                            <button
                                type="button"
                                aria-label={showReview ? 'Open chat' : 'Leave a review'}
                                onClick={() => setShowReview((value) => !value)}
                                className="rounded-full p-2 transition hover:bg-blue-500"
                            >
                                <StarIcon className="size-4" aria-hidden="true" />
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label="Close chat"
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-2 transition hover:bg-blue-500"
                        >
                            <XMarkIcon className="size-5" aria-hidden="true" />
                        </button>
                    </header>

                    {reviewAllowed && !hasExistingReview && (
                        <nav className="flex bg-blue-700 px-2 pt-2" aria-label="Chat tabs">
                            <button
                                type="button"
                                onClick={() => setShowReview(false)}
                                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                                    !showReview ? 'bg-white text-blue-700' : 'text-white/75'
                                }`}
                            >
                                💬 Chat
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowReview(true)}
                                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                                    showReview ? 'bg-white text-blue-700' : 'text-white/75'
                                }`}
                            >
                                ⭐ Review
                            </button>
                        </nav>
                    )}

                    {showReview ? (
                        <div className="flex-1 overflow-y-auto p-4">
                            {reviewSubmitted ? (
                                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                                    <span className="text-5xl" aria-hidden="true">✅</span>
                                    <h2 className="mt-3 font-semibold">Thank you for your review!</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {reviewData.rating || 'Your'} stars — Your feedback helps us improve.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowReview(false)}
                                        className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        Back to chat
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={submitReview}>
                                    <h2 className="mb-3 text-sm font-semibold">
                                        Rate your stay at {booking.branch.name}
                                    </h2>
                                    <div className="flex flex-col items-center rounded-xl bg-amber-50 p-3">
                                        <RatingStars
                                            value={reviewData.rating}
                                            onChange={(rating) => updateReview('rating', rating)}
                                            label="Overall rating"
                                        />
                                        <span className="mt-1 text-xs font-medium text-amber-800">
                                            {ratingLabels[reviewData.rating]}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        {([
                                            ['cleanliness', '🧹 Cleanliness'],
                                            ['service', '👋 Service'],
                                            ['location', '📍 Location'],
                                            ['value', '💰 Value'],
                                        ] as const).map(([field, label]) => (
                                            <div key={field}>
                                                <p className="mb-1 text-xs font-medium text-slate-600">
                                                    {label}
                                                </p>
                                                <RatingStars
                                                    small
                                                    value={reviewData[field]}
                                                    onChange={(rating) => updateReview(field, rating)}
                                                    label={label}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <input
                                        value={reviewData.title}
                                        onChange={(event) => updateReview('title', event.target.value)}
                                        placeholder="Give your review a title (optional)"
                                        maxLength={100}
                                        className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                                    />
                                    <textarea
                                        value={reviewData.comment}
                                        onChange={(event) => updateReview('comment', event.target.value)}
                                        placeholder="Tell us about your experience…"
                                        rows={4}
                                        maxLength={2000}
                                        className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                                    />
                                    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
                                    <button
                                        type="submit"
                                        disabled={reviewData.rating === 0 || isSubmittingReview}
                                        className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
                                    >
                                        {isSubmittingReview ? 'Submitting…' : 'Submit Review ⭐'}
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                                {isLoading ? (
                                    <div className="space-y-3 py-3" aria-label="Loading messages">
                                        {[0, 1, 2].map((item) => (
                                            <div
                                                key={item}
                                                className={`h-10 w-2/3 animate-pulse rounded-2xl bg-slate-200 ${
                                                    item % 2 === 0 ? '' : 'ml-auto'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-5 text-center">
                                        <div className="text-4xl" aria-hidden="true">👋</div>
                                        <p className="text-sm font-medium">Hi {customerName}!</p>
                                        <p className="text-xs text-slate-500">
                                            Send a message to the {booking.branch.name} team. We typically reply within minutes.
                                        </p>
                                    </div>
                                ) : (
                                    Object.entries(groupedMessages).map(([date, dayMessages]) => (
                                        <div key={date}>
                                            <div className="my-3 flex items-center gap-2 text-[10px] text-slate-400">
                                                <span className="h-px flex-1 bg-slate-200" />
                                                {formatMessageDate(date)}
                                                <span className="h-px flex-1 bg-slate-200" />
                                            </div>
                                            {dayMessages.map((message, index) => {
                                                const isMine = message.sender.type === 'customer';
                                                const previous = dayMessages[index - 1];
                                                const isFirstInSequence =
                                                    !previous || previous.sender.id !== message.sender.id;
                                                return (
                                                    <MessageBubble
                                                        key={message.id}
                                                        message={message}
                                                        isMine={isMine}
                                                        showSender={!isMine && isFirstInSequence}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {isTyping && (
                                <div className="flex items-center gap-2 bg-slate-50 px-4 pb-2">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map((item) => (
                                            <span
                                                key={item}
                                                className="size-2 animate-bounce rounded-full bg-slate-400"
                                                style={{ animationDelay: `${item * 0.15}s` }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {typingName} is typing…
                                    </span>
                                </div>
                            )}

                            <form onSubmit={(event) => void sendMessage(event)} className="border-t border-slate-100 bg-white px-3 py-2">
                                {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
                                {selectedFile && (
                                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs">
                                        <PaperClipIcon className="size-4 text-blue-500" aria-hidden="true" />
                                        <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
                                        <button
                                            type="button"
                                            aria-label="Remove attachment"
                                            onClick={() => setSelectedFile(null)}
                                            className="rounded p-1 text-slate-500 hover:bg-blue-100"
                                        >
                                            <XMarkIcon className="size-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <label
                                        htmlFor="messenger-file-upload"
                                        className="cursor-pointer rounded-full p-2 text-slate-400 hover:text-blue-500"
                                        aria-label="Attach a file"
                                    >
                                        <PaperClipIcon className="size-5" aria-hidden="true" />
                                        <input
                                            id="messenger-file-upload"
                                            type="file"
                                            accept="image/*,.pdf,.doc,.docx"
                                            className="hidden"
                                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                setSelectedFile(event.target.files?.[0] ?? null)
                                            }
                                        />
                                    </label>
                                    <textarea
                                        ref={inputRef}
                                        value={inputText}
                                        onChange={(event) => handleTyping(event.target.value)}
                                        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                void sendMessage();
                                            }
                                        }}
                                        placeholder="Type a message…"
                                        rows={1}
                                        maxLength={5000}
                                        className="max-h-24 min-h-10 flex-1 resize-y overflow-y-auto rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSending || (!inputText.trim() && !selectedFile)}
                                        aria-label="Send message"
                                        className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                                    >
                                        {isSending ? (
                                            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        ) : (
                                            <PaperAirplaneIcon className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            )}

            <button
                type="button"
                onClick={() => (isOpen ? setIsOpen(false) : void openChat())}
                aria-label={isOpen ? 'Close messaging' : 'Open messaging'}
                aria-expanded={isOpen}
                className="relative flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-all duration-200 hover:bg-blue-700"
            >
                {isOpen ? (
                    <XMarkIcon className="size-6" aria-hidden="true" />
                ) : (
                    <ChatBubbleLeftRightIcon className="size-6" aria-hidden="true" />
                )}
                {!isOpen && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-5 animate-bounce items-center justify-center rounded-full bg-red-500 text-xs text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}
