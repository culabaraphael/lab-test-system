import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/auth/Login";

// ==========================================
// MEDTECH import MedTechDashboard from "./pages/medtech/MedTechDashboard";
// ==========================================
import MedTechDashboard from "./pages/medtech/MedtechDashboard";
import Patients from "./pages/medtech/Patients";
import EncodeResults from "./pages/medtech/EncodeResults";
import ViewResults from "./pages/medtech/ViewResults";
import Analytics from "./pages/medtech/Analytics";
import History from "./pages/medtech/History";

// ==========================================
// DOCTOR
// ==========================================
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import PendingReview from "./pages/doctor/PendingReview";
import DoctorHistory from "./pages/doctor/DoctorHistory";
import DoctorAnalytics from "./pages/doctor/DoctorAnalytics";

// ==========================================
// PATIENT
// ==========================================
import PatientDashboard from "./pages/patient/PatientDashboard";

// ==========================================
// COUNTER
// ==========================================

import CounterDashboard from "./pages/counter/CounterDashboard";

const MEDTECH_ROLE = "Medical Technologist";
const DOCTOR_ROLE = "Doctor";
const COUNTER_ROLE = "COUNTER";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ================================== */}
          {/* LOGIN */}
          {/* ================================== */}
          <Route path="/login" element={<Login />} />

          {/* ================================== */}
          {/* MEDTECH ROUTES */}
          {/* ================================== */}

          <Route
            path="/medtech/dashboard"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <MedTechDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medtech/patients"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <Patients />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medtech/encode"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <EncodeResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medtech/results"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <ViewResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medtech/analytics"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <Analytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medtech/history"
            element={
              <ProtectedRoute allowedRoles={[MEDTECH_ROLE]}>
                <History />
              </ProtectedRoute>
            }
          />

          {/* ================================== */}
          {/* DOCTOR ROUTES */}
          {/* ================================== */}

          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute allowedRoles={[DOCTOR_ROLE]}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/pending"
            element={
              <ProtectedRoute allowedRoles={[DOCTOR_ROLE]}>
                <PendingReview />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/history"
            element={
              <ProtectedRoute allowedRoles={[DOCTOR_ROLE]}>
                <DoctorHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/analytics"
            element={
              <ProtectedRoute allowedRoles={[DOCTOR_ROLE]}>
                <DoctorAnalytics />
              </ProtectedRoute>
            }
          />

          {/* ================================== */}
          {/* PATIENT ROUTES */}
          {/* ================================== */}

          {/*
           * Intentionally NOT behind ProtectedRoute / login: Patient
           * identity is verified by the QR token itself (see
           * PatientDashboard.jsx and LabResultController::showByToken),
           * not by a login session. The token is a random, 15-minute
           * -expiring credential shown to the patient by Counter/Nurse
           * after Doctor approval -- there is deliberately no patient
           * account to log into.
           */}
          <Route
            path="/patient/dashboard"
            element={<PatientDashboard />}
          />

          {/* ================================== */}
          {/* COUNTER ROUTES */}
          {/* ================================== */}

          <Route
            path="/counter/dashboard"
            element={
              <ProtectedRoute allowedRoles={[COUNTER_ROLE]}>
                <CounterDashboard />
              </ProtectedRoute>
            }
          />

          {/* ================================== */}
          {/* ROOT */}
          {/* ================================== */}

          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ================================== */}
          {/* UNKNOWN URL */}
          {/* ================================== */}

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
