-- Add readAt column to task_events
ALTER TABLE "task_events" ADD COLUMN "readAt" TIMESTAMPTZ(6);