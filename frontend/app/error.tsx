"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <div className="state error">
        <h2>This workspace could not be opened.</h2>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
