function GameEndScreen({ gameEndData, onPlayAgain }) {
  return (
    <div className="game-container">
      <h1>Game Over</h1>
      {gameEndData.nuked && 
        <p>The {gameEndData.alienAlignment.toLowerCase()} aliens were nuked.</p>
      }
      {!gameEndData.nuked && 
        <p>The {gameEndData.alienAlignment.toLowerCase()} aliens were allowed to land.</p>
      }
      <h2>Winners:</h2>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {gameEndData.winners.map((winner, i) => (
          <span key={i} style={{ padding: '10px', background: '#16213e', borderRadius: '8px' }}>{winner}</span>
        ))}
      </div>
      {gameEndData.roleList && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2>Role List:</h2>
          <ul>
            {Array.from(gameEndData.roleList.entries()).map(([name, role], i) => (
              <li key={i}>{name}: {role}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ maxWidth: '400px', margin: '30px auto 0' }}>
        <button className="play-again-button" onClick={onPlayAgain} style={{ width: '100%' }}>
          Play Again
        </button>
      </div>
    </div>
  )
}

export default GameEndScreen
