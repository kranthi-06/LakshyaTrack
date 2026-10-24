import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechState = 'idle' | 'speaking' | 'paused';

interface SpeakOptions {
    onEnd?: () => void;
    onError?: () => void;
}

/**
 * Browser-only audio utilities. No microphone recording is persisted or sent
 * anywhere; speech recognition is handled separately by the Web Speech API.
 */
export function useAudioManager() {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('');
    const [speechState, setSpeechState] = useState<SpeechState>('idle');
    const [micLevel, setMicLevel] = useState(0);
    const meterStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const frameRef = useRef<number | null>(null);

    const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const mediaSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

    useEffect(() => {
        if (!speechSupported) return;
        const loadVoices = () => {
            const english = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'));
            setVoices(english);
            setSelectedVoice((current) => current || english[0]?.name || '');
        };
        loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }, [speechSupported]);

    const stopMeter = useCallback(() => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        meterStreamRef.current?.getTracks().forEach((track) => track.stop());
        meterStreamRef.current = null;
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        setMicLevel(0);
    }, []);

    const testMicrophone = useCallback(async () => {
        if (!mediaSupported) throw new Error('Microphone access is not available in this browser.');
        stopMeter();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        meterStreamRef.current = stream;
        const context = new AudioContext();
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const readLevel = () => {
            analyser.getByteFrequencyData(samples);
            const average = samples.reduce((total, value) => total + value, 0) / samples.length;
            setMicLevel(Math.min(1, average / 95));
            frameRef.current = requestAnimationFrame(readLevel);
        };
        readLevel();
    }, [mediaSupported, stopMeter]);

    const stopSpeech = useCallback(() => {
        if (speechSupported) window.speechSynthesis.cancel();
        setSpeechState('idle');
    }, [speechSupported]);

    const speak = useCallback((text: string, options: SpeakOptions = {}) => {
        if (!speechSupported || !text.trim()) return false;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        const voice = voices.find((candidate) => candidate.name === selectedVoice);
        if (voice) utterance.voice = voice;
        utterance.onstart = () => setSpeechState('speaking');
        utterance.onend = () => {
            setSpeechState('idle');
            options.onEnd?.();
        };
        utterance.onerror = () => {
            setSpeechState('idle');
            options.onError?.();
        };
        window.speechSynthesis.speak(utterance);
        return true;
    }, [selectedVoice, speechSupported, voices]);

    const toggleSpeechPause = useCallback(() => {
        if (!speechSupported) return;
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setSpeechState('speaking');
        } else if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            setSpeechState('paused');
        }
    }, [speechSupported]);

    useEffect(() => () => {
        stopSpeech();
        stopMeter();
    }, [stopMeter, stopSpeech]);

    return {
        mediaSupported,
        micLevel,
        selectedVoice,
        setSelectedVoice,
        speechState,
        speechSupported,
        speak,
        stopMeter,
        stopSpeech,
        testMicrophone,
        toggleSpeechPause,
        voices,
    };
}
