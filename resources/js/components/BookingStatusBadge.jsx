const statuses = {
    pending: {
        className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        emoji: '⏳',
        label: 'Pending',
    },
    confirmed: {
        className: 'bg-green-100 text-green-700 border-green-300',
        emoji: '✅',
        label: 'Confirmed',
    },
    checked_in: {
        className: 'bg-blue-100 text-blue-700 border-blue-300',
        emoji: '🏨',
        label: 'Checked In',
    },
    checked_out: {
        className: 'bg-gray-100 text-gray-600 border-gray-300',
        emoji: '🚪',
        label: 'Checked Out',
    },
    cancelled: {
        className: 'bg-red-100 text-red-700 border-red-300',
        emoji: '❌',
        label: 'Cancelled',
    },
    no_show: {
        className: 'bg-rose-100 text-rose-800 border-rose-300',
        emoji: '🚫',
        label: 'No Show',
    },
};

/**
 * @param {{ status: string }} props
 */
export default function BookingStatusBadge({ status }) {
    const badge = statuses[status] ?? {
        className: 'bg-gray-100 text-gray-600 border-gray-300',
        emoji: '',
        label: status.replaceAll('_', ' '),
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
        >
            {badge.emoji && <span aria-hidden="true">{badge.emoji}</span>}
            {badge.label}
        </span>
    );
}
