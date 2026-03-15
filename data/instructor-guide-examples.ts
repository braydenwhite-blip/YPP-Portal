/**
 * Full annotated examples of excellent Passion Labs, Sequences, and Competitions.
 * Each example includes every field filled in + an annotation explaining WHY it was written that way.
 */

// ─────────────────────────────────────────────────────
// PASSION LAB EXAMPLES
// ─────────────────────────────────────────────────────

export type AnnotatedField = {
  value: string;
  annotation: string; // explains why this field was filled this way
};

export type PassionLabExample = {
  title: string;
  overview: string;
  fields: {
    name: AnnotatedField;
    interestArea: AnnotatedField;
    drivingQuestion: AnnotatedField;
    targetAgeGroup: AnnotatedField;
    difficulty: AnnotatedField;
    deliveryMode: AnnotatedField;
    finalShowcase: AnnotatedField;
    submissionFormat: AnnotatedField;
  };
  blueprint: {
    bigIdea: AnnotatedField;
    studentChoicePlan: AnnotatedField;
    mentorCommunityConnection: AnnotatedField;
    showcaseCriteria: AnnotatedField;
    supportPlan: AnnotatedField;
    riskSafetyNotes: AnnotatedField;
    resourcePlan: AnnotatedField;
  };
  sessions: {
    topic: string;
    objective: string;
    checkpointArtifact: string;
    annotation: string;
  }[];
};

export const passionLabExamples: PassionLabExample[] = [
  {
    title: "Urban Photography Lab",
    overview:
      "A 6-session lab where students use smartphone photography to tell visual stories about their communities. Students explore composition, editing, and narrative photography, culminating in a digital portfolio presented at a virtual gallery night. This example shows how to build a lab around a real-world skill that connects to students' identities and neighborhoods.",
    fields: {
      name: {
        value: "Urban Photography Lab",
        annotation:
          "The name is specific (not just 'Photography'), signals the focus (urban/community), and uses 'Lab' to set expectations that this is hands-on and exploratory.",
      },
      interestArea: {
        value: "Arts",
        annotation:
          "Photography falls under Arts. Choosing the right passion area ensures students browsing 'Arts' will discover this lab.",
      },
      drivingQuestion: {
        value:
          "How can photography tell the story of our neighborhood in a way that makes people see it differently?",
        annotation:
          "This question is open-ended (many possible answers), connected to students' lives (their neighborhood), and implies a purpose beyond the skill (changing how people see things). It gives the lab meaning.",
      },
      targetAgeGroup: {
        value: "12-16",
        annotation:
          "This age range can handle going out to photograph independently (with safety guidelines) and can engage with concepts like narrative and perspective.",
      },
      difficulty: {
        value: "BEGINNER",
        annotation:
          "No prior photography experience needed — smartphones are the tool, not expensive cameras. This makes the lab accessible to everyone.",
      },
      deliveryMode: {
        value: "HYBRID",
        annotation:
          "Mini-lessons and critiques happen virtually. Photo shoots happen in-person in students' own neighborhoods. Hybrid lets us do both.",
      },
      finalShowcase: {
        value:
          "Students curate a 10-photo digital portfolio with captions telling the story of a place in their community, presented at a virtual gallery night.",
        annotation:
          "The showcase is specific (10 photos, captions, gallery night), creative (curating, not just submitting), and has a real audience (gallery night). This gives students something to work toward from day one.",
      },
      submissionFormat: {
        value: "Digital portfolio (Google Slides or PDF) with 10 captioned photos and a 1-minute recorded artist statement",
        annotation:
          "Very specific so students know exactly what 'done' looks like. The artist statement adds reflection and communication skills to the technical work.",
      },
    },
    blueprint: {
      bigIdea: {
        value:
          "Every neighborhood has untold stories. Photography can make the invisible visible and give communities a voice.",
        annotation:
          "The big idea connects the technical skill (photography) to something that matters (community voice, visibility). This gives students a reason to care beyond 'learning to take photos.'",
      },
      studentChoicePlan: {
        value:
          "Students choose their own subject/location for their photo series, select their editing style, decide how to arrange their portfolio narrative, and pick which photos to include in the final showcase.",
        annotation:
          "Four clear choice points. Students aren't just following instructions — they're making creative decisions at every stage. This is what makes it a Passion Lab, not a class.",
      },
      mentorCommunityConnection: {
        value:
          "Partner with a local photographer from the community arts center for a guest critique session in Week 4. Final portfolios displayed in the community center lobby for one month.",
        annotation:
          "Real professional feedback (not just instructor) + a real public display. This makes the work feel authentic and gives students a genuine audience.",
      },
      showcaseCriteria: {
        value:
          "Strong portfolio: 10 photos with clear narrative thread, thoughtful captions that add context (not just descriptions), evidence of composition techniques learned, and a 1-minute artist statement that explains your creative vision.",
        annotation:
          "Criteria are specific but leave room for creativity. They focus on quality of thinking (narrative, thoughtful captions, creative vision) not just technical execution.",
      },
      supportPlan: {
        value:
          "Weekly 1-on-1 check-ins during build time. Peer photo critique pairs assigned in Week 2. 'Stuck?' office hours on Wednesdays. Simplified portfolio option (5 photos) for students who need it.",
        annotation:
          "Multiple support structures: instructor check-ins, peer support, office hours, AND a reduced-scope option. This ensures no student falls through the cracks.",
      },
      riskSafetyNotes: {
        value:
          "Students photograph in pairs for safety when outside. No photos of people without written consent (forms provided). All editing software is free to avoid cost barriers. Students keep location details private in public-facing portfolios.",
        annotation:
          "Covers physical safety (pairs), consent (forms), financial access (free tools), and digital safety (privacy). Proactive planning prevents problems.",
      },
      resourcePlan: {
        value:
          "Smartphones (students use their own or borrow school devices), Snapseed app (free), Google Slides for portfolio, printed consent forms, rule-of-thirds reference cards, shared Google Photos album for peer review.",
        annotation:
          "Everything is free or provided. No barriers to participation. Includes both digital tools and physical materials.",
      },
    },
    sessions: [
      {
        topic: "Seeing Like a Photographer: Observation Walk",
        objective:
          "Students will practice mindful observation and take 20+ photos of their immediate surroundings using 'fresh eyes.'",
        checkpointArtifact: "20 unedited photos uploaded to shared album + 3 favorites with captions explaining 'why this caught my eye'",
        annotation:
          "Session 1 starts with doing, not lecturing. Students immediately start photographing. Low stakes — just explore and observe. Sets the tone for a hands-on lab.",
      },
      {
        topic: "Composition & Framing: The Rule of Thirds",
        objective:
          "Students will apply the rule of thirds to compose intentional photos and compare them to unframed shots.",
        checkpointArtifact: "5 photos demonstrating rule-of-thirds composition, with before/after comparisons",
        annotation:
          "Session 2 introduces the first technical concept. Before/after comparisons help students see the difference a technique makes — it's not abstract, it's visual.",
      },
      {
        topic: "Light, Shadow & Mood",
        objective:
          "Students will experiment with natural lighting to create different moods in their photos.",
        checkpointArtifact: "A series of 4 photos of the same subject at different times/angles of light, with mood descriptions",
        annotation:
          "Builds on composition (Session 2) by adding another layer. The 'same subject, different light' exercise isolates the variable so students can see the effect clearly.",
      },
      {
        topic: "Telling a Story: Photo Narrative & Sequencing",
        objective:
          "Students will arrange photos into a sequence that tells a story about a place, and write captions that add context.",
        checkpointArtifact: "A 5-photo sequence with captions telling a mini-story about one location",
        annotation:
          "This session shifts from individual photos to narrative — the core of the final portfolio. Caption writing integrates literacy skills naturally.",
      },
      {
        topic: "Editing & Style: Finding Your Voice",
        objective:
          "Students will use Snapseed to edit photos and develop a consistent personal editing style for their portfolio.",
        checkpointArtifact: "3 photos edited in a consistent style with a written 'style statement' (2-3 sentences on their editing choices)",
        annotation:
          "Students learn editing AND develop their own aesthetic. The style statement builds metacognitive skills — they have to articulate their choices.",
      },
      {
        topic: "Portfolio Assembly & Gallery Night Prep",
        objective:
          "Students will curate their final portfolio, write their artist statement, and prepare for the gallery night presentation.",
        checkpointArtifact: "Complete portfolio (10 photos, captions, artist statement) ready for gallery night",
        annotation:
          "Final session is about polish, curation, and preparation — not rushing to finish. Students have been building toward this all along, so this session is about choosing their best work and presenting it well.",
      },
    ],
  },
  {
    title: "Community App Design Lab",
    overview:
      "An 8-session lab where students identify a real problem in their community and design a mobile app concept to address it. No coding required — students use wireframing tools and design thinking. This example shows how to build a Passion Lab around problem-solving and design thinking rather than a technical skill.",
    fields: {
      name: {
        value: "Community App Design Lab",
        annotation:
          "Clear about what students will do (design an app) and for whom (their community). The word 'Design' signals that this is about thinking and creating, not coding.",
      },
      interestArea: {
        value: "STEM",
        annotation:
          "App design bridges technology and creative problem-solving, fitting well under STEM while also attracting students who might not think of themselves as 'tech people.'",
      },
      drivingQuestion: {
        value:
          "What problems in our community could a well-designed app help solve, and how do we design something people would actually want to use?",
        annotation:
          "Two-part question: identifies a real problem AND requires thinking about real users. Keeps the lab grounded in empathy and practicality, not just cool technology.",
      },
      targetAgeGroup: {
        value: "14-18",
        annotation:
          "Older teens can engage with abstract design thinking, conduct user research, and create more sophisticated wireframes.",
      },
      difficulty: {
        value: "BEGINNER",
        annotation:
          "No coding or design experience needed. The lab teaches design thinking from scratch using accessible tools (Figma free tier, pen and paper).",
      },
      deliveryMode: {
        value: "VIRTUAL",
        annotation:
          "Wireframing tools are all digital. Virtual delivery works well for screen-sharing design work and collaborative review sessions.",
      },
      finalShowcase: {
        value:
          "Students present a complete app concept: problem statement, user research findings, wireframes (5+ screens), and a 3-minute pitch video to a panel of local entrepreneurs.",
        annotation:
          "The showcase goes beyond just showing wireframes — it's a full pitch. The panel of real entrepreneurs gives students an authentic, intimidating-in-a-good-way audience.",
      },
      submissionFormat: {
        value: "Figma prototype link + pitch deck (5 slides) + 3-minute recorded pitch video",
        annotation:
          "Three deliverables that mirror real startup pitches. Students practice multiple skills: visual design, storytelling, and presentation.",
      },
    },
    blueprint: {
      bigIdea: {
        value:
          "Technology is most powerful when it solves real problems for real people. Students can be designers and problem-solvers right now, not someday.",
        annotation:
          "The big idea frames students as capable now — not just learning skills for the future. It connects technology to purpose.",
      },
      studentChoicePlan: {
        value:
          "Students identify their own community problem to solve, choose their target users, decide on features, and make all design decisions. The lab provides the process; students provide the vision.",
        annotation:
          "Maximum student agency. The instructor teaches design thinking methodology; students apply it to their own chosen problem. This ensures every project is unique and personally meaningful.",
      },
      mentorCommunityConnection: {
        value:
          "Local UX designer guest session in Week 4 (portfolio review). Final pitches judged by 3 local entrepreneurs/nonprofit leaders who could actually use student-designed apps.",
        annotation:
          "Two touchpoints with real professionals: one for feedback during the process, one for the final pitch. The judges are people who might actually benefit from the apps, making it feel real.",
      },
      showcaseCriteria: {
        value:
          "Strong project: clearly defined problem from actual user research (not assumptions), logical user flow, clean wireframes with consistent design language, and a compelling pitch that explains both the problem and solution.",
        annotation:
          "Criteria emphasize the thinking process (user research, logical flow) as much as the visual output. This prevents students from making 'cool-looking' apps that don't actually solve a problem.",
      },
      supportPlan: {
        value:
          "Design thinking checkpoints at each phase (empathize, define, ideate, prototype, test). Weekly peer design reviews. 'Figma Help Desk' — 15 minutes at the start of each session for tool-specific questions. Simplified option: paper wireframes instead of Figma for students who prefer analog.",
        annotation:
          "Multiple layers: process checkpoints, peer support, dedicated tool help, AND an analog option for students who are struggling with the digital tool.",
      },
      riskSafetyNotes: {
        value:
          "User research interviews must follow ethical guidelines (provided template). Students don't share personal info of interviewees. All tools are free-tier. Students may encounter sensitive community issues — instructor provides guidance on respectful problem-framing.",
        annotation:
          "Addresses ethical research practices, privacy, cost access, and emotional sensitivity. User research with real people requires thoughtful guardrails.",
      },
      resourcePlan: {
        value:
          "Figma (free tier), Google Slides for pitch decks, user interview template (provided), Loom (free) for recording pitches, pen and paper for sketching, design thinking process poster (PDF).",
        annotation:
          "All free. Includes both digital and analog options. Templates reduce friction so students spend time designing, not figuring out logistics.",
      },
    },
    sessions: [
      {
        topic: "Design Thinking: Empathize & Observe",
        objective: "Students will identify 3 community problems through observation, interviews, and personal experience.",
        checkpointArtifact: "Problem journal with 3 identified problems, each with 2+ observations or interview notes",
        annotation: "Start with empathy, not technology. Students look outward before designing anything.",
      },
      {
        topic: "Define: Picking Your Problem & Target User",
        objective: "Students will narrow to one problem, define their target user, and write a problem statement.",
        checkpointArtifact: "1-page problem brief: problem statement, target user persona, and 'How might we...' question",
        annotation: "Forces students to commit to one problem and think specifically about who they're designing for.",
      },
      {
        topic: "Ideate: Brainstorming Solutions",
        objective: "Students will generate 10+ solution ideas and select the most promising one to develop.",
        checkpointArtifact: "Brainstorm sheet (10+ ideas) + selected concept with 3-sentence rationale",
        annotation: "Quantity before quality — the '10+ ideas' requirement pushes past obvious first answers.",
      },
      {
        topic: "Paper Prototyping: Sketch Your App",
        objective: "Students will sketch paper wireframes for 5+ app screens showing the core user flow.",
        checkpointArtifact: "5+ paper wireframe screens with arrows showing user flow",
        annotation: "Paper first, digital later. Low-fidelity sketching is faster and more experimental.",
      },
      {
        topic: "User Testing: Get Feedback",
        objective: "Students will test their paper prototype with 2 peers and identify 3 improvements.",
        checkpointArtifact: "User testing notes: 3 pieces of feedback received + planned changes",
        annotation: "Real user feedback before building the digital version. Students learn that first designs always need iteration.",
      },
      {
        topic: "Figma Fundamentals: Going Digital",
        objective: "Students will recreate their paper wireframes as digital screens in Figma.",
        checkpointArtifact: "3+ digital wireframe screens in Figma matching their paper prototype",
        annotation: "Now they learn the tool — with a clear purpose (digitize their tested design). Tool learning is motivated, not abstract.",
      },
      {
        topic: "Polish & Prototype: Making It Click",
        objective: "Students will connect their Figma screens into a clickable prototype and refine visual design.",
        checkpointArtifact: "Clickable Figma prototype with 5+ connected screens and consistent styling",
        annotation: "Adding interactivity makes the app feel real. Visual consistency teaches design systems thinking.",
      },
      {
        topic: "Pitch Prep & Showcase",
        objective: "Students will create their pitch deck, record their video, and present to the entrepreneur panel.",
        checkpointArtifact: "Final deliverables: Figma link, pitch deck, and 3-minute video submitted",
        annotation: "Final session brings it all together. The pitch format forces students to articulate their thinking clearly.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────
// SEQUENCE EXAMPLES
// ─────────────────────────────────────────────────────

export type SequenceExample = {
  title: string;
  overview: string;
  blueprint: {
    targetLearner: AnnotatedField;
    entryPoint: AnnotatedField;
    endGoalCapstone: AnnotatedField;
    pacingGuidance: AnnotatedField;
    supportCheckpoints: AnnotatedField;
    completionSignals: AnnotatedField;
  };
  steps: {
    title: string;
    type: "Class" | "Passion Lab" | "Standalone";
    purpose: string;
    prerequisites: string;
    estimatedDuration: string;
    annotation: string;
  }[];
  dagDiagram: string; // ASCII diagram of the branching structure
};

export const sequenceExamples: SequenceExample[] = [
  {
    title: "From Beats to Albums: Music Production Pathway",
    overview:
      "A 4-step pathway that takes students from making their first beat to producing a complete 3-track EP. This example shows a linear sequence with manual unlock gates — each step requires instructor verification before advancing.",
    blueprint: {
      targetLearner: {
        value:
          "A student who loves listening to music and wants to learn how to make their own. No prior production experience needed — just curiosity and a willingness to experiment.",
        annotation:
          "Welcoming, low-barrier description. Targets motivation ('loves listening to music') rather than existing skills.",
      },
      entryPoint: {
        value:
          "No prerequisites. Students should have access to a computer or tablet. Helpful but not required: basic familiarity with any music app.",
        annotation:
          "Explicitly states no prerequisites to remove anxiety. Mentions the helpful-but-not-required skill so prepared students feel validated.",
      },
      endGoalCapstone: {
        value:
          "A 3-track EP produced, mixed, and published to a private SoundCloud playlist. Students present their EP at a listening party showcase with artist commentary.",
        annotation:
          "Concrete, impressive, shareable. A private SoundCloud is a real published artifact. The listening party adds a live presentation component.",
      },
      pacingGuidance: {
        value:
          "Recommended pace: one step every 2-3 weeks. Students can move faster if they demonstrate checkpoint evidence early. Total pathway: 8-12 weeks.",
        annotation:
          "Flexible pacing with a recommended range. Allows fast students to accelerate without leaving slower students behind.",
      },
      supportCheckpoints: {
        value:
          "After Step 1: instructor listens to first beat before advancing. After Step 3: peer review session before final production. Between any steps: students can request a check-in.",
        annotation:
          "Specific check-in points tied to concrete artifacts. The 'request a check-in' option empowers students to ask for help proactively.",
      },
      completionSignals: {
        value:
          "Student has: (1) produced 3 original tracks, (2) received and incorporated peer feedback, (3) presented EP at showcase or submitted final portfolio, (4) written a 1-paragraph artist statement.",
        annotation:
          "Four clear signals — not just 'finished all steps.' Includes both creative output and reflection.",
      },
    },
    steps: [
      {
        title: "Beat Basics: Your First Loop",
        type: "Class",
        purpose: "Learn the fundamentals of digital music production — tempo, rhythm, loops, and basic mixing.",
        prerequisites: "None (entry point)",
        estimatedDuration: "2-3 sessions (4-6 hours)",
        annotation:
          "First step has no prerequisites. Focuses on one tangible output (a beat loop) to build confidence immediately.",
      },
      {
        title: "Arranging: From Loop to Song",
        type: "Class",
        purpose: "Learn to structure a complete song with intro, verses, chorus, and transitions.",
        prerequisites: "Beat Basics (Step 1)",
        estimatedDuration: "2-3 sessions (4-6 hours)",
        annotation:
          "Builds directly on Step 1 — students take their beat and turn it into a full song structure. Clear dependency.",
      },
      {
        title: "Mixing & Sound Design Lab",
        type: "Passion Lab",
        purpose: "Explore advanced mixing techniques, effects, and sound design through experimentation.",
        prerequisites: "Arranging (Step 2)",
        estimatedDuration: "3-4 sessions (6-8 hours)",
        annotation:
          "This step is a Passion Lab (not a Class) because it's more exploratory — students experiment with sound design based on their interests. More student choice here.",
      },
      {
        title: "EP Production & Showcase",
        type: "Standalone",
        purpose: "Produce, finalize, and present a 3-track EP. Write artist statement and prepare for listening party.",
        prerequisites: "Mixing & Sound Design Lab (Step 3)",
        estimatedDuration: "2-3 sessions (4-6 hours)",
        annotation:
          "Standalone capstone milestone. No new instruction — students apply everything they've learned to create their final product.",
      },
    ],
    dagDiagram: `
    [Beat Basics] → [Arranging] → [Mixing Lab] → [EP & Showcase]
         (1)           (2)           (3)              (4)

    Linear pathway — each step requires the previous one.
    All unlocks are MANUAL (instructor verifies before advancing).
    `,
  },
  {
    title: "Entrepreneurship Bootcamp: Idea to Launch",
    overview:
      "A branching pathway where students start with a shared foundation, then choose a business track (Product, Service, or Social Enterprise), and converge on a shared capstone pitch. This example demonstrates DAG branching — students take parallel paths based on their interests.",
    blueprint: {
      targetLearner: {
        value:
          "A student who has a business idea (or wants to find one) and wants to learn how to turn it into something real. Curious about money, marketing, or making things people want.",
        annotation:
          "Broad enough to attract different types of entrepreneurial students (product-minded, service-oriented, social impact), while being specific about motivation.",
      },
      entryPoint: {
        value: "No business experience needed. Students should be comfortable with basic math and enjoy thinking about problems and solutions.",
        annotation: "Low barrier but honest about what the work involves (math, problem-solving).",
      },
      endGoalCapstone: {
        value:
          "A complete business plan and 5-minute pitch presentation delivered to a panel of local business owners. Students will have validated their idea through real customer conversations.",
        annotation:
          "Real-world validation (customer conversations) + professional presentation (pitch to actual business owners). The capstone proves students didn't just plan — they tested.",
      },
      pacingGuidance: {
        value:
          "Foundation: 2 weeks. Track: 3-4 weeks. Capstone: 2 weeks. Total: 7-8 weeks. Students in different tracks work in parallel — coordinate track sessions so all students finish around the same time.",
        annotation:
          "Practical scheduling guidance for the instructor managing multiple parallel tracks. Timing alignment is critical for the shared capstone.",
      },
      supportCheckpoints: {
        value:
          "After Foundation: instructor reviews business idea selection before students choose their track. Mid-track: peer feedback on business model canvas. Pre-capstone: dry-run pitch practice with mentor feedback.",
        annotation:
          "Three checkpoints at natural transition points. The idea review before track selection is crucial — prevents students from choosing the wrong track.",
      },
      completionSignals: {
        value:
          "Student has: (1) completed foundation + one full track, (2) validated idea with 3+ customer conversations, (3) delivered final pitch to panel, (4) received and responded to panel feedback.",
        annotation:
          "Completion requires both doing the work and engaging with feedback. The customer conversations ensure real-world engagement.",
      },
    },
    steps: [
      {
        title: "Entrepreneurship Foundation: Find Your Idea",
        type: "Class",
        purpose: "Learn entrepreneurship basics, explore business types, and identify a viable business idea.",
        prerequisites: "None (entry point)",
        estimatedDuration: "2 weeks (4 sessions)",
        annotation:
          "Shared foundation ensures all students have the same base knowledge before branching. Students identify their idea AND their track here.",
      },
      {
        title: "Product Track: Build & Sell a Physical/Digital Product",
        type: "Class",
        purpose: "Learn product development, manufacturing/production basics, pricing, and e-commerce.",
        prerequisites: "Entrepreneurship Foundation (Step 1)",
        estimatedDuration: "3-4 weeks (6-8 sessions)",
        annotation:
          "One of three parallel tracks. Students who want to build and sell a product (physical or digital) choose this path.",
      },
      {
        title: "Service Track: Design & Launch a Service Business",
        type: "Class",
        purpose: "Learn service design, client acquisition, pricing services, and operations management.",
        prerequisites: "Entrepreneurship Foundation (Step 1)",
        estimatedDuration: "3-4 weeks (6-8 sessions)",
        annotation:
          "Parallel track for students whose idea is a service (tutoring, design, event planning, etc.). Different skills than product track.",
      },
      {
        title: "Social Enterprise Track: Impact-Driven Business",
        type: "Passion Lab",
        purpose: "Explore social entrepreneurship, impact measurement, fundraising, and community partnerships.",
        prerequisites: "Entrepreneurship Foundation (Step 1)",
        estimatedDuration: "3-4 weeks (6-8 sessions)",
        annotation:
          "This track is a Passion Lab because social enterprise requires more exploration and community connection. More open-ended than the other tracks.",
      },
      {
        title: "Capstone: Business Plan & Pitch Day",
        type: "Standalone",
        purpose: "Finalize business plan, practice pitch, and present to entrepreneur panel.",
        prerequisites: "ANY ONE of: Product Track, Service Track, OR Social Enterprise Track",
        estimatedDuration: "2 weeks (3-4 sessions)",
        annotation:
          "Converging capstone — requires completion of exactly one track (not all three). All students come back together for shared pitch day.",
      },
    ],
    dagDiagram: `
                    ┌─→ [Product Track] ──────┐
                    │         (2)              │
    [Foundation] ──┼─→ [Service Track] ──────┼─→ [Capstone Pitch]
        (1)         │         (3)              │        (5)
                    └─→ [Social Enterprise] ──┘
                              (4)

    Branching pathway — after Foundation, students choose ONE of three tracks.
    All three tracks lead to the same Capstone.
    Capstone requires ANY ONE prerequisite (not all three).
    `,
  },
];

// ─────────────────────────────────────────────────────
// COMPETITION EXAMPLES
// ─────────────────────────────────────────────────────

export type CompetitionExample = {
  title: string;
  overview: string;
  fields: {
    season: AnnotatedField;
    theme: AnnotatedField;
    passionArea: AnnotatedField;
    rules: AnnotatedField;
  };
  planningBlueprint: {
    challengeBrief: AnnotatedField;
    idealParticipant: AnnotatedField;
    submissionPackage: AnnotatedField;
    milestoneTimeline: AnnotatedField;
    supportResources: AnnotatedField;
    reviewProcess: AnnotatedField;
    celebrationPlan: AnnotatedField;
    promotionPlan: AnnotatedField;
  };
  judgingCriteria: {
    name: string;
    weight: number;
    description: string;
    annotation: string;
  }[];
  prepTimeline: {
    week: string;
    milestone: string;
    type: string;
    annotation: string;
  }[];
};

export const competitionExamples: CompetitionExample[] = [
  {
    title: "Spring Design Challenge: Reimagining Public Spaces",
    overview:
      "A 4-week design competition where students propose redesigns of real public spaces in their communities. Open to all passion areas — encourages cross-discipline entries (architecture + art, tech + service, etc.). This example shows how to structure a competition with a strong prep timeline and balanced judging.",
    fields: {
      season: {
        value: "Spring 2026",
        annotation: "Clear season naming that matches the school calendar.",
      },
      theme: {
        value: "Reimagining Public Spaces",
        annotation:
          "Specific enough to focus (public spaces, not just 'design anything'), open enough for diverse interpretations (architecture, art installations, tech solutions, community gardens).",
      },
      passionArea: {
        value: "",
        annotation:
          "Left open intentionally. A public space redesign could involve arts, STEM, service, business — cross-discipline entries are welcome.",
      },
      rules: {
        value:
          "Open to all YPP students ages 12-18. One entry per student (individual only — no teams for this competition). Entries must be original work created during the 4-week competition period. Students may use any tools: hand-drawn, digital design, 3D modeling, collage, video. AI tools may be used as research assistants, but the core design work must be the student's own creation. All submissions must include a written explanation of the design choices.",
        annotation:
          "Comprehensive rules that answer likely questions: age range, team vs individual, originality requirements, tool permissions, AI policy, and submission requirements. The AI policy is modern and balanced.",
      },
    },
    planningBlueprint: {
      challengeBrief: {
        value:
          "Look around your community. There are spaces we share — parks, bus stops, school hallways, empty lots, community centers — that could be better. Your challenge: choose one real public space and redesign it to make it more useful, beautiful, accessible, or joyful for the people who use it. You're not just imagining — you're proposing a real change that could actually happen.",
        annotation:
          "Starts with observation (look around), grounds it in reality (real spaces), and raises the stakes (could actually happen). The brief makes students feel like designers, not students doing homework.",
      },
      idealParticipant: {
        value:
          "Any student who notices things that could be better and likes thinking about solutions. No design experience needed — we provide tools and templates. Great for students interested in architecture, art, urban planning, community service, or just making things look and work better.",
        annotation:
          "Very welcoming — frames the competition as accessible to anyone who 'notices things.' Lists specific interests to help students self-identify.",
      },
      submissionPackage: {
        value:
          "Submit all three: (1) Visual redesign — a mockup, model, drawing, or video walkthrough of your proposed space (any format). (2) Written explanation (300-500 words) — what problem you're solving, who benefits, and why your design works. (3) Before & after — a photo of the current space alongside your redesign.",
        annotation:
          "Three clear deliverables. The before/after requirement is clever — it forces students to ground their redesign in reality, not fantasy.",
      },
      milestoneTimeline: {
        value:
          "Week 1: Explore & Choose — visit 3+ public spaces, document with photos/notes, select your project space. Week 2: Research & Sketch — research the space's history and users, sketch 3 different redesign concepts. Week 3: Build Your Proposal — develop your chosen concept into a complete visual redesign with written explanation. Week 4: Polish & Submit — refine, get peer feedback, finalize all three submission components.",
        annotation:
          "Four weeks, four phases, each with a clear deliverable. The progression from explore → research → build → polish prevents last-minute rushing.",
      },
      supportResources: {
        value:
          "Canva design templates (free), Tinkercad for 3D modeling (free), past winner examples gallery, 'Design Thinking 101' video tutorial, weekly drop-in office hours (Tuesdays 4pm), peer feedback circles in Week 3, a printable 'Design Brief' worksheet to guide the process.",
        annotation:
          "Comprehensive free resources covering tools, examples, tutorials, live support, peer support, and worksheets. No student should feel unsupported.",
      },
      reviewProcess: {
        value:
          "Entries scored by 3 judges (local architect, YPP instructor, community leader) on 4 criteria: Creativity, Feasibility, Community Impact, and Presentation Quality. Top 5 finalists advance to community vote. Final score: 70% judges + 30% community vote. All participants receive written feedback from at least one judge.",
        annotation:
          "Transparent process with diverse judges (professional, educator, community member). The written feedback for all participants ensures everyone gets value, not just winners.",
      },
      celebrationPlan: {
        value:
          "Virtual showcase night: all finalists present live to community audience. Winners announced with certificates and prizes. All participants receive 'Community Designer' badge and XP. Top 3 entries featured on YPP social media and website. Winning design proposal sent to local city council as a real suggestion.",
        annotation:
          "Multiple layers of celebration: live event, badges for all, social media features, AND the winning design goes to city council — making it real.",
      },
      promotionPlan: {
        value:
          "Announce in all classes Week 1 of competition period. Dashboard banner with countdown timer. Email blast with full challenge brief. Weekly Instagram posts: teaser images of interesting public spaces. Reminder emails at 2 weeks and 3 days before deadline. Instructor shout-outs in classes.",
        annotation:
          "Multi-channel promotion with escalating urgency. The Instagram teasers build curiosity over time. Instructor mentions add personal encouragement.",
      },
    },
    judgingCriteria: [
      {
        name: "Creativity & Originality",
        weight: 30,
        description: "Does the redesign show original thinking? Does it go beyond the obvious? Does it surprise or delight?",
        annotation:
          "Highest weight because this is a creative competition. The description defines what 'creative' means in practice.",
      },
      {
        name: "Feasibility",
        weight: 25,
        description: "Could this actually be built? Is it realistic given real-world constraints (cost, materials, regulations)?",
        annotation:
          "Grounds the competition in reality. Prevents fantastical designs that ignore practical constraints.",
      },
      {
        name: "Community Impact",
        weight: 25,
        description: "Does this design genuinely improve the experience for the people who use this space? Is it inclusive and accessible?",
        annotation:
          "Centers the people who use the space. The 'inclusive and accessible' requirement pushes students to think beyond their own experience.",
      },
      {
        name: "Presentation Quality",
        weight: 20,
        description: "Is the submission clear, complete, and well-organized? Does the written explanation effectively communicate the design vision?",
        annotation:
          "Lowest weight because presentation shouldn't overshadow ideas — but it still matters. Clear communication is a real-world skill.",
      },
    ],
    prepTimeline: [
      {
        week: "Week 1",
        milestone: "Space Selection: Visit and document 3+ public spaces. Choose your project space.",
        type: "CHECKPOINT",
        annotation: "Gets students out into their community immediately. Choosing from 3+ options prevents impulsive picks.",
      },
      {
        week: "Week 1 (end)",
        milestone: "Photo Documentation: Submit 5+ photos of your chosen space with observation notes.",
        type: "PRACTICE_SUBMISSION",
        annotation: "First practice submission — low stakes, just photos and notes. Builds the habit of submitting early.",
      },
      {
        week: "Week 2",
        milestone: "Concept Sketches: Submit 3 different redesign concepts (rough sketches OK).",
        type: "PRACTICE_SUBMISSION",
        annotation: "Forces multiple concepts before committing. Rough is fine — the point is divergent thinking.",
      },
      {
        week: "Week 2 (end)",
        milestone: "Drop-in Office Hours: Get feedback on your concept from an instructor.",
        type: "WORKSHOP",
        annotation: "Live support at the midpoint when students are most likely to feel stuck or uncertain.",
      },
      {
        week: "Week 3",
        milestone: "Draft Submission: Share work-in-progress with peer feedback circle.",
        type: "REVIEW",
        annotation: "Peer feedback before final submission. Students improve their work AND practice giving constructive critique.",
      },
      {
        week: "Week 4 (3 days before)",
        milestone: "Final Polish: All three components complete. Last chance to revise.",
        type: "CHECKPOINT",
        annotation: "A soft deadline before the real deadline. Prevents last-minute scrambling.",
      },
    ],
  },
  {
    title: "Community Impact Pitch Competition",
    overview:
      "A 3-week competition focused on social impact — students pitch solutions to real community problems. Emphasis on research, storytelling, and presentation skills. This example shows a competition focused on a specific passion area (Service) with a shorter timeline.",
    fields: {
      season: {
        value: "Winter 2025-26",
        annotation: "Hyphenated season for winter competitions that span the year boundary.",
      },
      theme: {
        value: "Solutions That Matter: Tackling a Problem in Your Community",
        annotation:
          "Action-oriented theme. 'Solutions That Matter' is aspirational. 'Your Community' makes it personal and grounded.",
      },
      passionArea: {
        value: "Service",
        annotation:
          "Focused on Service passion area. This competition specifically targets students interested in community impact and social change.",
      },
      rules: {
        value:
          "Open to all YPP students. Individual or team entries (teams of 2-3). Solution must address a real, documented problem in the student's local community. Students must include evidence of at least 2 conversations with people affected by the problem. Presentations must be 5 minutes or less. No previous competition entries may be resubmitted.",
        annotation:
          "Team entries allowed (encourages collaboration). The 'real, documented problem' and 'conversations with affected people' requirements ensure solutions are grounded in reality, not assumptions.",
      },
    },
    planningBlueprint: {
      challengeBrief: {
        value:
          "Every community has challenges — food access, transportation, mental health support, environmental concerns, education gaps. Your challenge: identify a real problem affecting real people in your community, talk to the people affected, and pitch a realistic solution. The best solutions aren't always the biggest — sometimes the most impactful ideas are simple, focused, and deeply human.",
        annotation:
          "Lists example problem areas to spark ideas. The last sentence is key — it tells students that simple, thoughtful solutions can win, not just flashy ones.",
      },
      idealParticipant: {
        value:
          "Students who care about their communities and want to make a difference. No experience needed in business, nonprofit work, or public speaking — those skills are part of what you'll learn. Ideal for empathetic students who are good listeners and notice problems others overlook.",
        annotation:
          "Targets empathy and observation skills, not technical skills. Explicitly says you'll learn the needed skills during the process.",
      },
      submissionPackage: {
        value:
          "Submit: (1) A 5-minute pitch video or live presentation. (2) A 1-page solution brief: problem, affected people, proposed solution, first 3 steps to implement. (3) Evidence of community engagement: notes from at least 2 conversations with affected community members.",
        annotation:
          "The community engagement evidence is what makes this competition special. It prevents students from designing solutions in a vacuum.",
      },
      milestoneTimeline: {
        value:
          "Week 1: Research & Engage — identify your problem, have 2+ conversations with affected community members. Week 2: Design & Draft — develop your solution, create your pitch draft, get peer feedback. Week 3: Polish & Present — refine pitch, practice delivery, submit final package.",
        annotation:
          "Compressed 3-week timeline. Research comes first (Week 1) to ensure solutions are grounded before any pitch work begins.",
      },
      supportResources: {
        value:
          "Community interview guide template, pitch structure worksheet ('Problem → People → Solution → Action'), example pitches from past competitions (video library), public speaking tips video, peer feedback session in Week 2.",
        annotation:
          "The 'Problem → People → Solution → Action' pitch structure gives students a clear framework without being restrictive.",
      },
      reviewProcess: {
        value:
          "Judged by a panel of 4: community organizer, local business owner, YPP mentor, and a previous competition winner (peer judge). Scored on: Depth of Understanding, Solution Quality, Community Engagement Evidence, and Presentation Skills. No community vote for this competition — sensitive community topics deserve careful, private judging.",
        annotation:
          "Including a previous winner as peer judge is a great touch. Disabling community voting is a thoughtful choice for potentially sensitive topics.",
      },
      celebrationPlan: {
        value:
          "Live pitch event (hybrid: in-person + streamed). All participants receive 'Community Champion' badge. Top 3 winners receive prizes + mentorship sessions with the community organizer judge. Winning solutions shared with relevant local organizations. All pitches compiled into a 'Community Solutions Showcase' video.",
        annotation:
          "Mentorship as a prize is uniquely valuable. Sharing solutions with real organizations makes the work matter beyond the competition.",
      },
      promotionPlan: {
        value:
          "Launch announcement in Service-focused classes. Personal outreach to students who've expressed interest in community service. Dashboard feature. Email with compelling statistics about the impact of youth-led community solutions. Partner with local organizations to spread the word.",
        annotation:
          "Targeted promotion to students already interested in service, plus broader awareness. Statistics in the email make the case for why this matters.",
      },
    },
    judgingCriteria: [
      {
        name: "Depth of Understanding",
        weight: 30,
        description: "Does the student demonstrate deep understanding of the problem? Have they talked to affected people? Do they show empathy and nuance?",
        annotation:
          "Highest weight because understanding the problem is more important than having a perfect solution. Rewards genuine engagement.",
      },
      {
        name: "Solution Quality",
        weight: 25,
        description: "Is the proposed solution realistic, actionable, and well-thought-out? Would it actually help?",
        annotation:
          "Emphasizes 'actually help' — not just clever or impressive, but genuinely useful.",
      },
      {
        name: "Community Engagement",
        weight: 25,
        description: "Did the student genuinely engage with community members? Is the evidence of engagement authentic and meaningful?",
        annotation:
          "Dedicated criterion for engagement ensures students can't skip the community conversation requirement and still score well.",
      },
      {
        name: "Presentation Skills",
        weight: 20,
        description: "Is the pitch clear, compelling, and within the time limit? Does the student communicate with confidence and authenticity?",
        annotation:
          "Lowest weight but still valued. 'Authenticity' is listed alongside confidence — students don't need to be polished, just genuine.",
      },
    ],
    prepTimeline: [
      {
        week: "Week 1",
        milestone: "Problem Identification: Document 2+ community problems you've observed or experienced.",
        type: "CHECKPOINT",
        annotation: "Start broad, then narrow. Having 2+ options prevents premature commitment.",
      },
      {
        week: "Week 1 (end)",
        milestone: "Community Conversations: Submit notes from 2+ conversations with affected community members.",
        type: "PRACTICE_SUBMISSION",
        annotation: "Early submission of conversation notes ensures students actually talk to people before designing solutions.",
      },
      {
        week: "Week 2",
        milestone: "Solution Draft: Submit 1-page solution brief for peer feedback.",
        type: "REVIEW",
        annotation: "Peer feedback at the midpoint. The 1-page format forces concise, focused thinking.",
      },
      {
        week: "Week 2 (end)",
        milestone: "Pitch Practice: Record a practice run of your pitch and share with a partner.",
        type: "PRACTICE_SUBMISSION",
        annotation: "Recording yourself is uncomfortable but invaluable. Sharing with a partner adds accountability.",
      },
      {
        week: "Week 3 (2 days before)",
        milestone: "Final Review: All three submission components ready. Last chance to revise.",
        type: "CHECKPOINT",
        annotation: "Buffer before the deadline. Students who submit early can relax; latecomers have a warning.",
      },
    ],
  },
];
