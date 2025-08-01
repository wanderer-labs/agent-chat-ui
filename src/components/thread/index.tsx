import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef, useState as useReactState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Message } from "@langchain/langgraph-sdk";
import {
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { useArtifact } from "./artifact";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleArrowRight, faSpinner } from "@fortawesome/free-solid-svg-icons";

// Lucky prompts for "I'm feeling lucky" button - moved outside component to avoid hydration issues
const luckyPrompts = [
  "Create a beautiful landing page for a coffee shop",
  "Design a dashboard for tracking fitness goals", 
  "Build a portfolio website for a photographer",
  "Make a booking system for a restaurant",
  "Create a weather app with animations",
  "Design a task management tool",
  "Build a recipe sharing platform",
  "Create a music player interface",
  "Design a travel booking website",
  "Make a social media profile page",
  "Create a modern e-commerce product page",
  "Design a meditation and mindfulness app",
  "Build a real estate listing website",
  "Create a cryptocurrency trading dashboard",
  "Design a food delivery app interface",
  "Make a workout tracking application",
  "Create a news aggregator website",
  "Design a video streaming platform",
  "Build a job board and career portal",
  "Create a plant care and garden tracker"
];

// New component to render full-screen HTML content
function FullScreenCustomComponents() {
  const { values } = useStreamContext();
  const thread = useStreamContext();
  const artifact = useArtifact();
  
  // Get all custom UI components from the latest messages
  const customComponents = values.ui?.filter(ui => ui.name === "llm-ui") || [];
  
  if (!customComponents.length) return null;
  
  // Render the latest custom component full screen
  const latestComponent = customComponents[customComponents.length - 1];
  
  return (
    <div className="flex-1 w-full h-full overflow-auto">
      <LoadExternalComponent
        key={latestComponent.id}
        stream={thread}
        message={latestComponent}
        meta={{ ui: latestComponent, artifact }}
      />
    </div>
  );
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [isClient, setIsClient] = useReactState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // Ensure client-side rendering for hydration safety
  useEffect(() => {
    setIsClient(true);
  }, []);

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim().length === 0 || isLoading) return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: input.trim(),
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
  };

  const handleLuckyClick = () => {
    if (isLoading) return;
    
    // Use crypto.getRandomValues for better randomness and avoid hydration issues
    const randomIndex = Math.floor(Math.random() * luckyPrompts.length);
    const randomPrompt = luckyPrompts[randomIndex];
    
    // Auto-submit the random prompt
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: randomPrompt,
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );
  };

  const chatStarted = !!threadId || !!messages.length;

  // Check if we have custom UI components to show full screen
  const hasCustomUI = stream.values?.ui?.some(ui => ui.name === "llm-ui") || false;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {/* Top Navigation Bar */}
          <div className="relative z-10 flex items-center justify-between gap-3 p-2 border-b">
            <div className="relative flex items-center justify-start gap-2">
              <div className="absolute left-0 z-10">
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <motion.button
                className="flex cursor-pointer items-center gap-2"
                onClick={() => setThreadId(null)}
                animate={{
                  marginLeft: !chatHistoryOpen ? 48 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {/* <LangGraphLogoSVG
                  width={32}
                  height={32}
                /> */}
                <span className="text-xl font-semibold tracking-tight">
                  Branch
                </span>
              </motion.button>
            </div>

            <div className="flex items-center gap-4">
              <TooltipIconButton
                size="lg"
                className="p-4"
                tooltip="New thread"
                variant="ghost"
                onClick={() => setThreadId(null)}
              >
                <SquarePen className="size-5" />
              </TooltipIconButton>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {hasCustomUI ? (
              /* Full-screen HTML content */
              <FullScreenCustomComponents />
            ) : !chatStarted ? (
              /* Centered welcome state with input */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
                  <div className="flex flex-col items-center gap-3">
                    {/* <LangGraphLogoSVG className="h-12 flex-shrink-0" /> */}
                    <h1 className="text-3xl font-semibold tracking-tight">
                      Branch
                    </h1>
                  </div>
                  
                  {/* Centered Input Form */}
                  <div className="w-full">
                    <div
                      className={cn(
                        "bg-muted relative z-10 mx-auto w-full rounded-2xl shadow-lg transition-all border border-solid",
                      )}
                    >
                      <form
                        onSubmit={handleSubmit}
                        className="flex items-end gap-2 p-3"
                      >
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !e.metaKey &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              const el = e.target as HTMLElement | undefined;
                              const form = el?.closest("form");
                              form?.requestSubmit();
                            }
                          }}
                          placeholder="Go anywhere"
                          className="flex-1 field-sizing-content resize-none border-none bg-transparent p-2 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none min-h-[40px] max-h-[120px]"
                        />

                        {stream.isLoading ? (
                          <Button
                            key="stop"
                            onClick={() => stream.stop()}
                            variant="ghost"
                            className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100"
                          >
                            <FontAwesomeIcon 
                              icon={faSpinner} 
                              className="text-gray-600 animate-spin" 
                              size="lg"
                            />
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            variant="ghost"
                            className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100"
                            disabled={isLoading || !input.trim()}
                          >
                            <FontAwesomeIcon 
                              icon={faCircleArrowRight} 
                              className="text-blue-600" 
                              size="lg"
                            />
                          </Button>
                        )}
                      </form>
                    </div>
                  </div>
                  
                  {/* I'm Feeling Lucky Button */}
                  {isClient && (
                    <div className="flex justify-center mt-4">
                      <Button
                        onClick={handleLuckyClick}
                        variant="outline"
                        disabled={isLoading}
                        className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                      >
                        I'm Feeling Lucky
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Chat started - show messages area and loading */
              <div className="flex-1 flex items-center justify-center">
                {isLoading && !firstTokenReceived ? (
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon 
                      icon={faSpinner} 
                      className="h-6 w-6 animate-spin text-gray-600" 
                    />
                    <span>Generating...</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Bottom Input Form - Only show when chat has started */}
          {chatStarted && (
            <div className="border-t bg-white p-4">
              <div
                className={cn(
                  "bg-muted relative z-10 mx-auto w-full max-w-3xl rounded-2xl shadow-xs transition-all border border-solid",
                )}
              >
                <form
                  onSubmit={handleSubmit}
                  className="flex items-end gap-2 p-3"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        const el = e.target as HTMLElement | undefined;
                        const form = el?.closest("form");
                        form?.requestSubmit();
                      }
                    }}
                    placeholder="Go anywhere"
                    className="flex-1 field-sizing-content resize-none border-none bg-transparent p-2 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none min-h-[40px] max-h-[120px]"
                  />

                  {stream.isLoading ? (
                    <Button
                      key="stop"
                      onClick={() => stream.stop()}
                      variant="ghost"
                      className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100"
                    >
                      <FontAwesomeIcon 
                        icon={faSpinner} 
                        className="text-gray-600 animate-spin" 
                        size="lg"
                      />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="ghost"
                      className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100"
                      disabled={isLoading || !input.trim()}
                    >
                      <FontAwesomeIcon 
                        icon={faCircleArrowRight} 
                        className="text-blue-600" 
                        size="lg"
                      />
                    </Button>
                  )}
                </form>
              </div>
            </div>
          )}
        </motion.div>
        <div className="relative flex flex-col border-l">
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button
                onClick={closeArtifact}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      </div>
    </div>
  );
}
