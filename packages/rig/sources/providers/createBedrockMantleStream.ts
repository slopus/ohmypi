import type { BedrockModelRoute } from "./bedrock-model-routes.js";
import {
    createBedrockOpenAIClient,
    type BedrockOpenAIClient,
} from "./createBedrockOpenAIClient.js";
import { createBedrockOpenAIRequest } from "./createBedrockOpenAIRequest.js";
import { createOpenAIResponsesStream } from "./createOpenAIResponsesStream.js";
import type { Context, StreamOptions } from "./types.js";

export function createBedrockMantleStream(options: {
    bearerToken: string;
    client?: BedrockOpenAIClient;
    context: Context;
    endpoint?: string;
    modelRoute: BedrockModelRoute;
    region: string;
    streamOptions?: StreamOptions;
}): ReturnType<typeof createOpenAIResponsesStream> {
    const client =
        options.client ??
        createBedrockOpenAIClient({
            bearerToken: options.bearerToken,
            ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }),
            region: options.region,
        });

    return createOpenAIResponsesStream({
        createResponseStream: () =>
            client.responses.create(
                createBedrockOpenAIRequest({
                    context: options.context,
                    modelRoute: options.modelRoute,
                    ...(options.streamOptions === undefined
                        ? {}
                        : { streamOptions: options.streamOptions }),
                }),
                ...(options.streamOptions?.signal === undefined
                    ? []
                    : [{ signal: options.streamOptions.signal }]),
            ),
        failureMessage: "Amazon Bedrock failed to generate a response.",
        modelId: options.modelRoute.model.id,
        providerId: "bedrock",
        ...(options.streamOptions?.signal === undefined
            ? {}
            : { signal: options.streamOptions.signal }),
    });
}
