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
    },
  ],
};

// ── Export ──────────────────────────────────────────────────

export const EXAMPLE_CURRICULA: ExampleCurriculum[] = [
  financeCurriculum,
  bakingCurriculum,
  mathCurriculum,
];
