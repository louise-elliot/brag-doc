"use client";

interface ReframeViewProps {
  original: string;
  reframed: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ReframeView({
  original,
  reframed,
  onAccept,
  onDismiss,
}: ReframeViewProps) {
  return (
    <div className="border border-purple-800 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-400 mb-2">
            Your version
          </p>
          <p className="text-gray-300">{original}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-purple-400 mb-2">
            Reframed
          </p>
          <p className="text-white">{reframed}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded hover:bg-purple-500 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 bg-gray-800 text-gray-400 text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
