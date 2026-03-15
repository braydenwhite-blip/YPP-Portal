"use client";

import { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DAGStep {
  id: string;
  title: string;
  type: "class" | "lab" | "standalone";
  positionX: number;
  positionY: number;
  prerequisites: string[]; // IDs of prerequisite steps
  stepDetails?: {
    estimatedDuration?: string;
    purpose?: string;
    [key: string]: unknown;
  } | null;
}

interface SequenceDAGEditorProps {
  steps: DAGStep[];
  onSelectStep?: (stepId: string) => void;
  onMoveStep?: (stepId: string, x: number, y: number) => void;
  onConnectSteps?: (fromId: string, toId: string) => void;
  selectedStepId?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const CANVAS_MIN_WIDTH = 800;
const CANVAS_MIN_HEIGHT = 600;

const TYPE_ICONS: Record<DAGStep["type"], string> = {
  class: "\u{1F4DA}",
  lab: "\u{1F52C}",
  standalone: "\u{1F4DD}",
};

const TYPE_LABELS: Record<DAGStep["type"], string> = {
  class: "Class",
  lab: "Passion Lab",
  standalone: "Standalone",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBorderColor(
  step: DAGStep,
  allSteps: DAGStep[],
  isSelected: boolean
): string {
  if (isSelected) return "var(--ypp-purple, #7c3aed)";

  const isEntry = step.prerequisites.length === 0;
  const hasDependents = allSteps.some((s) => s.prerequisites.includes(step.id));

  if (isEntry) return "#22c55e"; // green - entry point
  if (!hasDependents) return "#eab308"; // gold - capstone
  return "#3b82f6"; // blue - has prerequisites
}

function getBorderLabel(step: DAGStep, allSteps: DAGStep[]): string | null {
  const isEntry = step.prerequisites.length === 0;
  const hasDependents = allSteps.some((s) => s.prerequisites.includes(step.id));

  if (isEntry) return "Entry";
  if (!hasDependents) return "Capstone";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SequenceDAGEditor({
  steps,
  onSelectStep,
  onMoveStep,
  onConnectSteps,
  selectedStepId,
}: SequenceDAGEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    stepId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null); // source step ID for connection mode

  // Calculate canvas size based on node positions
  const canvasWidth = Math.max(
    CANVAS_MIN_WIDTH,
    ...steps.map((s) => s.positionX + NODE_WIDTH + 40)
  );
  const canvasHeight = Math.max(
    CANVAS_MIN_HEIGHT,
    ...steps.map((s) => s.positionY + NODE_HEIGHT + 40)
  );

  // ── Drag handlers ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, stepId: string) => {
      if (connecting) return; // Don't drag while connecting
      e.preventDefault();
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      const scrollTop = containerRef.current?.scrollTop ?? 0;

      setDragging({
        stepId,
        offsetX: e.clientX - rect.left + scrollLeft - step.positionX,
        offsetY: e.clientY - rect.top + scrollTop - step.positionY,
      });
    },
    [steps, connecting]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      const scrollTop = containerRef.current?.scrollTop ?? 0;

      const x = Math.max(
        0,
        e.clientX - rect.left + scrollLeft - dragging.offsetX
      );
      const y = Math.max(
        0,
        e.clientY - rect.top + scrollTop - dragging.offsetY
      );

      onMoveStep?.(dragging.stepId, Math.round(x), Math.round(y));
    },
    [dragging, onMoveStep]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ── Connection handlers ──

  const startConnection = useCallback(
    (e: React.MouseEvent, stepId: string) => {
      e.stopPropagation();
      setConnecting(stepId);
    },
    []
  );

  const completeConnection = useCallback(
    (stepId: string) => {
      if (connecting && connecting !== stepId) {
        onConnectSteps?.(connecting, stepId);
      }
      setConnecting(null);
    },
    [connecting, onConnectSteps]
  );

  const cancelConnection = useCallback(() => {
    setConnecting(null);
  }, []);

  // ── Build arrow data ──

  const arrows: { fromX: number; fromY: number; toX: number; toY: number }[] =
    [];
  for (const step of steps) {
    for (const prereqId of step.prerequisites) {
      const prereq = steps.find((s) => s.id === prereqId);
      if (!prereq) continue;
      arrows.push({
        fromX: prereq.positionX + NODE_WIDTH / 2,
        fromY: prereq.positionY + NODE_HEIGHT,
        toX: step.positionX + NODE_WIDTH / 2,
        toY: step.positionY,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={connecting ? cancelConnection : undefined}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: CANVAS_MIN_HEIGHT,
        overflow: "auto",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: "var(--radius-md, 8px)",
        background: "var(--surface, #fafafa)",
        cursor: connecting ? "crosshair" : dragging ? "grabbing" : "default",
      }}
    >
      {/* Connection mode indicator */}
      {connecting && (
        <div
          style={{
            position: "sticky",
            top: 8,
            left: 8,
            zIndex: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "var(--ypp-purple, #7c3aed)",
            color: "#fff",
            borderRadius: "var(--radius-md, 8px)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Click a target step to create prerequisite link. Press Esc or click
          canvas to cancel.
        </div>
      )}

      {/* SVG layer for arrows */}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <defs>
          <marker
            id="dag-arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="var(--muted, #9ca3af)"
            />
          </marker>
        </defs>
        {arrows.map((a, i) => (
          <line
            key={i}
            x1={a.fromX}
            y1={a.fromY}
            x2={a.toX}
            y2={a.toY}
            stroke="var(--muted, #9ca3af)"
            strokeWidth={2}
            markerEnd="url(#dag-arrowhead)"
          />
        ))}
      </svg>

      {/* Node layer */}
      <div
        style={{
          position: "relative",
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {steps.map((step) => {
          const isSelected = selectedStepId === step.id;
          const borderColor = getBorderColor(step, steps, isSelected);
          const badge = getBorderLabel(step, steps);
          const prereqCount = step.prerequisites.length;
          const duration = step.stepDetails?.estimatedDuration ?? null;

          return (
            <div
              key={step.id}
              onClick={(e) => {
                e.stopPropagation();
                if (connecting) {
                  completeConnection(step.id);
                } else {
                  onSelectStep?.(step.id);
                }
              }}
              onMouseDown={(e) => handleMouseDown(e, step.id)}
              style={{
                position: "absolute",
                left: step.positionX,
                top: step.positionY,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                background: isSelected
                  ? "var(--ypp-purple-50, #f5f3ff)"
                  : "#fff",
                border: `2px solid ${borderColor}`,
                borderRadius: "var(--radius-md, 8px)",
                padding: "8px 10px",
                cursor: connecting
                  ? "pointer"
                  : dragging?.stepId === step.id
                    ? "grabbing"
                    : "grab",
                userSelect: "none",
                boxShadow: isSelected
                  ? `0 0 0 2px ${borderColor}40`
                  : "0 1px 3px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                zIndex: isSelected ? 10 : 1,
                transition: "box-shadow 0.15s ease",
              }}
            >
              {/* Top row: icon + title */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflow: "hidden",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {TYPE_ICONS[step.type]}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--foreground, #111)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.title || "Untitled Step"}
                </span>
              </div>

              {/* Bottom row: metadata */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted, #6b7280)",
                    fontWeight: 500,
                  }}
                >
                  {TYPE_LABELS[step.type]}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {prereqCount > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--muted, #6b7280)",
                      }}
                    >
                      {prereqCount} prereq{prereqCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {duration && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--muted, #6b7280)",
                      }}
                    >
                      {duration}
                    </span>
                  )}
                </div>
              </div>

              {/* Badge */}
              {badge && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: borderColor,
                    color: "#fff",
                  }}
                >
                  {badge}
                </span>
              )}

              {/* Connect handle: small circle at bottom center */}
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startConnection(e, step.id);
                }}
                title="Drag to connect as prerequisite"
                style={{
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "var(--ypp-purple, #7c3aed)",
                  border: "2px solid #fff",
                  cursor: "pointer",
                  zIndex: 11,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {steps.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "var(--muted, #6b7280)",
            fontSize: 14,
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: 18 }}>No steps yet</p>
          <p style={{ margin: 0 }}>
            Add steps to your sequence to start building the DAG.
          </p>
        </div>
      )}
    </div>
  );
}
