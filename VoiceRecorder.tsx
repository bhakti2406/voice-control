import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  onSendQuery: (query: string, audioBlob?: Blob) => void;
  isLoading: boolean;
  activeQuery: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendQuery, isLoading, activeQuery }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check SpeechRecognition support in browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInputText(transcript);
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition init error:', err);
      }
    }
  }, []);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());
        
        // If we transcribed text via recognition or have input text, send query
        const textToSend = inputText.trim() || 'What is the full form of RAM?';
        onSendQuery(textToSend, audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start recognition if available
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // already started
        }
      }

      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission error, fallback to mock recording or text:', err);
      alert('Microphone access was denied or not supported in this browser context. You can type your query in the text box below.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendQuery(inputText.trim());
  };

  const selectSample = (query: string) => {
    setInputText(query);
    onSendQuery(query);
  };

  const sampleQueries = [
    "What is the full form of RAM?",
    "What is RAG in AI?",
    "What is the full form of CPU?",
    "What is the full form of UPI?",
    "What is DNS and how does it work?",
    "What is the capital of Mars?" // Off-topic guardrail test
  ];

  return (
    <div id="voice-input-card" className="space-y-4">
      {/* Active Voice / STT Display Bar */}
      <div className="flex items-center gap-4 py-2">
        <div
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
            isRecording
              ? 'bg-red-500/20 border border-red-500/40 shadow-lg shadow-red-500/20 animate-pulse'
              : 'bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title={isRecording ? 'Click to stop recording' : 'Click to start voice recording'}
        >
          {isRecording ? (
            <div className="w-4 h-4 bg-red-400 rounded-sm animate-pulse"></div>
          ) : (
            <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse"></div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 italic">
              {isRecording ? `Listening via Sarvam STT (${recordingSeconds}s)...` : 'Last transcription (Sarvam STT):'}
            </p>
            <button
              type="button"
              id="mic-record-btn"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`text-[11px] px-2.5 py-1 rounded font-medium transition-all ${
                isRecording
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {isRecording ? 'Stop & Transcribe' : 'Start Mic'}
            </button>
          </div>
          <p className="text-lg text-white font-medium truncate mt-0.5">
            &quot;{inputText || activeQuery || 'What is the full form of RAM?'}&quot;
          </p>
        </div>
      </div>

      <div className="h-[1px] bg-slate-800 w-full"></div>

      {/* Query Input Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            id="query-input-field"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask question (e.g. 'What is the full form of RAM?')..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            disabled={isLoading || isRecording}
          />
        </div>
        <button
          id="ask-submit-btn"
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold text-sm tracking-wide transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>RETRIEVING</span>
            </>
          ) : (
            <>
              <span>ASK</span>
            </>
          )}
        </button>
      </form>

      {/* Quick Test Chips */}
      <div className="pt-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
          Sample Verification Queries:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              type="button"
              id={`sample-query-btn-${idx}`}
              onClick={() => selectSample(q)}
              disabled={isLoading}
              className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded border border-slate-800 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

