/**
 * Instructor Guide Content — Pedagogical help text for every builder field.
 *
 * Each entry has:
 *   title    — Short heading shown in the tooltip
 *   guidance — 2-3 sentence pedagogical advice
 *   example  — Concrete filled-in example for the field
 */

type HelpEntry = {
  title: string;
  guidance: string;
  example?: string;
};

// ─────────────────────────────────────────────────────
// PASSION LAB BUILDER
// ─────────────────────────────────────────────────────
export const passionLabHelp: Record<string, HelpEntry> = {
  name: {
    title: "Choosing a Lab Name",
    guidance:
      "Pick a name that sparks curiosity and clearly signals what students will do. It should feel exciting, not like a textbook title. Think of it as a headline that makes a student say 'I want to try that.'",
    example: "Urban Photography Lab",
  },
  interestArea: {
    title: "Selecting a Passion Area",
    guidance:
      "Choose the passion area that best matches the core skill students will develop. This helps students discover your lab when exploring their interests.",
    example: "Arts — if the lab focuses on visual storytelling through photography",
  },
  drivingQuestion: {
    title: "Writing a Great Driving Question",
    guidance:
      "A driving question is the central inquiry that powers the entire lab. It should be open-ended (no single right answer), connected to students' lives or communities, and big enough to sustain multiple sessions of exploration. Avoid yes/no questions or questions that can be answered with a quick search.",
    example:
      "How can photography tell the story of our neighborhood in a way that makes people see it differently?",
  },
  targetAgeGroup: {
    title: "Target Age Group",
    guidance:
      "Choose the age range that matches the complexity of your lab's content. Younger students (8-12) need more scaffolding and shorter activities. Older students (14-18) can handle more independence and abstract thinking. 'Mixed' works when the lab is activity-based and can flex to different levels.",
  },
  difficulty: {
    title: "Setting the Difficulty",
    guidance:
      "Beginner means no prior knowledge needed — anyone can walk in. Intermediate assumes some familiarity with the passion area. Advanced is for students who have completed earlier labs or classes in this area.",
  },
  deliveryMode: {
    title: "Delivery Mode",
    guidance:
      "In-Person works best for hands-on labs (art, science experiments, music). Virtual works for digital creation, coding, or writing labs. Hybrid lets some students attend remotely — only choose this if your activities genuinely work both ways.",
  },
  finalShowcase: {
    title: "Designing the Final Showcase",
    guidance:
      "The showcase is what makes a Passion Lab different from a regular class. Students should create something real that they're proud to share — a portfolio, a performance, a demo, an exhibition. Define what 'done' looks like so students have a clear target from day one.",
    example:
      "Students curate a 10-photo digital portfolio with captions telling the story of a place in their community, presented at a virtual gallery night.",
  },
  submissionFormat: {
    title: "Submission Format",
    guidance:
      "How will students turn in their showcase work? Be specific so students know exactly what to prepare. This could be a digital file, a live demo, a presentation, or a physical artifact.",
    example: "Digital portfolio (Google Slides or PDF) with 10 captioned photos",
  },
  bigIdea: {
    title: "The Big Idea",
    guidance:
      "This is the deeper theme that gives the lab meaning beyond just the skill. It connects the technical work to something students care about — identity, community, justice, creativity, self-expression. A strong big idea makes students feel like they're doing something that matters.",
    example:
      "Every neighborhood has untold stories. Photography can make the invisible visible and give communities a voice.",
  },
  studentChoicePlan: {
    title: "Planning for Student Choice",
    guidance:
      "Passion Labs must have space for students to make decisions. Where will students personalize their work? Where will they lead? A good choice plan identifies at least 2-3 moments where students drive the direction.",
    example:
      "Students choose their own subject/location for their photo series, select their own editing style, and decide how to arrange their final portfolio narrative.",
  },
  mentorCommunityConnection: {
    title: "Mentor & Community Connection",
    guidance:
      "Connect students to someone outside the classroom — a local professional, community member, or guest speaker. This makes the work feel real and gives students an authentic audience beyond their instructor.",
    example:
      "Partner with a local photographer from the community arts center for a guest critique session in Week 3. Final portfolios displayed at community center.",
  },
  showcaseCriteria: {
    title: "Showcase Success Criteria",
    guidance:
      "Define what makes a strong showcase so students (and you) know what to aim for. Be specific but leave room for creativity. Focus on effort, growth, and quality of thinking — not perfection.",
    example:
      "Strong portfolio: 10 photos with clear narrative thread, thoughtful captions, evidence of editing techniques learned, and a 1-minute artist statement.",
  },
  supportPlan: {
    title: "Student Support Plan",
    guidance:
      "How will you help students who get stuck, fall behind, or feel overwhelmed? A good support plan includes check-in points, alternative pathways, and peer support structures.",
    example:
      "Weekly 1-on-1 check-ins during build time. Peer photo critique pairs. 'Stuck?' office hours on Wednesdays. Simplified portfolio option (5 photos) for students who need it.",
  },
  riskSafetyNotes: {
    title: "Risk & Safety Notes",
    guidance:
      "Consider physical safety (if students go on location), digital safety (if sharing work online), emotional safety (if topics are personal), and access (if materials cost money). Plan around these proactively.",
    example:
      "Students photograph in pairs for safety. No photos of people without consent. Free editing software (Snapseed) used to avoid cost barriers.",
  },
  resourcePlan: {
    title: "Resource Plan",
    guidance:
      "List every material, tool, space, and digital resource the lab needs. Be realistic — if it requires expensive equipment, note alternatives. If it needs a specific room or setup, say so.",
    example:
      "Smartphones (students use their own or borrow school devices), Snapseed app (free), Google Slides for portfolio, printed consent forms for community photography.",
  },
  sessionTopic: {
    title: "Session Topic",
    guidance:
      "Each session should have a clear focus that moves students one step closer to their final showcase. Think of it as the 'headline' for the day — what are students exploring or building?",
    example: "Composition & Framing: How professionals use the rule of thirds",
  },
  sessionObjective: {
    title: "Session Objective",
    guidance:
      "What should students be able to do or understand by the end of this session? Write it from the student's perspective. 'Students will...' is a good start.",
    example:
      "Students will apply the rule of thirds to compose 5 intentional photos of their chosen subject.",
  },
  checkpointArtifact: {
    title: "Checkpoint Artifact",
    guidance:
      "What tangible thing does a student leave this session with? It could be a draft, a sketch, a prototype, a written reflection, or a set of practice work. This is how you know they engaged.",
    example:
      "5 photos demonstrating rule-of-thirds composition, uploaded to shared album with a 2-sentence caption each.",
  },
  sessionMiniLesson: {
    title: "Mini-Lesson",
    guidance:
      "A short, focused teaching moment (5-15 minutes). Introduce one concept or technique directly. Show examples. Keep it brief — students should spend most of their time building, not listening.",
    example:
      "10-minute slideshow: 'Rule of Thirds in Pro Photography' — show 6 famous photos with grid overlay, then 3 student examples from previous labs.",
  },
  handsOnBuild: {
    title: "Hands-On Build Time",
    guidance:
      "This is the heart of the session — students actively creating, experimenting, or building. Describe what they'll do, not just 'work time.' Be specific about the activity and expected output.",
    example:
      "Students go to their chosen location and shoot 15+ photos using rule of thirds. Instructor circulates to give real-time composition feedback.",
  },
  collaboration: {
    title: "Collaboration Activity",
    guidance:
      "How will students work together, give feedback, or learn from each other? This could be peer critique, pair work, group brainstorming, or a share-out. Design it so students gain something from the interaction.",
    example:
      "Photo Swap: partners exchange their 3 best shots and write one 'I notice...' and one 'I wonder...' comment on each.",
  },
  reflection: {
    title: "Reflection",
    guidance:
      "A brief pause for students to think about what happened. This can be a journal prompt, a verbal check-in, or a quick written response. Reflection helps students internalize what they learned.",
    example:
      "Exit journal: 'What surprised you about your photos today? What would you try differently next session?'",
  },
  sessionMaterials: {
    title: "Materials & Tools",
    guidance: "List everything needed for this specific session — devices, apps, supplies, handouts, links.",
    example:
      "Smartphones, Snapseed app, printed rule-of-thirds grid cards, shared Google Photos album link",
  },
  progressEvidence: {
    title: "Progress Evidence",
    guidance:
      "How will you know students made progress? This isn't a formal grade — it's a quick signal. Could be an artifact, a verbal check, or observation notes.",
    example:
      "Instructor reviews uploaded photos for intentional composition. Quick verbal check: 'Show me your favorite shot and tell me why.'",
  },
  extensionPrompt: {
    title: "Extension Prompt",
    guidance:
      "An optional next step for students who finish early or want to go deeper. This should stretch their thinking without requiring new materials.",
    example:
      "Challenge: Take 5 photos that deliberately break the rule of thirds. How does it change the feeling?",
  },
};

// ─────────────────────────────────────────────────────
// COMPETITION BUILDER
// ─────────────────────────────────────────────────────
export const competitionHelp: Record<string, HelpEntry> = {
  season: {
    title: "Competition Season",
    guidance:
      "Name the season or cycle this competition belongs to. This helps students and admins find it in the calendar. Use a clear format like 'Spring 2026' or 'Winter 2025-26.'",
    example: "Spring 2026",
  },
  theme: {
    title: "Choosing a Theme",
    guidance:
      "The theme is the creative lens that focuses the competition. A great theme is specific enough to inspire ideas but open enough that students can approach it from many angles. Avoid themes that are too broad ('Be Creative') or too narrow ('Build a Weather App').",
    example:
      "Reimagining Public Spaces — How can we redesign the spaces we share to make them more inclusive, functional, and joyful?",
  },
  passionArea: {
    title: "Passion Area Filter",
    guidance:
      "Optionally restrict to a single passion area, or leave open for cross-discipline entries. Open competitions attract more participants; focused ones produce deeper work.",
  },
  rules: {
    title: "Writing Clear Rules",
    guidance:
      "Rules should answer every question a student might have: Who can enter? What counts as a valid submission? What's not allowed? How many entries per person? Are team entries okay? Write rules that are fair, clear, and inclusive — avoid jargon.",
    example:
      "Open to all YPP students. One entry per student. Entries must be original work created during the competition period. Team entries (max 3) are allowed. AI tools may be used as assistants but the core creative work must be the student's.",
  },
  challengeBrief: {
    title: "Writing the Challenge Brief",
    guidance:
      "The challenge brief is what gets students excited to participate. It should clearly state the problem or creative challenge, explain why it matters, and paint a picture of what a great response looks like. Think of it as a creative prompt, not a homework assignment.",
    example:
      "Your neighborhood has spaces that could be better — an empty lot, a boring bus stop, a neglected park. Your challenge: redesign one public space to make it more useful, beautiful, or joyful for the people who use it. Present your redesign as a visual proposal.",
  },
  idealParticipant: {
    title: "Ideal Participant",
    guidance:
      "Describe who this competition is best for — experience level, interests, and what kind of student will thrive. This helps students self-select and sets expectations.",
    example:
      "Best for students interested in design, architecture, or community activism. No prior design experience needed — we'll provide tools and templates. Ideal for students who like thinking about how spaces affect people's daily lives.",
  },
  submissionPackage: {
    title: "Defining the Submission",
    guidance:
      "Be extremely specific about what students must turn in. Vague requirements lead to frustration. List every component: file type, length, format, and any required elements.",
    example:
      "Submit: (1) A visual redesign of your chosen space — can be a digital mockup, hand-drawn plan, or 3D model screenshot. (2) A 500-word written explanation of your design choices. (3) A 60-second video pitch explaining your vision.",
  },
  milestoneTimeline: {
    title: "Milestone Timeline",
    guidance:
      "Break the competition period into checkpoints so students don't leave everything to the last minute. Each milestone should have a clear deliverable and date.",
    example:
      "Week 1: Choose your space and document it (photos + notes). Week 2: Research + sketch 3 concepts. Week 3: Develop your chosen concept into a full proposal. Week 4: Polish, get peer feedback, finalize submission.",
  },
  supportResources: {
    title: "Support Resources",
    guidance:
      "What help will you provide? Templates, example entries, office hours, tutorial links, peer feedback sessions? The more support, the more students will actually finish and submit quality work.",
    example:
      "Design template (Canva), example winning entries from past competitions, weekly office hours (Tuesdays 4pm), peer feedback circles in Week 3, 'How to Make a Video Pitch' tutorial.",
  },
  reviewProcess: {
    title: "Review & Judging Process",
    guidance:
      "Be transparent about how entries will be evaluated. Explain the judging criteria, who the judges are, whether community voting is involved, and how winners are selected. Fairness and transparency build trust.",
    example:
      "Entries scored by 3 judges on: Creativity (30%), Feasibility (25%), Community Impact (25%), Presentation Quality (20%). Top 5 finalists go to community vote. Judges' scores = 70%, community vote = 30% of final score.",
  },
  celebrationPlan: {
    title: "Celebration Plan",
    guidance:
      "How will you recognize winners AND all participants? Competitions should end with celebration, not just rankings. Think about how to make every student feel their effort mattered.",
    example:
      "Virtual showcase night: all finalists present live. Winners announced with certificates and prizes. All participants receive a 'Community Designer' badge. Top entries featured on YPP social media.",
  },
  promotionPlan: {
    title: "Promotion Plan",
    guidance:
      "How will students find out about this competition? Plan announcements across channels — in classes, on the dashboard, via email, on social media. Build excitement over time with teasers and countdown reminders.",
    example:
      "Announce in all classes Week 1. Dashboard banner. Email blast with challenge brief. Weekly Instagram teasers showing example spaces. Reminder emails at 2 weeks and 3 days before deadline.",
  },
  judgingCriteriaName: {
    title: "Judging Criterion Name",
    guidance:
      "Each criterion should be a single, clear quality that judges evaluate. Use terms students understand — avoid academic jargon.",
    example: "Creativity",
  },
  judgingCriteriaWeight: {
    title: "Criterion Weight",
    guidance:
      "Assign weights that reflect your values. If creativity matters more than polish, weight it higher. Make sure weights add up to a meaningful total and students can see what matters most.",
  },
  judgingCriteriaDescription: {
    title: "Criterion Description",
    guidance:
      "Explain what this criterion means in practice. What does a high score look like vs a low score? This helps judges be consistent and helps students understand expectations.",
    example:
      "Does the entry show original thinking? Does it go beyond the obvious solution? Does it surprise or delight?",
  },
  votingEnabled: {
    title: "Community Voting",
    guidance:
      "Community voting increases engagement but can favor popular students over quality work. Balance it by giving community votes a lower weight (20-40%) compared to judge scores. Disable voting if the competition involves sensitive or personal topics.",
  },
  communityVoteWeight: {
    title: "Vote Weight Balance",
    guidance:
      "30% community / 70% judges is a good default. Increase community weight for fun, creative competitions. Decrease it for technical or skill-based competitions where expertise matters more.",
  },
  rewards: {
    title: "Setting Rewards",
    guidance:
      "Rewards don't have to be expensive — recognition and badges can be just as motivating as gift cards. Consider rewards that connect to the passion area (e.g., a masterclass, a mentorship session, or featuring on the YPP showcase).",
    example:
      "1st: $50 gift card + 'Design Champion' badge + featured on YPP homepage. 2nd: $25 gift card + badge. 3rd: $10 gift card + badge. All finalists: 'Finalist' badge + XP bonus.",
  },
};

// ─────────────────────────────────────────────────────
// SEQUENCE BUILDER
// ─────────────────────────────────────────────────────
export const sequenceHelp: Record<string, HelpEntry> = {
  name: {
    title: "Naming Your Sequence",
    guidance:
      "The name should communicate the learning journey, not just a topic. Think of it as a pathway title that tells students where they'll start and where they'll end up.",
    example: "From Beats to Albums: Music Production Pathway",
  },
  description: {
    title: "Sequence Description",
    guidance:
      "Describe the full arc: what students will learn, what they'll create, and why this sequence exists as a connected journey rather than separate classes.",
    example:
      "A 4-step pathway that takes students from making their first beat to producing a complete 3-track EP. Students build skills progressively, with each step unlocking new tools and techniques.",
  },
  interestArea: {
    title: "Interest Area",
    guidance:
      "Choose the passion area that best represents the sequence's focus. Students browsing by interest will find your sequence this way.",
  },
  targetLearner: {
    title: "Describing Your Target Learner",
    guidance:
      "Paint a picture of who this sequence is for. What do they already know? What are they curious about? What do they want to become? This helps students self-identify and helps you design at the right level.",
    example:
      "A student who loves listening to music and wants to learn how to make their own. No prior production experience needed — just curiosity and a willingness to experiment.",
  },
  entryPoint: {
    title: "Entry Point",
    guidance:
      "What should students know or have done before starting? If there are no prerequisites, say so clearly. If there are, be specific about what's required.",
    example:
      "No prerequisites. Students should have access to a computer or tablet. Helpful but not required: basic familiarity with any music app.",
  },
  endGoalCapstone: {
    title: "End Goal / Capstone",
    guidance:
      "What will students have created or achieved by the time they complete the entire sequence? This should be something concrete and impressive — a portfolio piece, a performance, a certification, a published project.",
    example:
      "A 3-track EP (electronic music project) produced, mixed, and published to a private SoundCloud playlist. Students present their EP at a listening party showcase.",
  },
  pacingGuidance: {
    title: "Pacing Guidance",
    guidance:
      "How fast should students move through the sequence? Should they complete one step per week? One per month? Can they go at their own pace? Include realistic time estimates.",
    example:
      "Recommended pace: one step every 2-3 weeks. Students can move faster if they demonstrate checkpoint evidence early. Total pathway: 8-12 weeks.",
  },
  supportCheckpoints: {
    title: "Support Checkpoints",
    guidance:
      "Where in the sequence should you check in with students? Identify moments where students commonly get stuck, lose motivation, or need feedback before moving forward.",
    example:
      "Checkpoint after Step 1 (first beat): instructor listens and gives feedback before student moves to arranging. Checkpoint after Step 3 (mixing): peer review session before final production.",
  },
  completionSignals: {
    title: "Completion Signals",
    guidance:
      "How do you know a student has truly completed the sequence (not just clicked through)? Define what 'done' looks like in terms of artifacts, demonstrations, or evidence.",
    example:
      "Student has: (1) produced 3 original tracks, (2) received and incorporated peer feedback, (3) presented EP at showcase or submitted final portfolio, (4) written a 1-paragraph artist statement.",
  },
  stepPurpose: {
    title: "Step Purpose",
    guidance:
      "Why does this step exist in the sequence? What does it add that the previous step didn't cover? Each step should have a clear reason for being there — not just 'more practice.'",
    example:
      "This step introduces multi-track arranging. Students move from making a single loop (Step 1) to structuring a complete song with intro, verse, chorus, and outro.",
  },
  expectedEvidence: {
    title: "Expected Evidence",
    guidance:
      "What should a student produce or demonstrate to show they've completed this step? Be specific enough that you can look at it and say 'yes, they're ready for the next step.'",
    example:
      "A 2-minute arranged track with at least 3 distinct sections (intro, main, outro) using at least 4 different instrument tracks.",
  },
  estimatedDuration: {
    title: "Estimated Duration",
    guidance:
      "How long should this step take for a typical student? Include both class time and any independent work. Be realistic — overestimating is better than underestimating.",
    example: "2-3 sessions (approximately 3-4 hours of class time + 1-2 hours independent practice)",
  },
  coachSupportNote: {
    title: "Coach / Support Note",
    guidance:
      "What should an instructor pay attention to during this step? Where do students commonly struggle? What kind of support works best here?",
    example:
      "Students often struggle with transitions between sections. Have them listen to 2-3 professional tracks and map out the arrangement structure before they start building their own.",
  },
  unlockRationale: {
    title: "Unlock Rationale",
    guidance:
      "Why is this step locked until prerequisites are complete? For AUTO unlock, explain what knowledge carries forward. For MANUAL unlock, explain what the instructor needs to verify before the student advances.",
    example:
      "MANUAL unlock: Instructor listens to the student's beat (Step 1 artifact) to verify they understand tempo, rhythm, and basic mixing before moving to arrangement.",
  },
};

// ─────────────────────────────────────────────────────
// CURRICULUM BUILDER (regular classes)
// ─────────────────────────────────────────────────────
export const curriculumHelp: Record<string, HelpEntry> = {
  title: {
    title: "Course Title",
    guidance:
      "Choose a title that's clear, specific, and inviting. Students and parents should immediately understand what the course covers. Avoid jargon or inside references.",
    example: "Introduction to Digital Illustration with Procreate",
  },
  interestArea: {
    title: "Interest Area",
    guidance:
      "Select the passion area that best matches your course. This drives how students discover your class.",
  },
  targetAgeGroup: {
    title: "Target Age Group",
    guidance:
      "Choose the age range that fits your content complexity and teaching style. This helps ensure students are matched to appropriate classes.",
  },
  numberOfClasses: {
    title: "Number of Classes",
    guidance:
      "How many sessions will this course run? Consider the depth of content and student attention spans. 4-8 sessions is typical for most courses. Shorter (1-3) works for workshops; longer (10+) for intensive skill-building.",
  },
  classDuration: {
    title: "Class Duration",
    guidance:
      "How long is each session in minutes? 45-60 minutes works for younger students. 60-90 minutes for teens. Consider break time for sessions over 60 minutes.",
  },
  difficultyLevel: {
    title: "Difficulty Level",
    guidance:
      "101 = Absolute beginner, no prerequisites. 201 = Has tried the basics, ready for more depth. 301 = Intermediate, can work with less scaffolding. 401 = Advanced, expects creative freedom and complex projects.",
  },
  targetSkill: {
    title: "Target Skill",
    guidance:
      "What is the ONE main skill students will develop? Being specific helps you design focused lessons and helps students know what they're signing up for.",
    example: "Digital illustration fundamentals — layers, brushes, color, and composition in Procreate",
  },
  finalOutcome: {
    title: "Final Student Outcome",
    guidance:
      "What will students have created or be able to do by the last class? This should be concrete and something students can show off.",
    example:
      "A 3-piece digital illustration portfolio: one character design, one landscape, and one composition of their choice.",
  },
  description: {
    title: "Course Description",
    guidance:
      "Write 2-4 sentences that would make a student (or parent) want to sign up. Cover: what students will do, what they'll create, and why it's exciting. Write in an inviting tone, not an academic one.",
    example:
      "Ever wanted to bring your ideas to life on a digital canvas? In this course, you'll learn to use Procreate to create stunning illustrations from scratch. By the end, you'll have a 3-piece portfolio you can share with friends, post online, or even print.",
  },
  lessonTopic: {
    title: "Lesson Topic",
    guidance:
      "Give each lesson a clear focus that builds on the previous one. The sequence should feel like a natural progression, not a random collection of activities.",
    example: "Lesson 3: Color Theory & Palette Building",
  },
  essentialQuestion: {
    title: "Essential Question",
    guidance:
      "A thought-provoking question that frames the lesson. It should make students think, not just recall facts. Good essential questions don't have one right answer.",
    example: "How do professional illustrators choose colors that create mood and emotion?",
  },
  lessonGoal: {
    title: "Lesson Goal",
    guidance:
      "What should students know or be able to do by the end of this specific lesson? Keep it focused — one clear goal per lesson is better than three vague ones.",
    example:
      "Students will create a custom 5-color palette based on color theory principles and apply it to a simple illustration.",
  },
  warmUpHook: {
    title: "Warm-Up / Hook",
    guidance:
      "The first 5 minutes set the tone. Start with something engaging — a question, a visual, a quick challenge, or a connection to students' lives. Avoid jumping straight into instruction.",
    example:
      "Show 4 versions of the same illustration in different color palettes. Ask: 'Which one feels happiest? Scariest? Why?'",
  },
  miniLesson: {
    title: "Mini-Lesson",
    guidance:
      "A short, focused teaching segment (5-15 min). Introduce one concept, demonstrate one technique, or explain one tool. Model it live if possible — students learn more from watching you do it than from slides.",
    example:
      "Live demo: build a 5-color palette using the color wheel in Procreate. Show complementary, analogous, and triadic approaches (10 minutes).",
  },
  instructorModel: {
    title: "Instructor Modeling",
    guidance:
      "Show students what the work looks like when you do it. Talk through your thinking as you create — 'I'm choosing this color because...' This makes your expertise visible and gives students a mental model to follow.",
    example:
      "Create a quick sunset landscape using only your 5-color palette. Narrate choices: 'I'm using the warm orange here because...'",
  },
  guidedPractice: {
    title: "Guided Practice",
    guidance:
      "Students try the skill with your support. Walk them through it step by step while they follow along on their own devices. Circulate and check in. This bridges the gap between watching and doing independently.",
    example:
      "Students build their own palette following the same steps. Instructor walks the room giving feedback on color relationships.",
  },
  independentBuild: {
    title: "Independent Build Time",
    guidance:
      "Students work on their own, applying what they learned. This is where real learning happens — when they have to make their own decisions. Set a clear task and expected output, then step back and support as needed.",
    example:
      "Using your custom palette, illustrate a simple object of your choice (a plant, a shoe, a food item). Apply at least 4 of your 5 colors.",
  },
  collaborationShare: {
    title: "Collaboration / Share",
    guidance:
      "Create a moment for students to see each other's work and learn from each other. Peer feedback, gallery walks, pair shares, or group critiques all work. Design it so students gain something specific from the interaction.",
    example:
      "Gallery Walk: students post their illustrations to the shared board. Each student leaves a sticky note on 2 peers' work: 'One color choice I love is...'",
  },
  checkForUnderstanding: {
    title: "Check for Understanding",
    guidance:
      "How will you know students actually got it? This can be a quick verbal check, a thumbs up/down, a quiz question, or looking at their work. Do this before moving on.",
    example:
      "Quick poll: 'Can you name the 3 types of color relationships we learned?' Check illustrations for intentional palette use.",
  },
  differentiationSupport: {
    title: "Differentiation & Support",
    guidance:
      "Not all students are at the same level. How will you support students who are struggling AND challenge students who finish early? Plan for both.",
    example:
      "Struggling: provide a pre-made palette they can use as a starting point. Advanced: challenge them to create TWO palettes (one warm, one cool) and do the same illustration in both.",
  },
  extensionChallenge: {
    title: "Extension Challenge",
    guidance:
      "An optional stretch activity for fast finishers. It should deepen understanding, not just add more work. Connect it to the lesson's essential question.",
    example:
      "Create the same illustration using ONLY two colors (plus black and white). How does a limited palette change the mood?",
  },
  exitTicket: {
    title: "Exit Ticket",
    guidance:
      "A quick closing activity (2-5 minutes) that captures what students learned. Can be a written response, a verbal share, or a submitted artifact. This gives you data to plan the next lesson.",
    example:
      "Write 1 sentence: 'The most important thing I learned about color today is...' Submit with your illustration.",
  },
  materialsTools: {
    title: "Materials & Tools",
    guidance: "List everything needed for this lesson — software, supplies, links, handouts, references.",
    example:
      "iPad with Procreate, Apple Pencil, color wheel reference PDF (linked in class materials), shared Padlet board for gallery walk",
  },
  assessmentEvidence: {
    title: "Assessment Evidence",
    guidance:
      "What artifact or observation tells you the student met the lesson goal? This isn't a grade — it's evidence of learning. Be specific about what you'll look for.",
    example:
      "Review student illustrations for: (1) custom palette with clear color relationships, (2) intentional application of at least 4 palette colors, (3) completed exit ticket reflection.",
  },
  engagementEnergyStyle: {
    title: "Energy Style",
    guidance:
      "Describe the overall vibe and energy of your course. Is it calm and focused? High-energy and collaborative? Creative and exploratory? This helps set expectations for both you and the students.",
    example:
      "Calm and creative — studio-style sessions with low background music, focused work time, and gentle peer sharing. High energy during warm-ups, quiet focus during build time.",
  },
  engagementDifferentiation: {
    title: "Differentiation Plan",
    guidance:
      "How will you handle mixed skill levels across the entire course? Plan strategies that let advanced students go deeper while supporting beginners without holding the class back.",
    example:
      "Tiered assignments: each lesson has a 'Core' task (everyone), a 'Stretch' option (advanced), and a 'Scaffold' version (extra support). Students self-select with instructor guidance.",
  },
  engagementStudentVoice: {
    title: "Student Voice Moments",
    guidance:
      "Where in the course do students get to make decisions, share opinions, or influence the direction? Student voice keeps engagement high and gives students ownership of their learning.",
    example:
      "Students vote on the final project theme (Week 3). Weekly 'Share Your Work' circle where students choose what to present. Anonymous suggestion box for topics they want to explore.",
  },
};
