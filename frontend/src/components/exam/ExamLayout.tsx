import React, { useState } from 'react';
import { Shield, Clock, Maximize, ChevronUp, ChevronDown } from 'lucide-react';
import logo from '../../assets/logo.png';

interface ExamLayoutProps {
  children: React.ReactNode;
  examTitle: string;
  topic: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  isExamActive: boolean;
  isFullscreen: boolean;
  onSubmitExam: () => void;
  answeredQuestions: Set<number>;
  markedForReview: Set<number>;
  onQuestionSelect: (index: number) => void;
}

const ExamLayout: React.FC<ExamLayoutProps> = ({
  children,
  examTitle,
  topic,
  currentQuestion,
  totalQuestions,
  timeRemaining,
  isExamActive,
  isFullscreen,
  onSubmitExam,
  answeredQuestions,
  markedForReview,
  onQuestionSelect,
}) => {
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isWarningTime = timeRemaining < 60;
  const isCriticalTime = timeRemaining < 10;

  const getQuestionStatusClasses = (index: number) => {
    const isCurrent = index === currentQuestion;
    const isAnswered = answeredQuestions.has(index);
    const isMarked = markedForReview.has(index);

    let classes = "w-10 h-10 rounded-lg flex items-center justify-center font-medium transition-all duration-200 border cursor-pointer ";

    if (isCurrent) {
      classes += "bg-[#5c52d2] text-white border-[#5c52d2] ring-2 ring-[#5c52d2]/30 ";
    } else if (isAnswered && isMarked) {
      classes += "bg-emerald-500/20 text-emerald-400 border-amber-500 ring-1 ring-amber-400/40 hover:bg-emerald-500/30 ";
    } else if (isAnswered) {
      classes += "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 ";
    } else if (isMarked) {
      classes += "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30 ";
    } else {
      classes += "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300 ";
    }
    
    return classes;
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a14] overflow-hidden text-slate-200">
      {/* Header */}
      <header className="h-14 bg-[#0f0f1a] border-b border-slate-800/60 flex items-center justify-between px-4 lg:px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="LakshyaTrack" className="h-6 object-contain" />
            <span className="font-bold text-white hidden sm:block">LakshyaTrack</span>
          </div>
          <div className="h-4 w-px bg-slate-700 mx-2 hidden sm:block"></div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-xs sm:text-sm">
            <span className="text-slate-300 font-medium truncate max-w-[120px] sm:max-w-xs">{examTitle}</span>
            <span className="text-slate-500 hidden sm:block">•</span>
            <span className="text-slate-400 truncate max-w-[100px] sm:max-w-[200px]">{topic}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 font-medium bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700/50">
          <span className="text-slate-400">Question</span>
          <span className="text-white">{currentQuestion + 1}</span>
          <span className="text-slate-500">of</span>
          <span className="text-slate-400">{totalQuestions}</span>
        </div>

        <div className="flex items-center gap-3 lg:gap-5">
          <div className={`flex items-center gap-2 font-mono text-sm lg:text-base font-bold px-3 py-1.5 rounded-md ${
            isWarningTime ? 'text-red-500 bg-red-500/10' : 'text-slate-200 bg-slate-800/50'
          } ${isCriticalTime ? 'animate-pulse' : ''}`}>
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure Mode</span>
          </div>
          {isFullscreen && (
            <div className="hidden lg:flex items-center justify-center text-slate-400" title="Fullscreen Active">
              <Maximize className="w-4 h-4" />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Side: Question Area */}
        <main className="flex-1 overflow-y-auto w-full lg:w-[72%] bg-[#0a0a14]">
          <div className="h-full flex flex-col p-4 lg:p-8 max-w-4xl mx-auto">
            {/* Mobile progress indicator */}
            <div className="md:hidden flex items-center justify-between mb-4 text-sm font-medium">
              <span className="text-slate-400">Question {currentQuestion + 1} of {totalQuestions}</span>
            </div>
            
            {/* Question content and navigation buttons */}
            {children}
          </div>
        </main>

        {/* Right Side: Question Palette (Desktop) */}
        <aside className="hidden lg:flex flex-col w-[28%] min-w-[300px] max-w-[400px] border-l border-slate-800/60 bg-[#0f0f1a]">
          <div className="p-4 border-b border-slate-800/60 font-semibold text-slate-200 flex items-center justify-between">
            <span>Question Palette</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {Array.from({ length: totalQuestions }).map((_, i) => {
                return (
                  <button
                    key={i}
                    onClick={() => onQuestionSelect(i)}
                    className={getQuestionStatusClasses(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-800/60 bg-[#0f0f1a] shrink-0">
            <div className="space-y-2 mb-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#5c52d2] border border-[#5c52d2]"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40"></div>
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500/20 border border-amber-500"></div>
                <span>Answered & Marked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-800/50 border border-slate-700"></div>
                <span>Not Visited / Unanswered</span>
              </div>
            </div>
            
            <button
              onClick={onSubmitExam}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Submit Exam
            </button>
          </div>
        </aside>

        {/* Mobile Question Palette Drawer */}
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0f0f1a] border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out ${isMobilePaletteOpen ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'}`}>
          <button 
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            className="w-full h-[60px] flex items-center justify-between px-6 border-b border-slate-800/60"
          >
            <span className="font-semibold text-slate-200">Question Palette</span>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-sm">{answeredQuestions.size}/{totalQuestions} Answered</span>
              {isMobilePaletteOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </div>
          </button>
          
          <div className="h-[50vh] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {Array.from({ length: totalQuestions }).map((_, i) => {
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        onQuestionSelect(i);
                        setIsMobilePaletteOpen(false);
                      }}
                      className={getQuestionStatusClasses(i)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-800/60 shrink-0 bg-[#0c0c16]">
              <button
                onClick={onSubmitExam}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamLayout;
