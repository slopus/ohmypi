import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
    type ComponentProps,
    createContext,
    type HTMLAttributes,
    useContext,
    useEffect,
    useState,
} from "react";
import {
    type BundledLanguage,
    codeToHtml,
    type ShikiTransformer,
    type SpecialLanguage,
} from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
    code: string;
    language: BundledLanguage | SpecialLanguage;
    showLineNumbers?: boolean;
};

type CodeBlockContextType = {
    code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
    code: "",
});

const lineNumberTransformer: ShikiTransformer = {
    name: "line-numbers",
    line(node, line) {
        node.children.unshift({
            type: "element",
            tagName: "span",
            properties: {
                className: [
                    "inline-block",
                    "min-w-10",
                    "mr-4",
                    "text-right",
                    "select-none",
                    "text-muted-foreground",
                ],
            },
            children: [{ type: "text", value: String(line) }],
        });
    },
};

// The app is dark-only (index.html sets class="dark"), so only the dark theme
// is highlighted — running shiki twice per block would be wasted work.
export async function highlightCode(
    code: string,
    language: BundledLanguage | SpecialLanguage,
    showLineNumbers = false,
): Promise<string> {
    const transformers: ShikiTransformer[] = showLineNumbers ? [lineNumberTransformer] : [];

    return await codeToHtml(code, {
        lang: language,
        theme: "one-dark-pro",
        transformers,
    });
}

export const CodeBlock = ({
    code,
    language,
    showLineNumbers = false,
    className,
    children,
    ...props
}: CodeBlockProps) => {
    const [html, setHtml] = useState<string>("");

    useEffect(() => {
        // Per-effect cancellation flag: with rapidly changing `code` (e.g.
        // streaming tool arguments) a stale highlight promise may resolve
        // after a newer one started; its result must be discarded.
        let cancelled = false;

        highlightCode(code, language, showLineNumbers).then((highlighted) => {
            if (!cancelled) {
                setHtml(highlighted);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [code, language, showLineNumbers]);

    return (
        <CodeBlockContext.Provider value={{ code }}>
            <div
                className={cn(
                    "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
                    className,
                )}
                {...props}
            >
                <div className="relative">
                    <div
                        className="overflow-auto [&>pre]:m-0 [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-foreground! [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                    {children && (
                        <div className="absolute top-2 right-2 flex items-center gap-2">
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </CodeBlockContext.Provider>
    );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
    onCopy?: () => void;
    onError?: (error: Error) => void;
    timeout?: number;
};

export const CodeBlockCopyButton = ({
    onCopy,
    onError,
    timeout = 2000,
    children,
    className,
    ...props
}: CodeBlockCopyButtonProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const { code } = useContext(CodeBlockContext);

    const copyToClipboard = async () => {
        if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
            onError?.(new Error("Clipboard API not available"));
            return;
        }

        try {
            await navigator.clipboard.writeText(code);
            setIsCopied(true);
            onCopy?.();
            setTimeout(() => setIsCopied(false), timeout);
        } catch (error) {
            onError?.(error as Error);
        }
    };

    const Icon = isCopied ? CheckIcon : CopyIcon;

    return (
        <Button
            className={cn("shrink-0", className)}
            onClick={copyToClipboard}
            size="icon"
            variant="ghost"
            {...props}
        >
            {children ?? <Icon size={14} />}
        </Button>
    );
};
