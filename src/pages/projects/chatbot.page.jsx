/* eslint-disable react/jsx-props-no-spreading */
import CustomHead from '@src/components/dom/CustomHead';
import ChatbotApp from '@src/pages/projects/chatbot/components/ChatbotApp';

const seo = {
  title: 'Portfolio — Demo Chat',
  description:
    'Interactive multimodal AI chatbot demo: text, image, video, and document inputs with streaming reasoning, session memory, and 30-minute media purge. No login required.',
  keywords: [
    'Multimodal AI',
    'NVIDIA Nemotron',
    'Portfolio Template',
    'AI Chat',
    'Reasoning Model',
    'Frontend',
  ],
};

function Page() {
  return (
    <>
      <CustomHead {...seo} />
      <ChatbotApp />
    </>
  );
}

export default Page;
