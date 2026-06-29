function VoteMode({ hasVoted, onVote }) {
  return (
    <div className="vote-section">
      <h2>Vote</h2>
      <div className="vote-buttons">
        <button 
          onClick={() => onVote('yes')} 
          disabled={hasVoted}
        >
          Yes
        </button>
        <button 
          onClick={() => onVote('no')} 
          disabled={hasVoted}
        >
          No
        </button>
      </div>
      {hasVoted && <p>Vote cast!</p>}
    </div>
  )
}

export default VoteMode
