import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { Sparkle } from "./Sparkle";
import { CardRenderer } from "./CardRenderer";
import { CopyBlock } from "./CopyBlock";
import { CodeBlock } from "./CodeBlock";
import { parseCards } from "@/lib/cards";
import { preprocessMarkdown } from "@/lib/markdownPreprocess";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/types/api";

/** Extrae texto crudo de los children de ReactMarkdown (que puede traer arrays anidados). */
function extractText(node: ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as object)) {
    // @ts-expect-error narrowed via props guard
    return extractText(node.props.children);
  }
  return "";
}

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatar,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-4 md:px-6 py-1.5">
        <div className="max-w-[80%]">
          <div className="bg-[var(--color-bg-elevated)] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-[1.55] border border-white/[0.06]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          {message.image && (
            <div className="mt-2 flex justify-end">
              <img
                src={message.image}
                alt=""
                className="max-w-[280px] rounded-xl border border-white/[0.06]"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant: parsear card markers
  const segments = parseCards(message.content);

  return (
    <div className={cn("flex gap-3 px-4 md:px-6 py-2", !showAvatar && "pl-12 md:pl-14")}>
      {showAvatar && (
        <div className="shrink-0 mt-1">
          <Sparkle size={22} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-3">
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <div
              key={i}
              className="prose-noa text-white/95 text-[15px] leading-[1.65]"
            >
              <ReactMarkdown
                rehypePlugins={[rehypeRaw as never, rehypeHighlight as never]}
                components={{
                  // Override `<pre>` para soportar:
                  //   ```copy[:Label] ... ```  → CopyBlock destacado
                  //   ```lang ... ```          → CodeBlock con mini-botón copiar
                  pre({ children }) {
                    // El child esperado es <code class="language-xxx">…</code>
                    const codeNode = Array.isArray(children) ? children[0] : children;
                    const className =
                      (codeNode as { props?: { className?: string } })?.props?.className ?? "";
                    const langMatch = /language-([\w:-]+)/.exec(className);
                    const lang = langMatch ? langMatch[1] : "";
                    const rawText = extractText(
                      (codeNode as { props?: { children?: ReactNode } })?.props?.children,
                    ).replace(/\n$/, "");

                    if (lang.startsWith("copy")) {
                      const label = lang.includes(":") ? lang.split(":")[1] : undefined;
                      return <CopyBlock text={rawText} label={label} />;
                    }
                    return (
                      <CodeBlock language={lang || undefined} raw={rawText}>
                        {children}
                      </CodeBlock>
                    );
                  },
                  // <pre> ya inyecta nuestro wrapper, así que <code> dentro de él
                  // se renderiza normal (hereda highlight de rehype-highlight).
                }}
              >
                {preprocessMarkdown(seg.content)}
              </ReactMarkdown>
            </div>
          ) : (
            <CardRenderer key={i} card={seg.card} />
          ),
        )}
        {message.image && (
          <img
            src={message.image}
            alt=""
            className="max-w-[480px] rounded-xl border border-white/[0.06]"
          />
        )}
      </div>
    </div>
  );
});
