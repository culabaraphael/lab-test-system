export default function EmptyState({ icon = '📋', title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}