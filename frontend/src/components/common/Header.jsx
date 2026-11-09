export default function Header({
  title,
  user = "MS",
}) {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header
      className="
        fixed
        top-0
        left-0
        lg:left-64
        right-0
        h-16
        bg-white
        border-b
        border-gray-200
        z-30
      "
    >
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">

        {/* Desktop title */}
        <div className="hidden lg:block">
          <h1 className="text-sm font-semibold text-gray-900">
            {title}
          </h1>
        </div>

        {/* Mobile title */}
        <div className="lg:hidden pl-14">
          <h1 className="text-sm font-semibold text-gray-900">
            {title}
          </h1>
        </div>

        {/* User */}
        <div className="flex items-center gap-3">

          <span className="hidden sm:block text-xs text-gray-500">
            {formattedDate}
          </span>

          <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold">
            {user}
          </div>

        </div>

      </div>
    </header>
  );
}