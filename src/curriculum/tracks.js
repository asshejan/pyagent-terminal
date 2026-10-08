// Track order = learning order. Each track's problems live in tracks/<file>.txt
export const TRACKS = [
  { id: "py", file: "01-foundations", title: "Python Foundations", blurb: "variables, collections, functions, errors, generators, JSON" },
  { id: "pyx", file: "02-pythonic", title: "Pythonic & Intermediate", blurb: "closures, decorators, context managers, dataclasses, typing" },
  { id: "oop", file: "03-oop", title: "Object-Oriented Python", blurb: "classes, inheritance, ABCs, dunders, composition, patterns" },
  { id: "ai", file: "04-ai-basics", title: "AI Engineering Basics", blurb: "messages, prompts, embeddings, chunking, retrieval, async, retries" },
  { id: "lc", file: "05-langchain", title: "LangChain Concepts", blurb: "build Runnables, LCEL pipes, parsers, tools, memory, RAG" },
  { id: "lg", file: "06-langgraph", title: "LangGraph Concepts", blurb: "state, nodes, edges, reducers, routing, ReAct, checkpoints" },
  { id: "ma", file: "07-multi-agent", title: "Multi-Agent Systems", blurb: "supervisors, handoffs, planner/critic, map-reduce, capstone" },
];
