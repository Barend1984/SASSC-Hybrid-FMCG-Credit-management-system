import React, { useRef, useState, useEffect } from 'react';
import { Edit2, Sparkles, Trash2, CheckCircle } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureData: string, type: 'drawn' | 'typed') => void;
  onClear: () => void;
  savedSignature?: string;
  savedType?: 'drawn' | 'typed';
  clientName: string;
}

export default function SignaturePad({
  onSave,
  onClear,
  savedSignature,
  savedType,
  clientName
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sigType, setSigType] = useState<'drawn' | 'typed'>(savedType || 'drawn');
  const [typedName, setTypedName] = useState(savedType === 'typed' ? savedSignature || '' : clientName || '');
  const [hasSignature, setHasSignature] = useState(!!savedSignature);

  // Initialize Canvas stroke styling
  useEffect(() => {
    if (sigType === 'drawn' && canvasRef.current) {
      const canvas = canvasRef.current;
      
      // Handle high-DPI scaling
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#f59e0b'; // Amber theme color
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw existing signature if any
        if (savedSignature && savedType === 'drawn') {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = savedSignature;
        }
      }
    }
  }, [sigType, savedSignature, savedType]);

  // Handle auto-saving typed names
  useEffect(() => {
    if (sigType === 'typed' && typedName.trim()) {
      onSave(typedName, 'typed');
      setHasSignature(true);
    }
  }, [typedName, sigType]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveDrawnSignature();
  };

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Create temporary canvas to get a white/transparent signature of correct size
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl, 'drawn');
    }
  };

  const clear = () => {
    if (sigType === 'drawn' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setTypedName('');
    setHasSignature(false);
    onClear();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">✍️ Electronic Legal Signature</span>
          <p className="text-[10px] text-slate-500">Sign electronically to consent and link this agreement to the NCR tracker</p>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 text-[10px]">
          <button
            type="button"
            onClick={() => { setSigType('drawn'); clear(); }}
            className={`px-2.5 py-1 rounded-md font-bold transition ${
              sigType === 'drawn' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Draw Sign
          </button>
          <button
            type="button"
            onClick={() => { setSigType('typed'); clear(); }}
            className={`px-2.5 py-1 rounded-md font-bold transition ${
              sigType === 'typed' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Type Signature
          </button>
        </div>
      </div>

      {sigType === 'drawn' ? (
        <div className="space-y-2">
          <div className="relative bg-slate-950 border border-slate-850 rounded-lg overflow-hidden h-[120px] cursor-crosshair">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 w-full h-full"
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-[10px] select-none uppercase tracking-widest font-mono">
                Use mouse or finger to draw signature here
              </div>
            )}
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500 italic">Signature will be applied to the 4 NCA compliance documents</span>
            <button
              type="button"
              onClick={clear}
              className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition"
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="form-group">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Type Acknowledgment Signature Name</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type customer's full name..."
              className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 py-2 px-3 text-xs focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>

          <div className="bg-slate-950 border border-slate-850/50 p-4 rounded-lg flex items-center justify-center min-h-[70px]">
            {typedName.trim() ? (
              <div className="text-center">
                <span className="font-serif italic text-2xl text-amber-500 tracking-wider font-semibold block px-4 py-1 select-none">
                  {typedName}
                </span>
                <span className="text-[9px] text-slate-500 block uppercase tracking-widest mt-1">Digital Attestation Signature</span>
              </div>
            ) : (
              <span className="text-slate-600 text-[10px] font-mono uppercase tracking-widest">Type a name above to view signature style</span>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500 italic">Legally valid digital signature matching Section 81 of the NCA</span>
            <button
              type="button"
              onClick={clear}
              className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition"
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>
      )}

      {hasSignature && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
          <CheckCircle size={12} />
          <span>Electronic Signature Loaded & Bound to Client Profile Successfully</span>
        </div>
      )}
    </div>
  );
}
