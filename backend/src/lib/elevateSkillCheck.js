// ELEVATE skill check: the "Orientation, Pre-test, Profiling" questionnaire
// that opens every ELEVATE training design. It is one general list for every
// beneficiary: their goal, whether they've used a computer, and one plain task
// per topic rated Never / With help / On my own. The ratings decide which
// topics they learn; the goal decides which of those come first.
//
// Each topic's `statements` and `questions` are the earlier per-topic check,
// kept as the source the plain `task` summarises.

const RATING_SCALE = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'With help' },
  { value: 2, label: 'On my own' },
];

// The one question shown per topic, in training-design order.
const TASKS = {
  T1: 'Turn on a computer, use the mouse and keyboard, and save and find files',
  T2: 'Write and format a document in Google Docs or MS Word',
  T3: 'Make a slide presentation in Google Slides or PowerPoint',
  T4: 'Organize data and use simple formulas in Google Sheets or Excel',
  T5: 'Search the internet and send emails with attachments in Gmail',
  T6: 'Answer job interview questions in English',
  T7: 'Explain what freelancing is and how freelancers get paid',
  T8: 'Create a profile and apply for work on a site like Upwork or OnlineJobs.ph',
  T9: 'Set up a device, internet and tools for working from home',
  T10: 'Build or edit a simple website in WordPress',
  T11: 'Do virtual-assistant tasks such as managing a client’s email and schedule',
  T12: 'Explain how digital marketing helps a small business sell',
  T13: 'Make social media posts that promote a product',
  T14: 'Write a simple business plan for selling online',
};

// Rating -> level on the 0-3 scale the bands, matching and results use.
const LEVEL_FOR_RATING = [0, 1.0, 2.0];

// Topics in training-design order (T1 to T14). `answer` is the index of the
// correct option (0 = a).
const TOPICS = [
  {
    code: 'T1',
    slug: 'elevate-basic-computer-operation',
    title: 'Basic Computer Operation',
    computerBased: true,
    statements: [
      'Turn a computer on and off properly, and use the mouse and keyboard.',
      'Create folders, and save, find, rename, copy and move files.',
      'Open and close programs, and connect a USB drive, printer or headset.',
    ],
    questions: [
      {
        text: 'What is the safe way to turn off a computer?',
        options: ['Unplug it', 'Hold the power button', 'Click Start, then Shut down', 'Turn off the monitor'],
        answer: 2,
      },
      {
        text: 'Which keys copy the selected text or file?',
        options: ['Ctrl + V', 'Ctrl + C', 'Ctrl + X', 'Ctrl + Z'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T2',
    slug: 'elevate-google-document',
    title: 'Google Document',
    computerBased: true,
    statements: [
      'Type and format a document: font, size, bold, alignment, bullets.',
      'Insert a table or picture, and set margins and page size.',
      'Share a Google Doc or save it as a PDF, and choose who can edit it.',
    ],
    questions: [
      {
        text: 'A coworker should comment on your Google Doc but not change it. Which access do you give?',
        options: ['Viewer', 'Editor', 'Commenter', 'Owner'],
        answer: 2,
      },
      {
        text: 'Which format keeps your resume’s layout the same on any computer?',
        options: ['PDF', 'Plain text (.txt)', 'A photo of the screen', 'A copied chat message'],
        answer: 0,
      },
    ],
  },
  {
    code: 'T3',
    slug: 'elevate-google-slides',
    title: 'Google Slides',
    computerBased: true,
    statements: [
      'Make a presentation with slides, text and pictures.',
      'Apply a theme or layout so every slide looks consistent.',
      'Present in full screen and share the file with others.',
    ],
    questions: [
      {
        text: 'Where do you write notes that only the presenter sees?',
        options: ['Speaker notes', 'Title box', 'Slide footer', 'Comments'],
        answer: 0,
      },
      {
        text: 'Which slide is easiest for an audience to read?',
        options: ['A full paragraph in small text', 'Short points with one picture', 'Five fonts and colors', 'Text over a busy photo'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T4',
    slug: 'elevate-google-spreadsheet',
    title: 'Google Spreadsheet',
    computerBased: true,
    statements: [
      'Enter data in rows and columns, and format numbers, money and dates.',
      'Use formulas such as SUM and AVERAGE, and + − × ÷ between cells.',
      'Sort and filter data and make a simple chart.',
    ],
    questions: [
      {
        text: 'Which formula adds the numbers in cells A1 to A10?',
        options: ['=ADD(A1:A10)', '=TOTAL(A1-A10)', '=SUM(A1:A10)', 'SUM A1 to A10'],
        answer: 2,
      },
      {
        text: 'Cell B2 holds 5 and C2 holds 4. What does =B2*C2 show?',
        options: ['9', '20', '1', 'B2C2'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T5',
    slug: 'elevate-basic-internet-operation',
    title: 'Basic Internet Operation',
    computerBased: false,
    statements: [
      'Search the web and tell whether a website can be trusted.',
      'Send, reply to and forward Gmail messages with attachments.',
      'Use strong passwords and spot scam or phishing messages.',
      'Join an online meeting (Zoom or Google Meet) and use the mic and camera.',
    ],
    questions: [
      {
        text: 'An email says: “Your account closes today. Click here and enter your password.” What do you do?',
        options: ['Click and enter the password', 'Reply with the password', 'Don’t click; report or delete it', 'Forward it to friends'],
        answer: 2,
      },
      {
        text: 'How do you send your resume file in Gmail?',
        options: ['Type the file name in the subject', 'Click the paperclip (Attach files) and choose the file', 'Write “resume attached” in the message', 'Put the file name in CC'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T6',
    slug: 'elevate-english-communication',
    title: 'English Communication Training',
    computerBased: false,
    oralAssessment: true,
    statements: [
      'Introduce myself and describe my skills and experience in English.',
      'Understand a customer’s request by phone and answer politely in English.',
      'Write a short, correct email in English.',
      'Answer common job interview questions in English.',
    ],
    questions: [
      {
        text: 'Which sentence is correct?',
        options: ['She don’t have any experience.', 'She doesn’t has any experience.', 'She not have any experience.', 'She doesn’t have any experience.'],
        answer: 3,
      },
      {
        text: 'A customer says, “I was charged twice.” Which reply is best?',
        options: ['“I’m sorry about that. Let me check your account for you.”', '“Please call again later.”', '“That’s not my fault.”', '“What do you want me to do?”'],
        answer: 0,
      },
    ],
  },
  {
    code: 'T7',
    slug: 'elevate-freelancing-101',
    title: 'Freelancing 101',
    computerBased: false,
    statements: [
      'Explain how freelancing differs from a regular job.',
      'List the services I could offer and set a price for them.',
      'Get paid safely (for example PayPal, GCash or a bank) and avoid job scams.',
    ],
    questions: [
      {
        text: 'A client offers you work but asks you to pay a fee before you start. This is most likely:',
        options: ['A normal hiring step', 'A scam', 'A training bonus', 'A tax requirement'],
        answer: 1,
      },
      {
        text: 'What is a freelancer’s portfolio?',
        options: ['Samples of your work that show clients what you can do', 'Your bank account', 'A list of client passwords', 'Your school ID'],
        answer: 0,
      },
    ],
  },
  {
    code: 'T8',
    slug: 'elevate-online-marketplace',
    title: 'Introduction to Online Marketplace',
    computerBased: false,
    statements: [
      'Name freelance marketplaces (for example Upwork, OnlineJobs.ph, Fiverr) and what each is for.',
      'Create a profile that shows my skills and samples of my work.',
      'Write a short proposal for a job post.',
    ],
    questions: [
      {
        text: 'Which of these is an online marketplace for freelance work?',
        options: ['Canva', 'Zoom', 'Google Sheets', 'Upwork'],
        answer: 3,
      },
      {
        text: 'Which proposal is most likely to win the job?',
        options: ['The same message sent to every post', 'One that answers the client’s needs and shows a related sample', 'One that only lists your price', 'One that asks the client to chat on another app first'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T9',
    slug: 'elevate-work-from-home-setup',
    title: 'Work from Home Basic Set up',
    computerBased: false,
    statements: [
      'Prepare a quiet work area with a working device and a headset.',
      'Test my internet speed and switch to a backup connection when it drops.',
      'Keep a daily work schedule at home and meet deadlines.',
    ],
    questions: [
      {
        text: 'Which pair matters most for a work-from-home voice or VA job?',
        options: ['A headset with a mic, and stable internet', 'A printer and a scanner', 'A gaming mouse and speakers', 'A second phone and a tablet'],
        answer: 0,
      },
      {
        text: 'Your home internet drops during work. What is the best backup?',
        options: ['Wait until it comes back', 'Log off for the day', 'Switch to mobile data or a pocket Wi-Fi and tell your client', 'Keep restarting the computer'],
        answer: 2,
      },
    ],
  },
  {
    code: 'T10',
    slug: 'elevate-wordpress',
    title: 'Basics of WordPress',
    computerBased: false,
    statements: [
      'Log in to a WordPress dashboard and create a page or post.',
      'Change the theme and add menus, pictures and plugins.',
      'Update and back up a WordPress site.',
    ],
    questions: [
      {
        text: 'In WordPress, what adds a new feature such as a contact form?',
        options: ['A theme', 'A post', 'A category', 'A plugin'],
        answer: 3,
      },
      {
        text: 'Which belongs on a WordPress Page rather than a Post?',
        options: ['“About Us”', 'Today’s news update', 'A weekly blog entry', 'A dated announcement'],
        answer: 0,
      },
    ],
  },
  {
    code: 'T11',
    slug: 'elevate-virtual-assistant',
    title: 'How to become a Virtual Assistant',
    computerBased: false,
    statements: [
      'Manage a client’s inbox and calendar (Gmail, Google Calendar).',
      'Track tasks in Trello or Asana and talk with clients on Slack.',
      'Research online and organize the results in a document or spreadsheet.',
    ],
    questions: [
      {
        text: 'Which tool would a VA use to track a client’s project tasks?',
        options: ['Paint', 'Calculator', 'Trello or Asana', 'Notepad'],
        answer: 2,
      },
      {
        text: 'A client abroad asks for a meeting at 9:00 AM their time. What do you do first?',
        options: ['Book 9:00 AM your time', 'Convert it to your time zone, then send a Google Calendar invite', 'Ask the client to call whenever they’re free', 'Skip the meeting'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T12',
    slug: 'elevate-digital-marketing-intro',
    title: 'Introduction to Digital Marketing & Entrepreneurship',
    computerBased: false,
    statements: [
      'Explain what digital marketing is and why businesses use it.',
      'Name jobs in digital marketing, such as social media manager or online seller.',
      'Describe a product or service of mine that could be sold online.',
    ],
    questions: [
      {
        text: 'Which of these is digital marketing?',
        options: ['Posting a product ad on a Facebook page', 'Taping flyers on poles', 'Announcing at a town fiesta', 'Painting a store sign'],
        answer: 0,
      },
      {
        text: 'What does a growth mindset mean?',
        options: ['Talent is fixed from birth', 'Skills grow with effort and practice', 'Avoid hard tasks', 'Only experts should try new things'],
        answer: 1,
      },
    ],
  },
  {
    code: 'T13',
    slug: 'elevate-core-digital-marketing',
    title: 'Core Digital Marketing Skills',
    computerBased: false,
    statements: [
      'Create Facebook or Instagram posts with a caption, photo and hashtags.',
      'Make a simple graphic (for example in Canva) or edit a short video.',
      'Set up or run an online store (for example on Shopify or Lazada).',
    ],
    questions: [
      {
        text: 'Which caption is strongest for selling?',
        options: ['“Hello.”', '“New product.”', '“Dried fish, ₱150 a pack. Message us to order; we deliver around Tuburan on Saturdays.”', '“Like and share.”'],
        answer: 2,
      },
      {
        text: 'What are Shopify and Lazada?',
        options: ['Video editing apps', 'Email services', 'Social media sites', 'E-commerce platforms for selling online'],
        answer: 3,
      },
    ],
  },
  {
    code: 'T14',
    slug: 'elevate-digital-business',
    title: 'Building a Digital Business',
    computerBased: false,
    statements: [
      'Describe my target customers and the problem my product solves.',
      'Write a simple business plan: product, price, costs and how I will sell.',
      'Create a brand for my business: name, logo and look.',
      'Plan how to promote the launch of an online business.',
    ],
    questions: [
      {
        text: 'What is a target market?',
        options: ['Everyone in the Philippines', 'The group of customers most likely to buy your product', 'Your competitors', 'Where you buy supplies'],
        answer: 1,
      },
      {
        text: 'You sold ₱5,000 of products and spent ₱3,200 on materials and delivery. What is your profit?',
        options: ['₱8,200', '₱3,200', '₱1,800', '₱5,000'],
        answer: 2,
      },
    ],
  },
];

const TOPIC_BY_SLUG = new Map(TOPICS.map((topic) => [topic.slug, topic]));
const slugsFor = (...codes) => codes.map((code) => TOPICS.find((topic) => topic.code === code).slug);

// A3: the learner's goal decides which topics are checked and recommended.
const TRACKS = {
  job: {
    label: 'Get hired for an office or BPO job',
    slugs: slugsFor('T1', 'T2', 'T3', 'T4', 'T5', 'T6'),
  },
  freelance: {
    label: 'Work from home as a freelancer or virtual assistant',
    slugs: slugsFor('T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'),
  },
  business: {
    label: 'Start or grow my own online business',
    slugs: slugsFor('T1', 'T4', 'T5', 'T12', 'T13', 'T14'),
  },
  undecided: {
    label: 'Not sure yet',
    slugs: slugsFor('T1', 'T2', 'T3', 'T4', 'T5', 'T6'),
  },
};

// A topic waits as "next up" until each prerequisite reaches 1.0 (Developing).
const PREREQUISITES = new Map([
  ['T2', ['T1']], ['T3', ['T1']], ['T4', ['T1']],
  ['T7', ['T5']], ['T9', ['T5']], ['T8', ['T5', 'T6']],
  ['T10', ['T1', 'T5']], ['T11', ['T2', 'T4', 'T5', 'T6']],
  ['T13', ['T12']], ['T14', ['T12']],
].map(([code, needs]) => [slugsFor(code)[0], slugsFor(...needs)]));

// Phases 2 and 3 reported scheduling conflicts and overload, so only a few
// topics are matched at once; the rest wait as next up.
const ACTIVE_TOPIC_LIMIT = 4;
const MAX_NOTES_LENGTH = 1000;

const BANDS = [
  { band: 'beginner', below: 1.0, proficiency: 'beginner', label: 'Beginner' },
  { band: 'developing', below: 2.0, proficiency: 'intermediate', label: 'Developing' },
  { band: 'proficient', below: 2.5, proficiency: 'advanced', label: 'Proficient' },
  { band: 'strong', below: Infinity, proficiency: 'expert', label: 'Strong' },
];

const PROFILE_OPTIONS = {
  sex: ['female', 'male', 'prefer_not_to_say'],
  workStatus: ['unemployed', 'employed', 'self_employed', 'student'],
};

function round2(value) {
  return Math.round(value * 100) / 100;
}

function bandFor(level) {
  return BANDS.find((entry) => level < entry.below);
}

// Topics the learner rates: all 14 in training-design order, minus topics
// missing from the database, minus computer topics when they have never used
// a computer (those start from the basics without being asked).
function topicsToCheck(usedComputer, availableSlugs) {
  return TOPICS
    .filter((topic) => availableSlugs.has(topic.slug))
    .filter((topic) => usedComputer || !topic.computerBased);
}

// The questionnaire as the learner sees it.
function publicQuestionnaire(topicRows) {
  const rowBySlug = new Map(topicRows.map((row) => [row.slug, row]));
  return {
    ratingScale: RATING_SCALE,
    tracks: Object.entries(TRACKS).map(([value, track]) => ({
      value,
      label: track.label,
      slugs: track.slugs.filter((slug) => rowBySlug.has(slug)),
    })),
    activeTopicLimit: ACTIVE_TOPIC_LIMIT,
    topics: TOPICS.filter((topic) => rowBySlug.has(topic.slug)).map((topic) => ({
      code: topic.code,
      slug: topic.slug,
      title: rowBySlug.get(topic.slug).title || topic.title,
      phase: rowBySlug.get(topic.slug).phase,
      computerBased: topic.computerBased,
      oralAssessment: Boolean(topic.oralAssessment),
      task: TASKS[topic.code],
    })),
  };
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateSubmission(body, availableSlugs) {
  const input = body || {};
  const profile = input.profile || {};
  if (!TRACKS[profile.goalTrack]) return { error: 'Choose your main goal for joining ELEVATE.' };
  if (typeof profile.usedComputer !== 'boolean') return { error: 'Tell us whether you have used a computer before.' };

  const phases = profile.phasesCompleted === undefined ? [] : profile.phasesCompleted;
  if (!Array.isArray(phases) || phases.some((phase) => !isIntInRange(phase, 1, 4))) {
    return { error: 'Choose the ELEVATE phases you finished from Phase 1 to Phase 4.' };
  }
  const sex = profile.sex || null;
  if (sex && !PROFILE_OPTIONS.sex.includes(sex)) return { error: 'Choose a valid option for sex.' };
  const workStatus = profile.workStatus || null;
  if (workStatus && !PROFILE_OPTIONS.workStatus.includes(workStatus)) return { error: 'Choose a valid work status.' };
  const age = profile.age === undefined || profile.age === null || profile.age === '' ? null : Number(profile.age);
  if (age !== null && !isIntInRange(age, 12, 100)) return { error: 'Enter an age from 12 to 100.' };

  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const cleanAnswers = {};
  for (const topic of topicsToCheck(profile.usedComputer, availableSlugs)) {
    const rating = answers[topic.slug]?.rating;
    if (!isIntInRange(rating, 0, RATING_SCALE.length - 1)) {
      return { error: `Answer every row, including “${TASKS[topic.code]}”.` };
    }
    cleanAnswers[topic.slug] = { rating };
  }

  // "Tell us more": free text the matched specialists can read.
  const notes = typeof profile.notes === 'string' ? profile.notes.trim() : '';
  if (notes.length > MAX_NOTES_LENGTH) return { error: `Keep “Tell us more” under ${MAX_NOTES_LENGTH} characters.` };

  return {
    value: {
      profile: {
        goalTrack: profile.goalTrack,
        usedComputer: profile.usedComputer,
        phasesCompleted: [...new Set(phases)].sort(),
        notes: notes || null,
        sex,
        age,
        workStatus,
      },
      answers: cleanAnswers,
    },
  };
}

function joinTitles(titles) {
  if (titles.length <= 1) return titles.join('');
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

// Level comes straight from the rating: Never 0, With help 1.0, On my own 2.0.
// Topics below 2.0 are learning topics. The goal track's topics take the
// active slots first; every other topic follows in training-design order.
function scoreSubmission({ profile, answers }, topicRows) {
  const rowBySlug = new Map(topicRows.map((row) => [row.slug, row]));
  const titleOf = (slug) => rowBySlug.get(slug)?.title || TOPIC_BY_SLUG.get(slug).title;
  const goalSlugs = TRACKS[profile.goalTrack].slugs.filter((slug) => rowBySlug.has(slug));
  const goalSet = new Set(goalSlugs);
  const orderedSlugs = [
    ...goalSlugs,
    ...TOPICS.map((topic) => topic.slug).filter((slug) => rowBySlug.has(slug) && !goalSet.has(slug)),
  ];

  const scored = orderedSlugs.map((slug) => {
    const answer = answers[slug];
    if (!answer) {
      return {
        slug, skipped: true, selfScore: null, checkCorrect: null, checkTotal: 0, level: 0, flagged: false, answers: null,
      };
    }
    return {
      slug,
      skipped: false,
      selfScore: answer.rating,
      checkCorrect: null,
      checkTotal: 0,
      level: LEVEL_FOR_RATING[answer.rating],
      flagged: false,
      answers: answer,
    };
  });

  const levelBySlug = new Map(scored.map((entry) => [entry.slug, entry.level]));
  let activeCount = 0;
  return scored.map((entry) => {
    const topic = TOPIC_BY_SLUG.get(entry.slug);
    const band = bandFor(entry.level);
    const onGoal = goalSet.has(entry.slug);
    let outcome;
    let reason;
    if (entry.level >= 2.0) {
      outcome = 'refresher';
      reason = 'You can already do this on your own. A refresher is optional.';
    } else {
      const unmet = (PREREQUISITES.get(entry.slug) || [])
        .filter((slug) => levelBySlug.has(slug) && levelBySlug.get(slug) < 1.0);
      if (unmet.length) {
        outcome = 'next_up';
        reason = `Starts once you can do ${joinTitles(unmet.map(titleOf))} with help.`;
      } else if (activeCount < ACTIVE_TOPIC_LIMIT) {
        outcome = 'active';
        activeCount += 1;
        reason = entry.skipped
          ? 'Starts from the basics because you haven’t used a computer yet.'
          : onGoal ? null : 'Added because it’s a skill you said you can’t do yet.';
      } else {
        outcome = 'next_up';
        reason = onGoal
          ? `Starts when you finish one of your current topics (up to ${ACTIVE_TOPIC_LIMIT} at a time).`
          : 'Comes after the topics for your main goal.';
      }
    }
    if (topic.oralAssessment && outcome !== 'refresher' && !entry.skipped) {
      reason = [reason, 'Your specialist will confirm your English level in a short spoken check.']
        .filter(Boolean).join(' ');
    }
    return {
      ...entry,
      code: topic.code,
      skillId: Number(rowBySlug.get(entry.slug).skill_id),
      title: titleOf(entry.slug),
      phase: rowBySlug.get(entry.slug).phase,
      onGoal,
      band: band.band,
      bandLabel: band.label,
      proficiency: band.proficiency,
      outcome,
      reason,
    };
  });
}

module.exports = {
  ACTIVE_TOPIC_LIMIT,
  PREREQUISITES,
  BANDS,
  TRACKS,
  publicQuestionnaire,
  validateSubmission,
  scoreSubmission,
};
