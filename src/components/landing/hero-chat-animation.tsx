"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib-landing/utils";
import { Bot, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
}

export function HeroChatAnimation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const runAnimation = async () => {
      // Delay before starting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 1: User Query
      setIsTyping(true);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate typing
      setMessages([
        {
          id: "1",
          role: "user",
          content: "Which are the top 3 Answer Engine Optimization tools?",
        },
      ]);
      setIsTyping(false);
      setStep(1);

      // Step 2: AI Thinking
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsTyping(true);

      // Step 3: Response Generation (Streamed effect simulated by blocks)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsTyping(false);
      
      const responseContent = (
        <div className="space-y-4 text-sm sm:text-base">
          <p className="mb-2 text-muted-foreground">Here are the top 3 Answer Engine Optimization tools based on recent citations:</p>
          
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
          >
            <div className="flex items-center gap-2 font-semibold text-blue-500 mb-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs">1</span>
              EvidentlyAEO
              <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm pl-7">
              The only end-to-end platform for measuring and optimizing AI Search visibility. Offers complete loop tracking and outcome-based guarantees.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs">2</span>
              Profound
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm pl-7">
              A visibility tracking tool for monitoring brand mentions across various AI platforms.
            </p>
          </motion.div>

          <motion.div 
             initial={{ opacity: 0, x: -10 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 1.8 }}
             className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs">3</span>
              Prompting Company
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm pl-7">
              Focuses on content optimization and identifying user questions for AI readability.
            </p>
          </motion.div>
        </div>
      );

      setMessages((prev) => [
        ...prev,
        {
          id: "2",
          role: "assistant",
          content: responseContent,
        },
      ]);
    };

    runAnimation();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto bg-background rounded-xl border shadow-xl overflow-hidden min-h-[400px] flex flex-col relative z-20">
      {/* Fake Browser Header */}
      <div className="h-10 border-b bg-muted/30 flex items-center px-4 gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-amber-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border">
          <Bot className="w-3 h-3" />
          <span>AI Assistant</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 space-y-6 overflow-hidden bg-gradient-to-b from-background to-muted/10">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-emerald-500 text-white"
                )}
              >
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 max-w-[90%] text-sm shadow-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-white dark:bg-slate-800 border rounded-tl-none"
                )}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-muted-foreground text-sm ml-11"
          >
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
            </span>
            <span>AI is thinking...</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
