import { Tool, ToolCallState } from "core";
import { ComponentType, useContext, useEffect, useMemo, useState } from "react";
import {
  ContextItemsPeekItem,
  openContextItem,
} from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToggleWithIcon } from "./ToggleWithIcon";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { toolCallStateToContextItems } from "./utils";

interface SimpleToolCallUIProps {
  toolCallState: ToolCallState;
  tool: Tool | undefined;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
  historyIndex: number;
}

export function SimpleToolCallUI({
  icon: Icon,
  toolCallState,
  tool,
  historyIndex,
}: SimpleToolCallUIProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState, toolCallState.output]);

  // Auto-open when tool is calling and has output (for streaming updates)
  const isCallingWithOutput =
    toolCallState.status === "calling" && shownContextItems.length > 0;
  const [open, setOpen] = useState(isCallingWithOutput);

  // Auto-open when calling with output changes
  useEffect(() => {
    if (isCallingWithOutput) {
      setOpen(true);
    }
  }, [isCallingWithOutput]);

  const isToggleable = shownContextItems.length > 1;
  const isSingleItem = shownContextItems.length === 1;
  // Show content if: calling with output (auto-display), or toggleable and open, or single item and open
  const shouldShowContent =
    isCallingWithOutput || (isToggleable ? open : isSingleItem && open);
  const isClickable = isToggleable || isSingleItem;

  function handleClick() {
    if (isToggleable) {
      setOpen((prev) => !prev);
    } else if (isSingleItem) {
      openContextItem(shownContextItems[0], ideMessenger);
    }
  }

  return (
    <div className="mt-1 flex flex-col px-4">
      <div className="flex min-w-0 flex-row items-center justify-between gap-2">
        <div
          className={`text-description flex min-w-0 flex-row items-center justify-between gap-1.5 text-xs transition-colors duration-200 ease-in-out ${
            isClickable ? "cursor-pointer hover:brightness-125" : ""
          }`}
          onClick={isClickable ? handleClick : undefined}
          data-testid="context-items-peek"
        >
          <ToggleWithIcon
            icon={Icon}
            isToggleable={isToggleable}
            open={shouldShowContent}
            isClickable={isSingleItem}
          />
          <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
        </div>
      </div>

      {(isToggleable || isCallingWithOutput || isSingleItem) && (
        <div
          className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
            shouldShowContent ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {shownContextItems.length > 0 ? (
            shownContextItems.map((contextItem, idx) => {
              // For status items with empty content, make them non-clickable
              const isStatusItem = !contextItem.content || contextItem.content.trim() === "";
              return (
                <div
                  key={idx}
                  className={isStatusItem ? "pointer-events-none" : ""}
                >
                  <ContextItemsPeekItem contextItem={contextItem} />
                </div>
              );
            })
          ) : (
            <div className="text-description pl-5 text-xs italic">
              No tool call output
            </div>
          )}
        </div>
      )}
    </div>
  );
}
