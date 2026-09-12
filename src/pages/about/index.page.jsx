/* eslint-disable react/jsx-props-no-spreading */
import CustomHead from '@src/components/dom/CustomHead';
import Hero from '@src/pages/about/components/hero/Hero';
import Overview from '@src/pages/about/components/overview/Overview';

const seo = {
  title: 'John Doe — About',
  description: 'About John Doe — frontend developer focused on motion, interaction, and polished web experiences.',
  keywords: ['John Doe', 'About', 'Frontend', 'Web Development', 'React', 'Next.js'],
};

function Page() {
  return (
    <>
      <CustomHead {...seo} />
      <Hero />
      <Overview />
    </>
  );
}

export default Page;
