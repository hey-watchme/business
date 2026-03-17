import React, { useState, useEffect, useRef } from 'react';
import './RecordingSession.css';
import { useAuth } from '../contexts/AuthContext';
import AudioBars from './AudioBars';
import type { Subject } from '../api/client';

interface RecordingSessionProps {
  childName: string;
  childAvatar?: string;
  subjectId: string;
  supportPlanId?: string;
  attendees?: {
    parent_father: boolean;
    parent_mother: boolean;
    subject: boolean;
    other: boolean;
  } | null;
  subjectDetail?: Subject | null;
  onClose: () => void;
  onUploadComplete: (sessionId?: string) => void;
}

interface TranscriptMessage {
  id: number;
  speaker: 'parent' | 'child' | 'staff';
  name: string;
  text: string;
  timestamp: string;
}

const REALTIME_CHUNK_MS = 2500;
const MAX_CHUNKS_PER_MESSAGE = 4;
const SENTENCE_END_PATTERN = /[。！？!?]$/;
const MIN_MEANINGFUL_TEXT_LENGTH = 3;
const DUPLICATE_CHUNK_DISTANCE = 3;

const RecordingSession: React.FC<RecordingSessionProps> = ({ childName, childAvatar, subjectId, supportPlanId, attendees, subjectDetail, onClose, onUploadComplete }) => {
  const { profile } = useAuth();
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isRealtimeTranscribing, setIsRealtimeTranscribing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const recordingTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const realtimeRecorderRef = useRef<MediaRecorder | null>(null);
  const realtimeChunkTimerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const messageIdRef = useRef(1);
  const chunkIndexRef = useRef(0);
  const nextChunkToRenderRef = useRef(0);
  const pendingChunkTextsRef = useRef<Map<number, string>>(new Map());
  const activeMessageIdRef = useRef<number | null>(null);
  const activeMessageTextRef = useRef('');
  const activeMessageChunkCountRef = useRef(0);
  const lastCommittedMessageIdRef = useRef<number | null>(null);
  const lastCommittedMessageTextRef = useRef('');
  const lastCommittedChunkIndexRef = useRef(-1);
  const inFlightChunkRequestsRef = useRef(0);
  const isMountedRef = useRef(true);
  const isRecordingActiveRef = useRef(false);

  const stopMediaResources = () => {
    if (realtimeChunkTimerRef.current) {
      clearTimeout(realtimeChunkTimerRef.current);
      realtimeChunkTimerRef.current = null;
    }
    if (realtimeRecorderRef.current && realtimeRecorderRef.current.state !== 'inactive') {
      realtimeRecorderRef.current.stop();
    }
    if (realtimeRecorderRef.current?.stream) {
      realtimeRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    realtimeRecorderRef.current = null;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
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

  const finalizeActiveMessage = () => {
    if (activeMessageIdRef.current !== null) {
      lastCommittedMessageIdRef.current = activeMessageIdRef.current;
      lastCommittedMessageTextRef.current = activeMessageTextRef.current;
    }
    activeMessageIdRef.current = null;
    activeMessageTextRef.current = '';
    activeMessageChunkCountRef.current = 0;
  };

  const normalizeForComparison = (text: string) => (
    text
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[、。！？!?・…「」『』（）()\-ー]/g, '')
  );

  const getLcsLength = (a: string, b: string): number => {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[a.length][b.length];
  };

  const isLikelyDuplicateOfRecent = (incomingText: string, chunkIndex: number) => {
    const lastText = lastCommittedMessageTextRef.current;
    const lastChunkIndex = lastCommittedChunkIndexRef.current;
    if (!lastText || lastChunkIndex < 0) return { duplicate: false, shouldReplace: false };
    if (chunkIndex - lastChunkIndex > DUPLICATE_CHUNK_DISTANCE) return { duplicate: false, shouldReplace: false };

    const incomingNorm = normalizeForComparison(incomingText);
    const lastNorm = normalizeForComparison(lastText);
    if (!incomingNorm || !lastNorm) return { duplicate: false, shouldReplace: false };

    if (
      incomingNorm === lastNorm ||
      incomingNorm.includes(lastNorm) ||
      lastNorm.includes(incomingNorm)
    ) {
      return { duplicate: true, shouldReplace: incomingNorm.length > lastNorm.length };
    }

    const lcs = getLcsLength(incomingNorm, lastNorm);
    const similarity = lcs / Math.max(incomingNorm.length, lastNorm.length);
    if (similarity >= 0.82) {
      return { duplicate: true, shouldReplace: incomingNorm.length >= lastNorm.length };
    }

    return { duplicate: false, shouldReplace: false };
  };

  const mergeTranscriptText = (currentText: string, incomingText: string) => {
    const current = currentText.trim();
    const incoming = incomingText.trim();
    if (!current) return incoming;
    if (!incoming || current === incoming || current.endsWith(incoming)) return current;

    const maxOverlap = Math.min(current.length, incoming.length, 24);
    for (let i = maxOverlap; i >= 3; i--) {
      const incomingPrefix = incoming.slice(0, i);
      if (current.endsWith(incomingPrefix)) {
        return `${current}${incoming.slice(i)}`.trim();
      }
    }

    const needsSpace = /[A-Za-z0-9]$/.test(current) && /^[A-Za-z0-9]/.test(incoming);
    return needsSpace ? `${current} ${incoming}` : `${current}${incoming}`;
  };

  const consumeTranscriptChunk = (text: string, chunkIndex: number) => {
    const trimmed = text.trim();
    if (!isMountedRef.current) return;

    if (!trimmed) {
      lastCommittedChunkIndexRef.current = chunkIndex;
      finalizeActiveMessage();
      return;
    }

    const normalizedIncoming = normalizeForComparison(trimmed);
    if (normalizedIncoming.length < MIN_MEANINGFUL_TEXT_LENGTH) {
      return;
    }

    const timestampSeconds = Math.floor(((chunkIndex + 1) * REALTIME_CHUNK_MS) / 1000);
    const timestamp = formatTime(timestampSeconds);

    if (activeMessageIdRef.current === null) {
      const duplicateCheck = isLikelyDuplicateOfRecent(trimmed, chunkIndex);
      if (duplicateCheck.duplicate) {
        if (duplicateCheck.shouldReplace && lastCommittedMessageIdRef.current !== null) {
          const replaceId = lastCommittedMessageIdRef.current;
          lastCommittedMessageTextRef.current = trimmed;
          lastCommittedChunkIndexRef.current = chunkIndex;
          setTranscript(prev => prev.map(message => (
            message.id === replaceId
              ? { ...message, text: trimmed, timestamp }
              : message
          )));
        }
        return;
      }

      const newMessageId = messageIdRef.current++;
      activeMessageIdRef.current = newMessageId;
      activeMessageTextRef.current = trimmed;
      activeMessageChunkCountRef.current = 1;

      const message: TranscriptMessage = {
        id: newMessageId,
        speaker: 'staff',
        name: '参加者の発言',
        text: trimmed,
        timestamp
      };
      setTranscript(prev => [...prev, message]);
    } else {
      const activeMessageId = activeMessageIdRef.current;
      const mergedText = mergeTranscriptText(activeMessageTextRef.current, trimmed);
      activeMessageTextRef.current = mergedText;
      activeMessageChunkCountRef.current += 1;

      setTranscript(prev => prev.map(message => (
        message.id === activeMessageId
          ? { ...message, text: mergedText, timestamp }
          : message
      )));
    }

    const shouldFinalize =
      SENTENCE_END_PATTERN.test(activeMessageTextRef.current) ||
      activeMessageChunkCountRef.current >= MAX_CHUNKS_PER_MESSAGE;

    if (shouldFinalize) {
      lastCommittedChunkIndexRef.current = chunkIndex;
      finalizeActiveMessage();
    }
  };

  const flushPendingChunks = () => {
    const pending = pendingChunkTextsRef.current;
    while (pending.has(nextChunkToRenderRef.current)) {
      const currentChunkIndex = nextChunkToRenderRef.current;
      const text = pending.get(currentChunkIndex) || '';
      pending.delete(currentChunkIndex);
      consumeTranscriptChunk(text, currentChunkIndex);
      nextChunkToRenderRef.current += 1;
    }
  };

  const transcribeChunk = async (chunk: Blob, chunkIndex: number) => {
    if (chunk.size === 0) return;

    const formData = new FormData();
    formData.append('audio', chunk, `chunk-${chunkIndex}.webm`);
    formData.append('language', 'ja');
    formData.append('chunk_index', String(chunkIndex));

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8052';
    const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'watchme-b2b-poc-2025';

    inFlightChunkRequestsRef.current += 1;
    if (isMountedRef.current) {
      setIsRealtimeTranscribing(true);
    }

    try {
      const response = await fetch(`${API_URL}/api/transcribe/realtime`, {
        method: 'POST',
        headers: {
          'X-API-Token': API_TOKEN
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Realtime transcription failed: ${response.status}`);
      }

      const data = await response.json();
      const text = typeof data.text === 'string' ? data.text : '';
      pendingChunkTextsRef.current.set(chunkIndex, text);
      flushPendingChunks();
    } catch (error) {
      console.error('Realtime transcription error:', error);
      pendingChunkTextsRef.current.set(chunkIndex, '');
      flushPendingChunks();
    } finally {
      inFlightChunkRequestsRef.current = Math.max(0, inFlightChunkRequestsRef.current - 1);
      if (isMountedRef.current) {
        setIsRealtimeTranscribing(inFlightChunkRequestsRef.current > 0);
      }
    }
  };

  const getSupportedAudioMimeType = (): string | undefined => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg'
    ];
    for (const mimeType of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return undefined;
  };

  const startRealtimeRecorderLoop = (stream: MediaStream, mimeType?: string) => {
    if (!isRecordingActiveRef.current) return;

    const realtimeRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    realtimeRecorderRef.current = realtimeRecorder;
    const realtimeChunks: Blob[] = [];

    realtimeRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        realtimeChunks.push(event.data);
      }
    };

    realtimeRecorder.onstop = () => {
      if (realtimeChunks.length > 0) {
        const chunkBlob = new Blob(realtimeChunks, { type: realtimeRecorder.mimeType || mimeType || 'audio/webm' });
        const chunkIndex = chunkIndexRef.current++;
        void transcribeChunk(chunkBlob, chunkIndex);
      }

      if (isRecordingActiveRef.current) {
        startRealtimeRecorderLoop(stream, mimeType);
      }
    };

    realtimeRecorder.start();
    realtimeChunkTimerRef.current = window.setTimeout(() => {
      if (realtimeRecorder.state !== 'inactive') {
        realtimeRecorder.stop();
      }
    }, REALTIME_CHUNK_MS);
  };

  useEffect(() => {
    isMountedRef.current = true;
    setIsRealtimeTranscribing(false);

    // Start actual recording
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = getSupportedAudioMimeType();
        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        chunkIndexRef.current = 0;
        nextChunkToRenderRef.current = 0;
        pendingChunkTextsRef.current.clear();
        activeMessageIdRef.current = null;
        activeMessageTextRef.current = '';
        activeMessageChunkCountRef.current = 0;
        lastCommittedMessageIdRef.current = null;
        lastCommittedMessageTextRef.current = '';
        lastCommittedChunkIndexRef.current = -1;
        messageIdRef.current = 1;
        isRecordingActiveRef.current = true;

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

          // Ensure microphone and audio resources are fully released
          stopMediaResources();

          await uploadAudio(blob);
        };

        mediaRecorder.start();
        startRealtimeRecorderLoop(stream, mimeType);
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting recording:', error);
        // Avoid blocking alert loops; just close the overlay.
        onClose();
      }
    };

    startRecording();

    // Start timer
    const timer = setInterval(() => {
      setRecordingTime(prev => {
        const next = prev + 1;
        recordingTimeRef.current = next;
        return next;
      });
    }, 1000);

    return () => {
      isMountedRef.current = false;
      isRecordingActiveRef.current = false;
      clearInterval(timer);
      // Stop recording on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopMediaResources();
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
    formData.append('duration_seconds', String(recordingTimeRef.current));
    if (supportPlanId) {
      formData.append('support_plan_id', supportPlanId);
    }
    if (attendees) {
      formData.append('attendees', JSON.stringify(attendees));
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
      onUploadComplete(data.session_id);
    } catch (error) {
      console.error('Upload error:', error);
      onUploadComplete();
    }
  };

  const handleStopRecording = () => {
    if (isStopping) return;
    setIsStopping(true);
    finalizeActiveMessage();
    isRecordingActiveRef.current = false;
    if (realtimeChunkTimerRef.current) {
      clearTimeout(realtimeChunkTimerRef.current);
      realtimeChunkTimerRef.current = null;
    }
    if (realtimeRecorderRef.current && realtimeRecorderRef.current.state !== 'inactive') {
      realtimeRecorderRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRealtimeTranscribing(false);
      stopMediaResources();
      onClose();
    } else {
      stopMediaResources();
      onClose();
    }
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'parent': return '#4FC3F7';
      case 'child': return '#81C784';
      case 'staff': return '#BA68C8';
      default: return '#999';
    }
  };

  const participantItems = [
    {
      key: 'staff',
      label: profile?.name || '支援者',
      avatarUrl: profile?.avatar_url,
      fallback: profile?.name?.charAt(0) || '支',
    },
    ...(attendees?.parent_father ? [{
      key: 'parent_father',
      label: '保護者(父)',
      avatarUrl: undefined,
      fallback: '父',
    }] : []),
    ...(attendees?.parent_mother ? [{
      key: 'parent_mother',
      label: '保護者(母)',
      avatarUrl: undefined,
      fallback: '母',
    }] : []),
    ...(attendees?.subject ? [{
      key: 'subject',
      label: '支援対象者',
      avatarUrl: childAvatar,
      fallback: childName.charAt(0),
    }] : []),
    ...(attendees?.other ? [{
      key: 'other',
      label: 'その他',
      avatarUrl: undefined,
      fallback: '他',
    }] : []),
  ];

  const genderLabel = (value?: string | null) => {
    if (!value) return null;
    if (value === 'male') return '男';
    if (value === 'female') return '女';
    if (value === 'other') return 'その他';
    return value;
  };

  const detailItems = subjectDetail ? [
    { label: '年齢', value: subjectDetail.age != null ? `${subjectDetail.age}歳` : null },
    { label: '性別', value: genderLabel(subjectDetail.gender) },
    { label: '生年月日', value: subjectDetail.birth_date || null },
    { label: '地域', value: [subjectDetail.prefecture, subjectDetail.city].filter(Boolean).join(' ') || null },
    { label: '学校名', value: subjectDetail.school_name || null },
    { label: '学校種別', value: subjectDetail.school_type || null },
    { label: '診断', value: subjectDetail.diagnosis?.length ? subjectDetail.diagnosis.join('、') : null },
    { label: '認知タイプ', value: subjectDetail.cognitive_type || null },
    { label: 'メモ', value: subjectDetail.notes || null, full: true },
  ] : [];

  return (
    <div className="recording-session-overlay">
      <div className="recording-session-container">
        {/* Header */}
        <div className="session-header">
          <div className="session-info">
            <h2 className="session-title">ヒアリング中</h2>
            <div className="session-meta">
              <span className="child-name">{childName}</span>
              <span className="separator">•</span>
              <span className="recording-duration">{formatTime(recordingTime)}</span>
            </div>
          </div>
          <button className="end-button" onClick={handleStopRecording} disabled={isStopping}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
            {isStopping ? '終了処理中...' : 'ヒアリングを終了'}
          </button>
        </div>

        {/* Main Content */}
        <div className="session-content">
          {/* Left: Video/Avatar Area */}
          <div className="session-main">
            <div className="subject-card">
              {childAvatar ? (
                <img src={childAvatar} alt={childName} className="subject-avatar img" />
              ) : (
                <div className="subject-avatar">
                  {childName.charAt(0)}
                </div>
              )}
              <div className="subject-info">
                <span className="subject-label">支援対象者</span>
                <span className="subject-name">{childName}</span>
              </div>
              <AudioBars level={audioLevel} className="audio-bars-compact" />
            </div>

            <div className="participants-section">
              <div className="participants-title">参加者</div>
              <div className="participants-list">
                {participantItems.map(participant => (
                  <div key={participant.key} className="participant-tile">
                    {participant.avatarUrl ? (
                      <img src={participant.avatarUrl} alt={participant.label} className="participant-avatar-small img" />
                    ) : (
                      <div className="participant-avatar-small">
                        {participant.fallback}
                      </div>
                    )}
                    <span className="participant-name-small">{participant.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="subject-details">
              <div className="subject-details-title">支援対象者情報</div>
              {detailItems.length > 0 ? (
                <div className="subject-details-grid">
                  {detailItems.map(item => (
                    <div
                      key={item.label}
                      className={`subject-detail-item${item.full ? ' full' : ''}`}
                    >
                      <span className="detail-label">{item.label}</span>
                      <span className="detail-value">{item.value || '未登録'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="subject-details-empty">詳細情報がありません</div>
              )}
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
                {!isRecording ? '待機中' : isRealtimeTranscribing ? '認識中...' : '録音中'}
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
              {isRecording && isRealtimeTranscribing && (
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
