import { gsap } from 'gsap';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useWindowSize } from '@darkroom.engineering/hamo';

const useProjectStackAnimation = ({ isLoading, canvasRefs, detailRefs }) => {
  const windowSize = useWindowSize();

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (isLoading) return;

      const canvases = canvasRefs.current.filter(Boolean);
      const details = detailRefs.current.filter(Boolean);
      const scroller = document?.querySelector('main');

      canvases.forEach((canvas, index) => {
        const card = canvas.parentElement;
        const detail = details[index];

        gsap.set(canvas, { xPercent: -40, opacity: 0 });
        if (detail) gsap.set(detail, { xPercent: -12, autoAlpha: 0 });

        const timeline = gsap.timeline({
          scrollTrigger: {
            id: `projectRef-${index}`,
            trigger: card,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            scroller,
            invalidateOnRefresh: true,
          },
        });

        timeline.to(canvas, { xPercent: 0, opacity: 0.4, duration: 0.35, ease: 'power2.out', force3D: true }, 0);
        if (detail) {
          timeline.to(detail, { xPercent: 0, autoAlpha: 1, duration: 0.35, ease: 'power2.out' }, 0);
        }

        timeline.to({}, { duration: 0.3 });

        timeline.to(canvas, { xPercent: 40, opacity: 0, duration: 0.35, ease: 'power2.in', force3D: true });
        if (detail) {
          timeline.to(detail, { xPercent: 12, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, '<');
        }
      });
    });

    return () => ctx.kill();
  }, [isLoading, windowSize.height, windowSize.width]);
};

export default useProjectStackAnimation;
