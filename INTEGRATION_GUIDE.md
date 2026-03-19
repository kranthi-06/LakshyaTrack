# LakshyaTrack Advanced Integration Guide

This document outlines how to connect the existing frontend pages to the new Advanced AI Backend logic without changing the UI design.

## 1. Plan Page (`CareerIntelligence.tsx`)
**Goal**: Integrate the AI Roadmap Engine.

### Integration Steps:
- **On Mount**: Call `GET /api/v1/roadmap/active`.
- **Roadmap Handling**:
  - If `roadmap` is null, show the existing "Target Role" input form.
  - On submission of target role, call `POST /api/v1/roadmap/generate`.
  - Save the returned `roadmap_data` to state.
- **Skill Display**:
  - Map the UI step cards to `roadmap_data.levels`.
  - For each skill:
    - Display `name` and `description`.
    - Handle `status`:
      - `locked`: Grayscale/Disabled button.
      - `unlocked`: Purple gradient button.
      - `completed`: Green checkmark icon.
- **Learning Resources**:
  - Clicking "Learn" on a skill should call `POST /api/v1/learning-content/resources`.
  - Display the returned YouTube links in the existing resource modal.
- **Quiz Progression**:
  - "Take Quiz" button should navigate to `/quiz?skill_id=...&skill_name=...&level=...`.

---

## 2. Quiz Page (`Quiz.tsx`)
**Goal**: Integrate the Gating System.

### Integration Steps:
- **Route Parameters**: Extract `skill_id`, `skill_name`, and `level` from URL.
- **Initialization**:
  - If parameters exist, call `POST /api/v1/quiz-gating/generate-skill-quiz`.
  - Otherwise, fallback to the existing generic quiz generation.
- **Submission**:
  - On complete, call `POST /api/v1/quiz-gating/submit`.
  - Handle the response:
    - `passed: true`: Show "Skill Mastered!" and "Roadmap Progressed."
    - `passed: false`: Show score and "Threshold: 70/80/85% required to pass."

---

## 3. Interview Page (`Interview.tsx`)
**Goal**: Integrate Advanced Mock Interview Flow.

### Integration Steps:
- **Unlock Logic**:
  - Call `POST /api/v1/interview-advanced/check-unlock` for current roadmap levels.
  - Disable "Start Interview" if the response is `unlocked: false`.
- **Questioning**:
  - Replace the generic generator with `POST /api/v1/interview-advanced/next-question-advanced`.
  - Pass the `resume_summary` (stored in AuthContext or fetched from `/resume/analysis`) for personalized questions.
- **Final Feedback**:
  - Call `POST /api/v1/interview-advanced/finish-advanced`.
  - Use the detailed JSON (technical_score, communication_score, confidence_score) to populate the summary cards.

---

## 4. Jobs Page (`Jobs.tsx`)
**Goal**: Integrate Opportunity Intelligence.

### Integration Steps:
- **Discovery**: 
  - Call `POST /api/v1/opportunities/matched` using the user's current roadmap skills.
  - Display courses, internships, and jobs with their respective "Match Score."
- **Redirects**:
  - The `url` field from the API should be used for the "Apply" or "View" buttons.

---

## 5. Progress Page (`Progress.tsx`)
**Goal**: Dynamic Metrics Tracking.

### Integration Steps:
- **Metrics**: 
  - Call `GET /api/v1/progress/current` to get the "Career Readiness Score."
  - Bind this to the main circular gauge.
- **History/Charts**:
  - Call `GET /api/v1/progress/history`.
  - Pass the `snapshots` array to the LineChart components for "Overall Growth."

---

## Backend Endpoint Summary (New)
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/v1/roadmap/generate` | POST | Creates personalized 3-level roadmap |
| `/api/v1/roadmap/active` | GET | Retrieves current progression |
| `/api/v1/quiz-gating/submit` | POST | Grades quiz and unlocks next roadmap step |
| `/api/v1/learning-content/resources` | POST | Gets cached YouTube tutorials |
| `/api/v1/interview-advanced/finish` | POST | Provides Technical/Communication analysis |
| `/api/v1/opportunities/matched` | POST | Lists skills-matched jobs & courses |
| `/api/v1/progress/history` | GET | Historical growth data for charts |
