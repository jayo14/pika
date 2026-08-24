// Pika product copy: simple, concrete language about finding, following, and acting on useful conversations online.
export const ASSETS = {
  logo: "/assets/brand-mark.svg",
  logoWhite: "/assets/brand-mark-white.svg",
  dashboard: "/assets/hero-dashboard.avif",
  communitySearch: "/assets/community-search.png",
  monitoring: "/assets/monitoring-alerts.png",
  conversationContext: "/assets/conversation-context.png",
  workflowQuestion: "/assets/workflow-question.png",
  workflowResults: "/assets/workflow-results.png",
  workflowSave: "/assets/workflow-save.png",
  communityAtlas: "/assets/community-atlas.png",
  startSearch: "/assets/start-search.png",
  watchOrbit: "/assets/watch-orbit.png",
  guideSearch: "/assets/guide-search.png",
  guideMonitoring: "/assets/guide-monitoring.png",
  guideSave: "/assets/guide-save.png",
  guideCommunities: "/assets/guide-communities.png",
  grid: "/assets/background-lines.svg",
  system: "/assets/system-graphic.svg",
  screenOne: "/assets/screen-one.png",
  screenTwo: "/assets/screen-two.png",
  generatedPasswordVisual: "/assets/password-visual.png",
  generatedStyleVisual: "/assets/style-visual.png",
  articleOne: "/assets/article-one.jpg",
  articleTwo: "/assets/article-two.jpg",
  articleThree: "/assets/article-three.avif",
} as const;

export const featureItems = [
  { slug: "find", title: "Find conversations", description: "Search for people asking for help, talking about a problem, or looking for a service.", icon: "/assets/feature-find.png" },
  { slug: "communities", title: "Find communities", description: "Look for communities around a topic, industry, or group of people.", icon: "/assets/feature-communities.png" },
  { slug: "watch", title: "Watch topics", description: "Follow a topic and get notified when a useful new conversation appears.", icon: "/assets/feature-watch.png" },
  { slug: "save", title: "Save useful threads", description: "Keep the people, conversations, and communities you want to come back to.", icon: "/assets/feature-save.png" },
] as const;

export const useCases = [
  { title: "Founders", description: "Find questions, complaints, and conversations about the problems you are solving." },
  { title: "Developers", description: "Find people looking for help with the skills and services you provide." },
  { title: "Sales teams", description: "Find people already talking about a problem your product can help with." },
  { title: "Agencies", description: "Keep an eye on conversations where future clients ask for help." },
  { title: "Researchers", description: "See what people are discussing about a topic without reading every channel." },
  { title: "Community operators", description: "Keep track of the questions, needs, and changes inside your community." },
] as const;

export const articles = [
  { slug: "find-people-looking-for-a-developer", title: "How to find people looking for a developer", author: "Pika", date: "Guide", image: ASSETS.guideSearch, category: "Search" },
  { slug: "follow-a-topic-without-reading-every-post", title: "How to follow a topic without reading every post", author: "Pika", date: "Guide", image: ASSETS.guideMonitoring, category: "Monitoring" },
  { slug: "save-conversations-worth-following", title: "Which conversations are worth saving?", author: "Pika", date: "Guide", image: ASSETS.guideSave, category: "Workflow" },
  { slug: "find-communities-about-a-topic", title: "How to find communities about a topic", author: "Pika", date: "Guide", image: ASSETS.guideCommunities, category: "Communities" },
] as const;

export const faqItems = [
  { question: "What does Pika do?", answer: "Pika helps you find useful conversations, people, communities, and opportunities online. You can search for what you need, follow topics, and save useful results." },
  { question: "What can I search for?", answer: "Try a plain question: “Find people looking for a React developer,” “Show conversations about onboarding,” or “Find communities about indie games.”" },
  { question: "How does watching a topic work?", answer: "Pick a topic or a type of conversation to follow. Pika helps you keep up when new relevant posts appear, so you do not have to check everything yourself." },
  { question: "Is Pika a Discord replacement?", answer: "No. Discord is where communities live. Pika helps you find and make sense of the conversations inside them." },
  { question: "Who is Pika for?", answer: "Pika is for people who need to find useful conversations: founders, developers, sales teams, agencies, researchers, and community operators." },
] as const;

export const navItems = [
  { href: "/features", label: "Product" },
  { href: "/about", label: "Who it’s for" },
  { href: "/blog-articles", label: "Insights" },
  { href: "/contact", label: "Contact us" },
] as const;

export const workflowQuestions = [
  "Find people looking for a React developer.",
  "Find communities about product marketing.",
  "Show conversations about Stripe alternatives.",
  "What are people saying about onboarding?",
  "Tell me when someone asks for a design agency.",
] as const;

export const bodyCopy = "Search across many conversations without digging through them yourself.";
export const richLead = "Pika gives you a simpler way to find useful conversations, people, communities, and opportunities online.";
export const featureLongCopy = "Search for a topic, person, or problem. Open the results, see the conversation, and save anything you want to follow up on.";

export const legalSections = [
  { title: "Pika information", text: "Pika helps people find useful conversations, people, communities, and opportunities online." },
  { title: "Using Pika", text: "Use Pika to search, watch topics, and save useful results for your own work." },
  { title: "Questions", text: "If you have a question about Pika, use the Contact us page." },
] as const;
