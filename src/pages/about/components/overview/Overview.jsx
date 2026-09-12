import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import clsx from 'clsx';
import styles from '@src/pages/about/components/overview/styles/overview.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';

function Overview() {
  const isMobile = useIsMobile();

  return (
    <section className={clsx(styles.root, 'layout-grid-inner')}>
      <div className={styles.title}>
        {isMobile ? (
          <AppearTitle key="mobile-queto">
            <h3 className="h3">The front-end developer&apos;s role </h3>
            <h3 className="h3">
              is like a kind host, <span className="medium">ensuring</span>
            </h3>
            <h3 className="h3">
              visitors have a <span className="medium">smooth</span> and
            </h3>
            <h3 className="h3">
              <span className="medium">enjoyable</span> experience.
            </h3>
          </AppearTitle>
        ) : (
          <AppearTitle key="desktop-queto">
            <h3 className="h3">The front-end developer&apos;s role is like a</h3>
            <h3 className="h3">
              kind host, <span className="medium">ensuring</span> visitors have
            </h3>
            <h3 className="h3">
              a <span className="medium">smooth</span> and <span className="medium">enjoyable</span> experience.
            </h3>
          </AppearTitle>
        )}
      </div>
      <div className={clsx(styles.text, 'p-l', styles.myStory)}>
        <AppearTitle>
          <span>Some words</span>
        </AppearTitle>
      </div>
      <div className={styles.desc}>
        {!isMobile ? (
          <AppearTitle key="desktop-overview">
            <h6 className="h6">Hey there! I&apos;m John, a frontend developer who learns by building:</h6>
            <h6 className="h6">websites, interfaces, systems, and visual experiments. Design,</h6>
            <h6 className="h6">motion, and accessibility are the lanes I keep walking.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>When I&apos;m not prototyping, I&apos;m usually in a terminal, a design</h6>
            <h6 className="h6">file, or an animation timeline. I like interfaces that feel crafted,</h6>
            <h6 className="h6">not default — type, contrast, and motion doing real work.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>This site is a template you can fork: projects, experiments, and</h6>
            <h6 className="h6">process arranged so visitors can walk through the work.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>If you want to build something, I&apos;m listening.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>John Doe.</h6>
          </AppearTitle>
        ) : (
          <AppearTitle key="mobile-overview">
            <h6 className="h6">Hey there! I&apos;m John, a frontend developer who learns by building:</h6>
            <h6 className="h6">websites, interfaces, systems, and visual experiments.</h6>
            <h6 className="h6">Design, motion, and accessibility are the lanes I keep walking.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>When I&apos;m not prototyping, I&apos;m usually in a terminal,</h6>
            <h6 className="h6">a design file, or an animation timeline. I like interfaces that</h6>
            <h6 className="h6">feel crafted, not default — type, contrast, and motion</h6>
            <h6 className="h6">doing real work.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>This site is a template you can fork: projects, experiments, and</h6>
            <h6 className="h6">process arranged so visitors can walk through the work.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>If you want to build something, I&apos;m listening.</h6>
            <h6 className={clsx(styles.paddingTop, 'h6')}>John Doe.</h6>
          </AppearTitle>
        )}
      </div>
    </section>
  );
}
export default Overview;
