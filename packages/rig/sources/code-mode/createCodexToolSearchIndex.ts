import { tokenizeCodexToolSearchText } from "./tokenizeCodexToolSearchText.js";

export interface CodexToolSearchDocument<T> {
    searchText: string;
    value: T;
}

export type CodexToolSearchIndex<T> = (query: string, limit: number) => readonly T[];

export function createCodexToolSearchIndex<T>(
    documents: readonly CodexToolSearchDocument<T>[],
): CodexToolSearchIndex<T> {
    const tokenized = documents.map((document) => tokenizeCodexToolSearchText(document.searchText));
    const averageDocumentLength =
        tokenized.length === 0
            ? 256
            : tokenized.reduce((total, tokens) => total + tokens.length, 0) / tokenized.length;
    const documentFrequency = new Map<string, number>();
    for (const tokens of tokenized) {
        for (const token of new Set(tokens)) {
            documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
        }
    }
    const indexedDocuments = tokenized.map((tokens, index) => {
        const frequencies = new Map<string, number>();
        for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
        const weights = new Map<string, number>();
        for (const [token, frequency] of frequencies) {
            const numerator = frequency * 2.2;
            const denominator =
                frequency + 1.2 * (1 - 0.75 + 0.75 * (tokens.length / averageDocumentLength));
            weights.set(token, numerator / denominator);
        }
        return { index, weights };
    });

    return (query, limit) => {
        const queryTokens = tokenizeCodexToolSearchText(query);
        const scored = indexedDocuments.flatMap(({ index, weights }) => {
            let score = 0;
            for (const token of queryTokens) {
                const weight = weights.get(token);
                if (weight === undefined) continue;
                const containingDocuments = documentFrequency.get(token) ?? 0;
                const inverseDocumentFrequency = Math.log(
                    1 +
                        (documents.length - containingDocuments + 0.5) /
                            (containingDocuments + 0.5),
                );
                score += inverseDocumentFrequency * weight;
            }
            return score === 0 ? [] : [{ index, score }];
        });
        scored.sort((left, right) => right.score - left.score || left.index - right.index);
        return scored.slice(0, limit).map(({ index }) => documents[index]!.value);
    };
}
