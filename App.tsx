import React, { useState, useEffect, useRef } from "react";
import { 
  Flame, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  Calendar, 
  Send, 
  Copy, 
  Sparkles, 
  AlertTriangle, 
  CheckSquare, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  Info,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, CalendarEvent, Message } from "./types";

export default function App() {
  // Seed initial tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("panic_tasks");
    if (saved) return JSON.parse(saved);
    return [
      { id: "t1", title: "Write final project writeup", deadline: "5:00 PM today", estimated_effort_hours: 4, status: "pending" },
      { id: "t2", title: "Prep slide deck for client review", deadline: "9:00 AM tomorrow", estimated_effort_hours: 3, status: "pending" },
      { id: "t3", title: "Review team pull requests", deadline: "In 48 hours", estimated_effort_hours: 2, status: "completed" }
    ];
  });

  // Seed initial calendar events
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem("panic_events");
    if (saved) return JSON.parse(saved);
    return [
      { id: "c1", title: "Weekly Sync & Status Update", start: "Today at 10:00 AM", duration_minutes: 60 },
      { id: "c2", title: "Mandatory Dentist Appointment", start: "Today at 2:00 PM", duration_minutes: 90 },
      { id: "c3", title: "1-on-1 with Engineering Manager", start: "Tomorrow at 11:00 AM", duration_minutes: 30 }
    ];
  });

  // Saved chat history
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("panic_messages");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "msg-welcome",
        role: "model",
        content: "I am **Panic Mode**. You are behind, overwhelmed, or running out of time. Tell me what you need to finish and when. I will pull your tasks and calendar, decide if it is realistically achievable, and either ruthlessly scope it down or write a damage-control extension draft for you immediately. No encouragement, just execution.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  // Input states
  const [userInput, setUserInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Task & Event forms
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskHours, setNewTaskHours] = useState(1);

  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventMinutes, setNewEventMinutes] = useState(30);

  // User custom deadline countdown configuration
  const [deadlineTime, setDeadlineTime] = useState("17:00"); // default 5:00 PM today
  const [countdownString, setCountdownString] = useState("");

  // UI state for showing tool results in dropdowns
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem("panic_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("panic_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("panic_messages", JSON.stringify(messages));
  }, [messages]);

  // Handle active countdown update
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = deadlineTime.split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      // If today's deadline time has already passed, roll forward to
      // tomorrow instead of getting permanently stuck on "PAST DEADLINE".
      if (target.getTime() < now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      {
        const diffMs = target.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
        setCountdownString(`${diffHours}h ${diffMins}m ${diffSecs}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [deadlineTime]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  // Simulated agent thoughts cycle
  useEffect(() => {
    if (!isPending) return;
    const steps = [
      "Accessing current task priority queue...",
      "Calculating available blocks from calendar events...",
      "Analyzing realistic work velocity vs. target deadline...",
      "Executing triage decision matrices (feasible vs. impossible)...",
      "Drafting optimal backup communication and scoped alternatives..."
    ];
    setPendingSteps(steps);
    setCurrentStepIndex(0);

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2200);

    return () => clearInterval(interval);
  }, [isPending]);

  // Quick Action copy-paste helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick preset triggers
  const handlePresetClick = (presetText: string) => {
    setUserInput(presetText);
  };

  // Submit User Message to backend Agent
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || userInput;
    if (!textToSend.trim() || isPending) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Update messages
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setUserInput("");
    setIsPending(true);

    try {
      // Map client-side state for Gemini functions input
      const currentTasksPayload = tasks.map(t => ({
        id: t.id,
        title: t.title,
        deadline: t.deadline,
        estimated_effort_hours: t.estimated_effort_hours,
        status: t.status
      }));

      const currentCalendarPayload = events.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        duration_minutes: e.duration_minutes
      }));

      // Transform messages into schema expected by backend route
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      let res;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            currentTasks: currentTasksPayload,
            currentCalendar: currentCalendarPayload
          })
        });
      } catch (networkErr: any) {
        throw new Error("Unable to reach the server. This may be due to a temporary network disruption or a rate-limit cooldown. Please try again in a moment.");
      }

      if (!res.ok) {
        let errMessage = "Failed to contact Panic Agent";
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errData = await res.json();
            errMessage = errData.error || errMessage;
          } catch (e) {
            // fallback if json parse fails
          }
        } else {
          try {
            const text = await res.text();
            if (text) {
              errMessage = text.length > 150 ? text.substring(0, 150) + "..." : text;
            }
          } catch (e) {
            // fallback if text read fails
          }
        }
        throw new Error(errMessage);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received an unexpected, non-JSON response format from the server. Please reload the application.");
      }

      const data = await res.json();

      const modelMsg: Message = {
        id: `msg-model-${Date.now()}`,
        role: "model",
        content: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: data.executedActions
      };

      setMessages(prev => [...prev, modelMsg]);

      // If reprioritize action occurred, we can update or flash tasks
      const hasReprioritized = data.executedActions?.some((a: any) => a.name === "reprioritize");
      if (hasReprioritized) {
        // Optional state triggers or notification logs could go here
      }

    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `msg-error-${Date.now()}`,
        role: "model",
        content: `⚠️ **System Interruption**: ${err.message || "The agent could not complete triage."}. Please verify your network and GEMINI_API_KEY settings in Secrets.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsPending(false);
    }
  };

  // Task Handlers
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const item: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      deadline: newTaskDeadline || "No specific deadline",
      estimated_effort_hours: Number(newTaskHours) || 1,
      status: "pending"
    };
    setTasks(prev => [...prev, item]);
    setNewTaskTitle("");
    setNewTaskDeadline("");
    setNewTaskHours(1);
    setShowTaskForm(false);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Calendar Handlers
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    const item: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: newEventTitle,
      start: newEventStart || "Today",
      duration_minutes: Number(newEventMinutes) || 30
    };
    setEvents(prev => [...prev, item]);
    setNewEventTitle("");
    setNewEventStart("");
    setNewEventMinutes(30);
    setShowEventForm(false);
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // Calculations for Panic Monitor
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const totalEffortHours = pendingTasks.reduce((sum, t) => sum + t.estimated_effort_hours, 0);
  const totalCommitmentsMinutes = events.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalCommitmentsHours = (totalCommitmentsMinutes / 60).toFixed(1);

  // Calculate stress level coefficient
  const totalAllocatedHours = totalEffortHours + Number(totalCommitmentsHours);
  let panicLevel: "CRITICAL" | "HIGH" | "MANAGEABLE" = "MANAGEABLE";
  if (totalAllocatedHours > 8) {
    panicLevel = "CRITICAL";
  } else if (totalAllocatedHours > 4) {
    panicLevel = "HIGH";
  }

  // Quick reset all data back to seed state to debug
  const handleResetApp = () => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      setTimeout(() => setIsConfirmingReset(false), 5000); // reset state after 5 seconds
      return;
    }
    localStorage.removeItem("panic_tasks");
    localStorage.removeItem("panic_events");
    localStorage.removeItem("panic_messages");
    window.location.reload();
  };

  // Start a fresh conversation without wiping tasks/calendar data.
  // This is the lightweight "New Chat" action, distinct from the full
  // sandbox reset above.
  const handleNewChat = () => {
    setMessages([]);
    localStorage.removeItem("panic_messages");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-orange-950 selection:text-orange-400">
      {/* Header Panel */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-950/75 border border-red-800/80 rounded-lg text-red-500 animate-pulse">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
              PANIC MODE
              <span className="text-[10px] font-mono bg-red-950/60 border border-red-800/50 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Emergency Agent
              </span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">DEADLINE ACCELERATOR & DISASTER AVOIDANCE</p>
          </div>
          <button
            onClick={handleNewChat}
            title="Start a new conversation (keeps your tasks and calendar)"
            className="ml-4 flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md px-3 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Dynamic Countdown HUD */}
        <div className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-lg p-2 px-4">
          <div className="text-right">
            <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              Emergency Deadline Hour
            </span>
            <input 
              type="time" 
              value={deadlineTime} 
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="bg-transparent border-none text-zinc-300 font-mono text-sm focus:outline-none cursor-pointer text-right w-24 p-0"
            />
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="text-right">
            <span className={`block text-[9px] font-mono uppercase tracking-widest ${
              countdownString === "PAST DEADLINE" ? "text-red-500 animate-pulse font-semibold" : "text-orange-500"
            }`}>
              {countdownString === "PAST DEADLINE" ? "TIME EXPIRED" : "CRITICAL COUNTDOWN"}
            </span>
            <span className={`text-sm font-mono font-semibold tracking-wider ${
              countdownString === "PAST DEADLINE" ? "text-red-500 font-bold" : "text-orange-400"
            }`}>
              {countdownString}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left column: Chat interface (7 cols) */}
        <div className="lg:col-span-7 flex flex-col border-r border-zinc-800/80 h-[calc(100vh-76px)] overflow-hidden">
          
          {/* Diagnostic Warnings banner if allocations are critical */}
          <div className="bg-zinc-900/60 border-b border-zinc-800 px-6 py-2.5 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                ALLOCATED BURDEN: <span className="text-orange-300 font-semibold">{totalAllocatedHours} hrs</span> of active tasks & commitments.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Triage state:</span>
              <span className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase border ${
                panicLevel === "CRITICAL" 
                  ? "bg-red-950/70 border-red-800/60 text-red-400" 
                  : "bg-amber-950/60 border-amber-800/50 text-amber-400"
              }`}>
                {panicLevel}
              </span>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col max-w-3xl ${
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] text-zinc-500">
                    <span>{msg.role === "user" ? "You" : "Panic Mode Agent"}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    {msg.role === "user" && (
                      <button
                        onClick={() => handleSendMessage(undefined, msg.content)}
                        disabled={isPending}
                        title="Resend this message"
                        className="ml-1 flex items-center gap-1 text-zinc-500 hover:text-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-xl px-4.5 py-3 text-sm leading-relaxed whitespace-pre-wrap select-text border ${
                      msg.role === "user"
                        ? "bg-orange-950/40 border-orange-800/50 text-orange-100"
                        : "bg-zinc-900 border-zinc-800 text-zinc-200"
                    }`}
                  >
                    {/* Render helper for custom code/draft blocks */}
                    <p className="markdown-body text-zinc-100">{msg.content}</p>

                    {/* Render action output block if a copy-pasteable draft exists */}
                    {msg.actionsExecuted && msg.actionsExecuted.some(a => a.name === "draft_action") && (
                      <div className="mt-4 border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
                        <div className="bg-zinc-900 px-3 py-1.5 flex items-center justify-between text-[10px] text-zinc-400 font-mono border-b border-zinc-800">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-orange-400" />
                            GENERATED EMERGENCY DRAFT
                          </span>
                          <button
                            onClick={() => {
                              const draftAction = msg.actionsExecuted?.find(a => a.name === "draft_action");
                              const draftText = draftAction?.result?.draft || "";
                              if (draftText) copyToClipboard(draftText, msg.id);
                            }}
                            className="text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-green-500" />
                                <span className="text-green-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Draft</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-3 text-xs text-zinc-300 font-mono max-h-64 overflow-y-auto whitespace-pre-wrap bg-zinc-950 select-all">
                          {msg.actionsExecuted.find(a => a.name === "draft_action")?.result?.draft || "Could not fetch draft content."}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expandable Trace logs for functions executed */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="mt-2.5 w-full max-w-xl">
                      <button
                        onClick={() => setExpandedTraceId(expandedTraceId === msg.id ? null : msg.id)}
                        className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 px-1 py-0.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                        <span>Autonomous Triage Log ({msg.actionsExecuted.length} steps)</span>
                        {expandedTraceId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {expandedTraceId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3.5"
                        >
                          {msg.actionsExecuted.map((act, idx) => (
                            <div key={idx} className="bg-zinc-900/60 border border-zinc-800/80 rounded p-2 text-[11px] font-mono">
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1 border-b border-zinc-800/60">
                                <span className="text-orange-400">⚡ call: {act.name}()</span>
                                <span className="text-zinc-500">Step {idx + 1}</span>
                              </div>
                              <div className="pt-1.5 text-zinc-500">
                                <span className="text-[10px] text-zinc-400 block font-semibold">ARGS:</span>
                                <pre className="bg-zinc-950 p-1 rounded mt-0.5 text-[10px] text-zinc-300 overflow-x-auto">
                                  {JSON.stringify(act.args, null, 2)}
                                </pre>
                              </div>
                              <div className="pt-1.5">
                                <span className="text-[10px] text-zinc-400 block font-semibold">RETURN PAYLOAD:</span>
                                <div className="bg-zinc-950/80 p-1.5 rounded mt-0.5 text-zinc-300 text-[10px] max-h-32 overflow-y-auto whitespace-pre-wrap">
                                  {act.name === "get_tasks" && act.result?.tasks ? (
                                    <span>{act.result.tasks.length} tasks synced.</span>
                                  ) : act.name === "get_calendar_events" && act.result?.events ? (
                                    <span>{act.result.events.length} commitments mapped.</span>
                                  ) : (
                                    JSON.stringify(act.result, null, 2)
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Simulated active thinking step logs */}
              {isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col max-w-lg mr-auto items-start"
                >
                  <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] text-orange-500 animate-pulse">
                    <span>Panic Mode Agent</span>
                    <span>•</span>
                    <span>TRIAGE IN PROGRESS</span>
                  </div>

                  <div className="bg-zinc-900/80 border border-orange-900/40 rounded-xl p-4 w-full">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-4.5 h-4.5 text-orange-500 animate-spin shrink-0" />
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-zinc-200">Analyzing situation details...</span>
                        <p className="text-xs text-orange-400/80 font-mono transition-all duration-300">
                          {pendingSteps[currentStepIndex] || "Thinking..."}
                        </p>
                      </div>
                    </div>

                    {/* Mini stepper track for aesthetic realism */}
                    <div className="mt-3.5 flex gap-1 h-1 w-full bg-zinc-950 rounded-full overflow-hidden">
                      {pendingSteps.map((_, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 transition-all duration-300 ${
                            idx <= currentStepIndex ? "bg-orange-500" : "bg-zinc-800"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Quick starter templates */}
          {messages.length === 1 && (
            <div className="px-6 py-2.5 bg-zinc-900/40 border-t border-zinc-800 space-y-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">
                EMERGENCY TEMPLATES (CLICK TO TRIGGER)
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handlePresetClick("I have to finish my quarterly slide deck in 2 hours but I've got a 90-minute dental checkup starting right now. Help!")}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg p-2.5 text-left text-xs text-zinc-300 hover:text-zinc-100 transition-colors max-w-sm flex flex-col gap-1.5"
                >
                  <span className="font-semibold text-orange-400">Dentist & Slide Deck Collision</span>
                  <span className="text-zinc-400 line-clamp-1">I have to finish my quarterly slide deck in 2 hours...</span>
                </button>
                <button
                  onClick={() => handlePresetClick("My final technical documentation draft is due in 1 hour and I haven't even outlined the architecture section. It's a disaster.")}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg p-2.5 text-left text-xs text-zinc-300 hover:text-zinc-100 transition-colors max-w-sm flex flex-col gap-1.5"
                >
                  <span className="font-semibold text-orange-400">Architecture Doc Emergency</span>
                  <span className="text-zinc-400 line-clamp-1">My final technical documentation draft is due in 1 hour...</span>
                </button>
                <button
                  onClick={() => handlePresetClick("I need to draft the client project proposal due by 5 PM, but I am bogged down. Should I request an extension?")}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg p-2.5 text-left text-xs text-zinc-300 hover:text-zinc-100 transition-colors max-w-sm flex flex-col gap-1.5"
                >
                  <span className="font-semibold text-orange-400">Proposal Extension Assessment</span>
                  <span className="text-zinc-400 line-clamp-1">I need to draft the client project proposal due by 5 PM...</span>
                </button>
              </div>
            </div>
          )}

          {/* User Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-3"
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Describe your critical situation, deadline, or new updates..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-500/80 text-zinc-200"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={isPending || !userInput.trim()}
              className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-bold px-5 py-3 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>TRIAGE</span>
            </button>
          </form>
        </div>

        {/* Right column: Task List & Calendar Event side panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-[calc(100vh-76px)] overflow-y-auto bg-zinc-950 p-6 space-y-6">
          
          {/* Quick instructions widget */}
          <div className="bg-gradient-to-r from-orange-950/20 to-red-950/20 border border-orange-900/30 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-zinc-300">
            <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-100 block mb-1">PROACTIVE PLANNING ENGINE</span>
              Panic Mode pulls directly from your side panel list. Update tasks, toggle statuses, or add block meetings below to alter available time, and click "Triage" to recompute.
            </div>
          </div>

          {/* Section: Active Tasks Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4.5 h-4.5 text-orange-400" />
                <h2 className="text-sm font-semibold tracking-wide text-zinc-200">CRITICAL TASK MATRIX</h2>
              </div>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded px-2.5 py-1 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Add Task</span>
              </button>
            </div>

            {/* Task Creation Micro-Form */}
            <AnimatePresence>
              {showTaskForm && (
                <motion.form
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onSubmit={handleAddTask}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3 overflow-hidden text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-mono">Task Name / Description</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g., Deliverable final slides"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-mono">Deadline</label>
                      <input
                        type="text"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        placeholder="e.g., Today at 5 PM"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-mono">Est. Hours</label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={newTaskHours}
                        onChange={(e) => setNewTaskHours(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowTaskForm(false)}
                      className="bg-transparent border border-zinc-800 px-3 py-1.5 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-bold px-3 py-1.5 rounded transition-colors"
                    >
                      Save Task
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Task Cards List */}
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                  No active tasks. Deadlines are quiet.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-3 flex items-start justify-between transition-colors ${
                      task.status === "completed"
                        ? "bg-zinc-900/30 border-zinc-900/60 opacity-60"
                        : "bg-zinc-900/80 border-zinc-800"
                    }`}
                  >
                    <div className="flex gap-3">
                      <button
                        onClick={() => toggleTaskStatus(task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          task.status === "completed"
                            ? "bg-orange-950 border-orange-500 text-orange-400"
                            : "border-zinc-700 hover:border-orange-500/50"
                        }`}
                      >
                        {task.status === "completed" && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="space-y-1">
                        <span className={`text-sm block font-medium ${
                          task.status === "completed" ? "line-through text-zinc-500" : "text-zinc-200"
                        }`}>
                          {task.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-500/80" />
                            {task.deadline}
                          </span>
                          <span>•</span>
                          <span>Est: {task.estimated_effort_hours}h</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Calendar Event Blockers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-orange-400" />
                <h2 className="text-sm font-semibold tracking-wide text-zinc-200">COMMITMENT BLOCKERS (48H)</h2>
              </div>
              <button
                onClick={() => setShowEventForm(!showEventForm)}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded px-2.5 py-1 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Add Event</span>
              </button>
            </div>

            {/* Event Creation Micro-Form */}
            <AnimatePresence>
              {showEventForm && (
                <motion.form
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onSubmit={handleAddEvent}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3 overflow-hidden text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-mono">Event Name / Meeting</label>
                    <input
                      type="text"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="e.g., Mandatory Client Call"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-mono">Date / Time</label>
                      <input
                        type="text"
                        value={newEventStart}
                        onChange={(e) => setNewEventStart(e.target.value)}
                        placeholder="e.g., Today at 2:00 PM"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 font-mono">Duration (mins)</label>
                      <input
                        type="number"
                        min="15"
                        step="15"
                        value={newEventMinutes}
                        onChange={(e) => setNewEventMinutes(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowEventForm(false)}
                      className="bg-transparent border border-zinc-800 px-3 py-1.5 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-bold px-3 py-1.5 rounded transition-colors"
                    >
                      Block Time
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Event list */}
            <div className="space-y-2">
              {events.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                  Calendar is clear. Maximum availability.
                </div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-zinc-900 border border-zinc-800/60 rounded-lg p-3 flex items-start justify-between"
                  >
                    <div className="flex gap-2.5">
                      <CalendarCheck className="w-4 h-4 text-orange-400/80 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-zinc-200 block">
                          {evt.title}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                          <span>{evt.start}</span>
                          <span>•</span>
                          <span>{evt.duration_minutes} mins</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteEvent(evt.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Simulation Reset Tool */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500">Simulated Sandbox:</span>
            <button
              onClick={handleResetApp}
              className={`flex items-center gap-1.5 border rounded px-2.5 py-1.5 transition-colors ${
                isConfirmingReset 
                  ? "bg-red-950/80 border-red-800 text-red-200 hover:bg-red-900" 
                  : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConfirmingReset ? "text-red-400 animate-spin" : "text-zinc-500"}`} />
              <span>{isConfirmingReset ? "Click to Confirm Reset" : "Reset Sandbox"}</span>
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}