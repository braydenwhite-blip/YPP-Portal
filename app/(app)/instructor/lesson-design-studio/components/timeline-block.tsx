"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WeekActivity } from "../types";
import { getLessonDesignStudioRichPreview } from "@/lib/lesson-design-studio-rich-content";
import { getActivityTypeConfig } from "./activity-template-data";

interface TimelineBlockBaseProps {
  activity: WeekActivity;
  startMin: number;
  endMin: number;
  widthPx: number;
  isSelected?: boolean;
  isDragging?: boolean;
  classDurationMin: number;
}

interface TimelineBlockProps extends TimelineBlockBaseProps {
  pixelsPerMinute: number;
  readOnly: boolean;
  onSelect: (activityId: string) => void;
  onCommitResize: (activityId: string, durationMin: number) => void;
}

function getRangeLabel(startMin: number, endMin: number) {
  return `${startMin}-${endMin} min`;
}

function TimelineBlockContent({
  activity,
  startMin,
  endMin,
  widthPx,
  isSelected = false,
  isDragging = false,
  classDurationMin,
}: TimelineBlockBaseProps) {
  const config = getActivityTypeConfig(activity.type);
  const compact = widthPx < 180;
  const tight = widthPx < 128;
  const isOvertime = endMin > classDurationMin;

  return (
    <>
      <div className="lds-timeline-block-top">
        <span className="lds-timeline-block-badge">
          {config.icon} {tight ? config.label.slice(0, 4) : config.label}
        </span>
        <span className="lds-timeline-block-duration">{activity.durationMin}m</span>
      </div>
      <div className="lds-timeline-block-body">
        <strong className="lds-timeline-block-title">
          {activity.title || config.label}
        </strong>
        {!tight ? (
          <p className="lds-timeline-block-copy">
            {getLessonDesignStudioRichPreview(activity.description)}
          </p>
        ) : null}
      </div>
      <div className="lds-timeline-block-footer">
        <span className="lds-timeline-block-range">{getRangeLabel(startMin, endMin)}</span>
        <span
          className={`lds-timeline-block-state${
            isSelected ? " active" : ""
          }${isDragging ? " dragging" : ""}${isOvertime ? " overtime" : ""}`}
        >
          {isOvertime ? "Overtime" : compact ? "Open" : "Open details"}
        </span>
      </div>
    </>
  );
}

export function TimelineBlockPreview(props: TimelineBlockBaseProps) {
  const config = getActivityTypeConfig(props.activity.type);

  return (
    <div
      className={`lds-timeline-block${props.isSelected ? " active" : ""}${
        props.isDragging ? " dragging" : ""
      }${props.endMin > props.classDurationMin ? " overtime" : ""} overlay`}
      style={
        {
          width: `${props.widthPx}px`,
          "--lds-timeline-accent": config.color,
        } as CSSProperties
      }
    >
      <div className="lds-timeline-block-button" aria-hidden="true">
        <TimelineBlockContent {...props} />
      </div>
    </div>
  );
}

export function TimelineBlock({
  activity,
  startMin,
  endMin,
  widthPx,
  pixelsPerMinute,
  isSelected,
  isDragging = false,
  readOnly,
  classDurationMin,
  onSelect,
  onCommitResize,
}: TimelineBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableDragging,
  } = useSortable({
    id: activity.id,
    disabled: readOnly,
  });

  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const previewDurationRef = useRef<number | null>(null);
  const resizingRef = useRef<{
    startX: number;
    startDuration: number;
  } | null>(null);
  const currentDuration = previewDuration ?? activity.durationMin;
  const currentEndMin = startMin + currentDuration;
  const config = getActivityTypeConfig(activity.type);

  useEffect(() => {
    if (!resizingRef.current) {
      setPreviewDuration(null);
      previewDurationRef.current = null;
    }
  }, [activity.durationMin]);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  function finishResize() {
    const nextDuration = previewDurationRef.current;
    resizingRef.current = null;
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    setPreviewDuration(null);
    previewDurationRef.current = null;

    if (
      typeof nextDuration === "number" &&
      nextDuration !== activity.durationMin &&
      nextDuration > 0
    ) {
      onCommitResize(activity.id, nextDuration);
    }
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!resizingRef.current) return;
      const deltaMinutes = Math.round(
        (event.clientX - resizingRef.current.startX) / pixelsPerMinute
      );
      const nextDuration = Math.max(1, resizingRef.current.startDuration + deltaMinutes);
      previewDurationRef.current = nextDuration;
      setPreviewDuration(nextDuration);
    }

    function handlePointerUp() {
      if (!resizingRef.current) return;
      finishResize();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activity.durationMin, onCommitResize, pixelsPerMinute]);

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    resizingRef.current = {
      startX: event.clientX,
      startDuration: activity.durationMin,
    };
    previewDurationRef.current = activity.durationMin;
    setPreviewDuration(activity.durationMin);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }

  const style: CSSProperties = {
    width: `${currentDuration * pixelsPerMinute}px`,
    transform: CSS.Transform.toString(transform),
    transition,
    "--lds-timeline-accent": config.color,
  } as CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lds-timeline-block${isSelected ? " active" : ""}${
        sortableDragging || isDragging ? " dragging" : ""
      }${currentEndMin > classDurationMin ? " overtime" : ""}`}
    >
      <button
        type="button"
        className="lds-timeline-block-button"
        aria-label={`${activity.title || config.label}, ${activity.durationMin} minutes`}
        onClick={() => onSelect(activity.id)}
        {...attributes}
        {...listeners}
      >
        <TimelineBlockContent
          activity={activity}
          startMin={startMin}
          endMin={currentEndMin}
          widthPx={currentDuration * pixelsPerMinute}
          isSelected={isSelected}
          isDragging={sortableDragging || isDragging}
          classDurationMin={classDurationMin}
        />
      </button>

      {!readOnly ? (
        <div
          className="lds-timeline-resize-handle"
          aria-label={`Resize ${activity.title || config.label}`}
          role="separator"
          aria-orientation="vertical"
          onPointerDown={handleResizeStart}
        />
      ) : null}
    </div>
  );
}
