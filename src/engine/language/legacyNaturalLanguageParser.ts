/**
 * @file src/engine/language/legacyNaturalLanguageParser.ts
 * @description Explicit legacy/test-only boundary for the deterministic natural-language parser.
 *
 * IMPORTANT RUNTIME CONTRACT
 * --------------------------
 * This parser is RETAINED FOR LEGACY TESTS / FORENSIC REGRESSION ONLY.
 * It is NOT the production multilingual Natural Language -> SemanticEvent frontend.
 * It MUST NOT be wired into the live /api/chat runtime path.
 *
 * Production semantic normalization is expected to come from LLM #1 (or a future
 * replaceable multilingual frontend) and emit language-neutral SemanticEvent data.
 * Causal Language begins AFTER semantic normalization.
 *
 * This explicit boundary exists so that future maintainers do not mistake the
 * current Korean pattern parser for the intended multilingual runtime architecture.
 */

import { parseNaturalLanguageToEvents } from './causalCompiler';

/**
 * @deprecated LEGACY / TEST-ONLY.
 * Use the production SemanticEvent frontend contract instead.
 */
export const legacyParseNaturalLanguageToEvents = parseNaturalLanguageToEvents;
