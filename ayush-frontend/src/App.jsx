import { Routes, Route } from 'react-router-dom'
import TouchlessKiosk from './components/TouchlessKiosk'
import PatientIntake from './components/PatientIntake'
import MobileScan from './components/MobileScan'
import DoctorDashboard from './components/DoctorDashboard'

export default function App() {
  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen">
      <Routes>
        <Route path="/" element={<TouchlessKiosk />} />
        <Route path="/text-intake" element={<PatientIntake />} />
        <Route path="/mobile-scan" element={<MobileScan />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
      </Routes>
    </div>
  )
}
