import React from 'react';
import './AudioBars.css';

type AudioBarsProps = {
  level: number;
  count?: number;
  className?: string;
};

const AudioBars: React.FC<AudioBarsProps> = ({ level, count = 20, className }) => {
  const wrapperClass = ['audio-bars-shared', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="audio-bar-shared"
          style={{
            height: `${Math.min(100, level * 2 + Math.random() * 20)}%`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
};

export default AudioBars;
