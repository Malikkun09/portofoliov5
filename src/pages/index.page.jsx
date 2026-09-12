/* eslint-disable react/jsx-props-no-spreading */
import Home from '@src/pages/components/home/Index';
import About from '@src/pages/components/about/Index';
import Quote from '@src/pages/components/quote/Index';
import Projects from '@src/pages/components/projects/Index';
import Clients from '@src/pages/components/clients/Index';
import CustomHead from '@src/components/dom/CustomHead';

const seo = {
  title: 'John Doe — Portfolio',
  description: 'Frontend developer portfolio template with GSAP motion, WebGL fluid effects, and a multimodal chatbot demo.',
  keywords: [
    'John Doe',
    'Portfolio',
    'Frontend',
    'Web Development',
    'React',
    'Next.js',
    'GSAP',
    'Portfolio Template',
  ],
};

function Page() {
  return (
    <>
      <CustomHead {...seo} />
      <Home />
      <About />
      <Clients />
      <Quote />
      <Projects />
    </>
  );
}

export default Page;
