import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './RecordingSetup.css';

interface RecordingSetupProps {
  onStart: (childName: string) => void;
  onCancel: () => void;
  subjectName?: string;
  subjectAvatar?: string;
}

const RecordingSetup: React.FC<RecordingSetupProps> = ({ onStart, onCancel, subjectName, subjectAvatar }) => {
  const { profile } = useAuth();
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [selectedChild, setSelectedChild] = useState(subjectName || '未選択');
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    if (subjectName) {
      setSelectedChild(subjectName);
    }
  }, [subjectName]);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let animationFrame: number | null = null;
    let isUnmounted = false;
    let activeStream: MediaStream | null = null;

    const startMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (isUnmounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStream = stream;
        setMicPermission('granted');

        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevel = () => {
          if (isUnmounted || !analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          animationFrame = requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      } catch (err) {
        if (!isUnmounted) {
          console.error('Mic access error:', err);
          setMicPermission('denied');
        }
      }
    };

    startMic();

    return () => {
      isUnmounted = true;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // Children selection removed as per user request

  return (
    <div className="recording-setup-overlay">
      <div className="recording-setup-container">
        <button className="close-button" onClick={onCancel}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="setup-content">
          <div className="setup-left">
            <div className="preview-area">
              <div className="user-preview">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name || ''} className="user-avatar-large" />
                ) : (
                  <div className="user-avatar-large">
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                      <circle cx="30" cy="20" r="10" fill="currentColor" opacity="0.5" />
                      <path d="M10 50C10 40 19 32 30 32C41 32 50 40 50 50" fill="currentColor" opacity="0.5" />
                    </svg>
                  </div>
                )}
                <h2 className="setup-user-name">{profile?.name || 'ゲストユーザー'}</h2>
                <p className="user-role">{profile?.role === 'staff' ? '児童発達支援管理責任者' : 'スタッフ'}</p>
              </div>

              <div className="audio-indicator">
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
                <span className="audio-label" style={{
                  color: micPermission === 'granted' ? 'var(--accent-success)' :
                    micPermission === 'denied' ? 'var(--accent-danger)' :
                      'var(--text-muted)'
                }}>
                  {micPermission === 'checking' && 'マイク: 確認中'}
                  {micPermission === 'granted' && 'マイク: 正常'}
                  {micPermission === 'denied' && 'マイク: エラー'}
                </span>
              </div>

              <div className="controls-preview">
                <button className="control-button mic-button active" title="マイク: オン">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
                <button className="control-button camera-button disabled" title="カメラ: オフ">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 16.29V7a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"></path>
                    <path d="M24 8l-8 5 8 5V8z"></path>
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="setup-right">
            <h1 className="setup-title">アセスメントの準備</h1>
            <p className="setup-subtitle">録音を開始する前に、以下の設定を確認してください</p>

            <div className="setup-section">
              <h3 className="setup-section-title">支援対象者</h3>
              <div className="child-display-card">
                {subjectAvatar ? (
                  <img src={subjectAvatar} alt={selectedChild} className="child-avatar-display" />
                ) : (
                  <div className="child-avatar-display">
                    {selectedChild.charAt(0)}
                  </div>
                )}
                <div className="child-info-display">
                  <span className="child-name-display">{selectedChild}</span>
                  <span className="child-label-display">この対象児の計画を作成します</span>
                </div>
              </div>
            </div>


            <div className="setup-section">
              <h3 className="setup-section-title">録音時の注意事項</h3>
              <ul className="tips-list">
                <li>静かな環境で録音してください</li>
                <li>マイクから適切な距離を保ってください</li>
                <li>保護者の方に録音の許可を得てください</li>
              </ul>
            </div>

            <div className="action-buttons">
              <button className="cancel-button" onClick={onCancel}>
                キャンセル
              </button>
              <button
                className="start-button"
                onClick={() => onStart(selectedChild)}
                disabled={micPermission !== 'granted' || !selectedChild}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="currentColor" />
                  <circle cx="10" cy="10" r="4" fill="white" />
                </svg>
                録音を開始
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordingSetup;