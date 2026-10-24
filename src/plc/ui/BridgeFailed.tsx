import { firstLine } from '../deploy/sendRoutes';

/**
 * How every "Send to …" dialog ends when something fails: the bridge's plain sentence (what went wrong, what to do),
 * then the log to send to support and Open log folder (Explorer with the log selected). A message of several lines
 * (an error the bridge did not expect) shows its first line only: the rest is in the log.
 */
export default function BridgeFailed({ error, logPath, logName, showLog, testId }: {
  error: string;
  logPath: string;
  /** The log's file name, while its path is not known yet. */
  logName: string;
  /** null: an older desktop app that cannot open the folder. */
  showLog: (() => Promise<boolean>) | null | undefined;
  testId: string;
}) {
  return (
    <div role="alert" className="space-y-1 rounded border border-red-200 bg-red-50 p-3 text-red-900" data-testid={`${testId}-failed`}>
      <p>{firstLine(error)}</p>
      <p className="text-xs">Send this log to support: <span className="select-all font-mono">{logPath || logName}</span>
        {showLog && <button onClick={() => void showLog().catch(() => undefined)} data-testid={`${testId}-open-log`} className="ml-2 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100">Open log folder</button>}</p>
    </div>
  );
}
