export default function FlagBadge({ flag }) {
  const flagStyles = {
    high: 'bg-red-100 text-red-800 border border-red-200',
    low: 'bg-blue-100 text-blue-800 border border-blue-200',
    normal: 'bg-green-100 text-green-800 border border-green-200',
  }

  const style = flagStyles[flag?.toLowerCase()] || 'bg-gray-100 text-gray-800'

  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded ${style}`}>
      {flag?.toUpperCase()}
    </span>
  )
}