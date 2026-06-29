function VoteResultsDisplay({ voteCounts }) {
  if (!voteCounts || (voteCounts.yes === 0 && voteCounts.no === 0 && voteCounts.launches === 0)) {
    return null
  }

  return (
    <div className="vote-counts-section">
      <h3>Vote Results</h3>
      <div className="vote-counts">
        <div className="vote-count yes-votes">
          <span className="vote-label">Yes:</span>
          <span className="vote-number">{voteCounts.yes}</span>
        </div>
        <div className="vote-count no-votes">
          <span className="vote-label">No:</span>
          <span className="vote-number">{voteCounts.no}</span>
        </div>
        
        <div className="vote-count launches">
          <span className="vote-label">Launches:</span>
          <span className="vote-number">{voteCounts.launches}</span>
        </div>
        
      </div>
    </div>
  )
}

export default VoteResultsDisplay
