import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { mediaTypeForPath } from "../utils/index.js";

const viewImageReturnSchema = Type.Object({
  image_url: Type.String(),
  detail: Type.Union([Type.Literal("high"), Type.Literal("original")]),
});

export const codexViewImageTool = defineTool({
  name: "view_image",
  label: "view_image",
  description:
    "View a local image file from the filesystem when visual inspection is needed. Use this for images already available on disk.",
  arguments: Type.Object({
    path: Type.String({ description: "Local filesystem path to an image file." }),
    detail: Type.Optional(Type.Union([
      Type.Literal("high"),
      Type.Literal("original"),
    ], {
      description: "Image detail level. Defaults to `high`; use `original` to preserve exact resolution.",
    })),
  }),
  returnType: viewImageReturnSchema,
  execute: async ({ path, detail }, context) => {
    const mediaType = mediaTypeForPath(path);
    const data = Buffer.from(await context.fs.readFileBuffer(path)).toString("base64");
    return {
      image_url: `data:${mediaType};base64,${data}`,
      detail: detail ?? "high",
    };
  },
  toLLM: (result) => {
    const match = /^data:([^;]+);base64,(.*)$/.exec(result.image_url);
    return match
      ? [{ type: "image", mediaType: match[1] ?? "image/png", data: match[2] ?? "" }]
      : [{ type: "text", text: result.image_url }];
  },
  locks: [],
});
