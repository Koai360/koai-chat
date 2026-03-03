import { useCallback, useEffect, useRef, useState } from "react";
import { inpaintImage } from "../lib/api";

interface Props {
  imageSrc: string;
  onClose: () => void;
  onResult: (resultSrc: string) => void;
}

type Tool = "brush" | "eraser";
interface Stroke {
  points: Array<{ x: number; y: number }>;
  tool: Tool;
  size: number;
}

const MASK_COLOR = "rgba(255, 0, 80, 0.45)";
const MIN_BRUSH = 10;
const MAX_BRUSH = 100;
const DEFAULT_BRUSH = 30;
const MAX_CANVAS = 1024;

export function MaskEditor({ imageSrc, onClose, onResult }: Props) {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isDrawing = useRef(false);
  const strokes = useRef<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Load image into canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_CANVAS / img.naturalWidth, MAX_CANVAS / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const ic = imageCanvasRef.current;
      const mc = maskCanvasRef.current;
      if (!ic || !mc) return;

      ic.width = w;
      ic.height = h;
      mc.width = w;
      mc.height = h;

      const ctx = ic.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
      }

      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Coordinate transform: pointer → canvas
  const getCanvasPoint = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const mc = maskCanvasRef.current;
    if (!mc) return null;
    const rect = mc.getBoundingClientRect();
    const scaleX = mc.width / rect.width;
    const scaleY = mc.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Scaled brush size (CSS px → canvas px)
  const getScaledBrush = useCallback(() => {
    const mc = maskCanvasRef.current;
    if (!mc) return brushSize;
    const rect = mc.getBoundingClientRect();
    return brushSize * (mc.width / rect.width);
  }, [brushSize]);

  // Draw a stroke segment
  const drawSegment = useCallback((from: { x: number; y: number }, to: { x: number; y: number }, t: Tool, size: number) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = MASK_COLOR;
    ctx.fillStyle = MASK_COLOR;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  // Draw a dot (for single taps)
  const drawDot = useCallback((point: { x: number; y: number }, t: Tool, size: number) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = MASK_COLOR;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (resultImage) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    isDrawing.current = true;
    const scaledBrush = getScaledBrush();
    currentStroke.current = { points: [point], tool, size: scaledBrush };
    lastPoint.current = point;
    drawDot(point, tool, scaledBrush);
  }, [tool, resultImage, getCanvasPoint, getScaledBrush, drawDot]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current || resultImage) return;
    const point = getCanvasPoint(e);
    if (!point || !lastPoint.current || !currentStroke.current) return;
    currentStroke.current.points.push(point);
    drawSegment(lastPoint.current, point, currentStroke.current.tool, currentStroke.current.size);
    lastPoint.current = point;
  }, [resultImage, getCanvasPoint, drawSegment]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentStroke.current && currentStroke.current.points.length > 0) {
      strokes.current.push(currentStroke.current);
    }
    currentStroke.current = null;
    lastPoint.current = null;
  }, []);

  // Replay all strokes on a clean canvas
  const replayStrokes = useCallback((list: Stroke[]) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx || !maskCanvasRef.current) return;
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    for (const s of list) {
      if (s.points.length === 1) {
        drawDot(s.points[0], s.tool, s.size);
      } else {
        for (let i = 1; i < s.points.length; i++) {
          drawSegment(s.points[i - 1], s.points[i], s.tool, s.size);
        }
      }
    }
  }, [drawDot, drawSegment]);

  const handleUndo = useCallback(() => {
    if (strokes.current.length === 0) return;
    strokes.current.pop();
    replayStrokes(strokes.current);
  }, [replayStrokes]);

  const handleClear = useCallback(() => {
    strokes.current = [];
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (ctx && maskCanvasRef.current) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
  }, []);

  const handleInvert = useCallback(() => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    const ctx = mc.getContext("2d");
    if (!ctx) return;
    const w = mc.width;
    const h = mc.height;
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 10) {
        px[i + 3] = 0;
      } else {
        px[i] = 255;
        px[i + 1] = 0;
        px[i + 2] = 80;
        px[i + 3] = 115;
      }
    }
    ctx.putImageData(data, 0, 0);
    strokes.current = [];
  }, []);

  // Check if mask has any painted content
  const hasMaskContent = useCallback((): boolean => {
    const mc = maskCanvasRef.current;
    if (!mc) return false;
    const ctx = mc.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, mc.width, mc.height);
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 10) return true;
    }
    return false;
  }, []);

  // Generate B/W mask from painted overlay
  const generateMaskBase64 = useCallback((): string => {
    const mc = maskCanvasRef.current;
    if (!mc) return "";
    const w = mc.width;
    const h = mc.height;
    const ctx = mc.getContext("2d")!;
    const maskData = ctx.getImageData(0, 0, w, h);
    const px = maskData.data;

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tmpCtx = tmp.getContext("2d")!;
    tmpCtx.fillStyle = "#000000";
    tmpCtx.fillRect(0, 0, w, h);
    const out = tmpCtx.getImageData(0, 0, w, h);
    const o = out.data;

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 10) {
        o[i] = 255;
        o[i + 1] = 255;
        o[i + 2] = 255;
        o[i + 3] = 255;
      }
    }
    tmpCtx.putImageData(out, 0, 0);
    return tmp.toDataURL("image/png").split(",")[1];
  }, []);

  // Get the source image as raw base64
  const getImageBase64 = useCallback((): string => {
    const ic = imageCanvasRef.current;
    if (!ic) return imageSrc.split(",")[1] || "";
    return ic.toDataURL("image/png").split(",")[1];
  }, [imageSrc]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Escribe qué quieres generar en las áreas marcadas");
      return;
    }
    if (!hasMaskContent()) {
      setError("Pinta las áreas que quieres regenerar");
      return;
    }
    setError(null);
    setGenerating(true);

    try {
      const result = await inpaintImage(
        getImageBase64(),
        generateMaskBase64(),
        prompt.trim(),
      );

      if (result.error) {
        setError(result.error);
      } else if (result.image) {
        const mime = result.image.startsWith("iVBOR") ? "image/png"
          : result.image.startsWith("R0lGOD") ? "image/gif"
          : result.image.startsWith("UklGR") ? "image/webp"
          : "image/jpeg";
        setResultImage(`data:${mime};base64,${result.image}`);
      } else {
        setError("No se recibió imagen de resultado");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }, [prompt, hasMaskContent, getImageBase64, generateMaskBase64]);

  const handleEditAgain = useCallback(() => {
    if (!resultImage) return;
    // Load result as the new base image
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_CANVAS / img.naturalWidth, MAX_CANVAS / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const ic = imageCanvasRef.current;
      const mc = maskCanvasRef.current;
      if (!ic || !mc) return;

      ic.width = w;
      ic.height = h;
      mc.width = w;
      mc.height = h;

      const ctx = ic.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
      }

      strokes.current = [];
      setResultImage(null);
    };
    img.src = resultImage;
  }, [resultImage]);

  const handleSave = useCallback(() => {
    if (resultImage) onResult(resultImage);
  }, [resultImage, onResult]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 safe-top">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 active:text-white active:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span className="text-sm font-medium text-white/80">
          {resultImage ? "Resultado" : "Editor"}
        </span>

        <div className="flex items-center gap-1">
          {!resultImage && (
            <>
              <button
                onClick={handleUndo}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 active:text-white active:bg-white/10"
                title="Deshacer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
              <button
                onClick={handleClear}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 active:text-white active:bg-white/10"
                title="Limpiar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={wrapperRef}
        className="flex-1 flex items-center justify-center px-3 overflow-hidden relative"
        style={{ touchAction: "none", overscrollBehavior: "none", userSelect: "none", WebkitUserSelect: "none" }}
      >
        {resultImage ? (
          <img
            src={resultImage}
            alt="Resultado inpainting"
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        ) : (
          <div className="relative inline-block">
            <canvas
              ref={imageCanvasRef}
              className="max-w-full max-h-full object-contain rounded-xl"
              style={{ display: imageLoaded ? "block" : "none" }}
            />
            <canvas
              ref={maskCanvasRef}
              className="absolute inset-0 max-w-full max-h-full rounded-xl"
              style={{ display: imageLoaded ? "block" : "none", touchAction: "none", cursor: "crosshair" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {!imageLoaded && (
              <div className="w-48 h-48 flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tool bar (only in draw mode) */}
      {!resultImage && imageLoaded && (
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1">
            {/* Brush */}
            <button
              onClick={() => setTool("brush")}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                tool === "brush" ? "bg-[#bcd431] text-black" : "bg-white/10 text-white/70"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>
            {/* Eraser */}
            <button
              onClick={() => setTool("eraser")}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                tool === "eraser" ? "bg-[#bcd431] text-black" : "bg-white/10 text-white/70"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21.4 5.6c.8.8.8 2 0 2.8L12 18" />
                <path d="M6 12l4 4" />
              </svg>
            </button>
          </div>

          {/* Brush size slider */}
          <input
            type="range"
            min={MIN_BRUSH}
            max={MAX_BRUSH}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1 mx-3 h-1 accent-[#bcd431] bg-white/10 rounded-full appearance-none cursor-pointer"
          />

          {/* Invert */}
          <button
            onClick={handleInvert}
            className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs font-medium active:bg-white/20 active:scale-95 transition-all"
          >
            Invertir
          </button>
        </div>
      )}

      {/* Result actions */}
      {resultImage && (
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <button
            onClick={handleEditAgain}
            className="px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm active:bg-white/20 active:scale-95 transition-all"
          >
            Editar de nuevo
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-full bg-[#bcd431] text-black text-sm font-medium active:scale-95 transition-all"
          >
            Guardar
          </button>
        </div>
      )}

      {/* Prompt input + Generate (only in draw mode) */}
      {!resultImage && imageLoaded && (
        <div className="px-3 pb-3 safe-bottom">
          {error && (
            <p className="text-xs text-red-400 text-center mb-2">{error}</p>
          )}
          <div className="flex items-center gap-2 bg-[#2f2f2f] rounded-[22px] px-4 py-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe qué generar en las áreas marcadas..."
              className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-[#9b9b9b]/60 outline-none"
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#bcd431] text-black shrink-0 disabled:opacity-40 active:scale-95 transition-all"
            >
              {generating ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 5H1v0" />
                  <polygon points="22 12 13 5 13 19" fill="currentColor" stroke="none" />
                </svg>
              )}
            </button>
          </div>
          {generating && (
            <p className="text-xs text-[#9b9b9b] text-center mt-2">
              Generando con Studio (puede tardar ~60s)...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
