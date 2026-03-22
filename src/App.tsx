import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Type, 
  Trash2, 
  Plus, 
  Sparkles, 
  Wand2, 
  Palette,
  MousePointer2,
  Crop,
  Brush,
  Eraser,
  PaintBucket,
  Search,
  Hand,
  Wand
} from 'lucide-react';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer, Line } from 'react-konva';
import Konva from 'konva';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import useImage from 'use-image';
import { Layer as LayerType, Project } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ImageLayer = ({ layer, isSelected, onSelect, onChange }: any) => {
  const [img] = useImage(layer.src || '');
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && shapeRef.current && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    if (shapeRef.current && img) {
      shapeRef.current.cache();
    }
  }, [img, layer.filter]);

  const getFilters = () => {
    if (!Konva) return [];
    
    switch (layer.filter) {
      case 'grayscale': return [Konva.Filters.Grayscale];
      case 'sepia': return [Konva.Filters.Sepia];
      case 'invert': return [Konva.Filters.Invert];
      case 'blur': return [Konva.Filters.Blur];
      case 'brighten': return [Konva.Filters.Brighten];
      default: return [];
    }
  };

  return (
    <>
      <KonvaImage
        image={img}
        ref={shapeRef}
        {...layer}
        filters={getFilters()}
        blurRadius={layer.filter === 'blur' ? 10 : 0}
        brightness={layer.filter === 'brighten' ? 0.3 : 0}
        draggable={layer.draggable !== false}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

const TextLayer = ({ layer, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && shapeRef.current && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        ref={shapeRef}
        {...layer}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            newBox.width = Math.max(30, newBox.width);
            return newBox;
          }}
        />
      )}
    </>
  );
};

const DrawingLayer = ({ layer, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && shapeRef.current && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Line
        ref={shapeRef}
        {...layer}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
        />
      )}
    </>
  );
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string>('move');
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [maskLayerId, setMaskLayerId] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('userId', '==', 'guest'));
    return onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });
  }, []);

  const addLayer = (type: LayerType['type'], src?: string) => {
    const newLayer: LayerType = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 50,
      y: 50,
      width: type === 'text' ? 200 : 200,
      height: type === 'text' ? 50 : 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      src,
      content: type === 'text' ? 'Double click to edit' : undefined,
      fill: type === 'text' ? '#ffffff' : undefined,
      fontSize: type === 'text' ? 24 : undefined,
      fontFamily: type === 'text' ? 'Inter' : undefined,
    };
    
    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        layers: [...currentProject.layers, newLayer]
      });
    } else {
      setCurrentProject({
        id: 'new',
        name: 'Untitled Project',
        userId: 'guest',
        layers: [newLayer],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        addLayer('image', event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyAITool = async (tool: 'remove-bg' | 'enhance' | 'generate' | 'magic-eraser') => {
    setIsProcessing(true);
    try {
      if (tool === 'magic-eraser') {
        if (!selectedId || !currentProject || !maskLayerId) return;
        const targetLayer = currentProject.layers.find(l => l.id === selectedId);
        const maskLayer = currentProject.layers.find(l => l.id === maskLayerId);
        if (!targetLayer || targetLayer.type !== 'image' || !maskLayer) return;

        // We'll send the image and the mask to Gemini
        // For simplicity, we'll prompt the model to remove the object highlighted by the mask
        // We need to combine them or send them as parts
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: targetLayer.src!.split(',')[1],
                  mimeType: "image/png"
                }
              },
              {
                text: "Please remove the object highlighted in the provided mask area and intelligently fill the background to match the surroundings. Return only the edited image as base64."
              }
            ]
          }
        });

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const updatedLayers = currentProject.layers.filter(l => l.id !== maskLayerId).map(l => 
              l.id === selectedId ? { ...l, src: `data:image/png;base64,${part.inlineData.data}` } : l
            );
            setCurrentProject({ ...currentProject, layers: updatedLayers });
            setMaskLayerId(null);
            break;
          }
        }
        return;
      }

      let body: any = {};
      let endpoint = '';

      if (tool === 'generate') {
        endpoint = '/api/ai/generate';
        body = { prompt: genPrompt };
      } else {
        if (!selectedId || !currentProject) return;
        const layer = currentProject.layers.find(l => l.id === selectedId);
        if (!layer || layer.type !== 'image') return;
        endpoint = tool === 'remove-bg' ? '/api/ai/remove-bg' : '/api/ai/enhance';
        body = { image: layer.src };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      
      if (tool === 'generate') {
        addLayer('image', data.image);
        setShowGenModal(false);
        setGenPrompt('');
      } else {
        const updatedLayers = currentProject!.layers.map(l => 
          l.id === selectedId ? { ...l, src: data.image } : l
        );
        setCurrentProject({ ...currentProject!, layers: updatedLayers });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyFilter = (filter: string) => {
    if (!selectedId || !currentProject) return;
    const layers = currentProject.layers.map(l => 
      l.id === selectedId ? { ...l, filter } : l
    );
    setCurrentProject({ ...currentProject, layers });
  };

  const handleMouseDown = (e: any) => {
    if (selectedTool !== 'brush' && selectedTool !== 'eraser' && selectedTool !== 'magic-eraser') return;
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newLayer: LayerType = {
      id: Math.random().toString(36).substr(2, 9),
      name: selectedTool === 'magic-eraser' ? 'AI Mask' : (selectedTool === 'brush' ? 'Brush Stroke' : 'Eraser Stroke'),
      type: 'drawing',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: selectedTool === 'magic-eraser' ? 0.5 : 1,
      visible: true,
      stroke: selectedTool === 'eraser' ? '#111111' : (selectedTool === 'magic-eraser' ? '#ff0000' : brushColor),
      strokeWidth: brushSize,
      points: [pos.x, pos.y],
      lineCap: 'round',
      lineJoin: 'round',
      globalCompositeOperation: selectedTool === 'eraser' ? 'destination-out' : 'source-over',
      draggable: selectedTool !== 'magic-eraser',
    } as any;

    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        layers: [...currentProject.layers, newLayer]
      });
      setSelectedId(selectedTool === 'magic-eraser' ? selectedId : newLayer.id);
      if (selectedTool === 'magic-eraser') {
        setMaskLayerId(newLayer.id);
      }
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentProject || (!selectedId && selectedTool !== 'magic-eraser')) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const targetId = selectedTool === 'magic-eraser' ? maskLayerId : selectedId;
    if (!targetId) return;
    
    const lastLayer = currentProject.layers.find(l => l.id === targetId);
    if (!lastLayer || lastLayer.type !== 'drawing') return;

    const newPoints = lastLayer.points?.concat([point.x, point.y]);
    const updatedLayers = currentProject.layers.map(l => 
      l.id === targetId ? { ...l, points: newPoints } : l
    );
    setCurrentProject({ ...currentProject, layers: updatedLayers });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleExport = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL();
    const link = document.createElement('a');
    link.download = `${currentProject?.name || 'project'}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewProject = () => {
    setCurrentProject({
      id: 'new',
      name: 'Untitled Project',
      userId: 'guest',
      layers: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setSelectedId(null);
  };

  const stageRef = useRef<any>(null);

  return (
    <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col overflow-hidden font-sans select-none">
      {/* Top Menu Bar */}
      <div className="h-8 bg-[#252525] border-b border-[#323232] flex items-center px-3 gap-4 text-[11px] font-medium">
        <div className="flex items-center gap-1 mr-4">
          <div className="w-5 h-5 bg-[#001e36] border border-[#00a3ff] rounded-sm flex items-center justify-center">
            <span className="text-[#00a3ff] text-[10px] font-bold">Ps</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleNewProject} className="px-2 py-1 hover:bg-[#323232] rounded transition-colors">New</button>
          <button onClick={handleExport} className="px-2 py-1 hover:bg-[#323232] rounded transition-colors">Export</button>
          {['Edit', 'Image', 'Layer', 'Type', 'Select', 'Filter', 'View', 'Window', 'Help'].map(menu => (
            <button key={menu} className="px-2 py-1 hover:bg-[#323232] rounded transition-colors">{menu}</button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">Guest User</span>
        </div>
      </div>

      {/* Options Bar */}
      <div className="h-10 bg-[#252525] border-b border-[#323232] flex items-center px-4 gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Tool:</span>
          <span className="font-semibold text-white uppercase">{selectedTool} Tool</span>
        </div>
        <div className="w-[1px] h-4 bg-[#323232]" />
        
        {(selectedTool === 'brush' || selectedTool === 'eraser') && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Size:</span>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="accent-[#00a3ff] w-24 h-1" 
              />
              <span className="w-4">{brushSize}</span>
            </div>
            {selectedTool === 'brush' && (
              <div className="flex items-center gap-2">
                <span>Color:</span>
                <input 
                  type="color" 
                  value={brushColor} 
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-5 h-5 bg-transparent border-none cursor-pointer" 
                />
              </div>
            )}
          </div>
        )}

        {selectedTool === 'move' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked className="accent-[#00a3ff]" />
              <span>Auto-Select</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked className="accent-[#00a3ff]" />
              <span>Show Transform Controls</span>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - Tools */}
        <aside className="w-12 bg-[#252525] border-r border-[#323232] flex flex-col items-center py-4 gap-2">
          <button 
            onClick={() => setSelectedTool('move')}
            className={cn("p-2 rounded transition-colors", selectedTool === 'move' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Move Tool (V)"
          >
            <MousePointer2 className={cn("w-5 h-5", selectedTool === 'move' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>
          
          <label className="p-2 hover:bg-[#323232] rounded cursor-pointer transition-colors" title="Add Image">
            <Plus className="w-5 h-5 text-zinc-400" />
            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
          </label>
          
          <div className="w-6 h-[1px] bg-[#323232] my-1" />
          
          <button 
            onClick={() => setSelectedTool('crop')}
            className={cn("p-2 rounded transition-all", selectedTool === 'crop' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Crop Tool (C)"
          >
            <Crop className={cn("w-5 h-5", selectedTool === 'crop' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => applyAITool('remove-bg')}
            className={cn(
              "p-2 rounded transition-all",
              isProcessing ? "animate-pulse bg-[#00a3ff]/20" : "hover:bg-[#323232]"
            )}
            title="AI Remove Background"
          >
            <Wand2 className="w-5 h-5 text-zinc-400" />
          </button>
          
          <button 
            onClick={() => applyAITool('enhance')}
            className="p-2 rounded hover:bg-[#323232] transition-all"
            title="AI Enhance"
          >
            <Sparkles className="w-5 h-5 text-zinc-400" />
          </button>

          <button 
            onClick={() => setSelectedTool('brush')}
            className={cn("p-2 rounded transition-all", selectedTool === 'brush' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Brush Tool (B)"
          >
            <Brush className={cn("w-5 h-5", selectedTool === 'brush' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => setSelectedTool('eraser')}
            className={cn("p-2 rounded transition-all", selectedTool === 'eraser' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Eraser Tool (E)"
          >
            <Eraser className={cn("w-5 h-5", selectedTool === 'eraser' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => setSelectedTool('magic-eraser')}
            className={cn("p-2 rounded transition-all", selectedTool === 'magic-eraser' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Magic Eraser (AI Object Removal)"
          >
            <Wand className={cn("w-5 h-5", selectedTool === 'magic-eraser' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => setSelectedTool('paint')}
            className={cn("p-2 rounded transition-all", selectedTool === 'paint' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Paint Bucket (G)"
          >
            <PaintBucket className={cn("w-5 h-5", selectedTool === 'paint' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => addLayer('text')}
            className="p-2 rounded hover:bg-[#323232] transition-all" 
            title="Add Text (T)"
          >
            <Type className="w-5 h-5 text-zinc-400" />
          </button>

          <button 
            onClick={() => setSelectedTool('filters')}
            className={cn("p-2 rounded transition-all", selectedTool === 'filters' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Filters"
          >
            <Palette className={cn("w-5 h-5", selectedTool === 'filters' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => setShowGenModal(true)}
            className="p-2 rounded hover:bg-[#323232] transition-all" 
            title="AI Image Generator"
          >
            <ImageIcon className="w-5 h-5 text-[#00a3ff]" />
          </button>
          
          <div className="flex-1" />
          
          <button 
            onClick={() => setSelectedTool('hand')}
            className={cn("p-2 rounded transition-all", selectedTool === 'hand' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Hand Tool (H)"
          >
            <Hand className={cn("w-5 h-5", selectedTool === 'hand' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>

          <button 
            onClick={() => setSelectedTool('zoom')}
            className={cn("p-2 rounded transition-all", selectedTool === 'zoom' ? "bg-[#373737]" : "hover:bg-[#323232]")} 
            title="Zoom Tool (Z)"
          >
            <Search className={cn("w-5 h-5", selectedTool === 'zoom' ? "text-[#00a3ff]" : "text-zinc-400")} />
          </button>
        </aside>

        {/* Canvas Area */}
        <section className="flex-1 relative bg-[#111111] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
          />
          
          <div className="bg-[#1e1e1e] shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden border border-[#323232] relative">
            {selectedTool === 'magic-eraser' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-[#00a3ff] text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce flex items-center gap-2 pointer-events-none">
                <Wand className="w-4 h-4" />
                Draw a mask over the object to remove
              </div>
            )}
            <Stage 
              ref={stageRef}
              width={800} 
              height={600}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null);
              }}
            >
              <Layer>
                {currentProject?.layers.map((layer) => {
                  if (layer.type === 'image') {
                    return (
                      <ImageLayer
                        key={layer.id}
                        layer={layer}
                        isSelected={layer.id === selectedId && selectedTool === 'move'}
                        onSelect={() => setSelectedId(layer.id)}
                        onChange={(newAttrs: any) => {
                          const layers = currentProject.layers.map(l => 
                            l.id === layer.id ? { ...l, ...newAttrs } : l
                          );
                          setCurrentProject({ ...currentProject, layers });
                        }}
                      />
                    );
                  } else if (layer.type === 'text') {
                    return (
                      <TextLayer
                        key={layer.id}
                        layer={layer}
                        isSelected={layer.id === selectedId && selectedTool === 'move'}
                        onSelect={() => setSelectedId(layer.id)}
                        onChange={(newAttrs: any) => {
                          const layers = currentProject.layers.map(l => 
                            l.id === layer.id ? { ...l, ...newAttrs } : l
                          );
                          setCurrentProject({ ...currentProject, layers });
                        }}
                      />
                    );
                  } else if (layer.type === 'drawing') {
                    return (
                      <DrawingLayer
                        key={layer.id}
                        layer={layer}
                        isSelected={layer.id === selectedId && selectedTool === 'move'}
                        onSelect={() => setSelectedId(layer.id)}
                        onChange={(newAttrs: any) => {
                          const layers = currentProject.layers.map(l => 
                            l.id === layer.id ? { ...l, ...newAttrs } : l
                          );
                          setCurrentProject({ ...currentProject, layers });
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </Layer>
            </Stage>
          </div>

          {isProcessing && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-40">
              <div className="bg-[#252525] border border-[#323232] p-6 rounded-lg shadow-2xl flex flex-col items-center gap-4">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-8 h-8 border-2 border-[#00a3ff] border-t-transparent rounded-full"
                />
                <span className="text-xs font-medium text-zinc-400">Processing AI magic...</span>
              </div>
            </div>
          )}

          {/* AI Image Generation Modal */}
          <AnimatePresence>
            {showGenModal && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-[#252525] border border-[#323232] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
                >
                  <div className="h-10 bg-[#323232] flex items-center justify-between px-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">AI Image Generator</span>
                    <button onClick={() => setShowGenModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-xs text-zinc-400">Describe the image you want to create. Our AI will generate it for you.</p>
                    <textarea 
                      className="w-full bg-[#1e1e1e] border border-[#323232] rounded-lg p-4 text-sm outline-none focus:border-[#00a3ff] h-32 resize-none"
                      placeholder="e.g. A futuristic cyberpunk city with neon lights and flying cars..."
                      value={genPrompt}
                      onChange={(e) => setGenPrompt(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setShowGenModal(false)}
                        className="px-4 py-2 text-xs font-medium hover:bg-[#323232] rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => applyAITool('generate')}
                        disabled={!genPrompt || isProcessing}
                        className="bg-[#00a3ff] text-white px-6 py-2 rounded-md text-xs font-bold hover:bg-[#0082cc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : <Sparkles className="w-3 h-3" />}
                        Generate Image
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Right Sidebar - Panels */}
        <aside className="w-64 bg-[#252525] border-l border-[#323232] flex flex-col">
          {/* Properties Panel */}
          <div className="flex-1 flex flex-col border-b border-[#323232]">
            <div className="h-8 bg-[#323232] flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Properties
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {selectedId ? (
                <div className="space-y-6">
                  {currentProject?.layers.find(l => l.id === selectedId)?.type === 'text' && (
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1 uppercase">Text Content</label>
                      <textarea 
                        className="w-full bg-[#1e1e1e] border border-[#323232] rounded px-2 py-1 text-xs outline-none focus:border-[#00a3ff] h-20"
                        value={currentProject.layers.find(l => l.id === selectedId)?.content}
                        onChange={(e) => {
                          const layers = currentProject.layers.map(l => 
                            l.id === selectedId ? { ...l, content: e.target.value } : l
                          );
                          setCurrentProject({ ...currentProject, layers });
                        }}
                      />
                    </div>
                  )}

                  {currentProject?.layers.find(l => l.id === selectedId)?.type === 'image' && selectedTool === 'filters' && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 block mb-1 uppercase">Filters</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['None', 'Grayscale', 'Sepia', 'Invert', 'Blur', 'Brighten'].map(filter => (
                          <button 
                            key={filter}
                            onClick={() => applyFilter(filter.toLowerCase())}
                            className={cn(
                              "text-[10px] py-2 rounded border transition-all",
                              currentProject.layers.find(l => l.id === selectedId)?.filter === filter.toLowerCase()
                                ? "bg-[#00a3ff] border-[#00a3ff] text-white"
                                : "bg-[#1e1e1e] border-[#323232] hover:border-zinc-500"
                            )}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1 uppercase">X Position</label>
                      <input 
                        type="number" 
                        className="w-full bg-[#1e1e1e] border border-[#323232] rounded px-2 py-1 text-xs outline-none focus:border-[#00a3ff]" 
                        value={Math.round(currentProject?.layers.find(l => l.id === selectedId)?.x || 0)} 
                        onChange={(e) => {
                          const layers = currentProject?.layers.map(l => 
                            l.id === selectedId ? { ...l, x: parseInt(e.target.value) } : l
                          );
                          if (currentProject) setCurrentProject({ ...currentProject, layers: layers || [] });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1 uppercase">Y Position</label>
                      <input 
                        type="number" 
                        className="w-full bg-[#1e1e1e] border border-[#323232] rounded px-2 py-1 text-xs outline-none focus:border-[#00a3ff]" 
                        value={Math.round(currentProject?.layers.find(l => l.id === selectedId)?.y || 0)} 
                        onChange={(e) => {
                          const layers = currentProject?.layers.map(l => 
                            l.id === selectedId ? { ...l, y: parseInt(e.target.value) } : l
                          );
                          if (currentProject) setCurrentProject({ ...currentProject, layers: layers || [] });
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-2 uppercase">Opacity</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01"
                        value={currentProject?.layers.find(l => l.id === selectedId)?.opacity || 1}
                        onChange={(e) => {
                          const layers = currentProject?.layers.map(l => 
                            l.id === selectedId ? { ...l, opacity: parseFloat(e.target.value) } : l
                          );
                          if (currentProject) setCurrentProject({ ...currentProject, layers: layers || [] });
                        }}
                        className="flex-1 accent-[#00a3ff] h-1" 
                      />
                      <span className="text-xs text-zinc-400 w-8">{Math.round((currentProject?.layers.find(l => l.id === selectedId)?.opacity || 1) * 100)}%</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-2 uppercase">Rotation</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        value={currentProject?.layers.find(l => l.id === selectedId)?.rotation || 0}
                        onChange={(e) => {
                          const layers = currentProject?.layers.map(l => 
                            l.id === selectedId ? { ...l, rotation: parseInt(e.target.value) } : l
                          );
                          if (currentProject) setCurrentProject({ ...currentProject, layers: layers || [] });
                        }}
                        className="flex-1 accent-[#00a3ff] h-1" 
                      />
                      <span className="text-xs text-zinc-400 w-8">{Math.round(currentProject?.layers.find(l => l.id === selectedId)?.rotation || 0)}Â°</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#323232]">
                    {selectedTool === 'magic-eraser' && maskLayerId && (
                      <button 
                        onClick={() => applyAITool('magic-eraser')}
                        className="w-full bg-[#00a3ff] hover:bg-[#0082cc] text-white text-xs py-2 rounded transition-colors mb-2 font-bold"
                      >
                        Remove Highlighted Object
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const layers = currentProject?.layers.map(l => 
                          l.id === selectedId ? { ...l, x: 50, y: 50, rotation: 0, opacity: 1 } : l
                        );
                        if (currentProject) setCurrentProject({ ...currentProject, layers: layers || [] });
                      }}
                      className="w-full bg-[#323232] hover:bg-[#3a3a3a] text-xs py-2 rounded transition-colors"
                    >
                      Reset Transform
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <p className="text-[10px]">Select a layer to view properties</p>
                </div>
              )}
            </div>
          </div>

          {/* Layers Panel */}
          <div className="h-[40%] flex flex-col">
            <div className="h-8 bg-[#323232] flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Layers
            </div>
            <div className="p-2 flex-1 overflow-y-auto bg-[#1e1e1e]">
              <div className="space-y-1">
                <AnimatePresence>
                  {currentProject?.layers.map((layer, index) => (
                    <motion.div
                      key={layer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedId(layer.id)}
                      className={cn(
                        "group h-10 px-2 flex items-center gap-3 cursor-pointer border transition-all",
                        selectedId === layer.id 
                          ? "bg-[#373737] border-[#00a3ff]/50" 
                          : "bg-[#252525] border-transparent hover:bg-[#2a2a2a]"
                      )}
                    >
                      <div className="w-8 h-8 bg-black/40 rounded-sm flex items-center justify-center overflow-hidden border border-[#323232]">
                        {layer.type === 'image' ? (
                          <img src={layer.src} className="w-full h-full object-cover opacity-50" />
                        ) : layer.type === 'text' ? (
                          <Type className="w-3 h-3 text-zinc-600" />
                        ) : (
                          <Brush className="w-3 h-3 text-zinc-600" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium flex-1 truncate">
                        {layer.name || (layer.type === 'image' ? `Image ${index + 1}` : layer.type === 'text' ? 'Text Layer' : 'Drawing Layer')}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const layers = currentProject.layers.filter(l => l.id !== layer.id);
                          setCurrentProject({ ...currentProject, layers });
                          if (selectedId === layer.id) setSelectedId(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {(!currentProject || currentProject.layers.length === 0) && (
                  <div className="text-center py-8 opacity-20">
                    <p className="text-[10px]">No layers</p>
                  </div>
                )}
              </div>
            </div>
            <div className="h-8 bg-[#252525] border-t border-[#323232] flex items-center justify-end px-2 gap-2">
              <button onClick={() => addLayer('text')} className="p-1 hover:bg-[#323232] rounded transition-colors"><Plus className="w-3 h-3" /></button>
              <button 
                onClick={() => {
                  if (selectedId && currentProject) {
                    const layers = currentProject.layers.filter(l => l.id !== selectedId);
                    setCurrentProject({ ...currentProject, layers });
                    setSelectedId(null);
                  }
                }}
                className="p-1 hover:bg-[#323232] rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Status Bar */}
      <footer className="h-6 bg-[#007acc] text-white flex items-center px-3 justify-between text-[10px] font-medium">
        <div className="flex items-center gap-4">
          <span>Doc: 800 x 600 px (72 ppi)</span>
          <div className="w-[1px] h-3 bg-white/20" />
          <span>Zoom: 100%</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{isProcessing ? 'Processing...' : 'Ready'}</span>
          <div className="w-[1px] h-3 bg-white/20" />
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Cloud Synced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
