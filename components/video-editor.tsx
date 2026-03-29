"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, Download, Play, Pause, RefreshCw, Image as ImageIcon, Video, Settings2, Palette, Scissors } from "lucide-react";

export default function VideoEditor() {
  // Video State
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Trim State
  const [trim, setTrim] = useState<[number, number]>([0, 100]);

  // Transform State
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [speed, setSpeed] = useState(1.0); // 0.85 to 1.15
  const [crop, setCrop] = useState(0); // 0 to 10%
  const [zoom, setZoom] = useState(1.0); // 1.0 to 1.1

  // Color State
  const [brightness, setBrightness] = useState(0); // -1 to 1
  const [contrast, setContrast] = useState(1.0); // 0 to 2
  const [saturation, setSaturation] = useState(1.0); // 0 to 3

  // Watermark State
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
  const [watermarkImg, setWatermarkImg] = useState<HTMLImageElement | null>(null);
  const [watermarkPos, setWatermarkPos] = useState("br"); // tl, tr, bl, br
  const [watermarkOpacity, setWatermarkOpacity] = useState(1.0);
  const [watermarkScale, setWatermarkScale] = useState(0.2); // 0.1 to 0.5

  // Export State
  const [hasRights, setHasRights] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ffmpegLogs, setFfmpegLogs] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const animationRef = useRef<number | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        setExportProgress(progress * 100);
      });
      ffmpeg.on("log", ({ message }) => {
        setFfmpegLogs((prev) => prev + message + "\n");
      });
      
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpegRef.current = ffmpeg;
    };
    loadFFmpeg();
  }, []);

  // Load Watermark Image
  useEffect(() => {
    if (watermarkUrl) {
      const img = new Image();
      img.src = watermarkUrl;
      img.onload = () => setWatermarkImg(img);
    } else {
      setWatermarkImg(null);
    }
  }, [watermarkUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 500 * 1024 * 1024) {
        setErrorMessage("Kích thước file vượt quá 500MB. Trình duyệt có thể bị tràn bộ nhớ (OOM) khi xử lý.");
        return;
      }
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
      setExportUrl(null);
      setExportProgress(0);
      setFfmpegLogs("");
    }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setWatermarkFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setWatermarkUrl(url);
    }
  };

  const removeWatermark = () => {
    setWatermarkFile(null);
    setWatermarkUrl(null);
    setWatermarkImg(null);
  };

  const resetAll = () => {
    setMirrorH(false);
    setMirrorV(false);
    setSpeed(1.0);
    setCrop(0);
    setZoom(1.0);
    setBrightness(0);
    setContrast(1.0);
    setSaturation(1.0);
    setWatermarkPos("br");
    setWatermarkOpacity(1.0);
    setWatermarkScale(0.2);
    if (duration > 0) {
      setTrim([0, duration]);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Ensure we play within trim bounds
        if (videoRef.current.currentTime >= trim[1] || videoRef.current.currentTime < trim[0]) {
          videoRef.current.currentTime = trim[0];
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number | readonly number[]) => {
    const val = Array.isArray(value) ? value[0] : (value as number);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
      renderFrame();
    }
  };

  const handleTrimChange = (value: number | readonly number[]) => {
    const val = Array.isArray(value) ? value : [value as number, value as number];
    setTrim([val[0], val[1]]);
    if (videoRef.current) {
      if (currentTime < val[0]) {
        videoRef.current.currentTime = val[0];
        setCurrentTime(val[0]);
      } else if (currentTime > val[1]) {
        videoRef.current.currentTime = val[1];
        setCurrentTime(val[1]);
      }
      renderFrame();
    }
  };

  const renderFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // 1. Apply Crop & Zoom
    const cropFactor = crop / 100;
    const cropX = canvas.width * cropFactor * 0.5;
    const cropY = canvas.height * cropFactor * 0.5;
    const cropW = canvas.width * (1 - cropFactor);
    const cropH = canvas.height * (1 - cropFactor);

    // Center origin for scaling/mirroring
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply Zoom
    ctx.scale(zoom, zoom);

    // Apply Mirror
    ctx.scale(mirrorH ? -1 : 1, mirrorV ? -1 : 1);

    // 2. Apply Color Grading via CSS Filters
    // Note: FFmpeg eq brightness is additive (-1 to 1). CSS brightness is multiplier.
    // We approximate it here for preview.
    const cssBrightness = (1 + brightness) * 100;
    ctx.filter = `brightness(${cssBrightness}%) contrast(${contrast * 100}%) saturate(${saturation * 100}%)`;

    // Draw video frame
    ctx.drawImage(video, cropX, cropY, cropW, cropH, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

    // Restore context so watermark isn't affected by video transforms (zoom/mirror/color)
    ctx.restore();

    // 3. Draw Watermark
    if (watermarkImg) {
      ctx.globalAlpha = watermarkOpacity;
      
      const wmWidth = canvas.width * watermarkScale;
      const wmHeight = (watermarkImg.height / watermarkImg.width) * wmWidth;
      
      let x = 10;
      let y = 10;
      
      if (watermarkPos === "tr") {
        x = canvas.width - wmWidth - 10;
      } else if (watermarkPos === "bl") {
        y = canvas.height - wmHeight - 10;
      } else if (watermarkPos === "br") {
        x = canvas.width - wmWidth - 10;
        y = canvas.height - wmHeight - 10;
      }

      ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);
      ctx.globalAlpha = 1.0;
    }
  }, [crop, zoom, mirrorH, mirrorV, brightness, contrast, saturation, watermarkImg, watermarkOpacity, watermarkScale, watermarkPos]);

  useEffect(() => {
    const loop = () => {
      if (isPlaying && videoRef.current) {
        // Handle Trim Loop
        if (videoRef.current.currentTime >= trim[1]) {
          videoRef.current.currentTime = trim[0];
        }
        renderFrame();
        setCurrentTime(videoRef.current.currentTime);
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, trim, renderFrame]);

  // Update playback rate when speed changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Trigger render when parameters change while paused
  useEffect(() => {
    if (!isPlaying) {
      renderFrame();
    }
  }, [renderFrame, isPlaying]);

  const handleExport = async (previewOnly = false) => {
    if (!ffmpegRef.current || !file) return;
    if (!hasRights) {
      setErrorMessage("Vui lòng xác nhận bạn có quyền sử dụng nội dung này.");
      return;
    }

    setErrorMessage(null);
    setIsExporting(true);
    setExportProgress(0);
    setFfmpegLogs("");
    const ffmpeg = ffmpegRef.current;

    try {
      const inputName = "input.mp4";
      const outputName = "output.mp4";
      
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      let watermarkName = "";
      if (watermarkFile) {
        watermarkName = "watermark.png";
        await ffmpeg.writeFile(watermarkName, await fetchFile(watermarkFile));
      }

      const args = ["-i", inputName];
      
      if (watermarkFile) {
        args.push("-i", watermarkName);
      }

      // Build filter_complex
      let filterComplex = "";
      const vFilters: string[] = [];
      
      // Crop & Zoom
      if (crop > 0 || zoom !== 1.0) {
        const cropFactor = crop / 100;
        vFilters.push(`crop=iw*${1 - cropFactor}:ih*${1 - cropFactor}`);
        if (zoom !== 1.0) {
          vFilters.push(`scale=iw*${zoom}:ih*${zoom}`);
        }
      }

      // Mirror
      if (mirrorH) vFilters.push("hflip");
      if (mirrorV) vFilters.push("vflip");

      // Color
      vFilters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);

      // Speed (Video)
      if (speed !== 1.0) {
        vFilters.push(`setpts=${1 / speed}*PTS`);
      }

      const vFilterStr = vFilters.length > 0 ? vFilters.join(",") : "null";

      if (watermarkFile) {
        filterComplex += `[0:v]${vFilterStr}[v_base];`;
        // Scale watermark and apply opacity
        filterComplex += `[1:v]scale=iw*${watermarkScale}:-1,format=rgba,colorchannelmixer=aa=${watermarkOpacity}[wm];`;
        
        let overlay = "W-w-10:H-h-10"; // br
        if (watermarkPos === 'tl') overlay = "10:10";
        if (watermarkPos === 'tr') overlay = "W-w-10:10";
        if (watermarkPos === 'bl') overlay = "10:H-h-10";
        
        filterComplex += `[v_base][wm]overlay=${overlay}[vout]`;
      } else {
        filterComplex += `[0:v]${vFilterStr}[vout]`;
      }

      // Audio filter
      let hasAudioFilter = false;
      if (!muteAudio) {
        if (speed !== 1.0) {
          filterComplex += `;[0:a]atempo=${speed}[aout]`;
          hasAudioFilter = true;
        }
      }

      args.push("-filter_complex", filterComplex);
      args.push("-map", "[vout]");
      
      if (!muteAudio) {
        if (hasAudioFilter) {
          args.push("-map", "[aout]");
        } else {
          args.push("-map", "0:a?");
        }
      }

      // Trimming
      if (trim[0] > 0) {
        args.push("-ss", trim[0].toString());
      }
      
      // Calculate export duration
      let exportDuration = trim[1] - trim[0];
      if (previewOnly && exportDuration > 10) {
        exportDuration = 10;
      }
      
      if (exportDuration < duration) {
        args.push("-t", exportDuration.toString());
      }

      // Output settings: Ensure compatibility with -pix_fmt yuv420p
      args.push(
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        outputName
      );

      const ret = await ffmpeg.exec(args);
      if (ret !== 0) {
        throw new Error(`Lỗi xử lý video (Mã lỗi FFmpeg: ${ret}). Vui lòng xem Log chi tiết.`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (data.length === 0) {
        throw new Error("File xuất ra có dung lượng 0KB. Quá trình xử lý thất bại.");
      }
      const blob = new Blob([data as any], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);

    } catch (error: any) {
      console.error("Export failed:", error);
      setErrorMessage(error.message || "Đã xảy ra lỗi trong quá trình xuất video.");
      setShowLogs(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded shadow-sm flex items-center justify-between">
        <div>
          <p className="font-bold">Lưu ý bản quyền & Hiệu suất</p>
          <p className="text-sm">Chỉnh sửa không làm mất bản quyền. Xử lý file lớn (&gt;100MB) có thể gây treo trình duyệt do giới hạn bộ nhớ WebAssembly.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm flex flex-col">
          <div className="flex items-center justify-between">
            <p className="font-bold">Lỗi</p>
            <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)} className="h-8 text-red-700 hover:text-red-900 hover:bg-red-200">Đóng</Button>
          </div>
          <p className="text-sm mt-1">{errorMessage}</p>
          {ffmpegLogs && (
            <Button variant="outline" size="sm" className="mt-3 w-fit border-red-300 text-red-700 hover:bg-red-200" onClick={() => setShowLogs(!showLogs)}>
              {showLogs ? "Ẩn Log" : "Xem Log Chi Tiết"}
            </Button>
          )}
          {showLogs && ffmpegLogs && (
            <pre className="mt-2 p-3 bg-black/80 text-green-400 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono">
              {ffmpegLogs}
            </pre>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="overflow-hidden border-2">
            <CardHeader className="bg-muted/50 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Video className="w-5 h-5 mr-2" />
                Preview
              </CardTitle>
              {videoUrl && (
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setVideoUrl(null); }}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Đổi Video
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!videoUrl ? (
                <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30 border-dashed">
                  <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                  <Button onClick={() => videoInputRef.current?.click()} className="px-6 py-3 font-medium">
                    Chọn Video Để Bắt Đầu
                  </Button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <p className="text-sm text-muted-foreground mt-4">Hỗ trợ MP4, WebM (Tối đa 100MB)</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="absolute opacity-0 pointer-events-none w-0 h-0"
                      onLoadedMetadata={(e) => {
                        const dur = e.currentTarget.duration;
                        setDuration(dur);
                        setTrim([0, dur]);
                        renderFrame();
                      }}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    <canvas
                      ref={canvasRef}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4 bg-muted/50 p-3 rounded-lg border">
                    <Button variant="default" size="icon" onClick={togglePlay} className="rounded-full w-10 h-10 shrink-0">
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <div className="flex-1">
                      <Slider
                        value={[currentTime]}
                        min={trim[0]}
                        max={trim[1]}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                      />
                    </div>
                    <div className="text-sm tabular-nums font-mono text-muted-foreground shrink-0">
                      {currentTime.toFixed(1)} / {trim[1].toFixed(1)}s
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {exportUrl && (
            <Card className="bg-green-50 border-green-200 shadow-sm">
              <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
                <div className="text-green-700 font-medium text-lg">🎉 Export Thành Công!</div>
                <a href={exportUrl} download="edited-video.mp4" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-11 px-8 py-2 shadow-md">
                  <Download className="w-5 h-5 mr-2" />
                  Tải Video Về Máy
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Settings2 className="w-5 h-5 mr-2" />
                Công Cụ Chỉnh Sửa
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 text-muted-foreground">
                Reset All
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <Tabs defaultValue="video" className="h-full flex flex-col">
                <TabsList className="w-full grid grid-cols-4 rounded-none border-b bg-transparent h-12">
                  <TabsTrigger value="video" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none"><Scissors className="w-4 h-4 mr-2 hidden sm:block"/> Video</TabsTrigger>
                  <TabsTrigger value="transform" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none">Transform</TabsTrigger>
                  <TabsTrigger value="color" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none"><Palette className="w-4 h-4 mr-2 hidden sm:block"/> Color</TabsTrigger>
                  <TabsTrigger value="watermark" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none"><ImageIcon className="w-4 h-4 mr-2 hidden sm:block"/> Logo</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1 p-4">
                  <TabsContent value="video" className="space-y-6 mt-0">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-4">Cắt Video (Trim)</h4>
                        <div className="space-y-4">
                          <Slider 
                            value={trim} 
                            min={0} 
                            max={duration || 100} 
                            step={0.1} 
                            onValueChange={handleTrimChange} 
                          />
                          <div className="flex justify-between text-sm text-muted-foreground font-mono">
                            <span>{trim[0].toFixed(1)}s</span>
                            <span>{trim[1].toFixed(1)}s</span>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <Label>Tắt âm thanh (Mute)</Label>
                          <Switch checked={muteAudio} onCheckedChange={setMuteAudio} />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between mb-4">
                          <h4 className="text-sm font-medium">Tốc độ (Speed)</h4>
                          <span className="text-sm text-muted-foreground font-mono">{speed.toFixed(2)}x</span>
                        </div>
                        <Slider value={[speed]} min={0.85} max={1.15} step={0.01} onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="transform" className="space-y-6 mt-0">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Lật ngang (Mirror H)</Label>
                          <Switch checked={mirrorH} onCheckedChange={setMirrorH} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Lật dọc (Mirror V)</Label>
                          <Switch checked={mirrorV} onCheckedChange={setMirrorV} />
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label>Cắt viền (Crop)</Label>
                          <span className="text-sm text-muted-foreground">{crop}%</span>
                        </div>
                        <Slider value={[crop]} min={0} max={10} step={1} onValueChange={(v) => setCrop(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label>Phóng to (Zoom)</Label>
                          <span className="text-sm text-muted-foreground">{zoom.toFixed(2)}x</span>
                        </div>
                        <Slider value={[zoom]} min={1.0} max={1.1} step={0.01} onValueChange={(v) => setZoom(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="color" className="space-y-6 mt-0">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label>Độ sáng (Brightness)</Label>
                          <span className="text-sm text-muted-foreground">{brightness.toFixed(2)}</span>
                        </div>
                        <Slider value={[brightness]} min={-1} max={1} step={0.05} onValueChange={(v) => setBrightness(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label>Độ tương phản (Contrast)</Label>
                          <span className="text-sm text-muted-foreground">{contrast.toFixed(2)}</span>
                        </div>
                        <Slider value={[contrast]} min={0} max={2} step={0.05} onValueChange={(v) => setContrast(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label>Độ bão hòa (Saturation)</Label>
                          <span className="text-sm text-muted-foreground">{saturation.toFixed(2)}</span>
                        </div>
                        <Slider value={[saturation]} min={0} max={3} step={0.1} onValueChange={(v) => setSaturation(Array.isArray(v) ? v[0] : (v as number))} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="watermark" className="space-y-6 mt-0">
                    <div className="space-y-6">
                      {!watermarkUrl ? (
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/30">
                          <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                          <Button variant="link" onClick={() => watermarkInputRef.current?.click()} className="text-sm text-primary p-0 h-auto">
                            Tải lên Logo (PNG/JPG)
                          </Button>
                          <input
                            ref={watermarkInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleWatermarkUpload}
                          />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                            <div className="flex items-center space-x-2 overflow-hidden">
                              <img src={watermarkUrl} alt="Watermark" className="w-8 h-8 object-contain bg-black/10 rounded" />
                              <span className="text-sm truncate max-w-[150px]">{watermarkFile?.name}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={removeWatermark} className="text-destructive hover:text-destructive/90">
                              Xóa
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <Label>Vị trí</Label>
                            <Select value={watermarkPos} onValueChange={(v) => { if (v) setWatermarkPos(v); }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Chọn vị trí" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tl">Góc trên trái</SelectItem>
                                <SelectItem value="tr">Góc trên phải</SelectItem>
                                <SelectItem value="bl">Góc dưới trái</SelectItem>
                                <SelectItem value="br">Góc dưới phải</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <Label>Kích thước (Scale)</Label>
                              <span className="text-sm text-muted-foreground">{(watermarkScale * 100).toFixed(0)}%</span>
                            </div>
                            <Slider value={[watermarkScale]} min={0.05} max={0.5} step={0.01} onValueChange={(v) => setWatermarkScale(Array.isArray(v) ? v[0] : (v as number))} />
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <Label>Độ mờ (Opacity)</Label>
                              <span className="text-sm text-muted-foreground">{(watermarkOpacity * 100).toFixed(0)}%</span>
                            </div>
                            <Slider value={[watermarkOpacity]} min={0.1} max={1.0} step={0.05} onValueChange={(v) => setWatermarkOpacity(Array.isArray(v) ? v[0] : (v as number))} />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start space-x-3 bg-muted/50 p-3 rounded-md">
                <Checkbox 
                  id="rights" 
                  checked={hasRights} 
                  onCheckedChange={(c) => setHasRights(c as boolean)} 
                  className="mt-1"
                />
                <Label htmlFor="rights" className="text-sm font-normal leading-snug cursor-pointer">
                  Tôi xác nhận có quyền sử dụng nội dung này và đồng ý với điều khoản.
                </Label>
              </div>

              {isExporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-primary flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</span>
                    <span>{exportProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300" 
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => handleExport(true)} 
                  disabled={!videoUrl || isExporting || !hasRights}
                  variant="secondary"
                  className="w-full"
                >
                  Export 10s (Test)
                </Button>
                <Button 
                  onClick={() => handleExport(false)} 
                  disabled={!videoUrl || isExporting || !hasRights}
                  className="w-full"
                >
                  Export Full Video
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
