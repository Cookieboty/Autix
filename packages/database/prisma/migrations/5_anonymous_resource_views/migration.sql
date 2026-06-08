-- Allow marketplace page views from anonymous visitors.
ALTER TABLE "resource_views" DROP CONSTRAINT "resource_views_userId_fkey";

ALTER TABLE "resource_views" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "resource_views"
ADD CONSTRAINT "resource_views_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
