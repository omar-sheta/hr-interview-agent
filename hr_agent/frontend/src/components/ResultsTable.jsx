const ResultsTable = ({ results = [], onSelect }) => {
  if (!results.length) {
    return <p className="muted">No results yet.</p>;
  }

  return (
    <div className="results-table">
      <div className="results-header">
        <span>Candidate</span>
        <span>Interview</span>
        <span>Average Score</span>
        <span>Timestamp</span>
        <span></span>
      </div>
      {results.map((result) => (
        <div className="results-row" key={result.session_id || result.id}>
          <span>{result.candidate_username || result.candidate_id || 'N/A'}</span>
          <span>{result.interview_title || result.interview_id}</span>
          <span>{result.scores?.average ?? '—'}</span>
          <span>{new Date(result.timestamp).toLocaleString()}</span>
          <span>
            {onSelect && (
              <button className="ghost" onClick={() => onSelect(result)}>
                View
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ResultsTable;
