import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPortal from './components/LandingPortal'
import TouchlessKiosk from './components/TouchlessKiosk'
import TeleConsultRoom from './components/TeleConsultRoom'
import PatientIntake from './components/PatientIntake'
import MobileScan from './components/MobileScan'
import DoctorDashboard from './components/DoctorDashboard'

// Beta sign-language lane — lazy so its MediaPipe bundle never loads for the stable kiosk flows.
const SignBridgeKiosk = lazy(() => import('./pages/SignBridgeKiosk'))

export default function App() {
  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPortal />} />
        <Route path="/kiosk" element={<TouchlessKiosk />} />
        <Route path="/teleconsult" element={<TeleConsultRoom />} />
        <Route path="/text-intake" element={<PatientIntake />} />
        <Route path="/mobile-scan" element={<MobileScan />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route
          path="/sign-bridge"
          element={
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-body-md text-body-md text-on-surface-variant">Loading SignBridge…</div>}>
              <SignBridgeKiosk />
            </Suspense>
          }
        />
      </Routes>
    </div>
  )
}
