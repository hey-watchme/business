import { useState, useRef } from 'react';
import './App.css';

type AppState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done';

function App() {
  const [state, setState] = useState<AppState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      setState('recording');

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('マイクへのアクセスが拒否されました');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setState('uploading');
    }
  };

  const uploadAudio = async (blob: Blob) => {
    setState('uploading');

    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');  // Changed from 'file' to 'audio'
    formData.append('facility_id', '00000000-0000-0000-0000-000000000001');  // Test facility ID
    formData.append('child_id', '00000000-0000-0000-0000-000000000002');  // Test child ID

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8052';
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

      // For Step 1, just show success (no processing yet)
      setState('done');
      setTranscription(`アップロード成功！\nセッションID: ${data.session_id}\nS3パス: ${data.s3_path}`);
    } catch (error) {
      console.error('Upload error:', error);
      setState('idle');
      setRecordingTime(0);
      alert('アップロードに失敗しました。もう一度お試しください。');
    }
  };

  // Temporarily unused - will be implemented in Step 2
  // const pollForResult = async (jobId: string) => {
  //   // Will be implemented when we add transcription processing
  // };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetApp = () => {
    setState('idle');
    setTranscription('');
    setRecordingTime(0);
  };

  const loadTestAudio = async (audioName: string, displayName: string) => {
    setState('uploading');

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8052';

      // Generate presigned URL from S3
      const s3Path = `test-audio/parent-interview-yoridokoro/${audioName}`;

      // Fetch the audio file from S3 via presigned URL
      // For now, we'll create a placeholder blob and upload it
      // In production, you'd fetch from S3 presigned URL

      const response = await fetch(`https://watchme-vault.s3.ap-southeast-2.amazonaws.com/${s3Path}`);
      const blob = await response.blob();

      // Upload to our API
      const formData = new FormData();
      formData.append('audio', blob, audioName);
      formData.append('facility_id', '00000000-0000-0000-0000-000000000001');
      formData.append('child_id', '00000000-0000-0000-0000-000000000002');

      const uploadResponse = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'X-API-Token': 'watchme-b2b-poc-2025'
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const data = await uploadResponse.json();
      console.log('Test audio upload successful:', data);

      setState('done');
      setTranscription(`テスト音源（${displayName}）アップロード成功！\nセッションID: ${data.session_id}\nS3パス: ${data.s3_path}`);
    } catch (error) {
      console.error('Test audio upload error:', error);
      setState('idle');
      alert('テスト音源のアップロードに失敗しました');
    }
  };

  return (
    <div className="app">
      <h1>個別支援計画 ヒアリング録音ツール</h1>
      <div className="main-container">

        {state === 'idle' && (
          <>
            <button className="record-button" onClick={startRecording}>
              🎤 録音開始
            </button>

            <div className="test-audio-section">
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                テスト音源（開発用）
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="test-audio-button"
                  onClick={() => loadTestAudio('section001_raw.wav', '抜粋・生音声')}
                  style={{ fontSize: '12px', padding: '8px 12px', backgroundColor: '#4CAF50' }}
                >
                  🎵 抜粋・生音声 (30秒)
                </button>
                <button
                  className="test-audio-button"
                  onClick={() => loadTestAudio('section001_clean.wav', '抜粋・ノイズ除去')}
                  style={{ fontSize: '12px', padding: '8px 12px', backgroundColor: '#2196F3' }}
                >
                  🎵 抜粋・クリーン (30秒)
                </button>
                <button
                  className="test-audio-button"
                  onClick={() => loadTestAudio('full_raw.wav', 'フル版')}
                  style={{ fontSize: '12px', padding: '8px 12px', backgroundColor: '#FF9800' }}
                >
                  🎵 フル版 (15分)
                </button>
              </div>
            </div>
          </>
        )}

        {state === 'recording' && (
          <div className="recording-container">
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              録音中... {formatTime(recordingTime)}
            </div>
            <button className="stop-button" onClick={stopRecording}>
              ⬛ 録音停止
            </button>
          </div>
        )}

        {state === 'uploading' && (
          <div className="status-message">
            📤 アップロード中...
          </div>
        )}

        {state === 'processing' && (
          <div className="status-message">
            ⚙️ 処理中...（文字起こし実行中）
          </div>
        )}

        {state === 'done' && (
          <div className="result-container">
            <h2>文字起こし結果</h2>
            <div className="transcription">
              {transcription}
            </div>
            <div className="actions">
              <button onClick={resetApp}>新しい録音を開始</button>
              {/* TODO: Add Excel generation button */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App
