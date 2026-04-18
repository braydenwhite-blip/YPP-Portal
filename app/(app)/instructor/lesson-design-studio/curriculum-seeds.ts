// ============================================================
// Curriculum Seeds — 5 complete 8-week starter curricula
// Used by quick-start and starter scaffolds to seed curriculum shape
// when a new instructor picks their interest area.
// ============================================================

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

type AtHomeAssignmentType =
  | "REFLECTION_PROMPT"
  | "PRACTICE_TASK"
  | "QUIZ"
  | "PRE_READING";

export interface SeedActivity {
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string;
}

export interface SeedWeek {
  title: string;
  objective: string;
  teacherPrepNotes: string;
  activities: SeedActivity[];
  atHomeAssignment: {
    type: AtHomeAssignmentType;
    title: string;
    description: string;
  };
}

export interface SeedCurriculum {
  id: string;
  label: string;
  icon: string;
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  classDurationMin: number;
  weeks: SeedWeek[];
}

// ── Technology & Coding ──────────────────────────────────────

const techCurriculum: SeedCurriculum = {
  id: "seed-tech",
  label: "Technology & Coding",
  icon: "\u{1F4BB}",
  title: "Code Your Future",
  description: "An 8-week introduction to web development. Students learn HTML, CSS, and JavaScript fundamentals while building a personal website from scratch.",
  interestArea: "Technology",
  outcomes: [
    "Build a multi-page website using HTML and CSS",
    "Write basic JavaScript to add interactivity to web pages",
    "Debug code errors using browser developer tools",
    "Present a completed personal website project",
  ],
  classDurationMin: 60,
  weeks: [
    {
      title: "What Is Code?",
      objective: "Students can explain what code is and write their first line of HTML",
      teacherPrepNotes: "Set up computers with a code editor (VS Code recommended). Test that all machines can open a browser.",
      activities: [
        { title: "Tech Check-In", type: "WARM_UP", durationMin: 5, description: "Students share one app or website they used today and guess how it was built." },
        { title: "How the Web Works", type: "INSTRUCTION", durationMin: 15, description: "Visual walkthrough of how browsers, servers, and code connect. Show the 'View Source' feature on a real website." },
        { title: "My First HTML Page", type: "PRACTICE", durationMin: 20, description: "Students create an HTML file with a heading, paragraph, and image tag. They open it in a browser to see the result." },
        { title: "Code Gallery Walk", type: "DISCUSSION", durationMin: 10, description: "Students walk around and view each other's pages. Discuss: what worked? What surprised you?" },
        { title: "Reflection", type: "REFLECTION", durationMin: 10, description: "Write in journal: What does code actually DO? How did it feel to see your first page appear?" },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Websites I Admire", description: "Find 3 websites you think look great. For each one, write 2 sentences about what you like about the design." },
    },
    {
      title: "HTML Structure & Content",
      objective: "Students can structure a webpage with headings, lists, links, and images",
      teacherPrepNotes: "Prepare an HTML cheat sheet handout with common tags. Have a sample multi-section page ready to demo.",
      activities: [
        { title: "Tag Matching Game", type: "WARM_UP", durationMin: 8, description: "Matching game: students pair HTML opening tags with their closing tags on cards." },
        { title: "Page Structure Deep Dive", type: "INSTRUCTION", durationMin: 15, description: "Teach headings (h1-h6), paragraphs, lists (ul/ol/li), links (a href), and images. Show nesting." },
        { title: "Build an About Me Page", type: "PRACTICE", durationMin: 25, description: "Students build a structured About Me page with: a heading, bio paragraph, list of hobbies, a photo, and a link to a favorite site." },
        { title: "Peer Review", type: "GROUP_WORK", durationMin: 12, description: "Partners swap screens and give 2 compliments + 1 suggestion on each other's About Me pages." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Add Three More Sections", description: "Add sections for 'My Goals', 'My Favorite Music', and 'Contact Me' to your About Me page using headings, paragraphs, and lists." },
    },
    {
      title: "CSS: Making It Beautiful",
      objective: "Students can apply CSS styles to change colors, fonts, spacing, and layout of their HTML page",
      teacherPrepNotes: "Prepare a CSS properties reference sheet. Have a before/after demo showing plain HTML vs styled HTML.",
      activities: [
        { title: "Ugly vs. Pretty", type: "WARM_UP", durationMin: 5, description: "Show two versions of the same webpage — unstyled HTML vs styled. Students guess what made the difference." },
        { title: "CSS Fundamentals", type: "INSTRUCTION", durationMin: 15, description: "Teach selectors, properties, and values. Cover color, font-size, font-family, background, padding, margin, and border." },
        { title: "Style Your About Me", type: "PRACTICE", durationMin: 25, description: "Students create a CSS file and link it to their About Me page. Apply at least 8 different style rules." },
        { title: "Design Critique", type: "DISCUSSION", durationMin: 10, description: "Volunteers share their styled pages. Class discusses: what colors work well together? What's easy to read?" },
        { title: "Quick Quiz", type: "ASSESSMENT", durationMin: 5, description: "5-question quiz: match CSS properties to their effects (e.g., 'What property changes text color?')" },
      ],
      atHomeAssignment: { type: "PRE_READING", title: "CSS Color Exploration", description: "Visit coolors.co and create a 5-color palette you want to use for your website. Save the hex codes." },
    },
    {
      title: "Layout with CSS",
      objective: "Students can use flexbox to create multi-column layouts and navigation bars",
      teacherPrepNotes: "Have Flexbox Froggy (flexboxfroggy.com) bookmarked. Prepare a nav bar code example.",
      activities: [
        { title: "Flexbox Froggy", type: "WARM_UP", durationMin: 10, description: "Students play the first 10 levels of Flexbox Froggy to learn flex container basics." },
        { title: "Layout Patterns", type: "INSTRUCTION", durationMin: 12, description: "Teach display:flex, justify-content, align-items, flex-wrap, and gap. Show header/nav/main/footer layout." },
        { title: "Build a Navigation Bar", type: "PRACTICE", durationMin: 15, description: "Students add a horizontal navigation bar to their site with links to different sections. Style with flexbox." },
        { title: "Two-Column Layout", type: "PRACTICE", durationMin: 15, description: "Students create a two-column layout with a sidebar and main content area using flexbox." },
        { title: "Layout Show & Tell", type: "DISCUSSION", durationMin: 8, description: "3-4 volunteers demo their layouts. Discuss challenges and solutions." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Responsive Check", description: "Resize your browser window from wide to narrow. Write down 3 things that break or look weird. We'll fix them next class." },
    },
    {
      title: "JavaScript Basics",
      objective: "Students can use JavaScript variables, alerts, and DOM manipulation to make a page interactive",
      teacherPrepNotes: "Prepare a JS starter file template. Have the browser console demo ready.",
      activities: [
        { title: "Console Playground", type: "WARM_UP", durationMin: 8, description: "Students open browser console and type simple commands: alert(), console.log(), and basic math." },
        { title: "JavaScript Fundamentals", type: "INSTRUCTION", durationMin: 18, description: "Teach variables (let/const), strings, numbers, and document.getElementById(). Show how JS connects to HTML." },
        { title: "Click Counter", type: "PRACTICE", durationMin: 20, description: "Students build a button that counts clicks and displays the count on the page using JS event listeners." },
        { title: "Bug Hunt", type: "GROUP_WORK", durationMin: 14, description: "In pairs, students debug 3 broken JS code snippets. First pair to fix all 3 wins." },
      ],
      atHomeAssignment: { type: "QUIZ", title: "JavaScript Vocabulary", description: "Define these terms in your own words: variable, function, event listener, DOM, string, number." },
    },
    {
      title: "Interactive Features",
      objective: "Students can build interactive UI features using JavaScript event handling and DOM updates",
      teacherPrepNotes: "Prepare 3 mini-project starter files (dark mode toggle, image gallery, form validator).",
      activities: [
        { title: "Feature Brainstorm", type: "WARM_UP", durationMin: 5, description: "Students list 5 interactive features they've seen on websites (dropdowns, modals, sliders, etc.)." },
        { title: "Events & DOM Updates", type: "INSTRUCTION", durationMin: 12, description: "Teach addEventListener, classList.toggle, innerHTML, and style property changes through live coding." },
        { title: "Build Two Features", type: "PRACTICE", durationMin: 28, description: "Students choose 2 of 3 mini-projects: a dark mode toggle button, an image gallery with next/prev, or a form with validation." },
        { title: "Feature Demo", type: "DISCUSSION", durationMin: 10, description: "Volunteers demo their features. Class votes on the most creative implementation." },
        { title: "Exit Ticket", type: "REFLECTION", durationMin: 5, description: "Write: which feature was hardest? What would you add if you had more time?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Add It to Your Site", description: "Add at least one interactive JavaScript feature to your personal website project." },
    },
    {
      title: "Project Work: Personal Website",
      objective: "Students can plan, build, and refine a multi-page personal website using HTML, CSS, and JavaScript",
      teacherPrepNotes: "Prepare a project requirements checklist. Set up peer review pairs in advance.",
      activities: [
        { title: "Project Planning", type: "WARM_UP", durationMin: 8, description: "Students sketch a sitemap of their website pages and list the features they want to include." },
        { title: "Requirements Review", type: "INSTRUCTION", durationMin: 7, description: "Walk through the project checklist: at least 3 pages, consistent styling, navigation, 2+ JS features, responsive layout." },
        { title: "Build Session", type: "PRACTICE", durationMin: 30, description: "Focused work time. Students build their personal websites. Teacher circulates to help with bugs and design decisions." },
        { title: "Peer Code Review", type: "GROUP_WORK", durationMin: 15, description: "Partners review each other's code. Check the requirements checklist and give written feedback on 2 strengths and 2 improvements." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Final Polish", description: "Complete all remaining checklist items. Test your site in at least 2 browsers. Fix any visual bugs before the showcase." },
    },
    {
      title: "Website Showcase",
      objective: "Students can present their completed website and explain the technical decisions they made",
      teacherPrepNotes: "Set up presentation display (projector/TV). Prepare feedback forms for audience. Have certificates ready.",
      activities: [
        { title: "Presentation Prep", type: "WARM_UP", durationMin: 8, description: "Students prepare a 2-minute presentation: what their site is about, one feature they're proud of, one challenge they overcame." },
        { title: "Website Presentations", type: "ASSESSMENT", durationMin: 30, description: "Each student presents their website to the class. Audience fills out a feedback card with one compliment." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 10, description: "Written reflection: What did you learn about coding? What would you build next? How has your confidence with technology changed?" },
        { title: "Celebration", type: "DISCUSSION", durationMin: 12, description: "Certificate ceremony. Students share what they want to build next. Share resources for continued learning." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Letter to Future Coders", description: "Write a short letter to someone starting this class next session. What advice would you give them? What should they not be afraid of?" },
    },
  ],
};

// ── Music & Audio ────────────────────────────────────────────

const musicCurriculum: SeedCurriculum = {
  id: "seed-music",
  label: "Music & Audio",
  icon: "\u{1F3B5}",
  title: "Sound Studio",
  description: "An 8-week journey through music creation. Students explore rhythm, melody, songwriting, and digital production, culminating in recording and performing an original song.",
  interestArea: "Music",
  outcomes: [
    "Create and perform a basic rhythm pattern using body percussion and instruments",
    "Compose an original melody using a digital audio tool",
    "Write lyrics that express a personal story or message",
    "Record, mix, and present an original song or beat",
  ],
  classDurationMin: 60,
  weeks: [
    {
      title: "Rhythm & Beats",
      objective: "Students can identify and clap along to 4/4 time signatures and create a basic beat pattern",
      teacherPrepNotes: "Prepare a playlist of songs with strong, clear beats. Have rhythm cards and body percussion demos ready.",
      activities: [
        { title: "Name That Beat", type: "WARM_UP", durationMin: 8, description: "Play 5 song clips. Students clap along and try to identify the tempo (fast, medium, slow)." },
        { title: "Rhythm Fundamentals", type: "INSTRUCTION", durationMin: 15, description: "Teach 4/4 time, whole/half/quarter/eighth notes. Use visual rhythm cards and clapping exercises." },
        { title: "Body Percussion Circle", type: "PRACTICE", durationMin: 15, description: "Students form a circle and create layered body percussion patterns: snaps, claps, stomps, and pats." },
        { title: "Beat Builder", type: "GROUP_WORK", durationMin: 12, description: "In groups of 3-4, create a 16-beat rhythm pattern using classroom objects (pencils, desks, bottles)." },
        { title: "Rhythm Reflection", type: "REFLECTION", durationMin: 10, description: "Journal: What makes a beat 'feel good'? Why do some rhythms make you want to move?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Rhythm Hunting", description: "Record a 30-second video of a rhythm you find in everyday life (a washing machine, a clock, traffic). Describe the pattern." },
    },
    {
      title: "Melody Basics",
      objective: "Students can sing or play a simple 8-note melody and identify scale patterns",
      teacherPrepNotes: "Set up keyboards or a piano app on devices. Print out the C major scale diagram.",
      activities: [
        { title: "Melody Telephone", type: "WARM_UP", durationMin: 8, description: "One student hums a short melody, passes it around the circle. See how it changes by the end." },
        { title: "Scales and Intervals", type: "INSTRUCTION", durationMin: 15, description: "Introduce the C major scale. Teach steps vs. skips. Play examples of melodies that go up, down, and stay." },
        { title: "Compose a Melody", type: "PRACTICE", durationMin: 20, description: "Using keyboards or an app, students compose an 8-note melody in C major. Record it." },
        { title: "Melody Showcase", type: "DISCUSSION", durationMin: 10, description: "Volunteers play their melodies. Class describes each one: is it happy? Sad? Adventurous? Why?" },
        { title: "Quick Check", type: "ASSESSMENT", durationMin: 7, description: "Identify 5 intervals as 'step up', 'step down', or 'skip' from audio examples." },
      ],
      atHomeAssignment: { type: "PRE_READING", title: "Song Analysis", description: "Pick a favorite song. Listen to just the melody (hum along). Write down: does it mostly go up, down, or repeat? How many different notes do you hear?" },
    },
    {
      title: "Songwriting: Lyrics",
      objective: "Students can write a verse and chorus with a clear theme and rhyme scheme",
      teacherPrepNotes: "Bring printed lyrics from 3 popular songs (age-appropriate). Prepare rhyme scheme examples (ABAB, AABB).",
      activities: [
        { title: "Lyric Mad Libs", type: "WARM_UP", durationMin: 8, description: "Fill in blanks in a song lyric template with silly words. Discuss how word choice changes meaning and feel." },
        { title: "Songwriting Craft", type: "INSTRUCTION", durationMin: 15, description: "Analyze lyric structure: verse, chorus, bridge. Study rhyme schemes. Discuss storytelling in songs." },
        { title: "Write Your Verse & Chorus", type: "PRACTICE", durationMin: 22, description: "Students pick a personal theme and write one verse (4 lines) and one chorus (4 lines) with a rhyme scheme." },
        { title: "Sharing Circle", type: "DISCUSSION", durationMin: 15, description: "Students read their lyrics aloud (or have a partner read). Classmates share what images or feelings the words create." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Second Verse", description: "Write a second verse for your song. Try to build on the story from your first verse. Experiment with a metaphor or simile." },
    },
    {
      title: "Digital Audio Tools",
      objective: "Students can navigate a digital audio workstation and record a basic track",
      teacherPrepNotes: "Install BandLab or GarageBand on all devices. Prepare a 5-minute screen recording of the DAW interface walkthrough.",
      activities: [
        { title: "Sound Exploration", type: "WARM_UP", durationMin: 5, description: "Students close their eyes and listen to 60 seconds of layered sounds. List everything they hear." },
        { title: "DAW Walkthrough", type: "INSTRUCTION", durationMin: 18, description: "Tour the digital audio workstation: tracks, timeline, record button, loops library, and volume controls." },
        { title: "First Recording", type: "PRACTICE", durationMin: 22, description: "Students record themselves clapping a beat and speaking/singing their chorus. Learn to trim and loop." },
        { title: "Troubleshooting Circle", type: "GROUP_WORK", durationMin: 15, description: "Common problems station rotation: audio not recording, wrong input selected, track too quiet, file not saving." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Loop Library Exploration", description: "Browse the loop library in your DAW. Find 3 drum loops and 3 instrument loops you like. Note their names and BPM." },
    },
    {
      title: "Recording Techniques",
      objective: "Students can record clean vocals or instruments and apply basic effects",
      teacherPrepNotes: "Test all microphones/headphones. Set up quiet recording corners if possible. Prepare effects demo (reverb, EQ).",
      activities: [
        { title: "Good vs Bad Recording", type: "WARM_UP", durationMin: 5, description: "Play two recordings of the same voice: one with good mic technique, one with bad. Students identify differences." },
        { title: "Recording Best Practices", type: "INSTRUCTION", durationMin: 12, description: "Teach mic placement, room noise reduction, gain levels, and the importance of headphones while recording." },
        { title: "Record Your Song", type: "PRACTICE", durationMin: 28, description: "Students record their vocals (lyrics from Week 3) over a beat. Multiple takes encouraged — keep the best one." },
        { title: "Effects Exploration", type: "PRACTICE", durationMin: 10, description: "Apply reverb, EQ, and volume adjustments to their vocal track. Compare before and after." },
        { title: "Listening Party", type: "DISCUSSION", durationMin: 5, description: "Play 2-3 recordings. Discuss: what sounds professional? What could be improved?" },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Recording Reflection", description: "How did it feel to hear your voice recorded? What would you do differently next time? Write 5+ sentences." },
    },
    {
      title: "Mixing Basics",
      objective: "Students can balance volume levels, pan tracks, and create a rough mix of their song",
      teacherPrepNotes: "Prepare a multi-track project file for the mixing demo. Print a mixing checklist.",
      activities: [
        { title: "Volume Puzzle", type: "WARM_UP", durationMin: 5, description: "Play a deliberately bad mix (drums too loud, vocals buried). Students identify what's wrong." },
        { title: "The Art of Mixing", type: "INSTRUCTION", durationMin: 15, description: "Teach volume balancing, panning (left/right), and basic EQ. Demonstrate on a multi-track project." },
        { title: "Mix Your Song", type: "PRACTICE", durationMin: 25, description: "Students adjust levels on their song: balance drums, melody, and vocals. Apply panning and EQ." },
        { title: "A/B Listening", type: "GROUP_WORK", durationMin: 10, description: "Partners listen to each other's mixes on headphones. Give feedback using the mixing checklist." },
        { title: "Mix Check", type: "REFLECTION", durationMin: 5, description: "Listen to your mix one final time. Write down 2 things you're happy with and 1 thing to improve." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Final Mix Tweaks", description: "Listen to your mix on 2 different devices (phone speaker, headphones, computer). Note any differences and make adjustments." },
    },
    {
      title: "Original Song Project",
      objective: "Students can complete a full original song with lyrics, melody, beat, and a polished mix",
      teacherPrepNotes: "Reserve extended studio time. Have project completion checklist ready. Set up peer review rubric.",
      activities: [
        { title: "Project Status Check", type: "WARM_UP", durationMin: 5, description: "Students review the project checklist and identify what's left to complete." },
        { title: "Production Tips", type: "INSTRUCTION", durationMin: 10, description: "Quick tips: adding an intro/outro, using automation for volume swells, adding a bridge section." },
        { title: "Studio Session", type: "PRACTICE", durationMin: 30, description: "Focused work time to finish songs. Teacher circulates as a producer — helping with arrangements, re-recordings, and mix issues." },
        { title: "Peer Production Review", type: "GROUP_WORK", durationMin: 15, description: "Partners listen to each other's nearly-finished songs. Use the rubric to give structured feedback on lyrics, melody, production, and mix." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Final Polish", description: "Export your final mix as an MP3. Listen to it 3 times. Make any last adjustments. Prepare a 1-minute intro for your live performance." },
    },
    {
      title: "Live Performance & Showcase",
      objective: "Students can perform or present their original song and articulate their creative process",
      teacherPrepNotes: "Set up a performance area with speakers. Prepare feedback cards for the audience. Print certificates.",
      activities: [
        { title: "Performance Prep", type: "WARM_UP", durationMin: 8, description: "Students rehearse their song introduction. Practice: song title, what inspired it, one thing they learned making it." },
        { title: "Live Performances", type: "ASSESSMENT", durationMin: 30, description: "Each student performs or plays their song for the class. Can be live singing over the track or playing the recording with a spoken intro." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 12, description: "Written reflection: How has your relationship with music changed? What skills surprised you? What would you create next?" },
        { title: "Celebration", type: "DISCUSSION", durationMin: 10, description: "Certificate ceremony. Share a class playlist of everyone's songs. Discuss next steps for continuing music creation." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Artist Statement", description: "Write a 1-paragraph artist statement about your song: what it means to you, why you made the creative choices you did, and what you hope listeners feel." },
    },
  ],
};

// ── Entrepreneurship ─────────────────────────────────────────

const businessCurriculum: SeedCurriculum = {
  id: "seed-business",
  label: "Entrepreneurship",
  icon: "\u{1F680}",
  title: "Young Entrepreneurs Academy",
  description: "An 8-week program where students identify real problems, develop business solutions, and pitch their ideas. Culminates in a Shark Tank-style presentation.",
  interestArea: "Business",
  outcomes: [
    "Identify a real problem and design a viable product or service solution",
    "Conduct customer discovery interviews and analyze feedback",
    "Create a basic business model with revenue and cost projections",
    "Deliver a compelling 3-minute investor pitch with visual aids",
  ],
  classDurationMin: 60,
  weeks: [
    {
      title: "What Is Entrepreneurship?",
      objective: "Students can define entrepreneurship and identify the traits of successful entrepreneurs",
      teacherPrepNotes: "Prepare 3 short entrepreneur story clips (diverse founders). Print the Entrepreneur Trait cards.",
      activities: [
        { title: "Would You Buy This?", type: "WARM_UP", durationMin: 8, description: "Show 5 unusual real products. Students vote: would they buy it? Discuss why some ideas succeed." },
        { title: "Entrepreneur Mindset", type: "INSTRUCTION", durationMin: 15, description: "Define entrepreneurship. Share stories of young entrepreneurs. Discuss traits: creativity, resilience, empathy, problem-solving." },
        { title: "Problem Spotting", type: "GROUP_WORK", durationMin: 20, description: "In groups, brainstorm 10 problems they face daily (school, home, community). Rank them by how annoying they are." },
        { title: "Share Top Problems", type: "DISCUSSION", durationMin: 12, description: "Each group shares their top 3 problems. Class votes on which ones are most common and most solvable." },
        { title: "Exit Ticket", type: "REFLECTION", durationMin: 5, description: "Write: What problem in your life would you most want to solve? Why?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Problem Journal", description: "Keep a problem journal for 3 days. Write down every annoyance, frustration, or 'I wish...' moment. Bring at least 10 entries." },
    },
    {
      title: "Finding Problems Worth Solving",
      objective: "Students can evaluate problems by severity, frequency, and market size to select one worth pursuing",
      teacherPrepNotes: "Print Problem Evaluation Matrix worksheets. Prepare examples of 'vitamins vs painkillers' in business.",
      activities: [
        { title: "Problem Journal Share", type: "WARM_UP", durationMin: 8, description: "Students share their top 3 problem journal entries with a partner. Partners ask 'How often does this happen?'" },
        { title: "Evaluating Problems", type: "INSTRUCTION", durationMin: 15, description: "Teach the Problem Evaluation Matrix: severity, frequency, number of people affected, existing solutions. Vitamins vs. painkillers." },
        { title: "Score Your Problems", type: "PRACTICE", durationMin: 20, description: "Students score their top 5 problems on the matrix. Calculate totals to find their best opportunity." },
        { title: "Problem Pitch (60 seconds)", type: "DISCUSSION", durationMin: 12, description: "Each student gives a 60-second pitch explaining their chosen problem. Classmates ask clarifying questions." },
        { title: "Decision Lock-In", type: "REFLECTION", durationMin: 5, description: "Write your final problem statement: 'I want to solve [problem] for [who] because [why it matters].'" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Problem Research", description: "Research your chosen problem online. Find 3 existing solutions and write what they do well and what they miss." },
    },
    {
      title: "Customer Discovery",
      objective: "Students can design and conduct a customer discovery interview to validate their problem",
      teacherPrepNotes: "Prepare sample interview scripts. Arrange for students to interview each other or bring in 2-3 adult volunteers.",
      activities: [
        { title: "Assumption Check", type: "WARM_UP", durationMin: 5, description: "Students list 3 assumptions about their problem. 'I assume people feel X because Y.'" },
        { title: "Interview Techniques", type: "INSTRUCTION", durationMin: 15, description: "Teach open-ended questions, active listening, and the 'Mom Test' (how to get honest feedback). Practice bad vs. good questions." },
        { title: "Write Your Interview Script", type: "PRACTICE", durationMin: 12, description: "Students write 8-10 interview questions. Teacher reviews and gives feedback on question quality." },
        { title: "Practice Interviews", type: "GROUP_WORK", durationMin: 18, description: "Students interview 2-3 classmates using their scripts. Take notes on responses." },
        { title: "Pattern Finding", type: "DISCUSSION", durationMin: 10, description: "What patterns emerged? Did anyone hear something that surprised them or changed their thinking?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Real-World Interviews", description: "Interview 3 people outside of class about your problem. Record their answers. Look for patterns in what they say." },
    },
    {
      title: "Business Model Basics",
      objective: "Students can fill out a Business Model Canvas identifying their value proposition, customers, and revenue model",
      teacherPrepNotes: "Print Business Model Canvas templates (large format). Prepare 2 filled-out examples from real companies.",
      activities: [
        { title: "Revenue Brainstorm", type: "WARM_UP", durationMin: 5, description: "How does YouTube make money? How does a food truck? Students brainstorm revenue models for 3 businesses." },
        { title: "Business Model Canvas", type: "INSTRUCTION", durationMin: 18, description: "Walk through all 9 blocks of the Business Model Canvas with real examples. Focus on Value Proposition, Customer Segments, and Revenue Streams." },
        { title: "Build Your Canvas", type: "PRACTICE", durationMin: 22, description: "Students fill out their own Business Model Canvas for their business idea. Teacher circulates to help." },
        { title: "Canvas Gallery Walk", type: "GROUP_WORK", durationMin: 10, description: "Post canvases on walls. Students walk around, read others' canvases, and leave sticky note feedback." },
        { title: "Iterate", type: "REFLECTION", durationMin: 5, description: "Read the feedback on your canvas. Write 2 changes you'll make based on what others said." },
      ],
      atHomeAssignment: { type: "QUIZ", title: "Business Model Quiz", description: "Define these terms: value proposition, customer segment, revenue stream, cost structure, key partners. Give an example of each from a real company." },
    },
    {
      title: "Branding & Marketing",
      objective: "Students can create a brand identity (name, logo concept, tagline) and a basic marketing plan",
      teacherPrepNotes: "Bring examples of strong brand identities (Nike, Apple, local businesses). Have Canva accounts set up.",
      activities: [
        { title: "Logo Detective", type: "WARM_UP", durationMin: 5, description: "Show 10 logos with brand names removed. Students guess the brand. Discuss what makes logos memorable." },
        { title: "Brand Building", type: "INSTRUCTION", durationMin: 15, description: "Teach brand identity: name, logo, colors, tagline, voice. Show how branding creates trust and recognition." },
        { title: "Create Your Brand", type: "PRACTICE", durationMin: 25, description: "Students name their business, write a tagline, choose brand colors, and sketch a logo concept using Canva or paper." },
        { title: "Marketing Channels", type: "DISCUSSION", durationMin: 10, description: "Brainstorm: where do your target customers spend time? Which channels (social, flyers, word-of-mouth) would reach them?" },
        { title: "Elevator Pitch Draft", type: "REFLECTION", durationMin: 5, description: "Write a 30-second elevator pitch: who you help, what problem you solve, and why your solution is unique." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Social Media Mock-Up", description: "Create 3 mock social media posts for your business. Include an image, caption, and hashtags. Use Canva or paper." },
    },
    {
      title: "Financial Basics",
      objective: "Students can create a simple profit/loss projection and price their product or service",
      teacherPrepNotes: "Prepare pricing worksheets and a simple spreadsheet template. Have calculator apps ready.",
      activities: [
        { title: "Price Is Right", type: "WARM_UP", durationMin: 8, description: "Students guess the price of 5 real products/services. Discuss: what makes something worth more or less?" },
        { title: "Costs & Pricing", type: "INSTRUCTION", durationMin: 15, description: "Teach fixed vs variable costs, markup, and break-even analysis. Walk through a pricing example." },
        { title: "Price Your Product", type: "PRACTICE", durationMin: 20, description: "Students list all costs, set a price, and calculate how many sales they need to break even. Create a simple monthly projection." },
        { title: "Investor Questions", type: "GROUP_WORK", durationMin: 12, description: "Partners play 'investor' and ask tough money questions: How much do you need to start? When do you profit? What if sales are slow?" },
        { title: "Numbers Check", type: "REFLECTION", durationMin: 5, description: "Do your numbers make sense? Write one thing that surprised you about the financial side of your business." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Startup Budget", description: "Create a list of everything you'd need to spend money on to launch your business. Total it up. How would you fund it?" },
    },
    {
      title: "Pitch Deck Creation",
      objective: "Students can build a compelling 6-slide pitch deck that tells their business story",
      teacherPrepNotes: "Prepare a pitch deck template (Google Slides). Show 2 example pitch decks (one good, one bad).",
      activities: [
        { title: "Good Pitch vs Bad Pitch", type: "WARM_UP", durationMin: 8, description: "Watch 2 short pitch clips. Students identify what makes one compelling and the other boring." },
        { title: "Pitch Deck Structure", type: "INSTRUCTION", durationMin: 12, description: "Teach the 6-slide format: Problem, Solution, Market, Business Model, Team, Ask. Show design tips." },
        { title: "Build Your Deck", type: "PRACTICE", durationMin: 25, description: "Students create their pitch deck using the template. Focus on clear visuals, minimal text, and storytelling." },
        { title: "Practice Pitches", type: "GROUP_WORK", durationMin: 15, description: "In groups of 3, each student delivers their pitch. Group gives feedback on clarity, confidence, and persuasiveness." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Pitch Rehearsal", description: "Practice your pitch 5 times at home (time yourself — aim for 3 minutes). Record one attempt and watch it back. Note 2 things to improve." },
    },
    {
      title: "Shark Tank Presentations",
      objective: "Students can deliver a polished 3-minute pitch and respond to audience questions confidently",
      teacherPrepNotes: "Invite 2-3 guest 'sharks' (teachers, parents, local business owners). Set up presentation area. Print judge scorecards.",
      activities: [
        { title: "Final Prep", type: "WARM_UP", durationMin: 8, description: "Last-minute pitch rehearsal. Students pair up for one final run-through with timer." },
        { title: "Shark Tank Pitches", type: "ASSESSMENT", durationMin: 32, description: "Each student delivers their 3-minute pitch to the panel of 'sharks'. Sharks ask 2 questions. Audience fills out peer feedback cards." },
        { title: "Awards & Reflection", type: "REFLECTION", durationMin: 10, description: "Shark panel deliberates and awards 'Most Innovative', 'Best Pitch', and 'Most Likely to Succeed'. Students write final reflections." },
        { title: "Celebration & Next Steps", type: "DISCUSSION", durationMin: 10, description: "Certificate ceremony. Discuss how to actually launch (YPP resources, mentorship opportunities, next steps)." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Entrepreneur Reflection", description: "Write a 1-page reflection: What did you learn about yourself as an entrepreneur? Would you actually pursue this business? Why or why not? What's your next big idea?" },
    },
  ],
};

// ── Visual Arts & Design ─────────────────────────────────────

const artCurriculum: SeedCurriculum = {
  id: "seed-art",
  label: "Visual Arts & Design",
  icon: "\u{1F3A8}",
  title: "Design Lab",
  description: "An 8-week exploration of visual design principles. Students learn elements of design, color theory, typography, and digital tools while building a professional portfolio.",
  interestArea: "Art & Design",
  outcomes: [
    "Apply the elements and principles of design to create balanced compositions",
    "Use color theory to create effective and appealing color schemes",
    "Design a logo, poster, or flyer using digital design tools",
    "Assemble and present a design portfolio showcasing original work",
  ],
  classDurationMin: 60,
  weeks: [
    {
      title: "Elements of Design",
      objective: "Students can identify and use the 7 elements of design (line, shape, form, color, value, texture, space)",
      teacherPrepNotes: "Print element identification worksheets. Collect 10 design examples (ads, posters, packaging) for analysis.",
      activities: [
        { title: "Design Detective", type: "WARM_UP", durationMin: 8, description: "Students examine 3 real-world designs (posters, logos, packaging) and list every visual element they notice." },
        { title: "The 7 Elements", type: "INSTRUCTION", durationMin: 15, description: "Teach line, shape, form, color, value, texture, and space with visual examples. Show how each creates meaning." },
        { title: "Element Sketches", type: "PRACTICE", durationMin: 22, description: "Students create 7 small sketches, each emphasizing one design element. Use pencils, markers, and paper." },
        { title: "Gallery Walk & Critique", type: "DISCUSSION", durationMin: 10, description: "Post sketches. Students walk around and place a sticky dot on the sketch that best represents each element." },
        { title: "Reflection", type: "REFLECTION", durationMin: 5, description: "Which element was easiest for you? Which was hardest? Why?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Element Photo Hunt", description: "Take 7 photos, each showcasing a different element of design found in the real world (a textured wall, a colorful sign, etc.)." },
    },
    {
      title: "Color Theory",
      objective: "Students can create harmonious color palettes using the color wheel and explain color psychology",
      teacherPrepNotes: "Have color wheel printouts and paint chips. Set up coolors.co on devices.",
      activities: [
        { title: "Color Mood Board", type: "WARM_UP", durationMin: 8, description: "Show 5 images using different color schemes. Students write one word describing the mood each creates." },
        { title: "Color Theory Deep Dive", type: "INSTRUCTION", durationMin: 15, description: "Teach primary/secondary/tertiary colors, complementary, analogous, and triadic harmonies. Discuss color psychology in branding." },
        { title: "Palette Creation", type: "PRACTICE", durationMin: 22, description: "Students create 3 color palettes: one warm, one cool, one complementary. Use coolors.co or paint mixing." },
        { title: "Brand Color Analysis", type: "GROUP_WORK", durationMin: 10, description: "Groups analyze 3 famous brands' color choices. Why did McDonald's choose red and yellow? Why is Facebook blue?" },
        { title: "Color Quiz", type: "ASSESSMENT", durationMin: 5, description: "Quick quiz: identify color harmonies, name complements, and match moods to palettes." },
      ],
      atHomeAssignment: { type: "PRE_READING", title: "Color in Culture", description: "Research how one color (your choice) means different things in different cultures. Write a paragraph with at least 3 examples." },
    },
    {
      title: "Typography",
      objective: "Students can choose appropriate typefaces, create visual hierarchy, and pair fonts effectively",
      teacherPrepNotes: "Print font pairing examples. Have Google Fonts and Canva ready on devices.",
      activities: [
        { title: "Font Feelings", type: "WARM_UP", durationMin: 5, description: "Show the word 'DANGER' in 5 different fonts. Students rank which ones actually feel dangerous and explain why." },
        { title: "Typography Rules", type: "INSTRUCTION", durationMin: 15, description: "Teach serif vs sans-serif, font pairing rules, visual hierarchy (size, weight, color), and readability basics." },
        { title: "Type Poster", type: "PRACTICE", durationMin: 25, description: "Students design a typographic poster using only text (no images). Must demonstrate hierarchy, font pairing, and at least 3 type sizes." },
        { title: "Critique Circle", type: "DISCUSSION", durationMin: 10, description: "Small groups share posters. Discuss: Is the hierarchy clear? Do the fonts work together? Is it readable?" },
        { title: "Exit Ticket", type: "REFLECTION", durationMin: 5, description: "Name 2 fonts you'd use for a children's birthday party invitation vs. a law firm's website. Why?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Font Pairing Challenge", description: "Using Google Fonts, find 3 font pairs that work well together. Screenshot them and write why each pair works." },
    },
    {
      title: "Digital Tools Introduction",
      objective: "Students can navigate Canva or Figma to create basic digital designs with layers and alignment",
      teacherPrepNotes: "Set up Canva accounts for all students. Prepare a tool walkthrough video as backup.",
      activities: [
        { title: "Tool Tour", type: "WARM_UP", durationMin: 5, description: "Students open Canva and spend 3 minutes exploring the interface. Find 5 features and write them down." },
        { title: "Digital Design Basics", type: "INSTRUCTION", durationMin: 18, description: "Walk through: canvas setup, adding shapes/text/images, layers, alignment, grouping, and export options." },
        { title: "Recreate a Design", type: "PRACTICE", durationMin: 22, description: "Students recreate a provided simple design (a business card) using Canva. Must match colors, fonts, and layout." },
        { title: "Free Design Time", type: "PRACTICE", durationMin: 10, description: "Create anything you want in Canva for 10 minutes. Explore templates, elements, and effects." },
        { title: "Show & Tell", type: "DISCUSSION", durationMin: 5, description: "3 volunteers share what they created during free time. Quick class applause." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Social Media Template", description: "Design an Instagram post template in Canva for a fictional brand. Include a photo placeholder, brand name, and tagline." },
    },
    {
      title: "Logo Design Project",
      objective: "Students can design a professional logo through the process of sketching, iteration, and digital refinement",
      teacherPrepNotes: "Print logo design process handout. Have tracing paper for sketching iterations.",
      activities: [
        { title: "Logo Evolution", type: "WARM_UP", durationMin: 8, description: "Show how 3 famous logos evolved over decades (Apple, Pepsi, Instagram). Discuss: what stayed the same? What changed?" },
        { title: "Logo Design Process", type: "INSTRUCTION", durationMin: 10, description: "Teach the 5-step process: brief, research, sketch, refine, digitize. Show wordmarks, icons, and combination marks." },
        { title: "Sketch 20 Ideas", type: "PRACTICE", durationMin: 15, description: "Students sketch 20 quick logo concepts for a brand of their choice (real or fictional). Speed over perfection." },
        { title: "Select & Refine", type: "PRACTICE", durationMin: 17, description: "Choose the top 3 sketches. Refine them on clean paper. Then digitize the best one in Canva." },
        { title: "Peer Feedback", type: "GROUP_WORK", durationMin: 10, description: "Partners compare digital logos. Give feedback on: is it recognizable at small sizes? Does it fit the brand?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Logo Variations", description: "Create 3 variations of your logo: one in full color, one in black and white, and one simplified icon version." },
    },
    {
      title: "Poster & Flyer Design",
      objective: "Students can design a visually compelling poster that communicates a clear message using design principles",
      teacherPrepNotes: "Collect 5 excellent event posters as inspiration. Prepare a poster requirements checklist.",
      activities: [
        { title: "Poster Ranking", type: "WARM_UP", durationMin: 5, description: "Show 5 event posters. Students rank them from most to least effective and explain their top pick." },
        { title: "Poster Design Principles", type: "INSTRUCTION", durationMin: 12, description: "Teach visual hierarchy for posters: focal point, information priority, white space, and call-to-action placement." },
        { title: "Design Your Poster", type: "PRACTICE", durationMin: 28, description: "Students design an event poster for a real or fictional event. Must include: event name, date/time, location, visual, and call-to-action." },
        { title: "Print-Ready Review", type: "GROUP_WORK", durationMin: 10, description: "Partners check each other's posters against the checklist. Is text readable? Are colors accessible? Is the CTA clear?" },
        { title: "Revision Plan", type: "REFLECTION", durationMin: 5, description: "Based on feedback, list 3 specific changes you'll make to improve your poster." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Poster Revision", description: "Apply the feedback from class. Create a final version of your poster. Export as PNG and PDF." },
    },
    {
      title: "Portfolio Assembly",
      objective: "Students can curate and present their best work in a cohesive design portfolio",
      teacherPrepNotes: "Prepare portfolio layout templates. Show 2 example student portfolios from past sessions.",
      activities: [
        { title: "Work Inventory", type: "WARM_UP", durationMin: 8, description: "Students list all the design work they've created in weeks 1-6. Star their top 5 pieces." },
        { title: "Portfolio Curation", type: "INSTRUCTION", durationMin: 12, description: "Teach portfolio best practices: quality over quantity, consistent presentation, project descriptions, and showing process (sketches → final)." },
        { title: "Build Your Portfolio", type: "PRACTICE", durationMin: 25, description: "Students assemble a 5-8 page digital portfolio in Canva. Include: cover page, about section, and 4-6 project pages with descriptions." },
        { title: "Portfolio Review", type: "GROUP_WORK", durationMin: 10, description: "Small groups share portfolios. Feedback on: flow, consistency, strongest piece, and what to cut." },
        { title: "Final Adjustments", type: "REFLECTION", durationMin: 5, description: "Note the top 3 changes to make before the showcase. What story does your portfolio tell?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Portfolio Polish", description: "Finalize your portfolio. Add captions to every project explaining what you learned. Prepare a 2-minute presentation." },
    },
    {
      title: "Design Gallery Showcase",
      objective: "Students can present their portfolio and articulate design decisions using professional vocabulary",
      teacherPrepNotes: "Set up gallery-style display (screens or printed). Prepare feedback cards and certificates.",
      activities: [
        { title: "Presentation Prep", type: "WARM_UP", durationMin: 8, description: "Students practice their 2-minute portfolio presentation with a partner. Focus on: what you made, why, and what you learned." },
        { title: "Gallery Presentations", type: "ASSESSMENT", durationMin: 30, description: "Each student presents their portfolio. Audience asks one question about a design decision. Feedback cards collected." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 12, description: "Written reflection: How has your eye for design changed? What principles will you use in everyday life? What would you design next?" },
        { title: "Celebration", type: "DISCUSSION", durationMin: 10, description: "Award categories: Best Typography, Most Creative Logo, Most Improved, People's Choice. Certificate ceremony." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Design Manifesto", description: "Write your personal design manifesto: 5 principles you believe make great design. Explain each one in 2-3 sentences." },
    },
  ],
};

// ── Health & Wellness ────────────────────────────────────────

const healthCurriculum: SeedCurriculum = {
  id: "seed-health",
  label: "Health & Wellness",
  icon: "\u{1F3C3}",
  title: "Mind & Body Wellness",
  description: "An 8-week program exploring physical health, mental wellness, nutrition, and healthy habits. Students develop a personalized wellness plan and present their transformation journey.",
  interestArea: "Health & Wellness",
  outcomes: [
    "Design a balanced weekly meal plan based on nutritional guidelines",
    "Demonstrate 3 stress management techniques and explain when to use each",
    "Set and track measurable wellness goals using the SMART framework",
    "Create and present a personal wellness plan addressing physical, mental, and social health",
  ],
  classDurationMin: 60,
  weeks: [
    {
      title: "What Is Wellness?",
      objective: "Students can define the 5 dimensions of wellness and self-assess their current well-being",
      teacherPrepNotes: "Print Wellness Wheel worksheets. Prepare a calming playlist for background music during reflection.",
      activities: [
        { title: "Wellness Word Cloud", type: "WARM_UP", durationMin: 5, description: "Students write 3 words they associate with 'being healthy.' Compile on the board. Discuss patterns." },
        { title: "5 Dimensions of Wellness", type: "INSTRUCTION", durationMin: 15, description: "Teach physical, mental, emotional, social, and intellectual wellness. Show how they interconnect." },
        { title: "My Wellness Wheel", type: "PRACTICE", durationMin: 20, description: "Students fill out a Wellness Wheel, rating each dimension 1-10. Identify their strongest and weakest areas." },
        { title: "Partner Share", type: "DISCUSSION", durationMin: 10, description: "Partners share their Wellness Wheels (only what they're comfortable with). Discuss: what surprised you about your scores?" },
        { title: "Goal Seed", type: "REFLECTION", durationMin: 10, description: "Write: which dimension do you most want to improve? What would that look like in your daily life?" },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Wellness Journal Start", description: "For 3 days, track your sleep, water intake, physical activity, and mood (1-10). Notice any patterns between them." },
    },
    {
      title: "Nutrition Basics",
      objective: "Students can identify macronutrients, read a nutrition label, and plan one balanced meal",
      teacherPrepNotes: "Bring 5 food packages with nutrition labels. Print MyPlate diagrams.",
      activities: [
        { title: "Myth or Fact?", type: "WARM_UP", durationMin: 8, description: "Read 8 nutrition statements (e.g., 'Eating fat makes you fat'). Students hold up TRUE or FALSE cards. Reveal answers." },
        { title: "Macronutrients & MyPlate", type: "INSTRUCTION", durationMin: 15, description: "Teach carbs, proteins, fats, vitamins, minerals, and water. Explain the MyPlate model and portion guidance." },
        { title: "Label Reading Challenge", type: "PRACTICE", durationMin: 15, description: "Students examine real nutrition labels. Answer questions: How many servings? What's the sugar content? Is this a healthy choice?" },
        { title: "Meal Design", type: "GROUP_WORK", durationMin: 12, description: "In pairs, design one balanced meal using the MyPlate model. Draw it on a paper plate and label the macronutrients." },
        { title: "Meal Gallery", type: "DISCUSSION", durationMin: 10, description: "Post meals on the wall. Walk around and vote on 'most balanced' and 'I'd actually eat this.'" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Food Diary", description: "Track everything you eat for 2 days. Categorize each item as carb, protein, fat, or veggie. How balanced are your meals?" },
    },
    {
      title: "Physical Fitness",
      objective: "Students can perform a basic fitness assessment and design a 20-minute workout routine",
      teacherPrepNotes: "Clear space for movement. Prepare fitness assessment cards (push-ups, sit-ups, flexibility). Have timers ready.",
      activities: [
        { title: "Energy Check-In", type: "WARM_UP", durationMin: 5, description: "Rate your energy 1-10 right now. We'll check again after activity. Stand up and do 30 seconds of jumping jacks." },
        { title: "Fitness Components", type: "INSTRUCTION", durationMin: 12, description: "Teach the 5 components: cardiovascular endurance, muscular strength, flexibility, muscular endurance, and body composition." },
        { title: "Fitness Baseline Test", type: "PRACTICE", durationMin: 15, description: "Students complete a simple fitness assessment: 1 min wall sit, max push-ups, sit-and-reach flexibility, resting heart rate." },
        { title: "Design a Workout", type: "GROUP_WORK", durationMin: 18, description: "In groups, create a 20-minute workout that covers all 5 components. Include warm-up, exercises, and cool-down." },
        { title: "Energy Re-Check", type: "REFLECTION", durationMin: 10, description: "Re-rate your energy. How do you feel compared to the start? Write: what type of exercise do you enjoy most and why?" },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Try Your Workout", description: "Do the group workout at home once. Time yourself and write down how it felt. Would you change anything?" },
    },
    {
      title: "Mental Health Awareness",
      objective: "Students can identify signs of common mental health challenges and name 3 coping strategies",
      teacherPrepNotes: "Review sensitive topic guidelines. Have school counselor contact info ready. Prepare anonymous question box.",
      activities: [
        { title: "Feelings Check-In", type: "WARM_UP", durationMin: 5, description: "Students pick an emoji card that represents how they feel today. No need to explain — just acknowledge." },
        { title: "Understanding Mental Health", type: "INSTRUCTION", durationMin: 18, description: "Discuss mental health spectrum (everyone has mental health). Cover stress, anxiety, and depression basics. Emphasize: asking for help is strength." },
        { title: "Coping Strategy Stations", type: "PRACTICE", durationMin: 20, description: "4 stations (3 min each): deep breathing, progressive muscle relaxation, gratitude journaling, and guided visualization." },
        { title: "Support Systems", type: "DISCUSSION", durationMin: 12, description: "Discuss: who can you talk to when you're struggling? Create a personal 'support map' — 5 people or resources you trust." },
        { title: "Anonymous Q&A", type: "REFLECTION", durationMin: 5, description: "Students write anonymous questions about mental health. Teacher collects and will address them next week (with counselor if needed)." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Self-Care Inventory", description: "List 10 things that help you feel better when you're stressed or sad. Circle the 3 you do most often. Star 2 new ones to try this week." },
    },
    {
      title: "Stress Management",
      objective: "Students can identify their personal stress triggers and apply at least 3 stress reduction techniques",
      teacherPrepNotes: "Set up calm environment (dim lights if possible). Prepare stress ball materials. Have guided meditation audio ready.",
      activities: [
        { title: "Stress Scale", type: "WARM_UP", durationMin: 5, description: "On a 1-10 scale, rate your stress level right now. We'll check again at the end of class." },
        { title: "Stress Science", type: "INSTRUCTION", durationMin: 12, description: "How stress affects the body (cortisol, fight-or-flight). Good stress vs chronic stress. Why stress management is a skill." },
        { title: "Technique Practice", type: "PRACTICE", durationMin: 20, description: "Practice 4 techniques (5 min each): box breathing, 5-4-3-2-1 grounding, body scan meditation, and mindful walking." },
        { title: "Stress Trigger Map", type: "GROUP_WORK", durationMin: 13, description: "Students map their personal stress triggers (school, social, family, future). Match each trigger with a technique that might help." },
        { title: "Re-Check", type: "REFLECTION", durationMin: 10, description: "Rate stress again. Which technique worked best for you? Commit to trying it once daily this week." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "Daily Calm Challenge", description: "Practice one stress technique every day for 5 days. Record which one, when you did it, and how you felt before and after." },
    },
    {
      title: "Healthy Relationships",
      objective: "Students can distinguish between healthy and unhealthy relationship patterns and practice assertive communication",
      teacherPrepNotes: "Prepare scenario cards for role-plays. Print communication style quiz.",
      activities: [
        { title: "Relationship Spectrum", type: "WARM_UP", durationMin: 8, description: "Read relationship scenarios. Students place them on a spectrum from 'healthy' to 'unhealthy'. Discuss disagreements." },
        { title: "Communication Styles", type: "INSTRUCTION", durationMin: 12, description: "Teach passive, aggressive, passive-aggressive, and assertive communication. Model each with the same scenario." },
        { title: "Role-Play Practice", type: "PRACTICE", durationMin: 18, description: "In pairs, practice responding assertively to 4 common scenarios: peer pressure, disagreements, boundary-setting, and asking for help." },
        { title: "Boundary Brainstorm", type: "DISCUSSION", durationMin: 12, description: "What are healthy boundaries? Students share examples of boundaries they've set or want to set. Discuss why boundaries help relationships." },
        { title: "Communication Style Quiz", type: "ASSESSMENT", durationMin: 10, description: "Self-assessment quiz: what's your default communication style? Read results and reflect on what to work on." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Relationship Reflection", description: "Think about your most important relationship (friend, family). Write 3 things that make it healthy and 1 area you'd like to improve. How could assertive communication help?" },
    },
    {
      title: "Goal Setting & Habits",
      objective: "Students can set SMART wellness goals and design a habit-building system with triggers and rewards",
      teacherPrepNotes: "Print SMART goal worksheets. Prepare habit loop diagram (cue → routine → reward).",
      activities: [
        { title: "Habit Audit", type: "WARM_UP", durationMin: 8, description: "Students list 5 daily habits (brushing teeth, scrolling phone, etc.). Circle which ones support wellness and which don't." },
        { title: "SMART Goals & Habit Loops", type: "INSTRUCTION", durationMin: 15, description: "Teach SMART framework (Specific, Measurable, Achievable, Relevant, Time-bound). Explain the habit loop: cue, routine, reward." },
        { title: "Set 3 SMART Goals", type: "PRACTICE", durationMin: 20, description: "Students write 3 SMART wellness goals (one physical, one mental, one social). Design habit loops for each: what's the cue? The reward?" },
        { title: "Accountability Partners", type: "GROUP_WORK", durationMin: 12, description: "Partners share goals and make an accountability plan. Schedule weekly check-ins. Discuss how to support without nagging." },
        { title: "Commitment Card", type: "REFLECTION", durationMin: 5, description: "Write your #1 goal on a commitment card. Sign it. We'll revisit at the showcase." },
      ],
      atHomeAssignment: { type: "PRACTICE_TASK", title: "7-Day Goal Tracker", description: "Track your #1 SMART goal for 7 days. Check off each day you complete the habit. Write a short note about how it went." },
    },
    {
      title: "Wellness Plan Showcase",
      objective: "Students can present a comprehensive personal wellness plan and reflect on their growth over 8 weeks",
      teacherPrepNotes: "Set up presentation stations. Print before/after Wellness Wheels. Prepare certificates.",
      activities: [
        { title: "Before & After Wellness Wheel", type: "WARM_UP", durationMin: 10, description: "Students fill out a new Wellness Wheel and compare with Week 1. Highlight areas of growth." },
        { title: "Wellness Plan Presentations", type: "ASSESSMENT", durationMin: 28, description: "Each student presents their personal wellness plan: goals, strategies, habit systems, and progress so far. 2-3 minutes each." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 12, description: "Written reflection: What surprised you most about wellness? What habit will you keep forever? How do you feel compared to Week 1?" },
        { title: "Celebration & Commitment", type: "DISCUSSION", durationMin: 10, description: "Certificate ceremony. Students share their commitment cards from Week 7. Class creates a collective wellness pledge." },
      ],
      atHomeAssignment: { type: "REFLECTION_PROMPT", title: "Letter to Your Future Self", description: "Write a letter to yourself 6 months from now. Remind yourself of your wellness goals, what you learned, and why it matters. Seal it in an envelope with a 'do not open until [date]' note." },
    },
  ],
};

// ── Export ────────────────────────────────────────────────────

export const SEED_CURRICULA: SeedCurriculum[] = [
  techCurriculum,
  musicCurriculum,
  businessCurriculum,
  artCurriculum,
  healthCurriculum,
];
