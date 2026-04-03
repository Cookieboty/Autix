import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "./model.factory";
import { buildSummaryPrompt } from "./summary.prompt-builder";

/**
 * Summary chain using pipe() composition:
 * prompt -> model -> StringOutputParser
 */
const summaryPrompt = buildSummaryPrompt();
const model = createChatModel();
const outputParser = new StringOutputParser();

export const summaryChain = summaryPrompt.pipe(model).pipe(outputParser);
