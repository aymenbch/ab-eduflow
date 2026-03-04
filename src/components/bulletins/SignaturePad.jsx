import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle, PenLine } from "lucide-react";

export default function SignaturePad({ label, onSign, existingSignature }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [signed, setSigned] = useState(!!existingSignature);
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    if (existingSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = existingSignature;
    }
  }, [existingSignature, showPad]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    // Check if anything was drawn
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasContent = data.some((v, i) => i % 4 === 3 && v > 0);
    if (!hasContent) return;
    setSigned(true);
    setShowPad(false);
    onSign && onSign(dataUrl);
  };

  return (
    <div className="text-center print:block">
      {/* Signature display area */}
      {signed && existingSignature ? (
        <div className="relative">
          <img
            src={existingSignature}
            alt="Signature"
            className="h-16 mx-auto object-contain"
          />
          <button
            onClick={() => { setShowPad(true); setSigned(false); clearPad(); }}
            className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-500 hover:bg-red-200 print:hidden"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          className="h-16 border-b border-slate-400 flex items-end justify-center pb-1 print:block cursor-pointer hover:bg-slate-50 rounded print:cursor-default"
          onClick={() => !showPad && setShowPad(true)}
        >
          {!showPad && (
            <span className="text-xs text-blue-500 flex items-center gap-1 print:hidden">
              <PenLine className="w-3 h-3" />
              Cliquez pour signer
            </span>
          )}
        </div>
      )}

      <div className="text-xs text-slate-400 mt-1">{label}</div>

      {/* Signature pad modal */}
      {showPad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-96">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">Signature électronique</h3>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 mb-4 touch-none">
              <canvas
                ref={canvasRef}
                width={340}
                height={150}
                className="block w-full"
                style={{ touchAction: "none" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>

            <p className="text-xs text-slate-400 text-center mb-4">
              Dessinez votre signature dans le cadre ci-dessus
            </p>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={clearPad} className="flex-1">
                <Trash2 className="w-4 h-4 mr-1" />
                Effacer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPad(false)} className="flex-1">
                Annuler
              </Button>
              <Button size="sm" onClick={confirmSignature} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Valider
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}