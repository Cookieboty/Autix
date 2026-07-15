// The specs run under `vitest --globals`, so describe/it/expect/vi are ambient.
// Referencing the types here (rather than via tsconfig "types") keeps the
// default @types auto-inclusion intact for @types/node, @types/express, etc.
/// <reference types="vitest/globals" />
