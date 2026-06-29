import { useState } from 'react'

function CardsDisplay({ cards, playedCardIndices, cardPlayedThisPhase, onPlayCard, joinedPlayers, isSilenced }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const roles = ['Scientist', 'Failsafe', 'Adventist', 'Supremacist', 'Negotiator']

  const handleCardClick = (card) => {
    if (isSilenced || cardPlayedThisPhase !== null) return
    if (playedCardIndices.includes(card.id)) return

    // If a selection menu is already open, close it first
    if (selectedCard) {
      setSelectedCard(null)
      setSelectedPlayer('')
      setSelectedRole('')
      // If clicking the same card that was selected, don't proceed
      if (selectedCard.id === card.id) {
        return
      }
    }

    if (card.name === 'Silence' || card.name === 'SeizeControl') {
      setSelectedCard(card)
    } else {
      onPlayCard(card.id)
    }
  }

  const handleConfirmSilence = () => {
    if (selectedCard && selectedPlayer && selectedRole) {
      onPlayCard(selectedCard.id, selectedPlayer, selectedRole)
      setSelectedCard(null)
      setSelectedPlayer('')
      setSelectedRole('')
    }
  }

  const handleCancel = () => {
    setSelectedCard(null)
    setSelectedPlayer('')
    setSelectedRole('')
  }

  const getCardStyle = (card) => {
    let className = 'card'
    if (playedCardIndices.includes(card.id)) {
      className += ' played'
    }
    if (cardPlayedThisPhase === card.id) {
      className += ' highlighted'
    }
    return className
  }

  return (
    <div className="cards-section">
      <h2>Your Cards</h2>
      <div className="cards-list">
        {cards.map((card) => (
          <div 
            key={card.id} 
            className={getCardStyle(card)}
            onClick={() => handleCardClick(card)}
            style={{ cursor: (!isSilenced && cardPlayedThisPhase === null && !playedCardIndices.includes(card.id)) ? 'pointer' : 'default' }}
          >
            {card.name}
          </div>
        ))}
      </div>

      {selectedCard && (selectedCard.name === 'Silence' || selectedCard.name === 'SeizeControl') && (
        <div className="silence-selection">
          <h3>Target Selection for {selectedCard.name}</h3>
          <div className="selection-group">
            <label>Target Player:</label>
            <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
              <option value="">Select a player</option>
              {joinedPlayers.map((player) => (
                <option key={player} value={player}>{player}</option>
              ))}
            </select>
          </div>
          <div className="selection-group">
            <label>Target Role:</label>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="selection-buttons">
            <button className="confirm-button" onClick={handleConfirmSilence} disabled={!selectedPlayer || !selectedRole}>
              Confirm
            </button>
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardsDisplay
