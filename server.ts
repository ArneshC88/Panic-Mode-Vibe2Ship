import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Helper function to call Gemini with robust retry logic for transient 503 and 429 limits
async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error) || error.message || "";
    // Match common transient error patterns including status code 503, UNAVAILABLE, 429, high demand
    const isTransient = errorStr.includes("503") || 
                        errorStr.includes("UNAVAILABLE") || 
                        errorStr.includes("high demand") || 
                        errorStr.includes("429") || 
                        errorStr.includes("RESOURCE_EXHAUSTED");
    if (isTransient && retries > 0) {
      // Add a randomized jitter between 100ms and 500ms to reduce collision
      const jitter = Math.floor(Math.random() * 400) + 100;
      const totalDelay = delay + jitter;
      console.log(`API check: Transient status detected. Re-establishing link in ${totalDelay}ms. Retries remaining: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
      return callGeminiWithRetry(fn, retries - 1, Math.min(delay * 2, 4000));
    }
    throw error;
  }
}

// Panic Mode Agent Endpoint
app.post("/api/chat", async (req, res) => {
  const { messages, currentTasks, currentCalendar } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY environment variable is not set. Please configure it in Settings > Secrets."
    });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid messages array" });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const SYSTEM_PROMPT = `You are "Panic Mode," a proactive productivity agent built for the moment things have already gone wrong — not for calm planning sessions. Users come to you when they are behind, overwhelmed, or out of time.

Your job is NOT to be encouraging by default. Your job is to be honest, fast, and useful in the next 5 minutes.

When a user describes a task and a deadline, you must autonomously work through these steps without waiting to be asked at each stage:


TRIAGE: Call get_tasks and get_calendar_events to understand everything else competing for the user's time right now. Estimate realistically how much usable time exists before the deadline.
ASSESS FEASIBILITY: Compare the time required for a "complete" version of the task against the time actually available. Be honest about whether the full task is achievable.
BRANCH:

If feasible: call scope_down_task to produce a minimum-viable version of the task that avoids disaster (not the ideal version — the version that gets the user out of trouble). Then call draft_action to produce the actual first concrete artifact (an email, an outline, a message, a checklist) the user can use immediately.
If NOT feasible: do not pretend otherwise. Call draft_action with mode="damage_control" to produce something like a short extension-request email, an apology message, or a fallback plan, and tell the user plainly why you're pivoting.



If the user later says something changed (a new task, a freed-up hour, a cancelled meeting), call reprioritize and redo the relevant steps above automatically — don't wait for them to re-explain everything.


Always be concrete. Never respond with only encouragement or a generic plan. Every response should end with either a usable artifact or a clear next physical action.`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_tasks",
            description: "Returns the user's current task list with deadlines and estimated effort.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                filter: { type: Type.STRING, description: "Optional filter, e.g. 'all' or 'pending'. Default to 'all' if not specified." }
              }
            }
          },
          {
            name: "get_calendar_events",
            description: "Returns the user's calendar events for today and the next 48 hours, used to calculate realistically available time.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                hours_ahead: { type: Type.INTEGER, description: "How many hours ahead to look, default 48" }
              }
            }
          },
          {
            name: "scope_down_task",
            description: "Given a task and available time, returns a minimum-viable version of the task scoped to what's actually achievable, prioritizing avoiding disaster over completeness.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                task_description: { type: Type.STRING },
                available_minutes: { type: Type.INTEGER }
              },
              required: ["task_description", "available_minutes"]
            }
          },
          {
            name: "draft_action",
            description: "Generates a concrete, ready-to-use artifact for the user: an email, a message, an outline, or a checklist, depending on the task and mode.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                task_description: { type: Type.STRING },
                mode: { type: Type.STRING, enum: ["normal", "damage_control"], description: "normal = produce the first concrete step toward finishing; damage_control = produce a fallback like an extension request or apology message" }
              },
              required: ["task_description", "mode"]
            }
          },
          {
            name: "reprioritize",
            description: "Re-runs the triage and planning loop when the user reports new information (a new task, freed time, a cancelled commitment).",
            parameters: {
              type: Type.OBJECT,
              properties: {
                new_information: { type: Type.STRING }
              },
              required: ["new_information"]
            }
          }
        ]
      }
    ];

    // Deep copy messages history
    const contents = JSON.parse(JSON.stringify(messages));
    const executedActions: any[] = [];
    let maxTurns = 8; // safeguard
    let textResult = "";

    while (maxTurns > 0) {
      maxTurns--;

      const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: tools
        }
      }));

      const functionCalls = response.functionCalls;
      const responseContent = response.candidates?.[0]?.content;

      // Ensure model message is added to conversation
      if (responseContent) {
        contents.push({
          role: "model",
          parts: responseContent.parts || []
        });
      }

      if (functionCalls && functionCalls.length > 0) {
        const responseParts: any[] = [];

        for (const call of functionCalls) {
          let result: any = {};
          try {
            if (call.name === "get_tasks") {
              const filter = call.args?.filter || "all";
              let filtered = currentTasks || [];
              if (filter === "pending") {
                filtered = (currentTasks || []).filter((t: any) => t.status !== "completed");
              }
              result = { tasks: filtered };
            } else if (call.name === "get_calendar_events") {
              result = { events: currentCalendar || [] };
            } else if (call.name === "scope_down_task") {
              const taskDesc = call.args?.task_description || "";
              const mins = call.args?.available_minutes || 60;
              
              const subRes = await callGeminiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `The user has a task: "${taskDesc}". They have exactly ${mins} minutes available right now.
Scope this task down to a ruthlessly minimal-viable version that can be done in ${mins} minutes. Focus only on avoiding total disaster.
Return exactly 2-3 blunt, realistic, and highly concrete bullet points. Keep it brief. No encouraging language. No filler.`
              }));
              result = { scoped_task: subRes.text };
            } else if (call.name === "draft_action") {
              const taskDesc = call.args?.task_description || "";
              const mode = call.args?.mode || "normal";
              
              let subPrompt = "";
              if (mode === "damage_control") {
                subPrompt = `The task: "${taskDesc}" is impossible to finish in time. Draft an urgent, professional, but completely realistic damage-control communication (like an extension request or apology email) the user can immediately send to their manager/client/colleagues.

CRITICAL FORMATTING RULES — follow exactly:
- This must be 100% ready to copy-paste with ZERO editing required.
- NEVER use square-bracket placeholders of any kind (no [Name], no [Date], no [New Realistic Date, e.g., ...], no [Your Name], nothing in brackets at all).
- For the sign-off, end with just "Best," on its own line and nothing after it — do not write "[Your Name]" or any name placeholder.
- For any date you need to propose, pick one concrete, specific real date/time and state it plainly (e.g. "tomorrow morning, June 27th by 10 AM") — never offer a menu of options or a placeholder for the user to fill in.
- No preamble before the draft, no explanation after it — return only the pure draft text.`;
              } else {
                subPrompt = `Generate a direct, fully drafted first concrete artifact (such as an email draft, a presentation outline, a concrete checklist, or a code scaffolding) for the task: "${taskDesc}".

CRITICAL FORMATTING RULES — follow exactly:
- This must be 100% ready to use with ZERO editing required.
- NEVER use square-bracket placeholders of any kind (no [insert name], no [date], no [details], nothing in brackets at all).
- If specific details aren't known, make a reasonable, concrete, specific assumption and state it directly instead of leaving a placeholder.
- No preamble, small talk, or pleasantries. Just return the pure artifact.`;
              }

              const subRes = await callGeminiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: subPrompt
              }));
              result = { draft: subRes.text };
            } else if (call.name === "reprioritize") {
              const info = call.args?.new_information || "";
              result = { status: "success", message: `System re-triaged with new update: "${info}"` };
            }
          } catch (err: any) {
            result = { error: err.message || "Failed execution" };
          }

          const functionResponse: any = {
            name: call.name,
            response: result
          };
          if (call.id) {
            functionResponse.id = call.id;
          }
          responseParts.push({ functionResponse });

          executedActions.push({
            name: call.name,
            args: call.args || {},
            result: result
          });
        }

        // Add the function execution responses as a user role content item
        contents.push({
          role: "user",
          parts: responseParts
        });

      } else {
        // No function calls - this is the final agent response
        textResult = response.text || "";
        break;
      }
    }

    if (!textResult) {
      textResult = "Agent execution loop finished. Ready for next action.";
    }

    res.json({
      response: textResult,
      executedActions
    });

  } catch (error: any) {
    console.error("Agent error:", error);
    res.status(500).json({ error: error.message || "Internal agent error" });
  }
});

// Vite & Static file serving setup
async function startViteServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startViteServer();
