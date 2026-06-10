import { lazy, Suspense } from "react";

/**
 * LazyNoaMarkdown — carga diferida del ecosistema markdown (S158-b).
 *
 * react-markdown + rehype + highlight.js pesan ~145KB gzip y NO se necesitan
 * hasta el primer mensaje del asistente. Antes entraban estáticos al first
 * load (bloqueaban hasta la pantalla de login). El fallback muestra el texto
 * plano — el usuario ve el contenido al instante y el formato aparece en
 * cuanto el chunk llega (~1 frame en conexión normal).
 */
const NoaMarkdownInner = lazy(() =>
  import("./NoaMarkdown").then((m) => ({ default: m.NoaMarkdown })),
);

interface LazyNoaMarkdownProps {
  content: string;
  plain?: boolean;
}

export function LazyNoaMarkdown({ content, plain }: LazyNoaMarkdownProps) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{content}</p>}>
      <NoaMarkdownInner content={content} plain={plain} />
    </Suspense>
  );
}
