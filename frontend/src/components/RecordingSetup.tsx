import React, { useState, useEffect } from 'react';
import './RecordingSetup.css';

interface RecordingSetupProps {
  onStart: (childName: string) => void;
  onCancel: () => void;
}

const RecordingSetup: React.FC<RecordingSetupProps> = ({ onStart, onCancel }) => {
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [selectedChild, setSelectedChild] = useState('田中太郎');
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    // Check microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        setMicPermission('granted');

        // Audio level visualization
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();

        // Cleanup
        return () => {
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
        };
      })
      .catch(() => {
        setMicPermission('denied');
      });
  }, []);

  const children = [
    '田中太郎',
    '佐藤花子',
    '鈴木一郎',
    '山田美咲',
    '高橋健太'
  ];

  return (
    <div className="recording-setup-overlay">
      <div className="recording-setup-container">
        <button className="close-button" onClick={onCancel}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="setup-content">
          <div className="setup-left">
            <div className="preview-area">
              <div className="user-preview">
                <div className="user-avatar-large">
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <circle cx="30" cy="20" r="10" fill="currentColor" opacity="0.5"/>
                    <path d="M10 50C10 40 19 32 30 32C41 32 50 40 50 50" fill="currentColor" opacity="0.5"/>
                  </svg>
                </div>
                <h2 className="user-name">山田太郎</h2>
                <p className="user-role">職員</p>
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
                <span className="audio-label">マイク: オン</span>
              </div>

              <div className="controls-preview">
                <button className="control-button mic-button active">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 11C5 11 5 18 12 18C19 18 19 11 19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="control-button settings-button">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 1V5M12 19V23M23 12H19M5 12H1M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="setup-right">
            <h1 className="setup-title">ヒアリングの準備</h1>
            <p className="setup-subtitle">録音を開始する前に、以下の設定を確認してください</p>

            <div className="setup-section">
              <h3 className="section-title">児童を選択</h3>
              <div className="child-selector">
                {children.map(child => (
                  <button
                    key={child}
                    className={`child-option ${selectedChild === child ? 'selected' : ''}`}
                    onClick={() => setSelectedChild(child)}
                  >
                    <div className="child-avatar">
                      {child.charAt(0)}
                    </div>
                    <span>{child}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-section">
              <h3 className="section-title">マイクの状態</h3>
              <div className={`mic-status ${micPermission}`}>
                {micPermission === 'checking' && (
                  <>
                    <div className="spinner"></div>
                    <span>マイクを確認中...</span>
                  </>
                )}
                {micPermission === 'granted' && (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6 10L8.5 12.5L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>マイクは正常に動作しています</span>
                  </>
                )}
                {micPermission === 'denied' && (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M12 8L8 12M8 8L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>マイクへのアクセスが拒否されました</span>
                  </>
                )}
              </div>
            </div>

            <div className="setup-section">
              <h3 className="section-title">録音時の注意事項</h3>
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
                  <circle cx="10" cy="10" r="8" fill="currentColor"/>
                  <circle cx="10" cy="10" r="4" fill="white"/>
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