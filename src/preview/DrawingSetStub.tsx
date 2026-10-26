/** Stand-in used by the preview build while the drawing engine is unfinished. */
export default function DrawingSetStub() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-gray-500 p-8 text-center">
      The drawing sheets are still being built. They'll appear here in the next preview update.
    </div>
  );
}
