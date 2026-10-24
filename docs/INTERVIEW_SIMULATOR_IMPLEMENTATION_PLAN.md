# LakshyaTrack Interview Simulator - Implementation Plan

## Overview

This plan transforms the existing text-based multi-stage interview simulator into a world-class, real-time AI interview platform with professional voice, video, and conversation capabilities.

---

## Architecture Strategy

### Core Principles
1. **Reuse Existing Infrastructure**: Leverage the existing AI service (Groq/Gemini/OpenAI), database models, and progress engine
2. **Incremental Enhancement**: Build on the current multi-stage system rather than creating parallel infrastructure
3. **Real-First Design**: Prioritize low-latency voice interaction with text as fallback
4. **Production-Ready**: All features must be tested, instrumented, and secure before release

### Technology Choices

#### Speech Recognition (STT)
- **Primary**: OpenAI Whisper API (high accuracy, streaming support)
- **Fallback**: Browser Web Speech API (already implemented)
- **Rationale**: OpenAI Whisper provides professional-grade accuracy with low latency (~1-2s for 30s audio)

#### Text-to-Speech (TTS)
- **Primary**: OpenAI TTS API (tts-1 model, HD quality)
- **Fallback**: Azure Neural TTS (if OpenAI quota exceeded)
- **Rationale**: OpenAI TTS offers natural voices, fast generation, and streaming capability

#### Real-Time Communication
- **Primary**: HTTP streaming with Server-Sent Events (SSE) for audio delivery
- **Fallback**: REST API for text-only mode
- **Rationale**: Simpler than WebRTC for this use case, sufficient for interview context

#### Frontend
- **React + TypeScript** (existing)
- **Framer Motion** (existing, for animations)
- **Tailwind CSS** (existing, for styling)
- **Lucide React** (existing, for icons)

---

## Phase-by-Phase Implementation

### Phase 2: World-Class Interview Hall UI/UX

#### 2.1 Interview Hall Layout
**File**: `frontend/src/pages/InterviewHall.tsx` (new)

Components:
- **Interviewer Avatar**: Professional AI interviewer with animated states (speaking, listening, processing)
- **Candidate Webcam Preview**: Video element with camera toggle, mirror toggle
- **Live Transcription Panel**: Real-time transcript overlay with confidence indicators
- **Question Display**: Large, readable question card with speaking animation
- **Control Bar**: Mute/unmute, camera on/off, captions toggle, pause/resume, end interview
- **Status Indicators**: Microphone level, camera status, network quality, audio device selector
- **Progress Timeline**: Visual stage progress with current question indicator
- **Timer**: Interview duration with optional time remaining

States:
- `setup`: Configuration screen (position, mode, duration, resume selection)
- `connecting`: Establishing session, checking permissions
- `ready`: Avatar idle, waiting to start
- `listening`: Avatar listening state, microphone active
- `speaking`: Avatar speaking state, audio playback
- `processing`: Avatar thinking state, AI generating response
- `evaluating`: Between stages, showing stage results
- `completed`: Final results and feedback

Theme Support:
- Respects existing `ThemeContext` (light/dark)
- Uses Tailwind `dark:` classes throughout
- No hardcoded dark mode

#### 2.2 Webcam Integration
**File**: `frontend/src/components/InterviewWebcam.tsx` (new)

Features:
- Camera permission request
- Device selection (multiple cameras)
- Mirror toggle (horizontal flip)
- Frame size selection (480p, 720p, 1080p)
- Fallback to placeholder if camera unavailable
- Privacy indicator (recording consent)

#### 2.3 Live Transcription Display
**File**: `frontend/src/components/LiveTranscription.tsx` (new)

Features:
- Real-time transcript overlay
- Speaker labels (Interviewer / Candidate)
- Confidence highlighting (color-coded)
- Auto-scroll to latest
- Collapse/expand toggle
- Export transcript option

#### 2.4 Professional Controls
**File**: `frontend/src/components/InterviewControls.tsx` (new)

Features:
- Microphone toggle with level meter
- Camera toggle with preview
- Mute interviewer toggle
- Captions toggle
- Pause/resume interview
- End interview with confirmation
- Settings menu (audio device, camera, subtitle language)

---

### Phase 3: Real-Time Natural AI Conversation

#### 3.1 Backend Speech Service
**File**: `backend/app/services/speech_service.py` (new)

STT Integration:
```python
class SpeechService:
    async def transcribe_audio(self, audio_data: bytes, language: str = "en") -> str:
        """Transcribe audio using OpenAI Whisper API."""
        
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Streaming transcription for real-time feedback."""
```

TTS Integration:
```python
    async def synthesize_speech(self, text: str, voice: str = "alloy") -> bytes:
        """Generate audio using OpenAI TTS API."""
        
    async def stream_speech(self, text: str, voice: str = "alloy") -> AsyncIterator[bytes]:
        """Streaming audio generation for low latency."""
```

Fallback to browser APIs if provider unavailable.

#### 3.2 Backend Interview Orchestration
**File**: `backend/app/services/interview_orchestration_service.py` (new)

Conversation State Management:
```python
class ConversationState:
    current_topic: str
    questions_asked: List[str]
    candidate_responses: List[str]
    context_summary: str
    sentiment: str
    difficulty_level: str
```

Streaming Response Handler:
```python
async def generate_response_stream(
    conversation_state: ConversationState,
    resume_context: Optional[Dict]
) -> AsyncIterator[str]:
    """Stream AI response token-by-token."""
```

#### 3.3 API Endpoints
**File**: `backend/app/api/endpoints/interview_realtime.py` (new)

Endpoints:
- `POST /interview-realtime/start-session`: Initialize interview with configuration
- `POST /interview-realtime/transcribe`: Submit audio for transcription
- `POST /interview-realtime/generate-question`: Get next question (streaming)
- `POST /interview-realtime/generate-audio`: Convert text to audio (streaming)
- `POST /interview-realtime/evaluate-stage`: Evaluate completed stage
- `POST /interview-realtime/end-session`: Finalize interview and generate report

#### 3.4 Frontend Audio Manager
**File**: `frontend/src/hooks/useAudioManager.ts` (new)

Features:
- Microphone access and recording
- Audio stream management
- Audio playback with interrupt support
- Volume control
- Device selection
- Latency measurement

#### 3.5 Interrupt Handling
**File**: `frontend/src/hooks/useConversationInterrupt.ts` (new)

Logic:
- Detect user speech during TTS playback
- Cancel current TTS generation
- Stop audio playback immediately
- Resume when user finishes speaking
- Priority: User speech > Interviewer speech

---

### Phase 4: Interview Intelligence

#### 4.1 Enhanced Question Generation
**File**: `backend/app/services/interview_multistage_service.py` (modify)

Enhancements:
- Context-aware follow-up questions
- Resume-specific questions (extract from actual resume data)
- Job-description-aligned questions
- Difficulty adaptation based on performance
- Topic rotation to avoid repetition

#### 4.2 Interview Configuration Screen
**File**: `frontend/src/pages/InterviewSetup.tsx` (new)

Configuration Options:
- Position/Role (text input with suggestions)
- Experience Level (entry, mid, senior, executive)
- Interview Type (resume-based, technical, behavioral, HR, mixed)
- Duration (15, 30, 45, 60 minutes)
- Resume Selection (from saved resumes)
- Job Description (paste or upload)
- Difficulty (auto, beginner, intermediate, advanced)
- Voice Mode (voice-first, text-first, hybrid)

#### 4.3 Resume Context Integration
**File**: `backend/app/services/resume_context_service.py` (new)

Features:
- Parse resume PDF/JSON
- Extract skills, experience, projects
- Generate skill summaries
- Identify gaps
- Map to interview questions

#### 4.4 Adaptive Difficulty
**File**: `backend/app/services/interview_adaptive_service.py` (new)

Logic:
- Track response quality
- Adjust question complexity
- Provide hints when stuck
- Increase challenge when performing well
- Maintain engagement curve

---

### Phase 5: Real Evaluation and Reporting

#### 5.1 Enhanced Evaluation Service
**File**: `backend/app/services/interview_evaluation_service.py` (new)

Evaluation Dimensions:
- Technical Accuracy (code correctness, knowledge depth)
- Communication Clarity (articulation, structure)
- Problem-Solving Approach (methodology, creativity)
- Cultural Fit (alignment with role expectations)
- Confidence Level (composure, presence)

Evidence Collection:
- Transcript excerpts for each strength/weakness
- Specific code analysis for technical questions
- Behavioral evidence for soft skills
- Comparison to role requirements

#### 5.2 Report Generation
**File**: `backend/app/services/interview_report_service.py` (new)

Report Structure:
```json
{
  "overall_score": 85,
  "verdict": "Strong Hire",
  "dimensions": {
    "technical": {"score": 90, "evidence": [...]},
    "communication": {"score": 80, "evidence": [...]},
    "problem_solving": {"score": 85, "evidence": [...]},
    "cultural_fit": {"score": 82, "evidence": [...]}
  },
  "strengths": [
    {"point": "Strong React knowledge", "evidence": "transcript excerpt..."}
  ],
  "weaknesses": [
    {"point": "Limited database experience", "evidence": "transcript excerpt..."}
  ],
  "recommendations": [
    {"topic": "Database design", "resources": [...], "priority": "high"}
  ],
  "transcript": "full interview transcript",
  "stage_breakdown": {...}
}
```

#### 5.3 Interview History UI
**File**: `frontend/src/pages/InterviewHistory.tsx` (new)

Features:
- List of completed interviews
- Date, position, duration, score
- View full report
- Re-download transcript
- Compare with previous interviews
- Progress tracking over time

---

### Phase 6: Resume Studio and Progress Intelligence

#### 6.1 Resume Selection Integration
**File**: `frontend/src/pages/InterviewSetup.tsx` (modify)

Features:
- Fetch saved resumes from Resume Studio
- Display resume preview
- Auto-extract skills and experience
- Use as context for questions

#### 6.2 Authoritative Progress Events
**File**: `backend/app/api/endpoints/interview_multistage.py` (modify)

Event Integration:
- Track interview start (`INTERVIEW_STARTED`)
- Track stage completion (`INTERVIEW_STAGE_COMPLETED`)
- Track interview completion (`INTERVIEW_COMPLETED`)
- Track score details in metadata
- Ensure user-scoped events

#### 6.3 Badge Verification
**File**: `backend/app/progress_engine/workers.py` (modify)

Badge Logic:
- "First Interview": Award on first completed interview
- "Interview Master": Award after 5 interviews with avg score > 80
- "Technical Ace": Award after 3 technical interviews with avg score > 85
- "Communicator": Award after interviews with communication score > 85

Duplicate Prevention:
- Check existing badge awards before awarding
- Use transaction for atomicity
- Log award decisions

#### 6.4 Statistics Updates
**File**: `backend/app/progress_engine/analytics.py` (modify)

Metrics:
- Total interviews completed
- Average interview score
- Interviews by type
- Skill-specific performance
- Progress over time

---

### Phase 7: Security, Privacy, and Reliability

#### 7.1 API Key Security
**Status**: ✅ Already implemented
- Keys in environment variables
- Never exposed to frontend
- Circuit breakers prevent abuse

#### 7.2 Audio Privacy
**File**: `frontend/src/components/InterviewConsent.tsx` (new)

Features:
- Explicit consent before microphone access
- Clear disclosure of audio processing
- Option to use text-only mode
- Delete transcript after interview (optional)
- Transcript encryption at rest

#### 7.3 Authorization
**Status**: ✅ Already implemented
- JWT authentication on all endpoints
- User-scoped database queries
- RLS policies on Supabase

#### 7.4 Rate Limiting
**File**: `backend/app/core/plan_limits.py` (modify)

Limits:
- Max interviews per week (by plan)
- Max audio duration per session
- Max STT requests per day
- Cost tracking per user

#### 7.5 Error Handling
**File**: `frontend/src/hooks/useInterviewErrorHandler.ts` (new)

Scenarios:
- Microphone permission denied
- Camera permission denied
- Network disconnection
- API timeout
- STT failure
- TTS failure
- Provider quota exceeded

Fallback:
- Graceful degradation to text mode
- Clear error messages
- Retry with exponential backoff
- Save progress locally

#### 7.6 Resource Cleanup
**File**: `frontend/src/hooks/useInterviewCleanup.ts` (new)

Cleanup Actions:
- Stop all audio streams
- Release camera
- Stop microphone
- Cancel pending requests
- Clear event listeners
- Close WebSocket connections

---

### Phase 8: Latency and Conversation Quality

#### 8.1 Latency Instrumentation
**File**: `backend/app/services/interview_metrics.py` (new)

Metrics:
- Speech-to-text latency (ms)
- Text-to-first-audio-byte latency (ms)
- AI generation latency (ms)
- End-to-end response latency (ms)
- Network latency (ms)
- Streaming chunk interval (ms)

Storage:
- Log to MongoDB (pe_events)
- Aggregate daily
- Alert on degradation (>3s average)

#### 8.2 Frontend Performance Tracking
**File**: `frontend/src/hooks/usePerformanceTracking.ts` (new)

Measurements:
- Component render time
- Audio playback delay
- Microphone activation time
- UI response time

#### 8.3 Conversation Quality Metrics
**File**: `backend/app/services/interview_quality.py` (new)

Quality Indicators:
- Turn-taking balance (interviewer vs candidate)
- Response length distribution
- Interruption frequency
- Question relevance score
- Follow-up question rate

---

### Phase 9: Testing and Production Verification

#### 9.1 Unit Tests
**Files**: Backend test files

Coverage:
- Speech service (STT/TTS mocks)
- Interview orchestration
- Evaluation service
- Report generation
- Progress event tracking

#### 9.2 Integration Tests
**Files**: Backend test files

Scenarios:
- Full interview flow with mocked providers
- Progress event emission
- Badge awarding logic
- Database persistence
- RLS policy enforcement

#### 9.3 E2E Tests
**File**: `frontend/e2e/interview.spec.ts` (new)

Scenarios:
- Start interview with configuration
- Answer question via voice
- Answer question via text
- Switch between voice/text
- Pause and resume
- Handle network disconnection
- Complete interview and view report
- Verify progress updated

#### 9.4 Performance Tests
**File**: `backend/tests/performance/test_interview_latency.py` (new)

Tests:
- STT latency under load
- TTS generation time
- AI response time
- Concurrent interview sessions

#### 9.5 Manual Verification Checklist
- [ ] Microphone works on Chrome, Firefox, Safari
- [ ] Camera works on Chrome, Firefox, Safari
- [ ] TTS voice sounds professional
- [ ] STT accuracy is >90%
- [ ] Latency <2s average
- [ ] Interrupt handling works smoothly
- [ ] Light/dark themes work
- [ ] Mobile responsive
- [ ] Badge awarded after interview
- [ ] Progress dashboard updated
- [ ] Report generated correctly
- [ ] Transcript is accurate
- [ ] No audio data leaked

---

## Environment Variables Required

Add to `backend/.env`:
```bash
# Speech Services
OPENAI_API_KEY=sk-...  # For Whisper STT and TTS
AZURE_SPEECH_KEY=...   # Optional fallback TTS
AZURE_SPEECH_REGION=...

# Latency Tracking
ENABLE_METRICS=true
METRICS_EXPORT_INTERVAL=60
```

---

## Deployment Strategy

### Staging
1. Deploy to staging environment
2. Run full test suite
3. Manual QA with test accounts
4. Load testing with 10 concurrent interviews
5. Verify badge awarding logic
6. Check latency metrics

### Production
1. Feature flag: `ENABLE_REALTIME_INTERVIEW=false`
2. Deploy to production
3. Enable for beta users (stage 2+)
4. Monitor metrics for 48 hours
5. Gradual rollout to all users
6. Monitor costs and latency

---

## Cost Estimates

### OpenAI API Costs (per interview)
- Whisper STT: $0.006 / minute × 30 min = $0.18
- TTS: $0.015 / 1K characters × 5K characters = $0.075
- GPT-4o-mini: $0.15 / 1M tokens × 10K tokens = $0.0015
- **Total per interview**: ~$0.26

### Budget per User (weekly)
- 3 interviews/week: $0.78
- 10 interviews/week: $2.60
- 50 interviews/week: $13.00

### Recommendations
- Enforce weekly limits by plan
- Cache repeated questions
- Use browser fallback for text-only mode to save costs
- Monitor usage daily

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 2: UI/UX | 5 days | None |
| Phase 3: Real-Time AI | 7 days | Phase 2 |
| Phase 4: Intelligence | 4 days | Phase 3 |
| Phase 5: Evaluation | 3 days | Phase 4 |
| Phase 6: Integration | 3 days | Phase 5 |
| Phase 7: Security | 2 days | Phase 6 |
| Phase 8: Metrics | 2 days | Phase 7 |
| Phase 9: Testing | 4 days | Phase 8 |
| **Total** | **30 days** | Sequential |

---

## Success Criteria

### Functional
- ✅ Candidate can complete full interview with voice
- ✅ Latency <2s average
- ✅ STT accuracy >90%
- ✅ TTS voice sounds professional
- ✅ Interrupt handling works smoothly
- ✅ Resume context used in questions
- ✅ Badge awarded correctly
- ✅ Progress dashboard updated

### Non-Functional
- ✅ No API keys exposed to frontend
- ✅ Audio consent obtained before recording
- ✅ Latency metrics collected
- ✅ Error handling graceful
- ✅ Mobile responsive
- ✅ Light/dark themes work
- ✅ Test coverage >80%

### User Experience
- ✅ UI feels premium and professional
- ✅ Interview feels natural (like talking to a person)
- ✅ Feedback is actionable and specific
- ✅ Report is comprehensive and evidence-based
- ✅ Setup is intuitive

---

## Remaining Blockers and Limitations

### Blockers
1. **OpenAI API Key**: Need valid key for Whisper and TTS
2. **Cost Budget**: Need approval for $0.26/interview cost
3. **Browser Compatibility**: Safari may have limited Web Speech API support

### Limitations
1. **No Offline Mode**: Requires internet for AI and speech services
2. **Single Language**: English only initially
3. **No Multi-User Support**: One interviewer per session
4. **Latency Depends on Network**: Poor connection affects experience

### Future Enhancements (Post-MVP)
1. Multi-language support (Spanish, Hindi, etc.)
2. Custom interviewer voices
3. Video interviewer (using pre-recorded footage)
4. Peer practice mode (two users interview each other)
5. Real-time code collaboration
6. Screen sharing for technical interviews
7. Integration with ATS systems
8. Company-branded interview portals

---

## Conclusion

This implementation plan transforms LakshyaTrack's interview simulator into a world-class, real-time AI interview platform. By reusing existing infrastructure and incrementally adding professional voice, premium UI, and intelligent conversation features, we can deliver a competitive product while maintaining production stability.

The estimated 30-day timeline is realistic given the solid foundation already in place. The primary risk is API cost management, which can be mitigated with plan limits and feature flags.
