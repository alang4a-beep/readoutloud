import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Type, Volume2, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLength, setCurrentLength] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Chrome ~15s TTS pause bug workaround
  const keepAliveInterval = useRef<number | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      if (availableVoices.length > 0) {
        const zhVoices = availableVoices.filter(v => v.lang.includes('zh'));
        // CRITICAL: Google network voices (Chrome default) often DO NOT fire `onboundary` events.
        // We must prioritize local system voices to ensure character highlighting works correctly.
        const localZhVoices = zhVoices.filter(v => v.localService);
        
        const bestVoice = 
          localZhVoices.find(v => v.name.includes('Hanhan') || v.name.includes('Yating') || v.name.includes('Mei-Jia') || v.name.includes('Siri')) ||
          localZhVoices[0] || 
          zhVoices.find(v => !v.name.includes('Google')) ||
          zhVoices[0] || 
          availableVoices[0];
          
        setSelectedVoice(bestVoice);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
    };
  }, []);

  // Workaround to keep TTS alive for long texts
  useEffect(() => {
    if (isPlaying && !isPaused) {
      keepAliveInterval.current = window.setInterval(() => {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 14000);
    } else if (keepAliveInterval.current) {
      clearInterval(keepAliveInterval.current);
    }
    return () => {
      if (keepAliveInterval.current) clearInterval(keepAliveInterval.current);
    };
  }, [isPlaying, isPaused]);

  const startPlayback = (startIndex: number, playbackSpeed: number) => {
    window.speechSynthesis.resume(); // Clear any stuck paused state
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
      const remainingText = text.substring(startIndex);
      if (!remainingText) return;
      
      const utterance = new SpeechSynthesisUtterance(remainingText);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = 'zh-TW';
      }
      utterance.rate = playbackSpeed;
      
      utterance.onboundary = (event) => {
        setCurrentIndex(startIndex + event.charIndex);
        setCurrentLength(event.charLength || 1);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIndex(0);
        setCurrentLength(0);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.error('Speech synthesis error', e);
          setIsPlaying(false);
          setIsPaused(false);
        }
      };

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    }, 50);
  };

  const handlePlay = () => {
    if (!text.trim()) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    setCurrentIndex(0);
    setCurrentLength(0);
    startPlayback(0, speed);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setCurrentLength(0);
  };

  const speedOptions = [1, 1.5, 2, 3];

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying && !isPaused) {
      startPlayback(currentIndex, newSpeed);
    }
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
    setCurrentLength(1);
    startPlayback(index, speed);
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 selection:bg-amber-200">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">文字朗讀助手</h1>
            <p className="text-sm text-stone-500 font-medium">具備語意斷句與動態高亮</p>
          </div>
        </div>
        
        {/* Speed Controls */}
        <div className="hidden sm:flex items-center gap-2 bg-stone-100 p-1.5 rounded-lg border border-stone-200">
          <Settings2 className="w-4 h-4 text-stone-400 ml-2" />
          <div className="w-px h-4 bg-stone-300 mx-1"></div>
          {speedOptions.map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                speed === s 
                  ? 'bg-white text-amber-700 shadow-sm' 
                  : 'text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[65vh] min-h-[400px]">
          
          {/* Content Area */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {!isPlaying && !isPaused ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="請在此貼上或輸入您想要朗讀的文字..."
                    className="flex-1 w-full p-8 text-lg leading-relaxed text-stone-700 bg-transparent resize-none focus:outline-none placeholder:text-stone-300"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="read"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-0 overflow-y-auto p-8"
                >
                  <div className="text-xl leading-loose text-stone-600 whitespace-pre-wrap font-medium select-none">
                    {text.split('').map((char, index) => {
                      const isHighlighted = index >= currentIndex && index < currentIndex + Math.max(currentLength, 1);
                      return (
                        <span
                          key={index}
                          onClick={() => handleJumpTo(index)}
                          className={`cursor-pointer transition-colors duration-100 ${
                            isHighlighted
                              ? 'bg-amber-200 text-amber-900 rounded-sm px-0.5 shadow-sm'
                              : 'hover:bg-stone-200 hover:text-stone-800 rounded-sm'
                          }`}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Toolbar */}
          <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
            
            {/* Mobile Speed Controls */}
            <div className="flex sm:hidden items-center gap-1 bg-white p-1 rounded-lg border border-stone-200">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    speed === s 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Voice Info */}
            <div className="hidden md:flex items-center text-sm text-stone-500 gap-2">
              <Type className="w-4 h-4" />
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const voice = voices.find(v => v.name === e.target.value);
                  if (voice) setSelectedVoice(voice);
                }}
                className="bg-transparent border-none focus:ring-0 cursor-pointer max-w-[200px] truncate outline-none hover:text-stone-700 transition-colors"
                title="選擇語音引擎 (若高亮未同步請嘗試切換)"
              >
                {voices.filter(v => v.lang.includes('zh')).map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
                {voices.filter(v => !v.lang.includes('zh')).length > 0 && (
                  <optgroup label="其他語言">
                    {voices.filter(v => !v.lang.includes('zh')).map(v => (
                      <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
              {isPlaying && !isPaused && (
                <button
                  onClick={handlePause}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors shadow-sm"
                  aria-label="Pause"
                >
                  <Pause className="w-5 h-5 fill-current" />
                </button>
              )}
              
              {(!isPlaying || isPaused) && (
                <button
                  onClick={handlePlay}
                  disabled={!text.trim()}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  aria-label="Play"
                >
                  <Play className="w-6 h-6 fill-current ml-1" />
                </button>
              )}

              {(isPlaying || isPaused) && (
                <button
                  onClick={handleStop}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shadow-sm"
                  aria-label="Stop"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Info text */}
        <p className="text-center text-stone-400 text-sm mt-6">
          系統會根據作業系統內建的語音引擎與神經網路模型，自動分析標點與語義，產生自然流暢的語調與斷句。
        </p>
      </main>
    </div>
  );
}
