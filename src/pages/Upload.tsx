import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { saveVideos, getVideos, getStories, saveStories } from '../lib/db';
import { Video, Story } from '../types';
import { CameraDeviceSelector } from '../components/CameraDeviceSelector';
import { 
  Upload as UploadIcon, X, Video as VideoIcon, Camera, Image as ImageIcon, 
  Users, Lock, Globe, Zap, CircleDot, Disc, Music, Type, Plus, Minus, Move
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FILTERS = [
  { name: 'Normal', class: '' },
  { name: 'Grayscale', class: 'grayscale' },
  { name: 'Sepia', class: 'sepia' },
  { name: 'Vivid', class: 'saturate-150 contrast-110' },
  { name: 'Cool', class: 'hue-rotate-90' },
  { name: 'Warm', class: 'sepia-[0.3] saturate-125' }
];

const SONGS = [
  { id: '1', name: 'Summer Vibes', artist: 'Lofi Girl', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', name: 'Drift Phonk', artist: 'KORDHELL', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', name: 'Chill Beats', artist: 'NCS', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', name: 'Glitch Mode', artist: 'Hacker Core', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

const ANIMATIONS = [
  { name: 'Pop', value: 'pop' },
  { name: 'Float', value: 'float' },
  { name: 'Glitch', value: 'glitch' },
  { name: 'Typing', value: 'typing' }
];

export function Upload() {
  const { currentUser, selectedCameraId } = useAppStore();
  const navigate = useNavigate();
  const [postTarget, setPostTarget] = useState<'feed' | 'story'>('feed');
  const [mode, setMode] = useState<'video' | 'image' | 'record' | 'screen'>('video');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [file, setFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'friends' | 'only_you'>('everyone');
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Editor States
  const [selectedMusic, setSelectedMusic] = useState<typeof SONGS[0] | null>(null);
  const [musicStartTime, setMusicStartTime] = useState(0);
  const [textOverlays, setTextOverlays] = useState<{ id: string, text: string, x: number, y: number, animation: string, fontSize: number, color: string }[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showTextControls, setShowTextControls] = useState(false);
  
  // Recording states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTextOverlay = () => {
    const newText = {
      id: `text_${Date.now()}`,
      text: 'Double tap to edit',
      x: 50,
      y: 50,
      animation: 'pop',
      fontSize: 24,
      color: '#ffffff'
    };
    setTextOverlays([...textOverlays, newText]);
    setActiveTextId(newText.id);
  };

  const updateText = (id: string, updates: Partial<typeof textOverlays[0]>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteText = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    if (activeTextId === id) setActiveTextId(null);
  };

  if (!currentUser) {
    return <div className="p-8 text-center">Please log in to create posts and stories.</div>;
  }

  // Handle switching to camera or screen
  useEffect(() => {
    if (mode === 'record' && !stream) {
      const videoConstraints = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true;
      navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
        .then(s => {
          setStream(s);
        })
        .catch(err => {
          console.warn('Camera error:', err);
          alert('Could not access camera or microphone.');
          setMode('video');
        });
    } else if (mode === 'screen' && !stream) {
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        .then(s => {
          setStream(s);
          
          s.getVideoTracks()[0].onended = () => {
            s.getTracks().forEach(track => track.stop());
            setStream(null);
            setMode('video');
          };
        })
        .catch(err => {
          console.warn('Screen recording error:', err);
          alert('Could not access screen recording.');
          setMode('video');
        });
    } else if ((mode === 'video' || mode === 'image') && stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [mode, stream]);

  useEffect(() => {
    if (stream && cameraRef.current) {
      cameraRef.current.srcObject = stream;
    }
  }, [stream, mode]);

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setFile(blob);
      setMediaType('video');
      setPreviewUrl(URL.createObjectURL(blob));
      setMode('video');
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setIsRecording(true);
    setRecordDuration(0);
    timerRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // Instant photo snap from live camera
  const snapPhoto = () => {
    if (!cameraRef.current) return;
    const video = cameraRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        setFile(blob);
        setMediaType('image');
        setPreviewUrl(URL.createObjectURL(blob));
        setMode('image');
      }
    }, 'image/jpeg', 0.95);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type.startsWith('image/')) {
      setFile(selected);
      setMediaType('image');
      setPreviewUrl(URL.createObjectURL(selected));
    } else if (selected.type.startsWith('video/')) {
      setFile(selected);
      setMediaType('video');
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      alert('Please select a valid image or video file.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    try {
      let downloadUrl = '';
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'centraltok');
        const res = await fetch('https://api.cloudinary.com/v1_1/dzpocbcl/auto/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          downloadUrl = data.secure_url;
        }
      } catch (err) {
        console.warn("Cloudinary upload failed, falling back to local processing:", err);
      }

      if (!downloadUrl) {
        downloadUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      if (!downloadUrl) {
        alert("Failed to process media file. Please try again.");
        setIsUploading(false);
        return;
      }

      const descTags = description.split(' ').filter(t => t.startsWith('#'));
      const explicitTags = hashtags.split(' ').map(t => t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`).filter(t => t !== '#');
      const parsedTags = Array.from(new Set([...descTags, ...explicitTags]));

      if (postTarget === 'story') {
        // Save as 24-Hour Story
        const stories = await getStories();
        const newStory: Story = {
          id: `story_${Date.now()}`,
          userId: currentUser.id,
          mediaUrl: downloadUrl,
          mediaType: mediaType,
          caption: description,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          visibility: visibility,
          viewers: [],
          musicId: selectedMusic?.id,
          musicStartTime: musicStartTime,
          textOverlays: textOverlays
        };
        await saveStories([newStory, ...stories]);
        navigate('/');
      } else {
        // Save as Feed Post
        const newVideo: Video = {
          id: `post_${Date.now()}`,
          userId: currentUser.id,
          videoUrl: downloadUrl, 
          description,
          tags: parsedTags,
          likes: [],
          comments: [],
          timestamp: Date.now(),
          views: 0,
          filter: filter,
          mediaType: mediaType,
          visibility: visibility,
          musicId: selectedMusic?.id,
          musicStartTime: musicStartTime,
          textOverlays: textOverlays
        };
        
        const videos = await getVideos();
        await saveVideos([newVideo, ...videos]);
        navigate('/');
      }
    } catch (error) {
      console.error("Upload failed", error);
      alert("Posting failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 overflow-y-auto hide-scrollbar pb-24">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
        
        {/* Post Destination: Feed vs Story */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Create</h1>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button
                onClick={() => setPostTarget('feed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  postTarget === 'feed' ? 'bg-pink-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                📱 Feed Post
              </button>
              <button
                onClick={() => setPostTarget('story')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  postTarget === 'story' ? 'bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Zap size={13} /> 24h Story
              </button>
            </div>
          </div>

          {/* Mode Switcher: Video, Image, Record, Screen */}
          {!file && (
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => { setMode('record'); setMediaType('video'); }}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all ${mode === 'record' ? 'bg-white dark:bg-zinc-700 shadow-sm text-pink-600 dark:text-pink-400' : 'text-zinc-500'}`}
              >
                <Camera size={15} /> Record Camera
              </button>
              <button 
                onClick={() => { setMode('image'); setMediaType('image'); }}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all ${mode === 'image' ? 'bg-white dark:bg-zinc-700 shadow-sm text-pink-600 dark:text-pink-400' : 'text-zinc-500'}`}
              >
                <ImageIcon size={15} /> Image
              </button>
              <button 
                onClick={() => { setMode('video'); setMediaType('video'); }}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all ${mode === 'video' ? 'bg-white dark:bg-zinc-700 shadow-sm text-pink-600 dark:text-pink-400' : 'text-zinc-500'}`}
              >
                <UploadIcon size={15} /> Video
              </button>
              <button 
                onClick={() => { setMode('screen'); setMediaType('video'); }}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all ${mode === 'screen' ? 'bg-white dark:bg-zinc-700 shadow-sm text-pink-600 dark:text-pink-400' : 'text-zinc-500'}`}
              >
                <VideoIcon size={15} /> Screen
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Visual Area */}
          <div className="flex-1">
            {mode === 'record' || mode === 'screen' ? (
              <div className="relative rounded-2xl overflow-hidden h-[500px] bg-black flex items-center justify-center">
                <video ref={cameraRef} autoPlay muted playsInline className={`w-full h-full object-cover ${filter}`} />
                
                {/* Recording Duration Indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <CircleDot size={12} /> {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </div>
                )}

                {/* Shutter controls: Record Video and Snap Photo */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-10">
                  {/* Snap Photo Button */}
                  {!isRecording && (
                    <button 
                      onClick={snapPhoto} 
                      className="p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all flex flex-col items-center gap-1"
                      title="Snap Instant Photo"
                    >
                      <Camera size={22} />
                      <span className="text-[10px] font-bold">Photo</span>
                    </button>
                  )}

                  {/* Record Video Button */}
                  {isRecording ? (
                    <button 
                      onClick={stopRecording} 
                      className="w-16 h-16 bg-red-600 rounded-2xl animate-pulse border-4 border-white shadow-2xl flex items-center justify-center text-white"
                      title="Stop Recording"
                    >
                      <Disc size={28} />
                    </button>
                  ) : (
                    <button 
                      onClick={startRecording} 
                      className="w-16 h-16 bg-red-500 rounded-full border-4 border-white shadow-2xl hover:scale-105 transition-transform flex items-center justify-center text-white"
                      title="Start Recording Video"
                    >
                      <CircleDot size={28} />
                    </button>
                  )}
                </div>
              </div>
            ) : !file ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-zinc-800 rounded-2xl h-[500px] flex flex-col items-center justify-center cursor-pointer transition-colors p-6"
              >
                {mode === 'image' ? (
                  <>
                    <ImageIcon size={48} className="text-zinc-400 mb-4" />
                    <p className="font-bold text-lg mb-2">Select image or photo</p>
                    <p className="text-zinc-500 text-sm mb-6 text-center">PNG, JPG, JPEG, WEBP or GIF<br/>High resolution supported</p>
                    <button className="bg-pink-600 text-white px-8 py-2.5 rounded-lg font-semibold">Select image</button>
                  </>
                ) : (
                  <>
                    <UploadIcon size={48} className="text-zinc-400 mb-4" />
                    <p className="font-bold text-lg mb-2">Select video to upload</p>
                    <p className="text-zinc-500 text-sm mb-6 text-center">MP4, WebM or MOV<br/>Up to 10 minutes</p>
                    <button className="bg-pink-600 text-white px-8 py-2.5 rounded-lg font-semibold">Select video</button>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept={mode === 'image' ? "image/*" : "video/*"} 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden h-[500px] bg-black flex items-center justify-center">
                {mediaType === 'image' ? (
                  <img src={previewUrl!} alt="" className={`w-full h-full object-contain ${filter}`} />
                ) : (
                  <video src={previewUrl!} className={`w-full h-full object-contain ${filter}`} controls autoPlay loop />
                )}

                {/* Overlays Container */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <AnimatePresence>
                    {textOverlays.map((overlay) => (
                      <motion.div
                        key={overlay.id}
                        drag
                        dragMomentum={false}
                        onDragEnd={(_, info) => {
                          const target = (info as any).target;
                          const container = target?.closest('.relative.rounded-2xl.overflow-hidden') || target?.offsetParent || target?.parentElement;
                          if (container && typeof container.getBoundingClientRect === 'function') {
                            const rect = container.getBoundingClientRect();
                            const x = (info.point.x / rect.width) * 100;
                            const y = (info.point.y / rect.height) * 100;
                            updateText(overlay.id, { x, y });
                          }
                        }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1,
                          y: overlay.animation === 'float' ? [0, -10, 0] : 0,
                          x: overlay.animation === 'glitch' ? [0, -2, 2, -2, 2, 0] : 0
                        }}
                        transition={{ 
                          duration: overlay.animation === 'float' ? 2 : 0.3,
                          repeat: overlay.animation === 'float' || overlay.animation === 'glitch' ? Infinity : 0,
                          ease: "easeInOut"
                        }}
                        className="absolute pointer-events-auto cursor-move select-none"
                        style={{ 
                          left: `${overlay.x}%`, 
                          top: `${overlay.y}%`, 
                          color: overlay.color,
                          fontSize: `${overlay.fontSize}px`,
                          fontWeight: '900',
                          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                          transform: 'translate(-50%, -50%)',
                          zIndex: activeTextId === overlay.id ? 20 : 10
                        }}
                        onDoubleClick={() => {
                          const newText = prompt("Edit text:", overlay.text);
                          if (newText !== null) updateText(overlay.id, { text: newText });
                        }}
                        onClick={() => setActiveTextId(overlay.id)}
                      >
                        {overlay.text}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {selectedMusic && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto"
                    >
                      <div className="bg-black/60 backdrop-blur-md border border-white/20 p-2 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-indigo-600 rounded-lg flex items-center justify-center animate-spin-slow">
                          <Music size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase text-white/50 tracking-widest leading-none mb-1">Playing Track</p>
                          <p className="text-xs font-bold text-white truncate">{selectedMusic.name}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedMusic(null)}
                          className="p-2 hover:bg-white/10 rounded-full text-white/70"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
                   <button 
                    onClick={() => setShowMusicPicker(!showMusicPicker)}
                    className={`p-3 rounded-full backdrop-blur-md transition-all flex items-center gap-2 ${selectedMusic ? 'bg-indigo-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}
                    title="Add Music"
                  >
                    <Music size={20} />
                  </button>
                  <button 
                    onClick={addTextOverlay}
                    className="p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all flex items-center gap-2"
                    title="Add Text"
                  >
                    <Type size={20} />
                  </button>
                </div>

                <button 
                  onClick={() => { setFile(null); setPreviewUrl(null); setSelectedMusic(null); setTextOverlays([]); }}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 p-2 rounded-full backdrop-blur-sm transition-colors text-white z-10"
                  title="Remove media"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Music Picker Modal */}
            <AnimatePresence>
              {showMusicPicker && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-6 overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Music Library</h3>
                    <button onClick={() => setShowMusicPicker(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {SONGS.map(song => (
                      <button 
                        key={song.id}
                        onClick={() => { setSelectedMusic(song); setShowMusicPicker(false); }}
                        className={`p-4 rounded-2xl border text-left flex items-center gap-4 transition-all ${selectedMusic?.id === song.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500'}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedMusic?.id === song.id ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                          <Music size={20} className={selectedMusic?.id === song.id ? 'text-white' : 'text-indigo-600'} />
                        </div>
                        <div>
                          <p className="font-bold">{song.name}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${selectedMusic?.id === song.id ? 'text-white/70' : 'text-zinc-500'}`}>{song.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Text Properties Editor */}
            <AnimatePresence>
              {activeTextId && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-zinc-400">Text Properties</h4>
                    <button onClick={() => setActiveTextId(null)} className="text-zinc-400 hover:text-zinc-900"><X size={14} /></button>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Animation Style</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {ANIMATIONS.map(anim => (
                          <button 
                            key={anim.value}
                            onClick={() => updateText(activeTextId, { animation: anim.value })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${textOverlays.find(t => t.id === activeTextId)?.animation === anim.value ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                          >
                            {anim.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Size</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateText(activeTextId, { fontSize: Math.max(12, (textOverlays.find(t => t.id === activeTextId)?.fontSize || 24) - 2) })} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><Minus size={14}/></button>
                          <span className="font-bold text-sm">{textOverlays.find(t => t.id === activeTextId)?.fontSize}px</span>
                          <button onClick={() => updateText(activeTextId, { fontSize: Math.min(64, (textOverlays.find(t => t.id === activeTextId)?.fontSize || 24) + 2) })} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><Plus size={14}/></button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Actions</p>
                        <button 
                          onClick={() => deleteText(activeTextId)}
                          className="w-full py-2 bg-red-50 dark:bg-red-900/10 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-100 transition-colors"
                        >
                          Remove Text
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters Row */}
            {(mode === 'record' || mode === 'screen' || file) && (
              <div className="mt-4">
                <p className="text-sm font-semibold mb-2">Effects & Filters</p>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {FILTERS.map(f => (
                    <button 
                      key={f.name}
                      onClick={() => setFilter(f.class)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.class ? 'bg-pink-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMusic && (
              <div className="mt-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Music size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>{selectedMusic.name} - {selectedMusic.artist}</span>
                    <span>Start: {musicStartTime}s</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="30"
                    value={musicStartTime}
                    onChange={(e) => setMusicStartTime(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Drag to adjust where the song plays in your video timeline.</p>
                </div>
                <button onClick={() => setSelectedMusic(null)} className="text-zinc-400 hover:text-red-500 text-xs font-bold p-2">Remove</button>
              </div>
            )}
          </div>
          
          {/* Form Area */}
          <div className="flex-1 flex flex-col gap-5">
            <CameraDeviceSelector className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800" />
            <div>
              <label className="block font-semibold mb-2">Caption / Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 rounded-lg p-3 outline-none min-h-[100px] resize-none text-sm"
                placeholder={postTarget === 'story' ? "Add a story caption..." : "Write a caption for your post..."}
                disabled={mode === 'record' || mode === 'screen'}
              />
            </div>
            
            {postTarget === 'feed' && (
              <div>
                <label className="block font-semibold mb-2 text-sm">Hashtags</label>
                <input 
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 rounded-lg p-3 outline-none text-sm"
                  placeholder="trending comedy viral (space separated)"
                  disabled={mode === 'record' || mode === 'screen'}
                />
              </div>
            )}

            {/* Post Visibility Selector */}
            <div>
              <label className="block font-semibold mb-2 text-sm">Who can view this {postTarget === 'story' ? 'story' : 'post'}?</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('everyone')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    visibility === 'everyone' 
                      ? 'border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Globe size={14} /> Everyone
                  </div>
                  <span className="text-[10px] font-normal opacity-80">Public feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('friends')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    visibility === 'friends' 
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Users size={14} /> Friends
                  </div>
                  <span className="text-[10px] font-normal opacity-80">Mutual follows</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('only_you')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    visibility === 'only_you' 
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Lock size={14} /> Only you
                  </div>
                  <span className="text-[10px] font-normal opacity-80">Private archive</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <button 
                onClick={() => { setFile(null); setPreviewUrl(null); setDescription(''); setHashtags(''); setMode('video'); }}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 py-3 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Discard
              </button>
              <button 
                onClick={handleUpload}
                disabled={!file || isUploading || mode === 'record' || mode === 'screen'}
                className="flex-1 bg-pink-600 text-white py-3 rounded-lg font-semibold hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
              >
                {isUploading ? 'Posting...' : postTarget === 'story' ? 'Post to Story' : 'Post Video'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
