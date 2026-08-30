import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const FEEDBACK_EMAIL = "jeffreyscotthamilton6399@gmail.com";
export const FEEDBACK_APP_NAME = "VoiceRip";

const BODY = `What went wrong, or what you want it to do:


Browser and device, if it's a bug:
`;

export const FEEDBACK_MAILTO =
  `mailto:${FEEDBACK_EMAIL}` +
  `?subject=${encodeURIComponent(`${FEEDBACK_APP_NAME} feedback`)}` +
  `&body=${encodeURIComponent(BODY)}`;

export function FeedbackButton({ className }: { className?: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 gap-1.5 px-2 text-xs font-normal text-muted-foreground",
        "hover:bg-transparent hover:text-foreground",
        className,
      )}
    >
      <a href={FEEDBACK_MAILTO} aria-label="Send feedback by email">
        <MessageSquarePlus className="size-3.5" />
        <span>Feedback</span>
      </a>
    </Button>
  );
}
