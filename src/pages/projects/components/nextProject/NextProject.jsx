import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import styles from '@src/pages/projects/components/nextProject/styles/nextProject.module.scss';

function NextProject({ nextProject }) {
  return (
    <>
      <section className={clsx(styles.titleContainer, 'layout-block-inner')}>
        <h1 className={clsx(styles.title, 'h1')}>
          <AppearByWords>Next Project</AppearByWords>
        </h1>
      </section>
      <section className={clsx(styles.nextRoot, 'layout-block-inner')}>
        <div className={styles.innerContainer}>
          <article id={nextProject.id} className={clsx(styles.card)}>
            <div className={styles.projectsWrap}>
              <div className={clsx(styles.container, 'layout-grid-inner')}>
                <div className={styles.projectsDetails}>
                  <h6 className={clsx(styles.text, 'h6')}>{nextProject.date}</h6>
                  <h3 className={clsx(styles.text, 'h3')}>{nextProject.title}</h3>
                  <div className={styles.projectActions}>
                    <ButtonLink compact href={nextProject.link} label="VIEW PROJECT" />
                    {nextProject.liveLink ? <ButtonLink compact target href={nextProject.liveLink} label="LIVE SITE" /> : null}
                  </div>
                </div>
                <Link aria-label={`View ${nextProject.title}`} scroll={false} href={nextProject.link} className={styles.imageContainer}>
                  <Image priority sizes="100%" src={nextProject.img} fill alt={nextProject.title} style={{ objectFit: 'cover' }} />
                </Link>
              </div>
            </div>

            <div className={styles.canvas}>
              <Image priority sizes="100%" src={nextProject.img} fill alt={nextProject.title} style={{ objectFit: 'cover' }} />
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
export default NextProject;
