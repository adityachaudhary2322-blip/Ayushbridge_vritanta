# AYUSH AI Triage Prototype (12-Hour Hackathon Build)

## Stack & Architecture
- Frontend: React + Vite (Port 5173), Tailwind CSS, Chrome Web Speech API (STT/TTS).
- Backend: Node.js / Express (Port 5000), cors, dotenv.
- AI Engine: Google Gemini Flash (`gemini-2.5-flash` via `@google/genai` or direct REST fetch).
- Telehealth: Zoom Server-to-Server OAuth.
- Storage: In-memory array (`globalPatients = []`) for demo session.

## Clinical Scope
- Adaptive intake probing in Hindi/English.
- Triage tiers: P1 (Surgical Emergency), P2 (Urgent), P3 (Standard), P4 (Routine).
- Flag acute surgical red flags (appendicitis, acute abdomen) and genetic disease suspicion.

## Execution Rules
- Minimal, clean JavaScript/React code.
- Build lightweight, resilient endpoints with mock fallbacks for live demo stability.
