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

  return (
    <div className="app">
      <h1>個別支援計画 ヒアリング録音ツール</h1>
      <div className="main-container">

        {state === 'idle' && (
          <button className="record-button" onClick={startRecording}>
            🎤 録音開始
          </button>
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
