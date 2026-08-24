// Pika product copy: simple, concrete language about finding, following, and acting on useful conversations online.
export const ASSETS = {
  logo: "/manus-storage/slice-ai-logo_7befa260.svg",
  logoWhite: "/manus-storage/6981d1e0d94ebbd54cbf2f1c_5599bd1ea2bd3fd68d6bb31b63521221_SliceAI Logo White_86887816.svg",
  dashboard: "/manus-storage/pika-hero-dashboard_4f90f240.avif",
  communitySearch: "/manus-storage/pika-community-search_2b7b5e91.png",
  monitoring: "/manus-storage/pika-monitoring-alerts_447dd00a.png",
  conversationContext: "/manus-storage/pika-conversation-context_f7f95ddf.png",
  workflowQuestion: "/manus-storage/pika-workflow-question_b9c44e9f.png",
  workflowResults: "/manus-storage/pika-workflow-results_a18dbb91.png",
  workflowSave: "/manus-storage/pika-workflow-save_9dfbf942.png",
  communityAtlas: "/manus-storage/pika-community-atlas_6d0d70f5.png",
  startSearch: "/manus-storage/pika-start-search_440f608b.png",
  watchOrbit: "/manus-storage/pika-watch-orbit_2ea0bb6d.png",
  guideSearch: "/manus-storage/pika-guide-search_6cd85bf9.png",
  guideMonitoring: "/manus-storage/pika-guide-monitoring_f5d51fcc.png",
  guideSave: "/manus-storage/pika-guide-save_8be1c373.png",
  guideCommunities: "/manus-storage/pika-guide-communities-replacement_fdec4a41.png",
  grid: "/manus-storage/bg-lines_2009fdd9.svg",
  system: "/manus-storage/6985d3832866c8eeb0b92350_system_80c9991a.svg",
  screenOne: "/manus-storage/screen-one_f337d35e.png",
  screenTwo: "/manus-storage/screen-two_42fb8254.png",
  generatedPasswordVisual: "/manus-storage/slice-hero-orb_46e6a24a.png",
  generatedStyleVisual: "/manus-storage/slice-feature-workflow_86ee4b47.png",
  articleOne: "/manus-storage/article-one_5a0508a7.jpg",
  articleTwo: "/manus-storage/article-two_cf690649.jpg",
  articleThree: "/manus-storage/article-three_7c68bf03.avif",
} as const;

export const featureItems = [
  { slug: "find", title: "Find conversations", description: "Search for people asking for help, talking about a problem, or looking for a service.", icon: "/manus-storage/69874b5c21fc9070b5bc96cc_icons8-commercial-96_3b960442.png" },
  { slug: "communities", title: "Find communities", description: "Look for communities around a topic, industry, or group of people.", icon: "/manus-storage/69874b16de2fccca4ed50b90_icons8-broadcasting-96_245df5a6.png" },
  { slug: "watch", title: "Watch topics", description: "Follow a topic and get notified when a useful new conversation appears.", icon: "/manus-storage/6986070198a0b05d3ede1cfe_icons8-combo-chart-96_f5d58377.png" },
  { slug: "save", title: "Save useful threads", description: "Keep the people, conversations, and communities you want to come back to.", icon: "/manus-storage/69874cbc32684aa70c703bc0_icons8-carton-96_18657653.png" },
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
