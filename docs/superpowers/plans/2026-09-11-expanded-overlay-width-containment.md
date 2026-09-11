# Expanded Overlay Width Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the expanded overlay footer inside its responsive width when the
next-problem title is long.

**Architecture:** Fix the intrinsic sizing boundary in the
`overlay-session`-owned footer; preserve existing title truncation and all
overlay behavior.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, React Testing Library

---

## Files

- Test: `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`

## Test-First Implementation

- [x] Add a submitted-state test with “Find First and Last Position of Element
      in Sorted Array”.
- [x] Verify RED: the footer lacked `min-w-0` and
      `grid-cols-[minmax(0,1fr)]`.
- [x] Add those two sizing utilities to the expanded footer.
- [x] Verify GREEN: the focused file passed all 9 tests.
- [x] Preserve the title's `truncate` contract.
- [x] Leave global overflow, next-card behavior, and collapsed/docked modes
      unchanged.

## Validation

- [x] `npm run test -- src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run`
- [x] `npm run test` — 153 files and 1,523 tests passed.
- [x] `npm run lint`
- [x] `npm run build`
- [ ] `npm run check` — blocked by the unchanged
      `src/extension/background/scheduler/alarm-scheduler.ts:93` TypeScript
      error.
- [ ] Human smoke proof before merge:
  - short and long next titles at normal expanded width
  - long next title at a narrow viewport
  - pre-submit actions, feedback wrapping, dock, and restore
  - screenshot or screen recording attached to the PR
