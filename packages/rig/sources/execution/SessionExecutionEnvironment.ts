export type SessionExecutionEnvironment =
    | { type: "local" }
    | {
          kind: "container" | "image";
          reference: string;
          type: "docker";
          workingDirectory: string;
      };
