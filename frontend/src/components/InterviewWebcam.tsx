import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ChevronDown } from 'lucide-react';

interface InterviewWebcamProps {
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    compact?: boolean;
}

export default function InterviewWebcam({ enabled, onEnabledChange, compact = false }: InterviewWebcamProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [deviceId, setDeviceId] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!navigator.mediaDevices) return;
        void navigator.mediaDevices.enumerateDevices().then((all) => {
            const cameras = all.filter((device) => device.kind === 'videoinput');
            setDevices(cameras);
            setDeviceId((current) => current || cameras[0]?.deviceId || '');
        });
    }, []);

    useEffect(() => {
        const stop = () => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
        };
        if (!enabled) {
            stop();
            return stop;
        }
        const start = async () => {
            try {
                setError('');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : true,
                    audio: false,
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                setError('Camera unavailable. You can continue without video.');
                onEnabledChange(false);
            }
        };
        void start();
        return stop;
    }, [deviceId, enabled, onEnabledChange]);

    return (
        <div className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-900 ${compact ? 'w-full' : 'w-64'}`}>
            <div className="relative aspect-video bg-[radial-gradient(circle_at_50%_0%,#243b68,transparent_55%)]">
                {enabled ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" /> : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                        <CameraOff className="h-7 w-7" />
                        <span className="text-xs font-medium">Camera is off</span>
                    </div>
                )}
                {enabled && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />You</span>}
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 bg-slate-950/80 p-2">
                <button type="button" onClick={() => onEnabledChange(!enabled)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-pressed={enabled}>
                    <Camera className="h-3.5 w-3.5" /> {enabled ? 'Camera on' : 'Turn on'}
                </button>
                {devices.length > 1 && <label className="ml-auto flex min-w-0 items-center text-slate-400"><span className="sr-only">Select camera</span><select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="max-w-28 appearance-none bg-transparent pr-1 text-[10px] outline-none"><option value="">Camera</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select><ChevronDown className="h-3 w-3" /></label>}
            </div>
            {error && <p className="border-t border-amber-400/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">{error}</p>}
        </div>
    );
}
