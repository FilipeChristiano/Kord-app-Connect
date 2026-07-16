import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Intro } from './video_scenes/Intro';
import { Showcase } from './video_scenes/Showcase';
import { Outro } from './video_scenes/Outro';

/* showcase = duração exata de um ciclo completo do HeroShowcase da página de vendas:
   4200 + 4900 + 20966 + 10000 + 5400 + 3200 = 48666 ms */
export const SCENE_DURATIONS = {
  intro: 4000,
  showcase: 48666,
  outro: 4500
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Intro,
  showcase: Showcase,
  outro: Outro,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  const recMarker =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('rec');
  const MARKER_COLORS: Record<string, string> = {
    intro: '#ff0000',
    showcase: '#00ff00',
    outro: '#0000ff',
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-bg-dark">
      {recMarker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 64,
            height: 8,
            background: MARKER_COLORS[baseSceneKey] ?? '#000',
            zIndex: 9999,
          }}
        />
      )}
      {/* Persistent Background Layer */}
      <div className="absolute inset-0">
        <motion.div className="absolute w-[80vw] h-[80vw] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }}
          animate={{ 
            x: ['-20vw', '50vw', '10vw'], 
            y: ['0vh', '40vh', '20vh'], 
            scale: [1, 1.2, 0.8] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} 
        />
        <motion.div className="absolute w-[60vw] h-[60vw] rounded-full opacity-10 blur-3xl right-0 bottom-0"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent)' }}
          animate={{ 
            x: ['20vw', '-30vw', '5vw'], 
            y: ['10vh', '-40vh', '-10vh'] 
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} 
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
