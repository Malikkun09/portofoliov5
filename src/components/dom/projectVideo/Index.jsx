import { useCallback, useEffect, useRef, useState } from 'react';

import clsx from 'clsx';
import styles from '@src/components/dom/projectVideo/projectVideo.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';

const AUTO_HIDE_MS = 3000;
const TAP_THRESHOLD_PX = 12;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

function ProjectVideo({ src, title }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const hideTimerRef = useRef(null);
  const pointerRef = useRef(null);
  const isMobile = useIsMobile();

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, AUTO_HIDE_MS);
  }, [clearHideTimer]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
    setIsPlaying(true);
    scheduleHide();
  }, [scheduleHide]);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    clearHideTimer();
    setShowControls(true);
  }, [clearHideTimer]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) playVideo();
    else pauseVideo();
  }, [pauseVideo, playVideo]);

  const seekTo = useCallback(
    (time) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(time)) return;
      const next = Math.min(Math.max(time, 0), duration || video.duration || 0);
      video.currentTime = next;
      setCurrentTime(next);
    },
    [duration],
  );

  const enterFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
      return;
    }

    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onTime = () => setCurrentTime(video.currentTime || 0);
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    if (video.readyState >= 1) onMeta();

    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        setIsPlaying(false);
        setShowControls(true);
      });
    }

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [src]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const handlePointerDown = useCallback((event) => {
    if (event.target.closest('[data-controls]')) return;
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  }, []);

  const handlePointerUp = useCallback(
    (event) => {
      const start = pointerRef.current;
      pointerRef.current = null;
      if (!start || start.id !== event.pointerId) return;
      if (event.target.closest('[data-controls]')) return;

      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      if (dx > TAP_THRESHOLD_PX || dy > TAP_THRESHOLD_PX) return;

      if (isMobile) {
        if (showControls) {
          setShowControls(false);
          clearHideTimer();
        } else {
          revealControls();
        }
        return;
      }

      togglePlay();
    },
    [clearHideTimer, isMobile, revealControls, showControls, togglePlay],
  );

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    setShowControls(true);
    clearHideTimer();
  }, [clearHideTimer, isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile || isScrubbing || !isPlaying) return;
    setShowControls(false);
  }, [isMobile, isPlaying, isScrubbing]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.root}>
      <div className={styles.sizer} />
      <div
        ref={stageRef}
        className={clsx(styles.player, showControls && styles.showControls, !isPlaying && styles.paused)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <video ref={videoRef} className={styles.video} loop muted playsInline autoPlay preload="metadata" aria-label={`${title} demo`}>
          <source src={src} type="video/mp4" />
        </video>

        {!isPlaying ? (
          <button type="button" className={styles.centerPlay} aria-label="Play demo" onClick={togglePlay}>
            <span aria-hidden>▶</span>
          </button>
        ) : null}

        <div className={clsx(styles.controls, showControls && styles.controlsVisible)} data-controls>
          <button
            type="button"
            className={clsx('p-xs', styles.controlButton)}
            aria-label={isPlaying ? 'Pause demo' : 'Play demo'}
            onClick={(event) => {
              event.stopPropagation();
              togglePlay();
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span className={clsx('p-xs', styles.time)}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <input
            className={styles.seek}
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Number.isFinite(currentTime) ? currentTime : 0}
            aria-label="Seek demo duration"
            onPointerDown={(event) => {
              event.stopPropagation();
              setIsScrubbing(true);
              clearHideTimer();
              setShowControls(true);
            }}
            onPointerUp={() => {
              setIsScrubbing(false);
              scheduleHide();
            }}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
          <button
            type="button"
            className={clsx('p-xs', styles.controlButton)}
            aria-label="Open fullscreen demo"
            onClick={(event) => {
              event.stopPropagation();
              enterFullscreen();
            }}
          >
            Full
          </button>
        </div>

        <div className={styles.progressTrack} aria-hidden>
          <span className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default ProjectVideo;
