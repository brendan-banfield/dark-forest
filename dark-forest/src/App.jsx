import { useState, useCallback } from 'react'
import './App.css'
import ConnectionScreen from './components/ConnectionScreen'
import GameHeader from './components/GameHeader'
import CardsDisplay from './components/CardsDisplay'
import VoteMode from './components/VoteMode'
import GameEndScreen from './components/GameEndScreen'
import CardsPlayedDisplay from './components/CardsPlayedDisplay'
import VoteResultsDisplay from './components/VoteResultsDisplay'

function App() {
  const [serverIp, setServerIp] = useState('localhost')
  const [playerName, setPlayerName] = useState('')
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState(null)
  
  // Game state
  const [role, setRole] = useState('')
  const [cards, setCards] = useState([]) // Array of objects: { id, name }
  const [playedCardIndices, setPlayedCardIndices] = useState([]) // Track played cards by index
  const [cardPlayedThisPhase, setCardPlayedThisPhase] = useState(null) // Track card played in current phase
  const [hasPlayedCardThisPhase, setHasPlayedCardThisPhase] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [gameMode, setGameMode] = useState('card') // 'card' or 'vote'
  const [gameEnded, setGameEnded] = useState(false)
  const [gameEndData, setGameEndData] = useState(null)
  const [failsafePressed, setFailsafePressed] = useState(false)
  const [hasFailsafe, setHasFailsafe] = useState(false) // Will depend on role
  const [joinedPlayers, setJoinedPlayers] = useState([])
  const [isReady, setIsReady] = useState(false)
  const [alienAlignment, setAlienAlignment] = useState('Unknown')
  const [cardsPlayed, setCardsPlayed] = useState([]) // Array of played cards with metadata
  const [cardSources, setCardSources] = useState([]) // Array of { player, card }
  const [isSilenced, setIsSilenced] = useState(false)
  const [voteCounts, setVoteCounts] = useState({ yes: 0, no: 0, launches: 0 })

  const parseMessage = useCallback((message) => {
    if (message.includes(':')) {
      const [type, ...payloadParts] = message.split(':')
      console.log('type', type, 'payload', payloadParts.join(':'))
      return { type, payload: payloadParts.join(':') }
    }
    console.log('type', message, 'payload', '')
    return { type: message, payload: '' }
  }, [])

  const sendMessage = useCallback((message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }, [ws])

  const connect = useCallback(() => {
    if (!playerName || !serverIp) return
    let webSocketUrl = `ws://${serverIp}`
    if (serverIp === 'localhost') {
      // port is not needed if using port forwarding for global access
      webSocketUrl = 'ws://localhost:8765'
    }
    console.log('Connecting to', webSocketUrl)
    const websocket = new WebSocket(webSocketUrl)
    
    websocket.onopen = () => {
      setConnected(true)
      setWs(websocket)
      setIsReady(false)
      websocket.send(`LookingForGame:${playerName}`)
    }
    
    websocket.onmessage = (event) => {
      const { type, payload } = parseMessage(event.data)
      
      switch (type) {
        case 'PlayerJoined':
          const playerList = payload.split(',')
          setJoinedPlayers(playerList)
          break
          
        case 'RoleGiven':
          const parts = payload.split(',')
          setRole(parts[0])
          if (parts[0] === 'Failsafe') {
            setHasFailsafe(true)
          }
          const cardNames = parts.slice(1, 5)
          setCards(cardNames.map((name, index) => ({ id: index, name })))
          // TODO: Set hasFailsafe based on role
          break
          
        case 'CardsPlayed':
          setGameMode('vote')
          setHasVoted(false)
          // Parse cards played - handle special case for Silence/SeizeControl
          const cardParts = payload.split(',')
          const parsedCards = []
          let i = 0
          while (i < cardParts.length) {
            const card = cardParts[i]
            if (card === 'Silence' || card === 'SeizeControl') {
              // Next two elements are target player and role
              if (i + 3 < cardParts.length) {
                parsedCards.push({
                  type: card,
                  targetPlayer: cardParts[i + 1],
                  targetRole: cardParts[i + 2],
                  success: cardParts[i + 3] === 'True'
                })
                // Check if current player was silenced
                if (cardParts[i + 1] === playerName && cardParts[i + 3] === 'True') {
                  setIsSilenced(true)
                }
                i += 4
              } else {
                parsedCards.push({ type: card })
                i += 1
              }
            } else {
              parsedCards.push({ type: card })
              i += 1
            }
          }
          setCardsPlayed(parsedCards)
          break
          
        case 'CardPlayStart':
          setGameMode('card')
          setHasPlayedCardThisPhase(false)
          setCardPlayedThisPhase(null)
          setCardSources([])
          break
          
        case 'VoteStart':
          setGameMode('vote')
          setHasVoted(false)
          break
          
        case 'VotesCast':
          setGameMode('card')
          const voteParts = payload.split(',')
          setVoteCounts({
            yes: parseInt(voteParts[0]) || 0,
            no: parseInt(voteParts[1]) || 0,
            launches: parseInt(voteParts[2]) || 0
          })
          break
          
        case 'CardSources':
          // Parse card sources: player1,card1,player2,card2,...
          const sourceParts = payload.split(',')
          const sources = []
          for (let i = 0; i < sourceParts.length; i += 2) {
            if (i + 1 < sourceParts.length) {
              sources.push({
                player: sourceParts[i],
                card: sourceParts[i + 1]
              })
            }
          }
          setCardSources(sources)
          break
          
        case 'FailsafePressed':
          setFailsafePressed(true)
          break

        case 'AlienAlignment':
          setAlienAlignment(payload)
          break

        case 'GameEnd':
          const endParts = payload.split(':')
          const globalStatus = endParts[0].split(',');
          // roleList in endParts[2] is of the form "playerName,playerRole,player2Name,player2Role"
          const roleList = new Map();
          const roleParts = endParts[2].split(',');
          for (let i = 0; i < roleParts.length; i += 2) {
            roleList.set(roleParts[i], roleParts[i + 1]);
          }
          setGameEndData({
            nuked: globalStatus[0],
            alienAlignment: globalStatus[1],
            winners: endParts[1].split(','),
            roleList: roleList
          })
          setGameEnded(true)
          break
      }
    }
    
    websocket.onclose = () => {
      setConnected(false)
      setWs(null)
    }
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [playerName, serverIp, parseMessage, sendMessage])

  const playCard = (cardIndex, selectedPlayer = null, selectedRole = null) => {
    if (hasPlayedCardThisPhase || isSilenced) return
    setHasPlayedCardThisPhase(true)
    setCardPlayedThisPhase(cardIndex)
    const card = cards[cardIndex]
    let message = `CardPlayed:${card.name}`
    if (selectedRole) message += `,${selectedRole}`
    if (selectedPlayer) message += `,${selectedPlayer}`
    sendMessage(message)
    setPlayedCardIndices([...playedCardIndices, cardIndex])
  }

  const vote = (vote) => {
    if (isSilenced) return
    sendMessage(`Vote:${vote}`)
    setHasVoted(true)
  }

  const pressFailsafe = () => {
    sendMessage('PressFailsafe')
  }

  const setReady = () => {
    setIsReady(true)
    sendMessage('ReadyToStart')
  }

  const playAgain = () => {
    setGameEnded(false)
    setGameEndData(null)
    setRole('')
    setCards([])
    setPlayedCardIndices([])
    setCardPlayedThisPhase(null)
    setHasPlayedCardThisPhase(false)
    setHasVoted(false)
    setGameMode('card')
    setFailsafePressed(false)
    setHasFailsafe(false)
    setIsReady(false)
    setAlienAlignment('Unknown')
    setCardsPlayed([])
    setCardSources([])
    setIsSilenced(false)
    setVoteCounts({ yes: 0, no: 0, launches: 0 })
    // tell the server we're looking for a new game
    sendMessage(`LookingForGame:${playerName}`)
  }

  if (gameEnded) {
    return <GameEndScreen gameEndData={gameEndData} onPlayAgain={playAgain} />
  }

  if (!connected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <ConnectionScreen
          serverIp={serverIp}
          setServerIp={setServerIp}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onConnect={connect}
        />
      </div>
    )
  }

  return (
    <div className="game-container">
      <div className="game-layout">
        <div className="game-layout-left">
          {role && (
            <GameHeader
              playerName={playerName}
              role={role}
              failsafePressed={failsafePressed}
              alienAlignment={alienAlignment}
              isSilenced={isSilenced}
            />
          )}
          {gameMode === 'card' && (
            <VoteResultsDisplay voteCounts={voteCounts} />
          )}
        </div>

        <div className="game-layout-center">
          <div className="game-layout-center-content">
            {!role && (
              <div className="waiting-lobby">
                <h2>Waiting for Game</h2>
                <div className="players-list">
                  <h3>Joined Players ({joinedPlayers.length}/4+):</h3>
                  <ul>
                    {joinedPlayers.map((player, i) => (
                      <li key={i}>{player}</li>
                    ))}
                  </ul>
                </div>
                {!isReady ? (
                  <button className="ready-button" onClick={setReady}>
                    Ready
                  </button>
                ) : (
                  <p className="ready-status">Ready!</p>
                )}
              </div>
            )}

            {role && (
              <>
                <CardsDisplay 
                  cards={cards} 
                  playedCardIndices={playedCardIndices} 
                  cardPlayedThisPhase={cardPlayedThisPhase}
                  onPlayCard={playCard}
                  joinedPlayers={joinedPlayers}
                  isSilenced={isSilenced}
                />

                {hasFailsafe && !failsafePressed && (
                  <button className="failsafe-button" onClick={pressFailsafe}>
                    Press Failsafe
                  </button>
                )}

                {gameMode === 'vote' && !isSilenced && (
                  <div style={{ marginTop: '20px' }}>
                    <VoteMode hasVoted={hasVoted} onVote={vote}/>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="game-layout-right">
          {gameMode === 'vote' && (
            <CardsPlayedDisplay cardsPlayed={cardsPlayed} cardSources={cardSources} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
