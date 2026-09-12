/* eslint-disable react/jsx-key */

const containt = [
  {
    smallTitle: 'Development',
    bigTitle: 'How I Build',
    desc: [
      <div className="p-l">I learn by shipping. Each project starts with a real problem, a stack that</div>,
      <div className="p-l">fits, and a loop of build, break, and fix until the thing can be used.</div>,
      <div className="p-l">School, PKL, hackathons, and this site all follow that same loop.</div>,
    ],
    descMobile: [
      <div className="p-l">I learn by shipping. Each project starts with a real problem,</div>,
      <div className="p-l">a stack that fits, and a loop of build, break, and fix until the</div>,
      <div className="p-l">thing can be used. School, PKL, hackathons, and this site</div>,
      <div className="p-l">all follow that same loop.</div>,
    ],
    options: [
      { title: 'Understand the problem', desc: 'Who uses it, what hurts, and what success looks like' },
      { title: 'Sketch the structure', desc: 'Pages, roles, and data before pixels get precious' },
      { title: 'Design the interface', desc: 'Hierarchy first, decoration last' },
      { title: 'Build the core', desc: 'HTML, CSS, JavaScript, React, or Laravel — whatever the job needs' },
      { title: 'Connect the data', desc: 'APIs, MySQL, and the flows that actually move information' },
      { title: 'Test the edges', desc: 'Broken states, access control, and the paths people actually take' },
      { title: 'Ship it', desc: 'Deploy, share the URL, and keep notes on what still fails' },
    ],
  },
  {
    smallTitle: 'Workflow',
    bigTitle: 'Workflow',
    desc: [
      <div className="p-l">My workflow is small and strict: version control, readable code, and a</div>,
      <div className="p-l">record of what changed. I use Git, Linux, and the tools in front of me —</div>,
      <div className="p-l">including AI — as collaborators, not as a substitute for thinking.</div>,
    ],
    descMobile: [
      <div className="p-l">My workflow is small and strict: version control, readable</div>,
      <div className="p-l">code, and a record of what changed. I use Git, Linux, and</div>,
      <div className="p-l">the tools in front of me — including AI — as collaborators,</div>,
      <div className="p-l">not as a substitute for thinking.</div>,
    ],
    options: [
      { title: 'Kickoff', desc: 'Write down the goal, the constraint, and the deadline' },
      { title: 'Research', desc: 'Look at similar products and the stack that can actually ship' },
      { title: 'Environment', desc: 'Set up the repo, linting, and a local run that does not lie' },
      { title: 'Version control', desc: 'Git from the first file, with commits that explain why' },
      { title: 'Components', desc: 'Build pieces that can be reused instead of copied' },
      { title: 'Review', desc: 'Read the code again. Cut what is clever. Keep what is clear.' },
      { title: 'Launch', desc: 'Put it on a domain and watch how it fails in the wild' },
      { title: 'Notes', desc: 'Document what I would do differently next time' },
    ],
  },
];
export default containt;
