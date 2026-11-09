import StatusBadge from '../common/StatusBadge'
import FlagBadge from '../common/FlagBadge'
import EmptyState from '../common/EmptyState'

export default function RecentLabResultsTable({ results = [] }) {
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <EmptyState
          icon="📋"
          title="No recent laboratory results"
          description="Encoded laboratory results will appear here."
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Patient
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Test Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Date Encoded
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Flags Detected
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {results.map((result, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-900">{result.patient}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{result.testType}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{result.dateEncoded}</td>
              <td className="px-6 py-4">
                <div className="flex gap-2 flex-wrap">
                  {result.flags && result.flags.length > 0 ? (
                    result.flags.map((flag, idx) => (
                      <FlagBadge key={idx} flag={flag} />
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={result.status} />
              </td>
              <td className="px-6 py-4">
                <button className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}