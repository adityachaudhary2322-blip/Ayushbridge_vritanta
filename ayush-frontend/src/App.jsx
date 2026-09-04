import { Routes, Route } from 'react-router-dom'
import LandingPortal from './components/LandingPortal'
import TouchlessKiosk from './components/TouchlessKiosk'
import TeleConsultRoom from './components/TeleConsultRoom'
import PatientIntake from './components/PatientIntake'
import MobileScan from './components/MobileScan'
import DoctorDashboard from './components/DoctorDashboard'

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
      </Routes>
    </div>
  )
}
