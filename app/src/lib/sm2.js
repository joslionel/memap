/**
 * SM-2 spaced repetition algorithm.
 * confidence: 1–5 (1=blank, 2=fuzzy, 3=ok, 4=good, 5=perfect)
 * Returns updated SR fields to persist on the assignment.
 */
export function sm2(current, confidence) {
  // Map 1-5 to SM-2 quality 0-4
  const q = confidence - 1

  let { easeFactor = 2.5, intervalDays = 0, repetitions = 0 } = current

  if (q >= 2) {
    // Correct response (confidence 3, 4, or 5)
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }
    repetitions += 1
  } else {
    // Incorrect – reset
    repetitions = 0
    intervalDays = 1
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02))

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + intervalDays)

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions,
    next_review: nextReview.toISOString(),
    last_reviewed: new Date().toISOString(),
    last_confidence: confidence,
  }
}

/**
 * Score an assignment for practice ordering.
 * Higher score = higher priority to show next.
 */
export function practiceScore(assignment) {
  const now = Date.now()
  const due = new Date(assignment.next_review ?? now).getTime()
  const daysOverdue = Math.max(0, (now - due) / 86_400_000)
  const confidencePenalty = 5 - (assignment.last_confidence ?? 3)
  const noise = Math.random() * 0.5
  return daysOverdue + confidencePenalty * 2 + noise
}
