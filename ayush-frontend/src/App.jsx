import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import AuthPortal from './components/AuthPortal'
import PatientIntake from './components/PatientIntake'
import DoctorDashboard from './components/DoctorDashboard'
import MobileScan from './components/MobileScan'

export default function App() {
  return (
    <Routes>
      <Route path="/mobile-scan" element={<MobileScan />} />
      <Route path="*" element={<KioskApp />} />
    </Routes>
  )
}

function KioskApp() {
  const [currentView, setCurrentView] = useState('auth')
  const [userRole, setUserRole] = useState(null) // 'patient' | 'doctor' | null
  const [triageData, setTriageData] = useState(null)

  const handleNavigate = (view) => {
    if (view === 'patient') setUserRole('patient')
    // Navigating to doctor from patient context keeps patient role but shows dashboard (staff demo)
    else if (view === 'doctor' && userRole !== 'patient') setUserRole('doctor')
    setCurrentView(view)
  }

  const handleSignOut = () => {
    setUserRole(null)
    setCurrentView('auth')
    setTriageData(null)
  }

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col">

      {/* App Header — shown when logged in */}
      {userRole && (
        <header className="sticky top-0 z-[100] bg-surface-container-lowest/95 backdrop-blur-sm border-b border-surface-container-high shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">spa</span>
              </div>
              <span className="font-title-md text-title-md text-on-surface font-semibold tracking-tight">AYUSH CareBridge</span>
            </div>

            {/* Role Badge + Nav */}
            <div className="flex items-center gap-3">
              {userRole === 'doctor' && currentView !== 'doctor' && (
                <button
                  onClick={() => setCurrentView('doctor')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">stethoscope</span>
                  <span className="hidden sm:block">Dashboard</span>
                </button>
              )}
              {userRole === 'patient' && currentView !== 'patient' && (
                <button
                  onClick={() => setCurrentView('patient')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  <span className="hidden sm:block">Intake</span>
                </button>
              )}

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm shadow-sm ${
                userRole === 'doctor'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-tertiary-container/30 text-on-tertiary-container'
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {userRole === 'doctor' ? 'stethoscope' : 'person'}
                </span>
                {userRole === 'doctor' ? 'Doctor' : 'Patient'}
              </span>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors"
                title="Sign out"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span className="hidden sm:block">Sign Out</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* View Content */}
      <main className="flex-1">
        {currentView === 'auth' && (
          <AuthPortal onNavigate={handleNavigate} />
        )}

        {currentView === 'patient' && userRole === 'patient' && (
          <PatientIntake
            onNavigate={handleNavigate}
            onTriage={(data) => setTriageData(data)}
          />
        )}

        {/* Allow doctor role OR patient in staff-demo mode to see doctor dashboard */}
        {currentView === 'doctor' && (userRole === 'doctor' || userRole === 'patient') && (
          <DoctorDashboard
            latestPatient={triageData}
            onNavigate={handleNavigate}
          />
        )}

        {/* Guard: unauthenticated user accessing a protected view */}
        {((currentView === 'patient' && userRole !== 'patient') ||
          (currentView === 'doctor' && !userRole)) && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant">lock</span>
            <p className="font-headline-sm text-headline-sm text-on-surface">Access Denied</p>
            <p className="font-body-md text-body-md text-on-surface-variant">You do not have permission to view this page.</p>
            <button
              onClick={() => setCurrentView('auth')}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
