// ============================================================
// Curriculum Builder Studio — Full curriculum examples
// 3 complete 8-week curricula: Finance, Baking/Food, Math
// ============================================================

export type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

export interface ExampleActivity {
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string;
}

export interface ExampleWeek {
  weekNumber: number;
  title: string;
  goal: string;
  activities: ExampleActivity[];
  teachingTips: string;
  atHomeAssignment: {
    type: "REFLECTION_PROMPT" | "PRACTICE_TASK" | "QUIZ" | "PRE_READING";
    title: string;
    description: string;
  };
}

export interface ExampleCurriculum {
  id: string;
  title: string;
  interestArea: string;
  description: string;
  outcomes: string[];
  classDurationMin: number;
  weeks: ExampleWeek[];
}

// ── Finance Curriculum ─────────────────────────────────────

const financeCurriculum: ExampleCurriculum = {
  id: "example-finance",
  title: "Youth Money Mastery",
  interestArea: "Finance",
  description:
    "An 8-week journey through personal finance essentials. Students build practical money skills through hands-on activities, real-world scenarios, and a capstone financial plan.",
  outcomes: [
    "Create and maintain a personal budget",
    "Explain the difference between needs and wants",
    "Describe how compound interest works",
    "Design a basic savings plan with goals",
  ],
  classDurationMin: 60,
  weeks: [
    {
      weekNumber: 1,
      title: "Budgeting Basics",
      goal: "Understand income, expenses, and the purpose of a budget",
      activities: [
        { title: "Money Talk Warm-Up", type: "WARM_UP", durationMin: 8, description: "Students share one thing they spent money on this week and whether it was planned or spontaneous." },
        { title: "Income & Expenses Breakdown", type: "INSTRUCTION", durationMin: 15, description: "Direct instruction on types of income and fixed vs variable expenses with real examples." },
        { title: "Build a Sample Budget", type: "PRACTICE", durationMin: 18, description: "Students receive a fictional paycheck and list of expenses, then create a balanced monthly budget." },
        { title: "Budget Share-Out", type: "DISCUSSION", durationMin: 10, description: "Pairs compare budgets and discuss different choices they made with the same income." },
        { title: "Spending Reflection", type: "REFLECTION", durationMin: 7, description: "Write about one spending habit you'd like to change and why." },
      ],
      teachingTips: "Bring in real pay stubs or print examples. Students relate better with real checks. Give extra time on the practice worksheet for students who haven't worked before.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Track Your Spending",
        description: "Write down every purchase you make this week (even small ones). At the end of the week, total by category: food, entertainment, transportation, etc.",
      },
    },
    {
      weekNumber: 2,
      title: "Needs vs Wants",
      goal: "Categorize expenses and make intentional spending decisions",
      activities: [
        { title: "Rapid Sort Challenge", type: "WARM_UP", durationMin: 6, description: "Students sort 20 expense cards into 'need' and 'want' piles as fast as possible." },
        { title: "The Needs-Wants Spectrum", type: "INSTRUCTION", durationMin: 12, description: "Explore how needs and wants exist on a spectrum and vary by context and culture." },
        { title: "Scenario Spending Decisions", type: "PRACTICE", durationMin: 15, description: "Given limited funds, students decide which items to buy and justify each choice." },
        { title: "Wants That Feel Like Needs", type: "DISCUSSION", durationMin: 12, description: "Group discussion on marketing tactics that make wants feel like needs." },
        { title: "Priority Check", type: "ASSESSMENT", durationMin: 8, description: "Quick quiz: categorize 10 items and explain one tricky choice." },
      ],
      teachingTips: "Print the expense sort cards before class. Expect debate on items like gym memberships or phones — that's intentional. Let students wrestle with the grey areas.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Reflect on One Want",
        description: "Write about one thing you bought recently that you'd now classify as a 'want.' Why did it feel necessary at the time? How do you feel about that purchase now?",
      },
    },
    {
      weekNumber: 3,
      title: "Savings Goals",
      goal: "Set SMART financial goals and understand the power of saving",
      activities: [
        { title: "Dream Purchase Gallery", type: "WARM_UP", durationMin: 7, description: "Students draw or write about something they want to save for and estimate its cost." },
        { title: "SMART Goal Framework", type: "INSTRUCTION", durationMin: 14, description: "Teach the SMART goal framework applied specifically to financial goals with examples." },
        { title: "Savings Calculator", type: "PRACTICE", durationMin: 18, description: "Students use a savings worksheet to calculate how long it takes to reach their goal at different saving rates." },
        { title: "Savings Plan Peer Review", type: "GROUP_WORK", durationMin: 12, description: "Partners review each other's savings plans and suggest improvements." },
        { title: "Goal Commitment Card", type: "REFLECTION", durationMin: 6, description: "Write a savings commitment card with goal, timeline, and weekly amount." },
      ],
      teachingTips: "Have students use their real savings goals if comfortable — it makes the math meaningful. Pre-fill the savings worksheet with example goals for students who are reluctant to share.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Create Your Real Savings Plan",
        description: "Choose one real savings goal. Calculate how long to reach it if you save a set amount each week. Write your goal, timeline, and weekly commitment.",
      },
    },
    {
      weekNumber: 4,
      title: "Understanding Credit",
      goal: "Explain what credit is, how scores work, and responsible credit use",
      activities: [
        { title: "Credit Myth or Fact?", type: "WARM_UP", durationMin: 7, description: "Students vote on whether common credit statements are myths or facts." },
        { title: "Credit Scores Explained", type: "INSTRUCTION", durationMin: 16, description: "Walk through the 5 factors that determine a credit score with visual diagrams." },
        { title: "Credit Scenario Cards", type: "PRACTICE", durationMin: 15, description: "Students read scenarios and predict how each action affects a credit score." },
        { title: "Debt Trap Discussion", type: "DISCUSSION", durationMin: 12, description: "Discuss how high-interest debt grows and strategies to avoid it." },
        { title: "Credit Health Check", type: "ASSESSMENT", durationMin: 8, description: "Match credit behaviors to their score impact: positive, negative, or neutral." },
      ],
      teachingTips: "Students often think 'using credit always means debt.' The myth/fact warm-up surfaces these misconceptions — address them head-on rather than correcting passively.",
      atHomeAssignment: {
        type: "QUIZ",
        title: "Credit Score Quick Check",
        description: "Answer these 5 questions without looking them up: What is the credit score range? Name 3 factors that affect your score. What's considered a 'good' score? What hurts your score most? How do you build credit from scratch?",
      },
    },
    {
      weekNumber: 5,
      title: "Banking & Accounts",
      goal: "Compare account types and choose appropriate banking products",
      activities: [
        { title: "Banking Bingo", type: "WARM_UP", durationMin: 7, description: "Play bingo with banking terms students have encountered in daily life." },
        { title: "Account Types Deep Dive", type: "INSTRUCTION", durationMin: 15, description: "Compare checking, savings, money market, and CDs with pros, cons, and fee structures." },
        { title: "Bank Comparison Shopping", type: "PRACTICE", durationMin: 18, description: "Research and compare 3 real banks' offerings using a structured comparison worksheet." },
        { title: "Fee Alert Discussion", type: "DISCUSSION", durationMin: 10, description: "Discuss hidden fees and how to avoid them using real bank fee schedules." },
        { title: "My Ideal Account", type: "REFLECTION", durationMin: 7, description: "Write which account type fits your current needs and explain why." },
      ],
      teachingTips: "If students don't have bank accounts, this is a great time to explain how to open one. Normalize the process and walk through what documents are typically needed.",
      atHomeAssignment: {
        type: "PRE_READING",
        title: "Compare Real Bank Accounts",
        description: "Look up checking and savings account options at two different banks. Note minimum balance requirements, monthly fees, and any sign-up bonuses. Bring your notes next session.",
      },
    },
    {
      weekNumber: 6,
      title: "Investing Intro",
      goal: "Understand basic investment types and the relationship between risk and return",
      activities: [
        { title: "Risk Tolerance Quiz", type: "WARM_UP", durationMin: 6, description: "Quick personality-style quiz to discover your risk tolerance profile." },
        { title: "Stocks, Bonds & Funds", type: "INSTRUCTION", durationMin: 16, description: "Explain the three main investment types with real-world examples and historical returns." },
        { title: "Mock Portfolio Builder", type: "PRACTICE", durationMin: 15, description: "Students allocate $1,000 across investment types based on their risk profile." },
        { title: "Risk vs Reward Debate", type: "DISCUSSION", durationMin: 12, description: "Teams debate: is it better to invest aggressively young or play it safe?" },
        { title: "Compound Interest Calculator", type: "PRACTICE", durationMin: 8, description: "Calculate how $100/month grows over 10, 20, and 40 years at different rates." },
      ],
      teachingTips: "Compound interest is abstract. Use the $100/month calculator activity — let students adjust the numbers themselves and discover the power of starting early.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Your Investor Personality",
        description: "Based on your risk tolerance quiz, write about what kind of investor you'd be. What would you invest in and why? How would you feel if your investment lost 20% temporarily?",
      },
    },
    {
      weekNumber: 7,
      title: "Smart Spending",
      goal: "Recognize marketing tactics and make informed purchasing decisions",
      activities: [
        { title: "Ad Breakdown", type: "WARM_UP", durationMin: 7, description: "Analyze a real advertisement and identify the emotional triggers it uses." },
        { title: "Marketing Tricks Exposed", type: "INSTRUCTION", durationMin: 14, description: "Teach common marketing and pricing tactics: anchoring, decoys, urgency, and social proof." },
        { title: "Comparison Shopping Challenge", type: "PRACTICE", durationMin: 16, description: "Students compare the real cost of 3 similar products considering quality, longevity, and unit price." },
        { title: "Consumer Rights & Returns", type: "INSTRUCTION", durationMin: 8, description: "Brief overview of consumer protection, return policies, and scam awareness." },
        { title: "Smart Shopper Pledge", type: "REFLECTION", durationMin: 6, description: "Write 3 personal rules for making smarter purchase decisions." },
      ],
      teachingTips: "Use real, recent social media ads if possible. The comparison shopping activity works best if students can use their phones to look up real prices.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Spot 3 Marketing Tactics",
        description: "This week, document 3 times you spot a marketing tactic from class (anchoring, urgency, social proof, decoy pricing, etc.). Screenshot or describe each and identify the tactic.",
      },
    },
    {
      weekNumber: 8,
      title: "Financial Planning Project",
      goal: "Apply all concepts by creating a comprehensive personal financial plan",
      activities: [
        { title: "Plan Components Review", type: "WARM_UP", durationMin: 5, description: "Quick recap of all 7 topics covered and what a complete financial plan includes." },
        { title: "Build Your Financial Plan", type: "PRACTICE", durationMin: 25, description: "Students create a one-page financial plan including budget, savings goal, and spending guidelines." },
        { title: "Plan Presentations", type: "GROUP_WORK", durationMin: 18, description: "Students present their financial plans in small groups and give constructive feedback." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 8, description: "Write about the most valuable lesson learned and one financial change you'll make this month." },
      ],
      teachingTips: "Share the project guidelines at the end of Week 7 so students can think ahead. The 25-minute build time is intentional — resist cutting it. Students who finish early can add detail to their plan.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Refine Your Financial Plan",
        description: "Add at least one more detail to your financial plan after class: update your savings goal with a real target date, add a spending rule you'll follow, or find one tool (app or book) that will help.",
      },
    },
  ],
};

// ── Baking Curriculum ──────────────────────────────────────

const bakingCurriculum: ExampleCurriculum = {
  id: "example-baking",
  title: "Baking Lab: Science of Food",
  interestArea: "Baking/Food",
  description:
    "An 8-week hands-on baking course that combines culinary technique with food science. Students learn safety, measurement, and baking methods while creating real recipes each week.",
  outcomes: [
    "Apply food safety and kitchen hygiene practices",
    "Use precise measurements and ratios in recipes",
    "Explain the science behind leavening and gluten development",
    "Create original recipes using learned techniques",
  ],
  classDurationMin: 90,
  weeks: [
    {
      weekNumber: 1,
      title: "Kitchen Safety & Setup",
      goal: "Master kitchen safety rules and proper workspace organization",
      activities: [
        { title: "Kitchen Hazard Hunt", type: "WARM_UP", durationMin: 10, description: "Look at photos of kitchen setups and identify safety hazards in each one." },
        { title: "Safety Rules & Hygiene", type: "INSTRUCTION", durationMin: 18, description: "Cover the 10 essential kitchen safety rules: knife handling, heat, allergies, cross-contamination, and more." },
        { title: "Handwashing & Station Setup", type: "PRACTICE", durationMin: 15, description: "Practice proper handwashing technique and organize a baking station with all needed tools." },
        { title: "Equipment Identification", type: "PRACTICE", durationMin: 20, description: "Hands-on activity identifying and naming 20 common baking tools and their uses." },
        { title: "Safety Scenario Quiz", type: "ASSESSMENT", durationMin: 12, description: "Read kitchen scenarios and identify the correct safety response for each." },
        { title: "Kitchen Rules Commitment", type: "REFLECTION", durationMin: 8, description: "Sign a kitchen safety agreement and write your top 3 safety priorities." },
      ],
      teachingTips: "Laminate the safety rules and post them at each station. Walk students through handwashing one at a time — it takes longer than expected. Build a culture where safety questions are celebrated.",
      atHomeAssignment: {
        type: "PRE_READING",
        title: "Watch: Kitchen Safety Basics",
        description: "Watch a short video (5–10 min) about professional kitchen safety. Notice 3 things the staff do that we covered in class. Be ready to share your observations next session.",
      },
    },
    {
      weekNumber: 2,
      title: "Measuring & Ratios",
      goal: "Use precise measurements and scale recipes up or down",
      activities: [
        { title: "Estimation Challenge", type: "WARM_UP", durationMin: 8, description: "Guess measurements of flour, sugar, and water by sight, then verify with tools." },
        { title: "Wet vs Dry Measuring", type: "INSTRUCTION", durationMin: 15, description: "Demonstrate the difference between measuring wet and dry ingredients and why it matters." },
        { title: "Precision Measuring Drill", type: "PRACTICE", durationMin: 18, description: "Students measure ingredients three times each and compare for consistency." },
        { title: "Recipe Scaling Math", type: "PRACTICE", durationMin: 20, description: "Scale a cookie recipe from 24 servings to 12 and 48, calculating each ingredient." },
        { title: "Bake a Basic Recipe", type: "GROUP_WORK", durationMin: 22, description: "In teams, follow a simple muffin recipe focusing on precise measurements." },
        { title: "Measurement Journal", type: "REFLECTION", durationMin: 7, description: "Record which measurements were hardest and what you learned about precision." },
      ],
      teachingTips: "Show the 'scoop and level' vs 'spoon and level' flour techniques side by side — the difference in weight is dramatic and memorable for students.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Home Measuring Practice",
        description: "Find a recipe at home with at least 5 ingredients. Write down all the measurements, then scale the recipe by 1.5x. Bring your work to show next class.",
      },
    },
    {
      weekNumber: 3,
      title: "Bread Science",
      goal: "Understand yeast, gluten, and fermentation in bread making",
      activities: [
        { title: "Yeast Activation Demo", type: "WARM_UP", durationMin: 10, description: "Watch yeast activate in warm water with sugar and discuss what's happening biologically." },
        { title: "Gluten & Fermentation", type: "INSTRUCTION", durationMin: 16, description: "Explain gluten development, yeast fermentation, and why kneading matters with diagrams." },
        { title: "Kneading Technique Practice", type: "PRACTICE", durationMin: 15, description: "Learn and practice proper kneading technique with teacher demonstration and coaching." },
        { title: "Focaccia Bake", type: "PRACTICE", durationMin: 30, description: "Students make focaccia dough, shape, proof, and bake with herb toppings." },
        { title: "Bread Texture Analysis", type: "DISCUSSION", durationMin: 10, description: "Compare bread textures from different kneading times and discuss the science." },
        { title: "Bread Science Log", type: "REFLECTION", durationMin: 7, description: "Draw and describe the stages of your dough from mixing to baked bread." },
      ],
      teachingTips: "Start yeast activation at the very beginning of class so students can observe it throughout the lesson. Most students under-knead on the first attempt — build in extra coaching time.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Bread Science Reflection",
        description: "Write about the science you observed: What happened to the dough as you kneaded it more? What did the yeast do? What would happen if you used cold water instead of warm?",
      },
    },
    {
      weekNumber: 4,
      title: "Pastry Techniques",
      goal: "Learn lamination principles and create flaky pastry dough",
      activities: [
        { title: "Pastry Tasting", type: "WARM_UP", durationMin: 8, description: "Taste three pastry types (puff, shortcrust, choux) and describe textures." },
        { title: "Lamination Science", type: "INSTRUCTION", durationMin: 15, description: "Explain how butter layers create flakiness, the role of cold temperatures, and folding techniques." },
        { title: "Butter Temperature Experiment", type: "PRACTICE", durationMin: 12, description: "Work with butter at different temperatures to see how it affects dough workability." },
        { title: "Rough Puff Pastry", type: "PRACTICE", durationMin: 30, description: "Make rough puff pastry with proper folding technique, chill, and bake into palmiers." },
        { title: "Break", type: "BREAK", durationMin: 10, description: "Rest while pastry chills. Clean workspace and prep for baking." },
        { title: "Pastry Comparison", type: "DISCUSSION", durationMin: 8, description: "Compare results across teams: what made some flakier than others?" },
        { title: "Technique Notes", type: "REFLECTION", durationMin: 7, description: "Write the 3 most important things to remember when making pastry." },
      ],
      teachingTips: "Temperature control is the biggest challenge. Have a thermometer available and let students check butter temperature. Pre-chill work surfaces if possible.",
      atHomeAssignment: {
        type: "PRE_READING",
        title: "Research: Types of Pastry",
        description: "Look up the difference between puff pastry, shortcrust, and choux pastry. Find one recipe using each type. What makes each unique? Come ready to explain in your own words.",
      },
    },
    {
      weekNumber: 5,
      title: "Cake Chemistry",
      goal: "Understand leavening agents and mixing methods for different cake textures",
      activities: [
        { title: "Leavening Demo", type: "WARM_UP", durationMin: 8, description: "Watch baking soda + vinegar vs baking powder + water reactions and discuss differences." },
        { title: "Chemical vs Mechanical Leavening", type: "INSTRUCTION", durationMin: 14, description: "Explain how baking soda, baking powder, and whipped eggs each create rise differently." },
        { title: "Mixing Method Stations", type: "PRACTICE", durationMin: 15, description: "Rotate through 3 stations: creaming, folding, and reverse creaming methods." },
        { title: "Cupcake Bake-Off", type: "PRACTICE", durationMin: 28, description: "Teams bake cupcakes using different mixing methods, then compare texture and rise." },
        { title: "Taste & Analyze", type: "ASSESSMENT", durationMin: 12, description: "Blind taste test cupcakes from different methods and identify which method was used." },
        { title: "Chemistry Journal", type: "REFLECTION", durationMin: 8, description: "Explain in your own words why overmixing cake batter is a problem." },
      ],
      teachingTips: "Set up the stations before class. Print clear instructions at each station so students can work independently. Remind students not to overmix — it's the most common error in this lesson.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Bake at Home",
        description: "Try baking a simple recipe at home using one of the mixing methods practiced in class. Note which method you used, how the result turned out, and what you'd do differently. Bring photos if you have them!",
      },
    },
    {
      weekNumber: 6,
      title: "Decoration & Presentation",
      goal: "Apply basic piping and plating techniques for professional presentation",
      activities: [
        { title: "Plating Inspiration Gallery", type: "WARM_UP", durationMin: 8, description: "View photos of professional plating and vote on favorites, discussing what makes them appealing." },
        { title: "Piping Fundamentals", type: "INSTRUCTION", durationMin: 14, description: "Demonstrate 5 essential piping tips: round, star, leaf, petal, and basket weave." },
        { title: "Piping Practice Board", type: "PRACTICE", durationMin: 20, description: "Practice each piping technique on parchment paper before moving to cupcakes." },
        { title: "Cupcake Decoration Challenge", type: "PRACTICE", durationMin: 25, description: "Decorate 4 cupcakes using at least 3 different piping techniques and garnishes." },
        { title: "Gallery Walk & Feedback", type: "GROUP_WORK", durationMin: 12, description: "Display decorated items and rotate giving written feedback on technique and creativity." },
        { title: "Design Sketch", type: "REFLECTION", durationMin: 7, description: "Sketch your dream cake design using the techniques learned today." },
      ],
      teachingTips: "Stock extra piping bags — they pop more than expected. The practice board is essential before students move to real cupcakes. Push for specific feedback during the gallery walk, not just generic praise.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Design Your Dream Cake",
        description: "Sketch or describe your dream cake in detail. What flavors, layers, and decorations would it have? What piping techniques would you use? This sketch can inspire your final project.",
      },
    },
    {
      weekNumber: 7,
      title: "Business of Baking",
      goal: "Calculate food costs and develop a pricing strategy for baked goods",
      activities: [
        { title: "How Much Does a Cookie Cost?", type: "WARM_UP", durationMin: 8, description: "Guess the ingredient cost of a single chocolate chip cookie, then calculate the real number." },
        { title: "Food Costing Method", type: "INSTRUCTION", durationMin: 16, description: "Teach the food cost formula: ingredient cost, labor, overhead, and profit margin." },
        { title: "Recipe Costing Worksheet", type: "PRACTICE", durationMin: 18, description: "Calculate the true cost per unit for three different recipes using real ingredient prices." },
        { title: "Pricing Strategy Discussion", type: "DISCUSSION", durationMin: 12, description: "Discuss pricing strategies: cost-plus, market rate, and value-based pricing." },
        { title: "Mini Business Plan", type: "PRACTICE", durationMin: 22, description: "Draft a one-page bakery business plan: 3 products, costs, prices, and target customers." },
        { title: "Entrepreneur Reflection", type: "REFLECTION", durationMin: 7, description: "Would you start a baking business? Why or why not? What would your signature item be?" },
      ],
      teachingTips: "Look up actual local ingredient prices before class for the costing worksheet to be realistic. The 'how much does a cookie cost?' warm-up always surprises students — let them guess freely first.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Price Your Signature Item",
        description: "Choose one baked item you love making. Calculate the true ingredient cost per serving, add estimated labor time, and set a price. Research what similar items sell for locally or online.",
      },
    },
    {
      weekNumber: 8,
      title: "Showcase Project",
      goal: "Design, bake, and present an original recipe using all learned techniques",
      activities: [
        { title: "Recipe Brainstorm", type: "WARM_UP", durationMin: 8, description: "Brainstorm original recipe ideas combining at least 2 techniques from the course." },
        { title: "Recipe Writing Workshop", type: "INSTRUCTION", durationMin: 10, description: "How to write a clear, complete recipe: ingredients, steps, temps, and timing." },
        { title: "Bake Your Original Recipe", type: "PRACTICE", durationMin: 35, description: "Students prepare and bake their original creations with teacher guidance available." },
        { title: "Plate & Present", type: "GROUP_WORK", durationMin: 20, description: "Present your creation to the class: explain your inspiration, techniques used, and what you'd change." },
        { title: "Course Celebration & Reflection", type: "REFLECTION", durationMin: 10, description: "Taste everyone's creations and write a final reflection on your growth as a baker." },
      ],
      teachingTips: "This 83-minute showcase fits comfortably within a 90-minute session — pre-stage all equipment. During the 20-minute presentations, coach students to explain their technique choices, not just describe what they made.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Your Baking Journey",
        description: "Write a final reflection: What was your biggest 'aha' moment in this course? What skill improved most? What would you tell someone just starting baking for the first time? What will you make next?",
      },
    },
  ],
};

// ── Math Curriculum ────────────────────────────────────────

const mathCurriculum: ExampleCurriculum = {
  id: "example-math",
  title: "Algebra Through Real Life",
  interestArea: "Math",
  description:
    "An 8-week algebra course that connects abstract math concepts to everyday situations. Students discover that algebra is a tool for solving real problems, not just textbook exercises.",
  outcomes: [
    "Translate real-world problems into algebraic expressions",
    "Solve linear equations and inequalities",
    "Graph linear functions and interpret slope/intercept",
    "Apply algebraic reasoning to multi-step problems",
  ],
  classDurationMin: 60,
  weeks: [
    {
      weekNumber: 1,
      title: "Patterns & Variables",
      goal: "Recognize patterns and use variables to represent unknown quantities",
      activities: [
        { title: "Pattern Detective", type: "WARM_UP", durationMin: 8, description: "Find the rule in 5 visual and number patterns, then predict the next three terms." },
        { title: "Variables as Placeholders", type: "INSTRUCTION", durationMin: 14, description: "Introduce variables using real contexts: age puzzles, price calculations, and distance problems." },
        { title: "Words to Expressions", type: "PRACTICE", durationMin: 16, description: "Translate 10 real-world word phrases into algebraic expressions (e.g., 'twice a number plus 5')." },
        { title: "Expression Matching Game", type: "GROUP_WORK", durationMin: 12, description: "Match word problems to their correct algebraic expressions in competing teams." },
        { title: "Variable Reflection", type: "REFLECTION", durationMin: 6, description: "Where do you see 'unknowns' in your daily life that could be represented by variables?" },
      ],
      teachingTips: "Use physical objects (tiles, coins) for pattern activities before moving to numbers. Students who struggle with abstract patterns often do fine with spatial ones.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Find Patterns Around You",
        description: "Find 3 real-world patterns in daily life (prices that follow a pattern, temperature changes, sports stats, etc.). Write an algebraic expression for each. Be ready to share next class.",
      },
    },
    {
      weekNumber: 2,
      title: "Expressions & Simplifying",
      goal: "Combine like terms and apply the distributive property",
      activities: [
        { title: "Like Terms Sort", type: "WARM_UP", durationMin: 7, description: "Sort expression cards into groups of like terms as quickly as possible." },
        { title: "Combining Like Terms", type: "INSTRUCTION", durationMin: 14, description: "Use algebra tiles and visual models to show why 3x + 2x = 5x but 3x + 2y stays as is." },
        { title: "Distributive Property Practice", type: "PRACTICE", durationMin: 16, description: "Apply the distributive property to expand and simplify 12 expressions of increasing difficulty." },
        { title: "Simplification Race", type: "GROUP_WORK", durationMin: 12, description: "Teams race to correctly simplify expressions on the whiteboard, relay-style." },
        { title: "Exit Ticket", type: "ASSESSMENT", durationMin: 7, description: "Simplify 3 expressions and explain one step in your own words." },
      ],
      teachingTips: "Algebra tiles are highly effective — students can physically combine like terms. Colored sticky notes work if tiles aren't available. Mix ability levels in the relay race teams.",
      atHomeAssignment: {
        type: "QUIZ",
        title: "Like Terms Mini Quiz",
        description: "Simplify these 5 expressions without notes: 3x + 5 + 2x, 4y - y + 3, 2(x+4), 5x + 2y - 3x + y, and 3(2x-1) + x. Check your work when you're done and note where you got stuck.",
      },
    },
    {
      weekNumber: 3,
      title: "One-Step Equations",
      goal: "Solve one-step equations using inverse operations",
      activities: [
        { title: "Balance Scale Demo", type: "WARM_UP", durationMin: 8, description: "Use a physical or virtual balance to show that equations must stay balanced." },
        { title: "Inverse Operations", type: "INSTRUCTION", durationMin: 15, description: "Teach the four inverse operation pairs and how to isolate a variable step-by-step." },
        { title: "Equation Solving Practice", type: "PRACTICE", durationMin: 15, description: "Solve 15 one-step equations: addition, subtraction, multiplication, and division." },
        { title: "Word Problem Workshop", type: "PRACTICE", durationMin: 12, description: "Set up and solve 5 real-world word problems as one-step equations." },
        { title: "Peer Teaching", type: "DISCUSSION", durationMin: 7, description: "Explain your solution process to a partner. They check your work and ask questions." },
      ],
      teachingTips: "Keep returning to the balance scale analogy throughout the unit. Encourage students to write the inverse operation before solving, rather than guessing the answer.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Write Your Own Equations",
        description: "Write 5 one-step word problems from your own life that could be solved with an equation (e.g., 'I have $20. After buying x, I have $13. How much did x cost?'). Write each equation and solve it.",
      },
    },
    {
      weekNumber: 4,
      title: "Multi-Step Equations",
      goal: "Solve equations with multiple steps and variables on both sides",
      activities: [
        { title: "Two-Step Warm-Up", type: "WARM_UP", durationMin: 7, description: "Solve 3 two-step equations independently, then compare answers with a neighbor." },
        { title: "Multi-Step Strategy", type: "INSTRUCTION", durationMin: 15, description: "Demonstrate the strategy: simplify each side, collect variables, then isolate using inverse ops." },
        { title: "Variables on Both Sides", type: "PRACTICE", durationMin: 16, description: "Work through 10 equations with variables on both sides, showing each step." },
        { title: "Real-World Applications", type: "PRACTICE", durationMin: 12, description: "Solve problems about comparing phone plans, distance/rate/time, and pricing scenarios." },
        { title: "Error Analysis", type: "ASSESSMENT", durationMin: 8, description: "Find and correct the mistakes in 4 solved equations, explaining what went wrong." },
      ],
      teachingTips: "Students learn more from finding someone else's error than from solving correctly themselves. Show a worked example with a deliberate mistake before handing out the error analysis worksheet.",
      atHomeAssignment: {
        type: "PRE_READING",
        title: "Real-World Equation Practice",
        description: "Find a real situation this week that could be modeled with a multi-step equation (comparing costs, figuring out time needed, splitting expenses). Write the equation and solve it. Bring it to share.",
      },
    },
    {
      weekNumber: 5,
      title: "Inequalities",
      goal: "Solve and graph linear inequalities on a number line",
      activities: [
        { title: "Inequality in Life", type: "WARM_UP", durationMin: 6, description: "List real situations that use inequality language: 'at least,' 'no more than,' 'fewer than.'" },
        { title: "Inequality Symbols & Rules", type: "INSTRUCTION", durationMin: 14, description: "Teach inequality symbols, the flip rule when multiplying/dividing by negatives, and graphing conventions." },
        { title: "Solving Inequalities", type: "PRACTICE", durationMin: 16, description: "Solve and graph 12 inequalities, including multi-step and compound inequalities." },
        { title: "Inequality Word Problems", type: "PRACTICE", durationMin: 12, description: "Model real constraints: budget limits, height requirements, and minimum grades." },
        { title: "Graphing Check", type: "ASSESSMENT", durationMin: 8, description: "Graph 4 inequality solutions on number lines and write the solution in interval notation." },
      ],
      teachingTips: "The flip rule (multiplying/dividing by a negative) is always confusing. Build in extra time and have students verify answers by substituting a value from their solution set.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Inequality in Real Life",
        description: "Find 3 real constraints in your life that are inequalities (spending limit, minimum grade needed, time available). Write each as an algebraic inequality and graph it on a number line.",
      },
    },
    {
      weekNumber: 6,
      title: "Functions & Graphs",
      goal: "Understand functions as input-output machines and graph linear relationships",
      activities: [
        { title: "Function Machine", type: "WARM_UP", durationMin: 7, description: "Play the function machine game: given inputs and outputs, guess the rule." },
        { title: "What is a Function?", type: "INSTRUCTION", durationMin: 15, description: "Define functions, domain, range. Use tables, mapping diagrams, and the vertical line test." },
        { title: "Plotting Points", type: "PRACTICE", durationMin: 14, description: "Create input-output tables for 4 functions and plot them on coordinate planes." },
        { title: "Slope Introduction", type: "INSTRUCTION", durationMin: 12, description: "Introduce slope as rate of change using real examples: speed, hourly pay, temperature change." },
        { title: "Slope from Graphs", type: "PRACTICE", durationMin: 8, description: "Calculate slope from 5 graphs and identify whether each relationship is increasing or decreasing." },
      ],
      teachingTips: "Make sure students understand domain and range before graphing. Rushing past this foundation causes confusion later with slope and intercepts.",
      atHomeAssignment: {
        type: "PRACTICE_TASK",
        title: "Graph a Real Relationship",
        description: "Find a real relationship that changes at a constant rate (earning money per hour, distance while walking). Make a table of values, plot the points, and identify the slope. What does the slope mean in context?",
      },
    },
    {
      weekNumber: 7,
      title: "Systems Preview",
      goal: "Understand what it means for two equations to share a solution",
      activities: [
        { title: "Two Plans Problem", type: "WARM_UP", durationMin: 7, description: "Phone plan A costs $30 + $0.10/text. Plan B costs $40 + $0.05/text. When are they equal?" },
        { title: "Systems by Graphing", type: "INSTRUCTION", durationMin: 16, description: "Graph two linear equations and find their intersection point as the solution to the system." },
        { title: "Graphing Systems Practice", type: "PRACTICE", durationMin: 16, description: "Graph 4 systems of equations and identify the solution point for each." },
        { title: "Real-World Intersections", type: "DISCUSSION", durationMin: 10, description: "Discuss real scenarios where finding the break-even or meeting point matters." },
        { title: "Systems Check", type: "ASSESSMENT", durationMin: 8, description: "Solve one system by graphing and verify the solution works in both equations." },
      ],
      teachingTips: "The phone plan warm-up sets up the whole lesson — work through it slowly before introducing formal vocabulary. Many students will graphically solve the problem before you name what it is.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Systems in Your Life",
        description: "Think of a real decision involving two options (two job offers, two products, two routes). Could it be modeled as a system of equations? Describe the situation and, if possible, write the two equations.",
      },
    },
    {
      weekNumber: 8,
      title: "Application Project",
      goal: "Apply algebraic reasoning to create and solve an original real-world problem",
      activities: [
        { title: "Concept Map Review", type: "WARM_UP", durationMin: 6, description: "Create a quick concept map connecting all the algebra topics covered in the course." },
        { title: "Project Guidelines", type: "INSTRUCTION", durationMin: 8, description: "Explain the project: create a real-world scenario that uses at least 3 algebra concepts." },
        { title: "Build Your Problem", type: "PRACTICE", durationMin: 22, description: "Students design their real-world algebra problem, write the equations, and solve them." },
        { title: "Gallery Walk Presentations", type: "GROUP_WORK", durationMin: 15, description: "Post problems around the room. Students rotate, solve each other's problems, and leave feedback." },
        { title: "Course Reflection", type: "REFLECTION", durationMin: 7, description: "Write about how your view of algebra changed and one way you'll use it outside of class." },
      ],
      teachingTips: "The gallery walk is the highlight of the course. When giving feedback, push students to be specific: 'Your equation setup is correct — explain why you chose that variable.' The concept map at the start helps students recall everything they've learned.",
      atHomeAssignment: {
        type: "REFLECTION_PROMPT",
        title: "Algebra in Your Future",
        description: "Write a letter to your future self: How will you use algebraic thinking beyond math class? Pick one concept from this course and explain how it connects to a real goal or situation in your life.",
      },
    },
  ],
};

// ── Export ──────────────────────────────────────────────────

export const EXAMPLE_CURRICULA: ExampleCurriculum[] = [
  financeCurriculum,
  bakingCurriculum,
  mathCurriculum,
];
