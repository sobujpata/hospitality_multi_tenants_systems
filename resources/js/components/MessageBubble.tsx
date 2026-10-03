import {
    CheckIcon,
    PaperClipIcon,
} from '@heroicons/react/24/outline';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

export type MessageBubbleData = {
    id: number;
    conversation_id: number;
    type: 'text' | 'image' | 'file';
    body: string | null;
    file_url: string | null;
    file_name: string | null;
    file_size: string | null;
    is_read: boolean;
    created_at: string;
    sender: {
        id: number;
        name: string;
        avatar: string | null;
        type: 'customer' | 'staff';
    };
};

export function formatMessageTime(dateString: string): string {
    const date = parseISO(dateString);
    if (isToday(date)) {
        return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
        return `Yesterday ${format(date, 'HH:mm')}`;
    }
    return format(date, 'dd MMM · HH:mm');
}

export function formatMessageDate(dateString: string): string {
    const date = parseISO(dateString);
    if (isToday(date)) {
        return 'Today';
    }
    if (isYesterday(date)) {
        return 'Yesterday';
    }
    return format(date, 'dd MMM yyyy');
}

export default function MessageBubble({
    message,
    isMine,
    showSender,
    variant = 'default',
}: {
    message: MessageBubbleData;
    isMine: boolean;
    showSender: boolean;
    variant?: 'default' | 'whatsapp' | 'pink';
}) {
    const mineBubbleClass = variant === 'whatsapp'
        ? 'rounded-br-sm bg-[#d9fdd3] text-slate-800'
        : variant === 'pink'
            ? 'rounded-br-sm bg-pink-500 text-white'
        : 'rounded-br-sm bg-blue-600 text-white';

    return (
        <div className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && (
                <div className="mr-2 flex w-7 shrink-0 items-end">
                    {showSender && (
                        message.sender.avatar ? (
                            <img
                                src={message.sender.avatar}
                                alt=""
                                className="size-7 rounded-full object-cover"
                            />
                        ) : (
                            <span className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                                {message.sender.name.charAt(0).toUpperCase()}
                            </span>
                        )
                    )}
                </div>
            )}
            <div className="flex max-w-[75%] flex-col gap-0.5">
                {!isMine && showSender && (
                    <span className="ml-1 text-xs text-slate-500">
                        {message.sender.name}
                    </span>
                )}
                {message.body !== null && (
                    <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isMine
                            ? mineBubbleClass
                            : 'rounded-bl-sm border border-slate-100 bg-white text-slate-800 shadow-sm'
                    }`}>
                        {message.body}
                    </div>
                )}
                {message.type === 'image' && message.file_url && (
                    <a
                        href={message.file_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open image ${message.file_name ?? ''}`}
                    >
                        <img
                            src={message.file_url}
                            alt={message.file_name ?? 'Message attachment'}
                            className="max-h-48 cursor-pointer rounded-2xl object-cover hover:opacity-90"
                        />
                    </a>
                )}
                {message.type === 'file' && message.file_url && (
                    <a
                        href={message.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                    >
                        <PaperClipIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">
                                {message.file_name}
                            </span>
                            <span className="text-xs text-slate-400">{message.file_size}</span>
                        </span>
                    </a>
                )}
                {(message.type === 'image' || message.type === 'file') && !message.file_url && message.body === null && (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                        Attachment unavailable
                    </div>
                )}
                <div className={`flex items-center gap-1 text-[10px] text-slate-400 ${
                    isMine ? 'justify-end' : 'justify-start'
                }`}>
                    {formatMessageTime(message.created_at)}
                    {isMine && (
                        <span aria-label={message.is_read ? 'Read' : 'Sent'}>
                            <CheckIcon className={`size-3 ${
                                message.is_read ? 'text-blue-500' : 'text-slate-300'
                            }`} aria-hidden="true" />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function groupMessagesByDate<T extends { created_at: string }>(
    messages: T[],
): Record<string, T[]> {
    return messages.reduce<Record<string, T[]>>((groups, message) => {
        const date = format(parseISO(message.created_at), 'yyyy-MM-dd');
        (groups[date] ??= []).push(message);
        return groups;
    }, {});
}
