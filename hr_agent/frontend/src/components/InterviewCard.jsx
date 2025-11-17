const InterviewCard = ({ interview, onStart, isStarting, status }) => {
  const { title, description, config, active } = interview;
  const isDone = status === 'done';
  return (
    <div className="card interview-card">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {config?.job_role && <p className="muted">Role: {config.job_role}</p>}
        {config?.num_questions && <p className="muted">Questions: {config.num_questions}</p>}
        {isDone && <span className="status active">Done</span>}
      </div>
      <div className="card__actions">
        <button
          disabled={!active || isStarting || isDone}
          onClick={() => onStart(interview)}
        >
          {isDone ? 'Completed' : isStarting ? 'Starting...' : 'Start Interview'}
        </button>
      </div>
    </div>
  );
};

export default InterviewCard;
