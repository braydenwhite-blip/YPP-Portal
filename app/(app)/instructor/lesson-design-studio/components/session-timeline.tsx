"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { WeekActivity } from "../types";
import { EnergyArc } from "./energy-arc";
import { TimelineBlock, TimelineBlockPreview } from "./timeline-block";

interface SessionTimelineProps {
  activities: WeekActivity[];
  classDurationMin: number;
  readOnly: boolean;
  selectedActivityId: string | null;
  onSelectActivity: (activityId: string) => void;
  onReorderActivity: (activeId: string, overId: string) => void;
  onResizeActivity: (activityId: string, durationMin: number) => void;
}

interface TimelineActivity extends WeekActivity {
  startMin: number;
  endMin: number;
}

function getMarkerStep(durationMin: number) {
  return durationMin > 90 ? 10 : 5;
}

function buildTimelineActivities(activities: WeekActivity[]) {
  let cursor = 0;
  return activities.map((activity) => {
    const startMin = cursor;
    const endMin = startMin + activity.durationMin;
    cursor = endMin;
    return {
      ...activity,
      startMin,
      endMin,
    };
  });
}

function formatMinuteValue(value: number) {
  return `${value} min`;
}

export function SessionTimeline({
  activities,
  classDurationMin,
  readOnly,
  selectedActivityId,
  onSelectActivity,
  onReorderActivity,
  onResizeActivity,
}: SessionTimelineProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const timelineActivities = useMemo(
    () => buildTimelineActivities(activities),
    [activities]
  );
  const totalMinutes =
    timelineActivities[timelineActivities.length - 1]?.endMin ?? 0;
  const roundedTarget = Math.max(classDurationMin, totalMinutes, 5);
  const markerStep = getMarkerStep(roundedTarget);
  const displayDuration =
    Math.ceil(roundedTarget / markerStep) * markerStep;
  const timelineWidth = Math.max(displayDuration * 12, 720);
  const pixelsPerMinute = timelineWidth / Math.max(displayDuration, 1);
  const overrunMinutes = Math.max(0, totalMinutes - classDurationMin);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const markers = useMemo(() => {
    const result: number[] = [];
    for (let minute = 0; minute <= displayDuration; minute += markerStep) {
      result.push(minute);
    }
    if (result[result.length - 1] !== displayDuration) {
      result.push(displayDuration);
    }
    return result;
  }, [displayDuration, markerStep]);
  const activeActivity =
    timelineActivities.find((activity) => activity.id === activeDragId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || readOnly) {
      return;
    }

    onReorderActivity(String(active.id), String(over.id));
  }

  return (
    <section className="lds-timeline-shell" aria-label="Session timeline builder">
      <div className="lds-timeline-header">
        <div>
          <p className="lds-section-eyebrow">Timeline builder</p>
          <h3 className="lds-timeline-title">See the full class at a glance</h3>
          <p className="lds-timeline-copy">
            Drag to reshape the flow, pull the edge to change time, and watch the
            session pace reveal itself as one connected arc.
          </p>
        </div>
        <div className="lds-timeline-status">
          <span className="lds-timeline-status-pill">
            {activities.length} activit{activities.length === 1 ? "y" : "ies"}
          </span>
          <span className="lds-timeline-status-pill subtle">
            Planned {formatMinuteValue(totalMinutes)}
          </span>
          <span
            className={`lds-timeline-status-pill${
              overrunMinutes > 0 ? " warning" : " success"
            }`}
          >
            {overrunMinutes > 0
              ? `Over by ${formatMinuteValue(overrunMinutes)}`
              : "Within class time"}
          </span>
        </div>
      </div>

      <div className="lds-timeline-legend" aria-hidden="true">
        <span className="low">Low energy</span>
        <span className="medium">Medium energy</span>
        <span className="high">High energy</span>
      </div>

      <div className="lds-timeline-scroller">
        <div className="lds-timeline-canvas" style={{ width: `${timelineWidth}px` }}>
          <div className="lds-timeline-axis">
            {markers.map((minute) => {
              const left = minute * pixelsPerMinute;
              const showLabel =
                minute === 0 ||
                minute === displayDuration ||
                minute % Math.max(markerStep * 2, 10) === 0;
              const edgeClass =
                minute === 0
                  ? " start"
                  : minute === displayDuration
                    ? " end"
                    : "";

              return (
                <div
                  key={`marker-${minute}`}
                  className={`lds-timeline-marker${edgeClass}`}
                  style={{ left: `${left}px` }}
                >
                  {showLabel ? (
                    <span className="lds-timeline-marker-label">{minute}</span>
                  ) : null}
                  <span className="lds-timeline-marker-tick" />
                </div>
              );
            })}
          </div>

          <div className="lds-timeline-stage">
            {displayDuration > classDurationMin ? (
              <div
                className="lds-timeline-overrun-zone"
                style={{
                  left: `${classDurationMin * pixelsPerMinute}px`,
                  width: `${(displayDuration - classDurationMin) * pixelsPerMinute}px`,
                }}
                aria-hidden="true"
              />
            ) : null}

            <div
              className="lds-timeline-class-end"
              style={{ left: `${classDurationMin * pixelsPerMinute}px` }}
              aria-hidden="true"
            >
              <span>{formatMinuteValue(classDurationMin)}</span>
            </div>

            {totalMinutes > 0 ? (
              <div
                className={`lds-timeline-total-marker${
                  overrunMinutes > 0 ? " over" : ""
                }`}
                style={{ left: `${totalMinutes * pixelsPerMinute}px` }}
                aria-hidden="true"
              >
                <span className="lds-timeline-total-badge">
                  {formatMinuteValue(totalMinutes)} planned
                </span>
              </div>
            ) : null}

            <EnergyArc
              activities={timelineActivities}
              width={timelineWidth}
              pixelsPerMinute={pixelsPerMinute}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={timelineActivities.map((activity) => activity.id)}
                strategy={horizontalListSortingStrategy}
              >
                {timelineActivities.length > 0 ? (
                  <div
                    className="lds-timeline-block-row"
                    style={{ width: `${totalMinutes * pixelsPerMinute}px` }}
                  >
                    {timelineActivities.map((activity) => (
                      <TimelineBlock
                        key={activity.id}
                        activity={activity}
                        startMin={activity.startMin}
                        endMin={activity.endMin}
                        widthPx={activity.durationMin * pixelsPerMinute}
                        pixelsPerMinute={pixelsPerMinute}
                        isSelected={selectedActivityId === activity.id}
                        readOnly={readOnly}
                        classDurationMin={classDurationMin}
                        onSelect={onSelectActivity}
                        onCommitResize={onResizeActivity}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="lds-timeline-empty">
                    Add a first activity to turn this session into a visible sequence of time,
                    energy, and student experience.
                  </div>
                )}
              </SortableContext>

              <DragOverlay>
                {activeActivity ? (
                  <TimelineBlockPreview
                    activity={activeActivity}
                    startMin={activeActivity.startMin}
                    endMin={activeActivity.endMin}
                    widthPx={activeActivity.durationMin * pixelsPerMinute}
                    isSelected={selectedActivityId === activeActivity.id}
                    isDragging
                    classDurationMin={classDurationMin}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      <p className="lds-subsection-note">
        Click a block to open the activity drawer. Drag a block to reorder it,
        or drag the right edge to rebalance its time.
      </p>
    </section>
  );
}
