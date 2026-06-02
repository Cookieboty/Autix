const exampleDatabaseUrl =
  'postgresql://postgres:autix123@localhost:5432/autix?schema=public';

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is required. Point it to the merged autix database, for example ${exampleDatabaseUrl}.`,
    );
  }

  return databaseUrl;
}
