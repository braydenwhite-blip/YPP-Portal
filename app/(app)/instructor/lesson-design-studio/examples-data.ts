// ============================================================
// Lesson Design Studio — Example lesson plans
// 3 good examples + 3 bad examples
// All tuned for in-person instruction
// Subjects: Finance, Math, Baking
// ============================================================

export type ExampleActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

export type ExampleActivity = {
  id: string;
  title: string;
  description: string;
  type: ExampleActivityType;
  durationMin: number;
  sortOrder: number;
};

export type ExamplePlan = {
  id: string;
  title: string;
  subject: "finance" | "math" | "baking";
  ageGroup: string;
  totalMinutes: number;
  description: string;
  activities: ExampleActivity[];
  quality: "good" | "bad";
  /** Short summary of why this is good/bad — shown in the annotation layer */
  overallNote: string;
};

export type ExampleAnnotation = {
  activityId: string;
  note: string;
  sentiment: "positive" | "negative";
};

// ── GOOD EXAMPLES ─────────────────────────────────────────────

export const GOOD_FINANCE: ExamplePlan = {
  id: "ex-good-finance",
  title: "Building Your First Budget: Needs vs. Wants",
  subject: "finance",
  ageGroup: "Grades 9–12",
  totalMinutes: 60,
  description:
    "Students examine their real spending patterns, categorize expenses as needs or wants, and build a personal monthly budget using the 50/30/20 framework — leaving class with a draft budget they can actually use.",
  quality: "good",
  overallNote:
    "Strong structure: opens with a relatable hook, builds conceptual knowledge, gives students time to apply it to real data, and ends with a reflection that prepares them for next class.",
  activities: [
    {
      id: "ex-gf-1",
      title: "The $100 Scenario (Warm-Up)",
      description:
        "Give each student a sticky note. Ask: 'If you got $100 today, what are the first 3 things you'd spend it on?' Students write silently (2 min), then share with a partner. Instructor calls on 5–6 students and writes responses on the board — no judgment. Segue: 'Let's look at how these choices fit into something called a budget.'",
      type: "WARM_UP",
      durationMin: 8,
      sortOrder: 0,
    },
    {
      id: "ex-gf-2",
      title: "Needs vs. Wants: The Framework",
      description:
        "Direct instruction with slides (max 8 slides). Cover: (1) Definition of needs vs. wants with real examples, (2) The 50/30/20 budget rule — 50% needs, 30% wants, 20% savings/debt. Use the class's sticky-note responses from warm-up to categorize live. Ask students to re-evaluate their own examples.",
      type: "INSTRUCTION",
      durationMin: 12,
      sortOrder: 1,
    },
    {
      id: "ex-gf-3",
      title: "Sort the Expenses (Practice)",
      description:
        "Pairs receive a printed card deck of 20 household expenses (rent, Netflix, groceries, gym membership, etc.). They physically sort cards into Needs / Wants / Savings piles. Instructor circulates and asks questions: 'Why did you put gym membership in Wants? Could it ever be a Need?' After 8 minutes, groups compare results with the pair next to them.",
      type: "PRACTICE",
      durationMin: 12,
      sortOrder: 2,
    },
    {
      id: "ex-gf-4",
      title: "Class Debrief — The Gray Area",
      description:
        "Full group discussion: Which 3 expenses were hardest to categorize? Why does it matter which category something falls into? Instructor introduces the idea that context matters — a car is a Want in NYC but a Need in rural Texas. Guide students toward understanding that a budget is personal.",
      type: "DISCUSSION",
      durationMin: 8,
      sortOrder: 3,
    },
    {
      id: "ex-gf-5",
      title: "My Budget Draft (Independent Build)",
      description:
        "Students use a provided budget worksheet to estimate their own monthly expenses (or a hypothetical $2,000/month income scenario). They categorize each line item, total each column, and check whether they're close to 50/30/20. Instructor walks the room — minimum one check-in per student.",
      type: "PRACTICE",
      durationMin: 14,
      sortOrder: 4,
    },
    {
      id: "ex-gf-6",
      title: "Exit Reflection",
      description:
        "Students write on an index card: (1) One thing from their budget that surprised them, (2) One expense they want to rethink. Cards are collected — instructor uses them to open next class. Preview: 'Next week we'll look at what happens when your needs and wants cost more than you earn — and how debt works.'",
      type: "REFLECTION",
      durationMin: 6,
      sortOrder: 5,
    },
  ],
};

export const GOOD_MATH: ExamplePlan = {
  id: "ex-good-math",
  title: "Ratios in the Real World: Recipes & Proportions",
  subject: "math",
  ageGroup: "Grades 6–8",
  totalMinutes: 45,
  description:
    "Students learn ratios through the context of scaling recipes — a concrete, tactile anchor that makes proportion feel intuitive before they see the algebra. They work in small groups to scale a real recipe up and down, then solve for a missing ingredient.",
  quality: "good",
  overallNote:
    "Concept-to-context approach: the recipe hook makes ratios memorable. Group work builds social learning, and the misconception discussion preempts the most common error before students make it.",
  activities: [
    {
      id: "ex-gm-1",
      title: "The Broken Batch (Warm-Up)",
      description:
        "Project a recipe card for chocolate chip cookies. Tell students: 'I made cookies last night and they were terrible. I followed the recipe but made 3 times as many cookies. Here's what went wrong.' Show altered recipe where only some ingredients were tripled. Ask: 'What's the problem?' Give 2 minutes to discuss with a partner before taking answers. Don't give the answer yet.",
      type: "WARM_UP",
      durationMin: 6,
      sortOrder: 0,
    },
    {
      id: "ex-gm-2",
      title: "What Is a Ratio? (Instruction)",
      description:
        "Short direct instruction (10 min max). Define ratio using the cookie recipe as the anchor: flour:butter:sugar. Show how doubling means multiplying EVERY ingredient by the same factor. Introduce the notation 2:3 and equivalent ratios. Connect to fractions they already know. No more than 3 worked examples — keep it tight.",
      type: "INSTRUCTION",
      durationMin: 10,
      sortOrder: 1,
    },
    {
      id: "ex-gm-3",
      title: "Scale the Recipe (Group Work)",
      description:
        "Groups of 3–4 receive a different recipe card (cookies, lemonade, or guacamole — each group gets one). Task: scale the recipe to serve the whole class (given a target serving count). Groups must show their ratio setup, all calculations, and what units change. Instructor floats between groups — priority on groups that are stuck, not groups that are flying.",
      type: "GROUP_WORK",
      durationMin: 14,
      sortOrder: 2,
    },
    {
      id: "ex-gm-4",
      title: "The Missing Ingredient Problem (Assessment)",
      description:
        "Each student independently solves a 'missing ingredient' problem on a half-sheet: 'A recipe uses 2 cups of flour for every 3 cups of sugar. If you use 5 cups of sugar, how much flour do you need?' Students must show their ratio, show their work, and write a one-sentence explanation. Instructor collects before class ends.",
      type: "ASSESSMENT",
      durationMin: 10,
      sortOrder: 3,
    },
    {
      id: "ex-gm-5",
      title: "The Common Mistake (Reflection)",
      description:
        "Show the most common wrong answer from a previous class: adding instead of multiplying when scaling. Ask: 'Why do you think students make this mistake? How would you explain the correct approach to a friend?' Students write 2–3 sentences. Share 2–3 aloud. Preview: 'Next class we'll use ratios to solve real problems with maps and scale drawings.'",
      type: "REFLECTION",
      durationMin: 5,
      sortOrder: 4,
    },
  ],
};

export const GOOD_BAKING: ExamplePlan = {
  id: "ex-good-baking",
  title: "The Science of Yeast: Why Bread Rises",
  subject: "baking",
  ageGroup: "All ages (teen/adult)",
  totalMinutes: 75,
  description:
    "Students activate and observe yeast, mix and knead a basic dough, and learn the fermentation chemistry behind rise — connecting sensory experience to science. The session ends with dough ready to proof, building anticipation for the next session's bake.",
  quality: "good",
  overallNote:
    "Hands-on from the start. The experiment before the explanation is a deliberate choice — students are curious about why when they see it happen first. Pacing accounts for the natural wait time yeast needs.",
  activities: [
    {
      id: "ex-gb-1",
      title: "The Living Ingredient (Warm-Up)",
      description:
        "Place three small cups on each table: (1) warm water + yeast + sugar, (2) cold water + yeast + sugar, (3) boiling water + yeast + sugar. Tell students to watch and NOT touch for 5 minutes while you take attendance and set up. After 5 minutes, ask: 'What do you notice? What's different about each cup?' Record observations on the whiteboard. The goal is curiosity — no explanation yet.",
      type: "WARM_UP",
      durationMin: 10,
      sortOrder: 0,
    },
    {
      id: "ex-gb-2",
      title: "Fermentation Explained (Instruction)",
      description:
        "Now explain what they just watched: yeast is alive; it eats sugar and produces CO2 + alcohol (fermentation equation). The CO2 bubbles are what makes bread rise. Why did Cup 3 not work? Heat killed the yeast. Show a 3-minute video of bread dough rising in time-lapse. Connect to commercial bread production. Keep Q&A tight — collect questions for the debrief.",
      type: "INSTRUCTION",
      durationMin: 12,
      sortOrder: 1,
    },
    {
      id: "ex-gb-3",
      title: "Dough Mixing & Kneading (Practice)",
      description:
        "Students follow the recipe step-by-step: combine flour, salt, yeast mixture, and olive oil. Mix until shaggy. Turn out and knead for 8–10 minutes (instructor demonstrates proper technique first: heel of hand, quarter-turn, fold). Check gluten development by stretching a thin window. Instructor circulates — tactile coaching is critical here. Play music to keep the energy up during kneading.",
      type: "PRACTICE",
      durationMin: 25,
      sortOrder: 2,
    },
    {
      id: "ex-gb-4",
      title: "While We Wait: The Chemistry Q&A (Discussion)",
      description:
        "Dough goes into oiled bowls to proof. Now address the questions collected during instruction: 'Why does bread smell like alcohol sometimes?', 'What happens if we add too much yeast?', 'Why do some breads have big holes?' Students can ask new questions. Use the proofing dough as a live prop — check it periodically during discussion.",
      type: "DISCUSSION",
      durationMin: 15,
      sortOrder: 3,
    },
    {
      id: "ex-gb-5",
      title: "Exit: Label the Process",
      description:
        "Each student receives a simplified diagram of the fermentation process with 5 labels missing. They fill it in from memory. Also answer: 'What is one variable you could change in this recipe that would affect how much the bread rises? Why?' Collect before they leave. Preview next session: shaping, second proof, and bake.",
      type: "ASSESSMENT",
      durationMin: 8,
      sortOrder: 4,
    },
    {
      id: "ex-gb-6",
      title: "Cleanup & Wrap (Break/Transition)",
      description:
        "Structured cleanup: wipe surfaces, cover dough bowls with plastic wrap for overnight proof in the refrigerator, wash hands. Instructor gives each student their labeled dough to take home or confirms fridge storage. Brief summary of what happens overnight in the fridge (slow cold fermentation = more flavor).",
      type: "BREAK",
      durationMin: 5,
      sortOrder: 5,
    },
  ],
};

// ── BAD EXAMPLES ──────────────────────────────────────────────

export const BAD_FINANCE: ExamplePlan = {
  id: "ex-bad-finance",
  title: "Learning About Money",
  subject: "finance",
  ageGroup: "Grades 9–12",
  totalMinutes: 60,
  description: "Students will learn about money and budgets.",
  quality: "bad",
  overallNote:
    "Critical problems: vague title and objective give students no sense of purpose. No warm-up means cold start. Three consecutive instruction blocks with no practice. No way to know if students understood anything.",
  activities: [
    {
      id: "ex-bf-1",
      title: "What is Money?",
      description:
        "Talk to students about what money is and why it's important. Cover the history of money briefly.",
      type: "INSTRUCTION",
      durationMin: 15,
      sortOrder: 0,
    },
    {
      id: "ex-bf-2",
      title: "Types of Expenses",
      description:
        "Go over the different types of expenses people have. Talk about fixed and variable expenses.",
      type: "INSTRUCTION",
      durationMin: 15,
      sortOrder: 1,
    },
    {
      id: "ex-bf-3",
      title: "Budgeting Basics",
      description:
        "Explain what a budget is and why people use them. Show some examples of budgets.",
      type: "INSTRUCTION",
      durationMin: 20,
      sortOrder: 2,
    },
    {
      id: "ex-bf-4",
      title: "Questions?",
      description: "Ask if anyone has any questions about what was covered today.",
      type: "DISCUSSION",
      durationMin: 10,
      sortOrder: 3,
    },
  ],
};

export const BAD_MATH: ExamplePlan = {
  id: "ex-bad-math",
  title: "Ratios",
  subject: "math",
  ageGroup: "Grades 6–8",
  totalMinutes: 45,
  description: "Teach ratios.",
  quality: "bad",
  overallNote:
    "No hook or real-world connection. The entire class is lecture-then-worksheet — passive learning with no discussion, no group collaboration, and the worksheet is the only feedback mechanism. No reflection or preview for next class.",
  activities: [
    {
      id: "ex-bm-1",
      title: "Define Ratios",
      description:
        "Write the definition of a ratio on the board. Explain ratio notation. Show 3 examples.",
      type: "INSTRUCTION",
      durationMin: 15,
      sortOrder: 0,
    },
    {
      id: "ex-bm-2",
      title: "Work Through Examples on Board",
      description: "Go through 6 more ratio problems on the board. Students copy the work.",
      type: "INSTRUCTION",
      durationMin: 15,
      sortOrder: 1,
    },
    {
      id: "ex-bm-3",
      title: "Worksheet",
      description: "Students complete the ratio worksheet independently.",
      type: "PRACTICE",
      durationMin: 15,
      sortOrder: 2,
    },
  ],
};

export const BAD_BAKING: ExamplePlan = {
  id: "ex-bad-baking",
  title: "Bread Making",
  subject: "baking",
  ageGroup: "All ages (teen/adult)",
  totalMinutes: 75,
  description: "Make bread.",
  quality: "bad",
  overallNote:
    "Jumps straight into making with no conceptual frame — students follow steps like robots with no understanding of why. No check-in during the long practice block. No discussion, no reflection, and the assessment is just 'did it turn out?'",
  activities: [
    {
      id: "ex-bb-1",
      title: "Bread Overview",
      description:
        "Briefly explain what bread is and go over the recipe and ingredients at the front of the room.",
      type: "INSTRUCTION",
      durationMin: 10,
      sortOrder: 0,
    },
    {
      id: "ex-bb-2",
      title: "Make the Bread",
      description:
        "Students follow the recipe and make the bread. Mix ingredients and knead the dough. Put in bowl to rise.",
      type: "PRACTICE",
      durationMin: 55,
      sortOrder: 1,
    },
    {
      id: "ex-bb-3",
      title: "Did It Work?",
      description: "Check if the dough rose correctly.",
      type: "ASSESSMENT",
      durationMin: 10,
      sortOrder: 2,
    },
  ],
};

// ── Annotations ───────────────────────────────────────────────

export const ANNOTATIONS_GOOD_FINANCE: ExampleAnnotation[] = [
  { activityId: "ex-gf-1", note: "Opens with a personal hook — students relate to spending $100, making them immediately invested.", sentiment: "positive" },
  { activityId: "ex-gf-2", note: "Builds directly on the warm-up data — uses students' own answers as teaching material.", sentiment: "positive" },
  { activityId: "ex-gf-3", note: "Physical card sorting makes an abstract concept tactile. Pairs reduce anxiety for struggling students.", sentiment: "positive" },
  { activityId: "ex-gf-4", note: "Surfaces the 'gray area' — teaches critical thinking, not just category memorization.", sentiment: "positive" },
  { activityId: "ex-gf-5", note: "Applies concept to real (or realistic) personal data. One-on-one check-ins catch confusion early.", sentiment: "positive" },
  { activityId: "ex-gf-6", note: "Exit card doubles as formative assessment AND connects to next class. No student leaves without reflecting.", sentiment: "positive" },
];

export const ANNOTATIONS_BAD_FINANCE: ExampleAnnotation[] = [
  { activityId: "ex-bf-1", note: "No warm-up — cold start. 15 minutes of history before anything relevant to students' lives.", sentiment: "negative" },
  { activityId: "ex-bf-2", note: "Second consecutive instruction block. Students are passive for 30 minutes straight with no engagement.", sentiment: "negative" },
  { activityId: "ex-bf-3", note: "Third instruction block. Showing 'some examples' is not the same as students applying the concept themselves.", sentiment: "negative" },
  { activityId: "ex-bf-4", note: "'Questions?' at the end is not formative assessment. Students who are confused rarely know what to ask.", sentiment: "negative" },
];

export const ANNOTATIONS_GOOD_MATH: ExampleAnnotation[] = [
  { activityId: "ex-gm-1", note: "Shows the problem BEFORE the concept — curiosity drives engagement during instruction.", sentiment: "positive" },
  { activityId: "ex-gm-2", note: "Instruction is tightly scoped: 3 worked examples max. Doesn't overload working memory.", sentiment: "positive" },
  { activityId: "ex-gm-3", note: "Groups get different problems — every table has a unique task, preventing copying and building richer whole-class debrief.", sentiment: "positive" },
  { activityId: "ex-gm-4", note: "Individual assessment after group work surfaces which students need support — collected data for the next lesson.", sentiment: "positive" },
  { activityId: "ex-gm-5", note: "Addresses the most common misconception explicitly. Students leave with a mental shield against the error.", sentiment: "positive" },
];

export const ANNOTATIONS_BAD_MATH: ExampleAnnotation[] = [
  { activityId: "ex-bm-1", note: "Starts with an abstract definition. No context, no hook — math feels like memorization from minute one.", sentiment: "negative" },
  { activityId: "ex-bm-2", note: "Students copying board work is passive. Watching someone solve problems doesn't build problem-solving skill.", sentiment: "negative" },
  { activityId: "ex-bm-3", note: "Worksheet alone with no debrief means errors go unaddressed. No reflection, no preview, no connection to next class.", sentiment: "negative" },
];

export const ANNOTATIONS_GOOD_BAKING: ExampleAnnotation[] = [
  { activityId: "ex-gb-1", note: "Experiment-first design: students observe the mystery before the explanation. Curiosity is manufactured deliberately.", sentiment: "positive" },
  { activityId: "ex-gb-2", note: "Instruction arrives at the moment of highest curiosity — just after the experiment. Perfect timing.", sentiment: "positive" },
  { activityId: "ex-gb-3", note: "Long practice block is appropriate here because kneading is a motor skill. Music keeps energy high during repetitive work.", sentiment: "positive" },
  { activityId: "ex-gb-4", note: "Discussion is scheduled around the natural wait time for proofing — uses dead time as teaching time.", sentiment: "positive" },
  { activityId: "ex-gb-5", note: "Diagram-fill assessment checks retention from memory, not just recognition. The variable question pushes deeper thinking.", sentiment: "positive" },
  { activityId: "ex-gb-6", note: "Structured cleanup prevents chaos and gives instructor time for last-minute one-on-ones.", sentiment: "positive" },
];

export const ANNOTATIONS_BAD_BAKING: ExampleAnnotation[] = [
  { activityId: "ex-bb-1", note: "10-minute overview is all concept transfer before a 55-minute hands-on block. Students don't know WHY they're doing any step.", sentiment: "negative" },
  { activityId: "ex-bb-2", note: "55-minute unstructured practice with no check-ins, no milestones, and no discussion. Instructor likely retreats to the front.", sentiment: "negative" },
  { activityId: "ex-bb-3", note: "'Did it work?' is not an assessment — it's an outcome check. No reflection, no student thinking required.", sentiment: "negative" },
];

// ── Paired exports ─────────────────────────────────────────────

export const EXAMPLE_PAIRS: Array<{
  subject: "finance" | "math" | "baking";
  label: string;
  emoji: string;
  good: ExamplePlan;
  bad: ExamplePlan;
  annotationsGood: ExampleAnnotation[];
  annotationsBad: ExampleAnnotation[];
}> = [
  {
    subject: "finance",
    label: "Finance",
    emoji: "💰",
    good: GOOD_FINANCE,
    bad: BAD_FINANCE,
    annotationsGood: ANNOTATIONS_GOOD_FINANCE,
    annotationsBad: ANNOTATIONS_BAD_FINANCE,
  },
  {
    subject: "math",
    label: "Math",
    emoji: "📐",
    good: GOOD_MATH,
    bad: BAD_MATH,
    annotationsGood: ANNOTATIONS_GOOD_MATH,
    annotationsBad: ANNOTATIONS_BAD_MATH,
  },
  {
    subject: "baking",
    label: "Baking",
    emoji: "🍞",
    good: GOOD_BAKING,
    bad: BAD_BAKING,
    annotationsGood: ANNOTATIONS_GOOD_BAKING,
    annotationsBad: ANNOTATIONS_BAD_BAKING,
  },
];
