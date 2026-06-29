function ConnectionScreen({ serverIp, setServerIp, playerName, setPlayerName, onConnect }) {
  return (
    <div>
      <h1>Dark Forest</h1>
      <div className="connection-form">
        <input
          type="text"
          placeholder="Server IP"
          value={serverIp}
          onChange={(e) => setServerIp(e.target.value)}
        />
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button onClick={onConnect}>Connect</button>
      </div>
    </div>
  )
}

export default ConnectionScreen
