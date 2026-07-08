export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-message">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="btn btn-sm">Retry</button>}
    </div>
  );
}
