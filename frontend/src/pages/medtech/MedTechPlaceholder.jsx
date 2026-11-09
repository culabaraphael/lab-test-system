import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

export default function MedTechPlaceholder({
  title,
  subtitle,
  icon,
  children,
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="ml-64 w-full">

        {/* Header */}
        <Header title={title} user="MS" />

        {/* Page Content */}
        <main className="pt-20 px-8 pb-10">

          {/* Page Introduction */}
          <div className="mb-8">
            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">
                {icon}
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {title}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {subtitle}
                </p>
              </div>

            </div>
          </div>

          {/* Page Content */}
          {children || (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">

              <div className="flex flex-col items-center justify-center text-center py-24 px-6">

                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl mb-6">
                  {icon}
                </div>

                <h3 className="text-xl font-semibold text-gray-900">
                  This section is under development
                </h3>

                <p className="text-sm text-gray-500 max-w-md mt-3">
                  This page is currently being prepared for the MedTech
                  workflow. Real data and backend functionality will be
                  connected later.
                </p>

                <div className="mt-6 px-4 py-2 rounded-lg bg-gray-100 text-xs font-medium text-gray-500">
                  FRONTEND PREVIEW
                </div>

              </div>

            </div>
          )}

        </main>

      </div>
    </div>
  );
}