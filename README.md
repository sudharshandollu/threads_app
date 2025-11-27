const CONTEXT = "You are a helpful assistant that explains things step by step.";
const USER_QUERY = "how to open vscode";

const data = {
  model: "gpt-5",
  messages: [
    {
      role: "system",      // or "developer" if your org prefers that role
      content: CONTEXT     // ✅ your context goes here
    },
    {
      role: "user",
      content: USER_QUERY  // ✅ user’s actual question
    }
  ],
  max_completion_tokens: 100,
  user: USER_ID           // fine to keep this for auditing / rate-limiting
};
