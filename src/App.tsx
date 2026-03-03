/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, History, ChevronLeft, Info, Sparkles, Search, MoreVertical, Paperclip, Smile, CheckCheck, BookOpen, QrCode, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HISTORICAL_FIGURES } from './constants';
import { HistoricalFigure, Message } from './types';
import { QRCodeSVG } from 'qrcode.react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // Check for figure lock in URL
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const lockedFigureId = urlParams.get('figure');
  const isLocked = !!lockedFigureId;

  const initialFigure = useMemo(() => {
    if (lockedFigureId) {
      return HISTORICAL_FIGURES.find(f => f.id === lockedFigureId) || null;
    }
    return null;
  }, [lockedFigureId]);

  const [selectedFigure, setSelectedFigure] = useState<HistoricalFigure | null>(initialFigure);
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('chatHistories');
    return saved ? JSON.parse(saved) : {};
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(!isLocked);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQrModal, setShowQrModal] = useState<HistoricalFigure | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMessages = selectedFigure ? (chatHistories[selectedFigure.id] || []) : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isLoading]);

  useEffect(() => {
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
  }, [chatHistories]);

  const filteredFigures = HISTORICAL_FIGURES.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || !selectedFigure || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: Date.now(),
      imageData: selectedImage?.data,
      mimeType: selectedImage?.mimeType,
    };

    const newHistory = [...currentMessages, userMessage];
    setChatHistories(prev => ({ ...prev, [selectedFigure.id]: newHistory }));
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);
    setShowEmojiPicker(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Enforce Leichte Sprache and Short responses via system instruction
      const finalInstruction = selectedFigure.systemInstruction + 
        "\n\nREGELN:\n1. Antworte in EINFACHER SPRACHE.\n2. Antworte IMMER in nur einem einzigen Absatz.\n3. Antworte EXTREM KURZ (maximal 2 Sätze).\n4. Benutze Smileys passend zu deiner Rolle.\n5. Wenn ein Bild gesendet wird, reagiere kurz darauf aus deiner historischen Sicht.\n6. Sei NICHT generisch. Gehe auf das ein, was das Kind schreibt.\n7. Merke dir den Namen des Kindes und sprich es damit an.\n8. Stelle nur eine Rückfrage, wenn es für das Gespräch sinnvoll ist.";

      const historyParts = newHistory.map(m => {
        const parts: any[] = [{ text: m.text || "Schau dir dieses Bild an." }];
        if (m.imageData && m.mimeType) {
          parts.push({
            inlineData: {
              data: m.imageData,
              mimeType: m.mimeType
            }
          });
        }
        return {
          role: m.role,
          parts
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Using recommended model
        contents: historyParts,
        config: {
          systemInstruction: finalInstruction,
        }
      });

      const modelMessage: Message = {
        role: 'model',
        text: response.text || "Entschuldigung, ich konnte keine Antwort finden.",
        timestamp: Date.now(),
      };

      setChatHistories(prev => ({ 
        ...prev, 
        [selectedFigure.id]: [...(prev[selectedFigure.id] || []), modelMessage] 
      }));
    } catch (error) {
      console.error("Error calling Gemini:", error);
      setChatHistories(prev => ({ 
        ...prev, 
        [selectedFigure.id]: [...(prev[selectedFigure.id] || []), {
          role: 'model',
          text: "Es gab einen Fehler bei der Verbindung zur Vergangenheit. Bitte versuche es erneut.",
          timestamp: Date.now(),
        }] 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const selectFigure = (figure: HistoricalFigure) => {
    if (isLocked) return;
    setSelectedFigure(figure);
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInput(prev => prev + emojiData.emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedImage({
        data: base64String,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const clearChat = () => {
    if (!selectedFigure) return;
    if (window.confirm(`Möchtest du den Chat mit ${selectedFigure.name} wirklich löschen?`)) {
      setChatHistories(prev => {
        const newHistories = { ...prev };
        delete newHistories[selectedFigure.id];
        return newHistories;
      });
    }
  };

  const generateQrUrl = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('figure', id);
    return url.toString();
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden font-sans text-[#111b21]">
      {/* Sidebar */}
      {!isLocked && (
        <aside className={cn(
          "w-full md:w-[400px] bg-white border-r border-[#d1d7db] flex flex-col transition-all duration-300",
          !showSidebar && "hidden md:flex"
        )}>
          {/* Sidebar Header */}
          <header className="h-[60px] bg-[#f0f2f5] px-4 flex items-center justify-between shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#d1d7db] flex items-center justify-center">
              <User className="text-[#54656f]" />
            </div>
            <div className="flex gap-4 text-[#54656f]">
              <History className="w-6 h-6 cursor-pointer" />
              <Sparkles className="w-6 h-6 cursor-pointer" />
              <MoreVertical className="w-6 h-6 cursor-pointer" />
            </div>
          </header>

          {/* Search */}
          <div className="p-2 shrink-0">
            <div className="relative bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5">
              <Search className="w-4 h-4 text-[#54656f] mr-4" />
              <input 
                type="text" 
                placeholder="Suchen oder neuen Chat beginnen"
                className="bg-transparent border-none outline-none text-sm w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto">
            {filteredFigures.map(figure => (
              <div 
                key={figure.id}
                className={cn(
                  "flex items-center px-3 py-3 cursor-pointer hover:bg-[#f5f6f6] transition-colors border-b border-[#f0f2f5] group",
                  selectedFigure?.id === figure.id && "bg-[#ebebeb]"
                )}
                onClick={() => selectFigure(figure)}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 mr-3">
                  <img src={figure.imageUrl} alt={figure.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-medium truncate">{figure.name}</h3>
                    <span className="text-[12px] text-[#667781]">{figure.period.split(' - ')[0]}</span>
                  </div>
                  <p className="text-sm text-[#667781] truncate">{figure.title}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQrModal(figure);
                  }}
                  className="ml-2 p-2 opacity-0 group-hover:opacity-100 hover:bg-black/5 rounded-full transition-all"
                  title="QR-Code für diese Person generieren"
                >
                  <QrCode className="w-4 h-4 text-[#54656f]" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      <main className={cn(
        "flex-1 flex flex-col bg-white relative",
        !isLocked && showSidebar && "hidden md:flex"
      )}>
        {selectedFigure ? (
          <>
            {/* Chat Header */}
            <header className="h-[60px] bg-[#f0f2f5] px-4 flex items-center justify-between border-l border-[#d1d7db] shrink-0">
              <div className="flex items-center gap-3">
                {!isLocked && (
                  <button 
                    onClick={() => setShowSidebar(true)}
                    className="md:hidden p-1 mr-1"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img src={selectedFigure.imageUrl} alt={selectedFigure.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h2 className="font-medium text-base leading-tight">{selectedFigure.name}</h2>
                  <p className="text-[13px] text-[#667781]">online • Leichte Sprache</p>
                </div>
              </div>
              <div className="flex items-center gap-5 text-[#54656f]">
                <div title="Leichte Sprache ist aktiv">
                  <BookOpen className="w-5 h-5 text-[#00a884]" />
                </div>
                <Search className="w-5 h-5 cursor-pointer hidden sm:block" />
                <button 
                  onClick={clearChat}
                  className="p-1 hover:bg-black/5 rounded-full transition-colors"
                  title="Chat löschen"
                >
                  <X className="w-5 h-5 cursor-pointer" />
                </button>
                <MoreVertical className="w-5 h-5 cursor-pointer" />
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-[#efeae2] p-4 md:p-8 space-y-2 relative">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />
              
              <div className="relative z-10 max-w-4xl mx-auto space-y-2">
                <div className="flex justify-center mb-4">
                  <span className="bg-[#ffffff] text-[#54656f] text-[12.5px] px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wide font-medium">
                    Heute
                  </span>
                </div>

                <div className="flex justify-center mb-8">
                  <div className="bg-[#fff5c4] text-[#54656f] text-[12.5px] px-4 py-2 rounded-lg shadow-sm text-center max-w-xs">
                    Dieser Chat ist in Leichter Sprache. Die Antworten sind kurz und einfach.
                  </div>
                </div>

                {currentMessages.map((msg, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "flex w-full mb-1",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] md:max-w-[65%] px-2 py-1.5 rounded-lg shadow-sm relative text-[14.2px] leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-[#d9fdd3] rounded-tr-none" 
                        : "bg-white rounded-tl-none"
                    )}>
                      {msg.imageData && (
                        <div className="mb-2 rounded-md overflow-hidden border border-black/5">
                          <img 
                            src={`data:${msg.mimeType};base64,${msg.imageData}`} 
                            alt="Uploaded content" 
                            className="max-w-full h-auto block"
                          />
                        </div>
                      )}
                      <div className="markdown-body pr-12">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
                        <span className="text-[11px] text-[#667781]">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'user' && (
                          <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start mb-1">
                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm rounded-tl-none flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Bar */}
            <footer className="bg-[#f0f2f5] px-4 py-2.5 flex flex-col shrink-0 relative">
              {selectedImage && (
                <div className="mb-2 p-2 bg-white rounded-lg shadow-sm flex items-center gap-3 w-fit relative animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-16 h-16 rounded overflow-hidden border border-black/10">
                    <img 
                      src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button 
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-50">
                  <EmojiPicker 
                    onEmojiClick={onEmojiClick} 
                    autoFocusSearch={false}
                    theme={Theme.LIGHT}
                    width={350}
                    height={400}
                  />
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex gap-4 text-[#54656f]">
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    <Smile className={cn("w-6 h-6 cursor-pointer", showEmojiPicker && "text-[#00a884]")} />
                  </button>
                  <label className="cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <Paperclip className="w-6 h-6" />
                  </label>
                </div>
                <form onSubmit={handleSendMessage} className="flex-1">
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={selectedImage ? "Bild beschreiben (optional)" : "Nachricht schreiben"}
                    className="w-full bg-white border-none outline-none rounded-lg px-4 py-2.5 text-sm"
                    disabled={isLoading}
                  />
                </form>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="text-[#54656f] disabled:opacity-50"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-l border-[#d1d7db] text-center p-8">
            <div className="w-64 h-64 mb-8 opacity-20">
              <img src="https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png" alt="WhatsApp Web" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-light text-[#41525d] mb-4">WhatsApp Web für Geschichte</h1>
            <p className="text-[#667781] text-sm max-w-md leading-relaxed">
              Wähle eine historische Persönlichkeit aus der Liste links aus, um einen Chat zu beginnen.
            </p>
            <div className="mt-auto flex items-center gap-1.5 text-[#8696a0] text-xs">
              <Sparkles className="w-3 h-3" /> Ende-zu-Ende verschlüsselt durch Zeit und Raum
            </div>
          </div>
        )}
      </main>

      {/* QR Modal */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center"
            >
              <button 
                onClick={() => setShowQrModal(null)}
                className="absolute top-4 right-4 p-2 hover:bg-black/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-xl font-bold mb-2">QR-Code für {showQrModal.name}</h2>
              <p className="text-sm text-[#667781] mb-6">
                Scanne diesen Code, um direkt mit {showQrModal.name} zu chatten. Andere Kontakte werden ausgeblendet.
              </p>
              
              <div className="bg-white p-4 rounded-xl border border-black/5 mb-6">
                <QRCodeSVG value={generateQrUrl(showQrModal.id)} size={200} />
              </div>
              
              <div className="w-full p-3 bg-[#f0f2f5] rounded-lg text-xs break-all font-mono text-[#54656f]">
                {generateQrUrl(showQrModal.id)}
              </div>
              
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generateQrUrl(showQrModal.id));
                  alert('Link kopiert!');
                }}
                className="mt-4 text-[#00a884] font-medium text-sm hover:underline"
              >
                Link kopieren
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
