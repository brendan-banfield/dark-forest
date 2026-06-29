function GameHeader({ playerName, role, failsafePressed, alienAlignment, isSilenced }) {
  return (
    <div className="game-header">
      <h1>Alien&nbsp;Game</h1>
      <p>Player: {playerName}</p>
      <p>Role: {role || 'Waiting...'}</p>
      <p>Alien Alignment: {alienAlignment}</p>
      {isSilenced && <p className="silenced-warning">SILENCED - Cannot play cards or vote</p>}
      {failsafePressed && <p className="failsafe-warning">FAILSAFE PRESSED</p>}
    </div>
  )
}

export default GameHeader
