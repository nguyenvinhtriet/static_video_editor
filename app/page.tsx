import VideoEditor from "@/components/video-editor";

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Static Video Editor</h1>
        <p className="text-muted-foreground mt-2">
          Edit videos directly in your browser. No server uploads required.
        </p>
      </div>
      <VideoEditor />
    </main>
  );
}
