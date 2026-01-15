import React, { useState, useEffect, useRef } from 'react';
import './RecordingSession.css';

interface RecordingSessionProps {
  childName: string;
  onStop: () => void;
}

interface TranscriptMessage {
  id: number;
  speaker: 'parent' | 'child' | 'staff';
  name: string;
  text: string;
  timestamp: string;
}

const RecordingSession: React.FC<RecordingSessionProps> = ({ childName, onStop }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Mock transcript data
  const mockTranscript: TranscriptMessage[] = [
    { id: 1, speaker: 'staff', name: '山田太郎', text: 'それでは、本日のヒアリングを始めさせていただきます。', timestamp: '00:02' },
    { id: 2, speaker: 'parent', name: '田中母', text: 'よろしくお願いします。', timestamp: '00:05' },
    { id: 3, speaker: 'staff', name: '山田太郎', text: `${childName}くんの最近の様子はいかがですか？`, timestamp: '00:08' },
    { id: 4, speaker: 'parent', name: '田中母', text: '家では元気にしています。ただ、朝の準備に時間がかかることが多くて...', timestamp: '00:12' },
    { id: 5, speaker: 'child', name: childName, text: 'ぼく、がんばってるよ！', timestamp: '00:18' },
    { id: 6, speaker: 'parent', name: '田中母', text: 'そうね、頑張ってるよね。でも、もう少し早くできるといいなって思うの。', timestamp: '00:22' },
    { id: 7, speaker: 'staff', name: '山田太郎', text: '朝の準備で特に時間がかかるのはどんなことですか？', timestamp: '00:28' },
    { id: 8, speaker: 'parent', name: '田中母', text: '着替えと、朝ごはんですね。特に着替えは、自分でやりたがるんですけど...', timestamp: '00:35' },
    { id: 9, speaker: 'staff', name: '山田太郎', text: '自分でやりたいという気持ちは大切ですね。施設でも同じような様子が見られます。', timestamp: '00:42' },
    { id: 10, speaker: 'child', name: childName, text: 'じぶんで、できるもん！', timestamp: '00:48' }
  ];

  useEffect(() => {
    // Start actual recording
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await uploadAudio(blob);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting recording:', error);
        alert('録音の開始に失敗しました');
        onStop();
      }
    };

    startRecording();

    // Start timer
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Simulate transcript updates (mock)
    const transcriptTimer = setInterval(() => {
      setTranscript(prev => {
        const nextIndex = prev.length;
        if (nextIndex < mockTranscript.length) {
          return [...prev, mockTranscript[nextIndex]];
        }
        return prev;
      });
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(transcriptTimer);
      // Stop recording on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    formData.append('facility_id', '00000000-0000-0000-0000-000000000001');
    formData.append('child_id', '00000000-0000-0000-0000-000000000002');

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8052';
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'X-API-Token': 'watchme-b2b-poc-2025'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      alert(`録音が保存されました！\nセッションID: ${data.session_id}`);
      onStop();
    } catch (error) {
      console.error('Upload error:', error);
      alert('アップロードに失敗しました');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handlePauseResume = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'parent': return '#4FC3F7';
      case 'child': return '#81C784';
      case 'staff': return '#BA68C8';
      default: return '#999';
    }
  };

  return (
    <div className="recording-session-overlay">
      <div className="recording-session-container">
        {/* Header */}
        <div className="session-header">
          <div className="session-info">
            <h2 className="session-title">保護者ヒアリング録音中</h2>
            <div className="session-meta">
              <span className="child-name">{childName}</span>
              <span className="separator">•</span>
              <span className="recording-duration">{formatTime(recordingTime)}</span>
            </div>
          </div>
          <button className="end-button" onClick={handleStopRecording}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
            録音を終了
          </button>
        </div>

        {/* Main Content */}
        <div className="session-content">
          {/* Left: Video/Avatar Area */}
          <div className="session-main">
            <div className="participants-grid">
              <div className="participant-card main">
                <div className="participant-avatar">
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <circle cx="30" cy="20" r="10" fill="currentColor" opacity="0.5"/>
                    <path d="M10 50C10 40 19 32 30 32C41 32 50 40 50 50" fill="currentColor" opacity="0.5"/>
                  </svg>
                </div>
                <div className="participant-info">
                  <span className="participant-name">田中母（保護者）</span>
                  <div className="audio-wave">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="wave-bar"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="participant-card">
                <div className="participant-avatar small">
                  {childName.charAt(0)}
                </div>
                <span className="participant-name">{childName}</span>
              </div>

              <div className="participant-card">
                <div className="participant-avatar small">
                  山
                </div>
                <span className="participant-name">山田太郎</span>
              </div>
            </div>

            {/* Recording Indicator */}
            <div className="recording-indicator-large">
              <div className="rec-dot"></div>
              <span>REC</span>
            </div>
          </div>

          {/* Right: Transcript */}
          <div className="session-transcript">
            <div className="transcript-header">
              <h3>リアルタイム文字起こし</h3>
              <span className="transcript-status">
                {isRecording ? '認識中...' : '待機中'}
              </span>
            </div>
            <div className="transcript-messages">
              {transcript.map(message => (
                <div key={message.id} className={`message ${message.speaker}`}>
                  <div className="message-header">
                    <span
                      className="message-speaker"
                      style={{ color: getSpeakerColor(message.speaker) }}
                    >
                      {message.name}
                    </span>
                    <span className="message-time">{message.timestamp}</span>
                  </div>
                  <div className="message-text">{message.text}</div>
                </div>
              ))}
              {isRecording && transcript.length < mockTranscript.length && (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="session-controls">
          <button className="control-btn mic active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 11C5 11 5 18 12 18C19 18 19 11 19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="control-btn pause" onClick={handlePauseResume}>
            {isPaused ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M8 5L19 12L8 19V5Z" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
              </svg>
            )}
          </button>
          <button className="control-btn settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 1V5M12 19V23M23 12H19M5 12H1M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingSession;