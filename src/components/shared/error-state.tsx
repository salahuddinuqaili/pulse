export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
        <span className="text-warning text-2xl">!</span>
      </div>
      <h2 className="font-display text-xl text-on-surface">{title}</h2>
      <p className="text-sm text-muted font-body text-center max-w-md">{message}</p>
    </div>
  );
}
