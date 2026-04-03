import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "./model.factory";
import { buildRequirementPrompt } from "./requirement.prompt-builder";

/**
 * Requirement chain using pipe() composition:
 * prompt -> model -> StringOutputParser
 */
const requirementPrompt = buildRequirementPrompt();
const model = createChatModel();
const outputParser = new StringOutputParser();

export const requirementChain = requirementPrompt.pipe(model).pipe(outputParser);
