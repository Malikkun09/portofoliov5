/* eslint-disable react/jsx-props-no-spreading */
import CustomHead from '@src/components/dom/CustomHead';
import ChatbotApp from '@src/pages/projects/chatbot/components/ChatbotApp';

const seo = {
  title: 'Malik Fajar — Multimodal Chatbot',
  description:
    'Interactive multimodal AI chatbot project: text, image, video, and document inputs with streaming reasoning, session memory, and 30-minute media purge. No login required.',
  keywords: [
    'Malik Fajar Chatbot',
    'Multimodal AI',
    'NVIDIA Nemotron',
    'Portfolio Project',
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
