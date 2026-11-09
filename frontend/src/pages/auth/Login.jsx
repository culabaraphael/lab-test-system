import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Medical Technologist");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid username, password, or role.");
      }

      /*
       * Login successful
       * Store the authentication token and user information.
       */
      login(data.token, data.user);

      /*
       * Redirect based on the REAL role returned
       * by Laravel.
       */
      if (data.user.role === "Medical Technologist") {
        navigate("/medtech/dashboard");
      } else if (data.user.role === "Doctor") {
        navigate("/doctor/dashboard");
      } else if (data.user.role === "COUNTER") {
        navigate("/counter/dashboard");
      } else {
        setError("Your account does not have a valid role.");
      }
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot reach the server. Please check that the backend is running."
          : err.message || "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setIsDropdownOpen(false);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gray-900 rounded-full p-2 mr-2">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <span className="text-lg font-semibold text-gray-900">
            Lab Result System
          </span>
        </div>

        {/* Welcome */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back
          </h1>

          <p className="text-gray-600 text-sm">
            Sign in to access your dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Username
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>

              <input
                id="username"
                type="text"
                placeholder="medtech01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 focus:shadow-md transition duration-200 ease-in-out cursor-pointer hover:border-gray-400 flex items-center justify-between disabled:opacity-60"
              >
                <span className="text-gray-900">
                  {role === "COUNTER" ? "Counter / Nurse" : role}
                </span>

                <svg
                  className={`w-5 h-5 text-gray-400 transition duration-300 ${
                    isDropdownOpen ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>

              <div
                className={`absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out z-10 ${
                  isDropdownOpen
                    ? "opacity-100 max-h-48 visible"
                    : "opacity-0 max-h-0 invisible"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleRoleSelect("Medical Technologist")}
                  className={`w-full px-4 py-3 text-left transition duration-150 hover:bg-gray-100 ${
                    role === "Medical Technologist"
                      ? "bg-gray-50 font-medium text-gray-900"
                      : "text-gray-700"
                  }`}
                >
                  Medical Technologist
                </button>

                <div className="border-t border-gray-200"></div>

                <button
                  type="button"
                  onClick={() => handleRoleSelect("Doctor")}
                  className={`w-full px-4 py-3 text-left transition duration-150 hover:bg-gray-100 ${
                    role === "Doctor"
                      ? "bg-gray-50 font-medium text-gray-900"
                      : "text-gray-700"
                  }`}
                >
                  Doctor
                </button>

                <div className="border-t border-gray-200"></div>

                <button
                  type="button"
                  onClick={() => handleRoleSelect("COUNTER")}
                  className={`w-full px-4 py-3 text-left transition duration-150 hover:bg-gray-100 ${
                    role === "COUNTER"
                      ? "bg-gray-50 font-medium text-gray-900"
                      : "text-gray-700"
                  }`}
                >
                  Counter / Nurse
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Sign In */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white font-semibold py-2 rounded-lg hover:bg-gray-800 transition duration-200 flex items-center justify-center gap-2 mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign in"}

            {!isLoading && (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Contact hospital admin if you cannot access your account
        </p>
      </div>
    </div>
  );
}
