/* eslint-disable no-return-assign */
/* eslint-disable no-nested-ternary */
import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import ProjectNewBadge from '@src/components/dom/ProjectNewBadge';
import projects from '@src/constants/projects';
import styles from '@src/pages/components/projects/styles/projects.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import useProjectStackAnimation from '@src/hooks/useProjectStackAnimation';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function Projects() {
  const isMobile = useIsMobile();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));

  const projectRefs = useRef([]);
  const detailRefs = useRef([]);

  const newProjects = projects.slice(0, 3);

  useProjectStackAnimation({ isLoading, canvasRefs: projectRefs, detailRefs });

  return (
    <>
      <section className={clsx(styles.titleContainer, 'layout-grid-inner')}>
        <h1 className={clsx(styles.title, 'h1')}>
          <AppearByWords>Selected Projects</AppearByWords>
        </h1>
      </section>
      <section className={clsx(styles.root, 'layout-block-inner')}>
        <div className={styles.innerContainer}>
          {newProjects.map((project, index) => (
            <article id={project.id} key={project.id} className={clsx(styles.card)}>
              <div
                style={
                  !isMobile
                    ? {
                        height: index === newProjects.length - 1 ? '200svh' : `${200 + 100 * index}svh`,
                        top: index === 0 ? '0px' : '-100svh',
                      }
                    : {
                        height: index === newProjects.length - 1 ? '100svh' : `${200 + 100 * index}svh`,
                        top: index === 0 ? '0px' : '-50svh',
                      }
                }
                className={styles.projectsWrap}
              >
                <div className={clsx(styles.container, 'layout-grid-inner')}>
                  <div
                    ref={(el) => {
                      detailRefs.current[index] = el;
                    }}
                    className={styles.projectsDetails}
                  >
                    <h6 className="h6">{project.date}</h6>
                    <h3 className="h3">
                      {project.title}
                      {project.isNew ? <ProjectNewBadge /> : null}
                    </h3>
                    <div className={styles.projectActions}>
                      <ButtonLink compact href={project.link} label="VIEW PROJECT" />
                      {project.liveLink ? <ButtonLink compact target href={project.liveLink} label="LIVE SITE" /> : null}
                    </div>
                  </div>
                  <Link aria-label={`View ${project.title}`} scroll={false} href={project.link} className={styles.imageContainer}>
                    <Image src={project.img} fill sizes="100%" alt={project.title} style={{ objectFit: 'cover' }} />
                  </Link>
                </div>
              </div>
              <div ref={(el) => (projectRefs.current[index] = el)} className={styles.canvas}>
                <Image
                  priority
                  className={index === 0 ? styles.firstCard : index === newProjects.length - 1 ? styles.lastCard : undefined}
                  src={project.img}
                  fill
                  sizes="100%"
                  alt={project.title}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </article>
          ))}
        </div>
        <div className={styles.buttonContainer}>
          <ButtonLink href="/projects" label="ALL PROJECTS" />
        </div>
      </section>
    </>
  );
}

export default Projects;
