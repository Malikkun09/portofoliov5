import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import styles from '@src/components/dom/projectVideo/projectVideo.module.scss';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

const DISMISS_PX = 120;
const DISMISS_VELOCITY = 720;

const resistPull = (dy) => {
  if (dy <= 0) return 0;
  return dy / (1 + dy / 780);
};

const pullScale = (y) => Math.max(0.88, 1 - y / 1700);
const pullOpacity = (y) => Math.max(0.12, 0.92 - y / 520);

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
  const backdropRef = useRef(null);
  const dragRef = useRef(null);
  const tweenRef = useRef(null);
  const closingRef = useRef(false);
  const resumeAtRef = useRef(0);
  const [lenis] = useStore(useShallow((state) => [state.lenis]));

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false);

  const jumps = useMemo(() => {
    if (!duration) return [];
    return [0, duration * 0.25, duration * 0.5, duration * 0.75];
  }, [duration]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
    setIsPlaying(true);
  }, []);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
  }, []);

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

  const openFullscreen = useCallback(() => {
    resumeAtRef.current = videoRef.current?.currentTime || 0;
    closingRef.current = false;
    setIsFullscreen(true);
    lenis?.stop();
  }, [lenis]);

  const closeFullscreen = useCallback(() => {
    resumeAtRef.current = videoRef.current?.currentTime || resumeAtRef.current;
    closingRef.current = false;
    dragRef.current = null;
    tweenRef.current = null;
    setIsFullscreen(false);
    lenis?.start();
  }, [lenis]);

  const snapPull = useCallback((y, scale) => {
    const stage = stageRef.current;
    const backdrop = backdropRef.current;
    if (!stage) return;
    gsap.killTweensOf([stage, backdrop]);
    gsap.to(stage, { y, scale, duration: 0.58, ease: 'expo.out', overwrite: true, force3D: true });
    if (backdrop) gsap.to(backdrop, { opacity: pullOpacity(y), duration: 0.45, ease: 'power2.out', overwrite: true });
  }, []);

  const dismissFullscreen = useCallback(() => {
    if (!isFullscreen || closingRef.current) return;
    closingRef.current = true;
    dragRef.current = null;

    const stage = stageRef.current;
    const backdrop = backdropRef.current;
    const fly = typeof window !== 'undefined' ? window.innerHeight * 0.92 : 800;

    gsap.killTweensOf([stage, backdrop]);
    const tl = gsap.timeline({
      onComplete: closeFullscreen,
    });
    if (stage) {
      tl.to(stage, { y: fly, scale: 0.84, duration: 0.42, ease: 'power3.in', force3D: true }, 0);
    }
    if (backdrop) {
      tl.to(backdrop, { opacity: 0, duration: 0.32, ease: 'power2.in' }, 0);
    }
    if (!stage) closeFullscreen();
  }, [isFullscreen, closeFullscreen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const applyResume = () => {
      if (resumeAtRef.current) {
        video.currentTime = resumeAtRef.current;
      }
    };
    const onTime = () => setCurrentTime(video.currentTime || 0);
    const onMeta = () => {
      setDuration(video.duration || 0);
      applyResume();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    if (video.readyState >= 1) onMeta();
    applyResume();
    playVideo();

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [playVideo, src, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return undefined;

    const onKeyDown = (event) => {
      const video = videoRef.current;
      const now = video?.currentTime || 0;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissFullscreen();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekTo(now + 5);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekTo(now - 5);
      }
      if (event.key === ' ') {
        event.preventDefault();
        if (video?.paused) playVideo();
        else pauseVideo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, dismissFullscreen, seekTo, pauseVideo, playVideo]);

  useEffect(() => {
    if (!isFullscreen) return undefined;

    const stage = stageRef.current;
    const backdrop = backdropRef.current;
    if (!stage) return undefined;

    gsap.set(stage, { y: 0, scale: 1, force3D: true, transformOrigin: '50% 18%' });
    if (backdrop) gsap.set(backdrop, { opacity: 0.92 });

    tweenRef.current = {
      yTo: gsap.quickTo(stage, 'y', { duration: 0.1, ease: 'power2.out' }),
      scaleTo: gsap.quickTo(stage, 'scale', { duration: 0.14, ease: 'power2.out' }),
      opacityTo: backdrop ? gsap.quickTo(backdrop, 'opacity', { duration: 0.12, ease: 'none' }) : null,
    };

    const onMove = (event) => {
      if (!dragRef.current || closingRef.current) return;
      event.preventDefault();
      const now = performance.now();
      const raw = Math.max(0, event.clientY - dragRef.current.y);
      const dt = now - dragRef.current.t;
      if (dt > 0) {
        dragRef.current.velocity = ((event.clientY - dragRef.current.lastY) / dt) * 1000;
      }
      dragRef.current.lastY = event.clientY;
      dragRef.current.t = now;
      dragRef.current.moved = raw;

      const y = resistPull(raw);
      const tweens = tweenRef.current;
      tweens?.yTo(y);
      tweens?.scaleTo(pullScale(y));
      tweens?.opacityTo?.(pullOpacity(y));
      stage.classList.add(styles.dragging);
    };

    const onUp = () => {
      if (!dragRef.current || closingRef.current) return;
      const moved = dragRef.current.moved || 0;
      const velocity = dragRef.current.velocity || 0;
      dragRef.current = null;
      stage.classList.remove(styles.dragging);

      if (moved > DISMISS_PX || velocity > DISMISS_VELOCITY) {
        dismissFullscreen();
        return;
      }

      if (moved < 8) {
        const video = videoRef.current;
        if (video?.paused) playVideo();
        else pauseVideo();
      }

      snapPull(0, 1);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      gsap.killTweensOf([stage, backdrop]);
    };
  }, [isFullscreen, dismissFullscreen, playVideo, pauseVideo, snapPull]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onDown = (event) => {
      if (event.target.closest('[data-controls]')) return;

      if (!isFullscreen) {
        openFullscreen();
        return;
      }

      dragRef.current = { y: event.clientY, lastY: event.clientY, t: performance.now(), moved: 0, velocity: 0 };
      stageRef.current?.classList.add(styles.dragging);
    };

    stage.addEventListener('pointerdown', onDown);
    return () => stage.removeEventListener('pointerdown', onDown);
  }, [isFullscreen, openFullscreen]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const player = (
    <div className={clsx(styles.player, isFullscreen && styles.fullscreen)}>
      {isFullscreen ? <div ref={backdropRef} className={styles.backdrop} /> : null}
      <div ref={stageRef} className={styles.stage}>
        {isFullscreen ? (
          <div className={styles.handleRow}>
            <span className={styles.handle} />
            <p className={clsx('p-xs', styles.hint)}>Tarik ke bawah untuk keluar</p>
          </div>
        ) : null}
        <video ref={videoRef} className={styles.video} loop muted playsInline autoPlay preload="auto" aria-label={`${title} demo`}>
          <source src={src} type="video/mp4" />
        </video>
        <div data-controls className={styles.controls}>
          <button
            type="button"
            className={clsx('p-xs', styles.iconButton)}
            aria-label="Back five seconds"
            onClick={(event) => {
              event.stopPropagation();
              seekTo((videoRef.current?.currentTime || 0) - 5);
            }}
          >
            -5s
          </button>
          <button
            type="button"
            className={clsx('p-xs', styles.iconButton)}
            aria-label={isPlaying ? 'Pause demo' : 'Play demo'}
            onClick={(event) => {
              event.stopPropagation();
              if (isPlaying) pauseVideo();
              else playVideo();
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className={clsx('p-xs', styles.iconButton)}
            aria-label="Forward five seconds"
            onClick={(event) => {
              event.stopPropagation();
              seekTo((videoRef.current?.currentTime || 0) + 5);
            }}
          >
            +5s
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
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
          <div className={styles.jumps} data-controls>
            {jumps.map((time) => (
              <button
                key={time}
                type="button"
                className={clsx('p-xs', styles.jump, currentTime >= time && styles.jumpActive)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  seekTo(time);
                  playVideo();
                }}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
          {!isFullscreen ? (
            <button
              type="button"
              className={clsx('p-xs', styles.iconButton)}
              aria-label="Open fullscreen demo"
              onClick={(event) => {
                event.stopPropagation();
                openFullscreen();
              }}
            >
              Full
            </button>
          ) : (
            <button
              type="button"
              className={clsx('p-xs', styles.iconButton)}
              aria-label="Close fullscreen"
              onClick={(event) => {
                event.stopPropagation();
                dismissFullscreen();
              }}
            >
              Close
            </button>
          )}
        </div>
        <div className={styles.progressTrack} aria-hidden>
          <span className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <div className={styles.sizer} />
      {isFullscreen && mounted ? createPortal(player, document.body) : player}
    </div>
  );
}

export default ProjectVideo;
