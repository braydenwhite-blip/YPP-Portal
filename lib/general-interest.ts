export const GRADE_LEVEL_OPTIONS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Other",
] as const;

export type GradeLevelOption = (typeof GRADE_LEVEL_OPTIONS)[number];

export const GENERAL_INTEREST_INTRO = [
  "The Youth Passion Project is a Delaware Nonprofit Corporation, first created to make use of the free time in people’s schedules during COVID-19. We believe that students should always have the opportunity to explore new topics of interest that they cannot learn in most school settings.",
  "Our goal is to provide these opportunities to those with a love for learning, while also allowing high school students to share their passions with others.",
  "We offered free courses taught by high schoolers to encourage younger students to expand and supplement their learning. Our large variety of classes range from Songwriting to the Art of Baking and Introduction to Coding in Java.",
  "We are now exploring starting in-person classes at high schools and would like to know if you are interested in joining the team.",
] as const;
