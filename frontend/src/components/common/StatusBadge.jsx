export default function StatusBadge({ status }) {
  const statusStyles = {
    pending: 'bg-orange-100 text-orange-800 border border-orange-200',
    approved: 'bg-green-100 text-green-800 border border-green-200',
  }

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
  }

  const normalizedStatus = status?.toLowerCase()

  const style =
    statusStyles[normalizedStatus] ||
    'bg-gray-100 text-gray-800 border border-gray-200'

  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style}`}>
      {statusLabels[normalizedStatus] || status || 'Unknown'}
    </span>
  )
}