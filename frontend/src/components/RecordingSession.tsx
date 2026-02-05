import React, { useState, useEffect, useRef } from 'react';
import './RecordingSession.css';
import { useAuth } from '../contexts/AuthContext';

interface RecordingSessionProps {
  childName: string;
  childAvatar?: string;
  subjectId: string;
  supportPlanId?: string;
  onStop: (sessionId?: string) => void;
}

interface TranscriptMessage {
  id: number;
  speaker: 'parent' | 'child' | 'staff';
  name: string;
  text: string;
  timestamp: string;
}

const RecordingSession: React.FC<RecordingSessionProps> = ({ childName, childAvatar, subjectId, supportPlanId, onStop }) => {
  const { profile } = useAuth();
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
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

        // Audio level visualization
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

          // Clean up media stream BEFORE uploading
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
    formData.append('facility_id', profile?.facility_id || '00000000-0000-0000-0000-000000000001');
    formData.append('subject_id', subjectId);
    if (supportPlanId) {
      formData.append('support_plan_id', supportPlanId);
    }
    // Add staff_id from authenticated user
    if (profile?.user_id) {
      formData.append('staff_id', profile.user_id);
    }

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
      onStop(data.session_id);
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
            <h2 className="session-title">アセスメント - 録音中</h2>
            <div className="session-meta">
              <span className="child-name">{childName}</span>
              <span className="separator">•</span>
              <span className="recording-duration">{formatTime(recordingTime)}</span>
            </div>
          </div>
          <button className="end-button" onClick={handleStopRecording}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" />
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
                    <circle cx="30" cy="20" r="10" fill="currentColor" opacity="0.5" />
                    <path d="M10 50C10 40 19 32 30 32C41 32 50 40 50 50" fill="currentColor" opacity="0.5" />
                  </svg>
                </div>
                <div className="participant-info">
                  <span className="participant-name">保護者</span>
                  <div className="audio-bars">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="audio-bar"
                        style={{
                          height: `${Math.min(100, audioLevel * 2 + Math.random() * 20)}%`,
                          animationDelay: `${i * 0.05}s`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="participant-card">
                {childAvatar ? (
                  <img src={childAvatar} alt={childName} className="participant-avatar small img" />
                ) : (
                  <div className="participant-avatar small">
                    {childName.charAt(0)}
                  </div>
                )}
                <span className="participant-name">{childName}</span>
              </div>

              <div className="participant-card">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name || ''} className="participant-avatar small img" />
                ) : (
                  <div className="participant-avatar small">
                    {profile?.name?.charAt(0) || '職'}
                  </div>
                )}
                <span className="participant-name">{profile?.name || '職員'}</span>
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
          <button className="control-btn mic active" title="マイク: オン">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          <button className="control-btn camera disabled" title="カメラ: オフ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16.29V7a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"></path>
              <path d="M24 8l-8 5 8 5V8z"></path>
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingSession;